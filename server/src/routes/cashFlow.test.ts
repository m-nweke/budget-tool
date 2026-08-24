import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import { hashPassword } from '../utils/password';

let tenantId: number;

async function loginAsOwner(email = 'owner@example.com', password = 'password123') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function createOwner(name: string, email: string) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  const tenant = tenantRepository.create(`${name}'s Budget`, 'personal');
  tenantMembershipRepository.create({ user_id: user.id, tenant_id: tenant.id, role: 'owner', department_id: null });
  return { user, tenantId: tenant.id };
}

async function createHead(name: string, email: string) {
  const enterpriseTenant = tenantRepository.create('Corp', 'enterprise');
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: enterpriseTenant.id,
    role: 'department_head',
    department_id: null,
  });
  return user;
}

beforeEach(async () => {
  db.exec(
    'DELETE FROM paycheck_splits; DELETE FROM paychecks; DELETE FROM recurring_transactions; DELETE FROM transactions; ' +
    'DELETE FROM categories; DELETE FROM debts; DELETE FROM savings_goals; DELETE FROM bank_accounts; ' +
    'DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM departments; DELETE FROM tenants;'
  );
  const result = await createOwner('Owner', 'owner@example.com');
  tenantId = result.tenantId;
});

describe('GET /api/cash-flow', () => {
  it('returns 403 for an enterprise head', async () => {
    await createHead('Head', 'head@example.com');
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'head@example.com', password: 'password123' });
    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(403);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/cash-flow');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid months param', async () => {
    const agent = await loginAsOwner();
    const res = await agent.get('/api/cash-flow?months=0');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/months/);
  });

  it('returns 400 for months > 12', async () => {
    const agent = await loginAsOwner();
    const res = await agent.get('/api/cash-flow?months=13');
    expect(res.status).toBe(400);
  });

  it('returns baseline structure with no data', async () => {
    const agent = await loginAsOwner();
    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      end_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      accounts: [],
      events: [],
      snapshots: [{ date: expect.any(String), total_balance: 0 }],
      projected_end_balance: 0,
      total_income: 0,
      total_expenses: 0,
    });
  });

  it('defaults to 3 months when months param is omitted', async () => {
    const agent = await loginAsOwner();
    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(200);
    const start = new Date(res.body.start_date);
    const end = new Date(res.body.end_date);
    const diffMonths =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    expect(diffMonths).toBe(3);
  });

  it('respects the months query param', async () => {
    const agent = await loginAsOwner();
    const res = await agent.get('/api/cash-flow?months=6');
    expect(res.status).toBe(200);
    const start = new Date(res.body.start_date);
    const end = new Date(res.body.end_date);
    const diffMonths =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    expect(diffMonths).toBe(6);
  });

  it('includes paycheck income events and adds them to snapshots', async () => {
    const agent = await loginAsOwner();

    // Create an account for the split
    const accountRes = await agent
      .post('/api/bank-accounts')
      .send({ name: 'Checking', type: 'checking', current_balance: 1000 });
    expect(accountRes.status).toBe(201);
    const accountId = accountRes.body.id;

    // Create a monthly paycheck starting tomorrow
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const paycheckRes = await agent.post('/api/paychecks').send({
      label: 'Salary',
      amount: 3000,
      frequency: 'monthly',
      next_pay_date: tomorrowStr,
      splits: [{ bank_account_id: accountId, split_type: 'fixed', value: 3000 }],
    });
    expect(paycheckRes.status).toBe(201);

    const res = await agent.get('/api/cash-flow?months=1');
    expect(res.status).toBe(200);
    expect(res.body.total_income).toBeGreaterThan(0);
    expect(res.body.events.some((e: { type: string }) => e.type === 'paycheck')).toBe(true);
    // Balance should exceed current after the paycheck hits
    expect(res.body.projected_end_balance).toBeGreaterThan(1000);
  });

  it('includes debt payment events as negative amounts', async () => {
    const agent = await loginAsOwner();

    await agent.post('/api/debts').send({
      name: 'Car Loan',
      balance: 10000,
      interest_rate: 5.5,
      minimum_payment: 200,
      due_day: 15,
    });

    const res = await agent.get('/api/cash-flow?months=3');
    expect(res.status).toBe(200);
    expect(res.body.total_expenses).toBeGreaterThan(0);
    const debtEvents = res.body.events.filter((e: { type: string }) => e.type === 'debt_payment');
    expect(debtEvents.length).toBeGreaterThanOrEqual(1);
    expect(debtEvents[0].amount).toBe(-200);
  });

  it('includes recurring transaction events as negative amounts', async () => {
    const agent = await loginAsOwner();

    // A recurring transaction requires a category, which requires a department on an enterprise
    // tenant. On a personal tenant, categories scope by tenant_id, so create one directly.
    const categoryRes = await agent
      .post('/api/categories')
      .send({ name: 'Subscriptions', budgeted_amount: 100, start_date: '2026-01-01' });
    expect(categoryRes.status).toBe(201);

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const recurRes = await agent.post('/api/recurring-transactions').send({
      amount: 15,
      description: 'Netflix',
      category_id: categoryRes.body.id,
      start_date: tomorrowStr,
      interval: 'monthly',
    });
    expect(recurRes.status).toBe(201);

    const res = await agent.get('/api/cash-flow?months=3');
    expect(res.status).toBe(200);
    const recurEvents = res.body.events.filter(
      (e: { type: string }) => e.type === 'recurring_transaction'
    );
    expect(recurEvents.length).toBeGreaterThanOrEqual(1);
    // Recurring transactions should appear as expenses (negative)
    expect(recurEvents[0].amount).toBe(-15);
    expect(res.body.total_expenses).toBeGreaterThan(0);
  });

  it('only sees data from its own tenant', async () => {
    // Create a second owner with their own account and paycheck
    const { tenantId: otherTenantId } = await createOwner('Other', 'other@example.com');
    db.prepare('INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, ?, ?, ?)').run(
      otherTenantId, 'Other Checking', 'checking', 5000
    );

    const agent = await loginAsOwner();
    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(200);
    // Owner's accounts don't include the other tenant's account
    expect(res.body.accounts.some((a: { name: string }) => a.name === 'Other Checking')).toBe(false);
  });

  it('includes accounts with current balances', async () => {
    const agent = await loginAsOwner();
    await agent.post('/api/bank-accounts').send({ name: 'Savings', type: 'savings', current_balance: 8000 });

    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0]).toMatchObject({ name: 'Savings', type: 'savings', current_balance: 8000 });
    expect(res.body.snapshots[0].total_balance).toBe(8000);
  });
});
