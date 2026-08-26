import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import { hashPassword } from '../utils/password';

let enterpriseTenantId: number;

async function loginAs(email: string, password = 'password123') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function createHead(name: string, email: string) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: enterpriseTenantId,
    role: 'department_head',
    department_id: null,
  });
  return user;
}

async function createOwner(name: string, email: string) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  const personalTenant = tenantRepository.create(`${name}'s Budget`, 'personal');
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: personalTenant.id,
    role: 'owner',
    department_id: null,
  });
  return { user, tenantId: personalTenant.id };
}

beforeEach(() => {
  db.exec(
    'DELETE FROM paycheck_splits; DELETE FROM paychecks; DELETE FROM savings_goals; ' +
      'DELETE FROM debt_payoff_settings; DELETE FROM debts; ' +
      'DELETE FROM bills; DELETE FROM bank_accounts; DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM tenants;'
  );
  enterpriseTenantId = tenantRepository.create('Acme Co', 'enterprise').id;
});

describe('GET /api/bank-accounts', () => {
  it('is owner-only — an enterprise head gets 403', async () => {
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');
    const res = await agent.get('/api/bank-accounts');
    expect(res.status).toBe(403);
  });

  it('an owner sees only their own tenant\'s accounts', async () => {
    const { tenantId } = await createOwner('Pat', 'pat@example.com');
    db.prepare('INSERT INTO bank_accounts (tenant_id, name, type) VALUES (?, ?, ?)').run(tenantId, 'Checking', 'checking');

    const otherTenant = tenantRepository.create("Alex's Budget", 'personal');
    db.prepare('INSERT INTO bank_accounts (tenant_id, name, type) VALUES (?, ?, ?)').run(otherTenant.id, 'Other Checking', 'checking');

    const agent = await loginAs('pat@example.com');
    const res = await agent.get('/api/bank-accounts');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Checking');
  });
});

describe('CRUD /api/bank-accounts', () => {
  it('an owner can create, update, and delete their own bank account', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const created = await agent.post('/api/bank-accounts').send({ name: 'Checking', type: 'checking' });
    expect(created.status).toBe(201);

    const updated = await agent
      .put(`/api/bank-accounts/${created.body.id}`)
      .send({ name: 'Main Checking', type: 'checking', current_balance: 500 });
    expect(updated.status).toBe(200);
    expect(updated.body.current_balance).toBe(500);

    const deleted = await agent.delete(`/api/bank-accounts/${created.body.id}`);
    expect(deleted.status).toBe(204);
  });

  it('rejects an invalid account type', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.post('/api/bank-accounts').send({ name: 'Checking', type: 'crypto' });
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range apy', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    for (const apy of [-1, 101]) {
      const res = await agent.post('/api/bank-accounts').send({ name: 'Savings', type: 'savings', apy });
      expect(res.status).toBe(400);
    }
  });

  it("an update with apy omitted preserves the account's existing apy", async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const created = await agent.post('/api/bank-accounts').send({ name: 'Savings', type: 'savings', apy: 4.5 });

    const updated = await agent
      .put(`/api/bank-accounts/${created.body.id}`)
      .send({ name: 'HYSA', type: 'savings' });
    expect(updated.body.apy).toBe(4.5);
  });

  it('an owner cannot update or delete another tenant\'s bank account', async () => {
    const other = tenantRepository.create("Alex's Budget", 'personal');
    const otherAccountId = db
      .prepare('INSERT INTO bank_accounts (tenant_id, name, type) VALUES (?, ?, ?)')
      .run(other.id, 'Checking', 'checking').lastInsertRowid as number;

    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const updateRes = await agent
      .put(`/api/bank-accounts/${otherAccountId}`)
      .send({ name: 'Hijacked', type: 'checking' });
    expect(updateRes.status).toBe(403);

    const deleteRes = await agent.delete(`/api/bank-accounts/${otherAccountId}`);
    expect(deleteRes.status).toBe(403);
  });

  it('cannot delete a bank account referenced by a paycheck split', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const account = await agent.post('/api/bank-accounts').send({ name: 'Checking', type: 'checking' });
    await agent.post('/api/paychecks').send({
      label: 'Job',
      amount: 2000,
      frequency: 'biweekly',
      next_pay_date: '2026-09-01',
      splits: [{ bank_account_id: account.body.id, split_type: 'fixed', value: 500 }],
    });

    const res = await agent.delete(`/api/bank-accounts/${account.body.id}`);
    expect(res.status).toBe(400);
  });
});

describe('CRUD /api/savings-goals', () => {
  it('rejects a negative saved_amount', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent
      .post('/api/savings-goals')
      .send({ name: 'Emergency Fund', target_amount: 5000, saved_amount: -1 });
    expect(res.status).toBe(400);
  });

  it('rejects a bank_account_id from another tenant', async () => {
    const other = tenantRepository.create("Alex's Budget", 'personal');
    const otherAccountId = db
      .prepare('INSERT INTO bank_accounts (tenant_id, name, type) VALUES (?, ?, ?)')
      .run(other.id, 'Checking', 'checking').lastInsertRowid as number;

    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const res = await agent
      .post('/api/savings-goals')
      .send({ name: 'Emergency Fund', target_amount: 5000, bank_account_id: otherAccountId });
    expect(res.status).toBe(400);
  });

  it('an owner can create a goal linked to their own account', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const account = await agent.post('/api/bank-accounts').send({ name: 'Savings', type: 'savings' });
    const res = await agent
      .post('/api/savings-goals')
      .send({ name: 'Emergency Fund', target_amount: 5000, bank_account_id: account.body.id });
    expect(res.status).toBe(201);
    expect(res.body.bank_account_id).toBe(account.body.id);
  });
});

describe('CRUD /api/debts', () => {
  it('is owner-only and tenant-scoped', async () => {
    await createHead('Dana', 'dana@example.com');
    const headAgent = await loginAs('dana@example.com');
    expect((await headAgent.get('/api/debts')).status).toBe(403);

    await createOwner('Pat', 'pat@example.com');
    const ownerAgent = await loginAs('pat@example.com');
    const created = await ownerAgent
      .post('/api/debts')
      .send({ name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 15 });
    expect(created.status).toBe(201);

    const res = await ownerAgent.get('/api/debts');
    expect(res.body).toHaveLength(1);
  });

  it('rejects an out-of-range due_day', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent
      .post('/api/debts')
      .send({ name: 'Credit Card', balance: 2000, interest_rate: 19.99, minimum_payment: 50, due_day: 32 });
    expect(res.status).toBe(400);
  });

  it('rejects a promo_apr with no matching promo_expires_on', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent
      .post('/api/debts')
      .send({ name: 'Promo Card', balance: 1000, interest_rate: 24.99, minimum_payment: 25, due_day: 10, promo_apr: 0 });
    expect(res.status).toBe(400);
  });

  it('accepts a matched promo_apr/promo_expires_on pair', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.post('/api/debts').send({
      name: 'Promo Card',
      balance: 1000,
      interest_rate: 24.99,
      minimum_payment: 25,
      due_day: 10,
      promo_apr: 0,
      promo_expires_on: '2027-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ promo_apr: 0, promo_expires_on: '2027-01-01' });
  });
});

describe('GET /api/debt-payoff-plan and PUT /api/debt-payoff-plan/settings', () => {
  it('is owner-only', async () => {
    await createHead('Dana', 'dana@example.com');
    const headAgent = await loginAs('dana@example.com');
    expect((await headAgent.get('/api/debt-payoff-plan')).status).toBe(403);
    expect((await headAgent.put('/api/debt-payoff-plan/settings').send({ monthly_amount: 100, strategy: 'snowball' })).status).toBe(403);
  });

  it('returns a null plan and snapshot before any debts/settings exist', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.get('/api/debt-payoff-plan');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ snapshot: null, settings: null, plan: null, avalanche_comparison: null });
  });

  it('rejects an invalid strategy', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.put('/api/debt-payoff-plan/settings').send({ monthly_amount: 100, strategy: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('rejects a negative monthly_amount', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.put('/api/debt-payoff-plan/settings').send({ monthly_amount: -50, strategy: 'snowball' });
    expect(res.status).toBe(400);
  });

  it('rejects strategy=custom with no order', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.put('/api/debt-payoff-plan/settings').send({ monthly_amount: 100, strategy: 'custom' });
    expect(res.status).toBe(400);
  });

  it('persists settings and returns the recomputed plan in the same response', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    await agent.post('/api/debts').send({ name: 'Credit Card', balance: 1000, interest_rate: 12, minimum_payment: 1000, due_day: 15 });

    const putRes = await agent.put('/api/debt-payoff-plan/settings').send({ monthly_amount: 1000, strategy: 'snowball' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.settings).toMatchObject({ monthly_amount: 1000, strategy: 'snowball' });
    expect(putRes.body.plan).not.toBeNull();

    // Confirms it's actually persisted, not just returned once.
    const getRes = await agent.get('/api/debt-payoff-plan');
    expect(getRes.body.settings).toMatchObject({ monthly_amount: 1000, strategy: 'snowball' });
  });

  it('is scoped to the caller\'s own tenant', async () => {
    await createOwner('Pat', 'pat@example.com');
    const patAgent = await loginAs('pat@example.com');
    await patAgent.post('/api/debts').send({ name: 'Pat Card', balance: 1000, interest_rate: 12, minimum_payment: 50, due_day: 1 });
    await patAgent.put('/api/debt-payoff-plan/settings').send({ monthly_amount: 200, strategy: 'snowball' });

    await createOwner('Quinn', 'quinn@example.com');
    const quinnAgent = await loginAs('quinn@example.com');
    const res = await quinnAgent.get('/api/debt-payoff-plan');
    expect(res.body).toMatchObject({ snapshot: null, settings: null });
  });
});

describe('CRUD /api/bills', () => {
  it('is owner-only and tenant-scoped', async () => {
    await createHead('Dana', 'dana@example.com');
    const headAgent = await loginAs('dana@example.com');
    expect((await headAgent.get('/api/bills')).status).toBe(403);

    await createOwner('Pat', 'pat@example.com');
    const ownerAgent = await loginAs('pat@example.com');
    const created = await ownerAgent
      .post('/api/bills')
      .send({ name: 'Rent', category: 'rent', amount: 1500, due_day: 1 });
    expect(created.status).toBe(201);

    const res = await ownerAgent.get('/api/bills');
    expect(res.body).toHaveLength(1);
  });

  it('rejects an invalid category', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.post('/api/bills').send({ name: 'Rent', category: 'mortgage', amount: 1500, due_day: 1 });
    expect(res.status).toBe(400);
  });

  it('rejects a non-positive amount', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    for (const amount of [0, -50]) {
      const res = await agent.post('/api/bills').send({ name: 'Rent', category: 'rent', amount, due_day: 1 });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a non-integer due_day', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const res = await agent.post('/api/bills').send({ name: 'Rent', category: 'rent', amount: 1500, due_day: 3.5 });
    expect(res.status).toBe(400);
  });

  it('an owner cannot update or delete another tenant\'s bill', async () => {
    const other = tenantRepository.create("Alex's Budget", 'personal');
    const otherBillId = db
      .prepare('INSERT INTO bills (tenant_id, name, category, amount, due_day) VALUES (?, ?, ?, ?, ?)')
      .run(other.id, 'Rent', 'rent', 1500, 1).lastInsertRowid as number;

    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const updateRes = await agent
      .put(`/api/bills/${otherBillId}`)
      .send({ name: 'Hijacked', category: 'rent', amount: 1, due_day: 1 });
    expect(updateRes.status).toBe(403);

    const deleteRes = await agent.delete(`/api/bills/${otherBillId}`);
    expect(deleteRes.status).toBe(403);
  });
});

describe('CRUD /api/paychecks', () => {
  it('creates a paycheck with mixed percentage/fixed splits, no full-allocation requirement', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const accountA = await agent.post('/api/bank-accounts').send({ name: 'Checking', type: 'checking' });
    const accountB = await agent.post('/api/bank-accounts').send({ name: 'Savings', type: 'savings' });

    const res = await agent.post('/api/paychecks').send({
      label: 'Job',
      amount: 2000,
      frequency: 'biweekly',
      next_pay_date: '2026-09-01',
      splits: [
        { bank_account_id: accountA.body.id, split_type: 'percentage', value: 20 },
        { bank_account_id: accountB.body.id, split_type: 'fixed', value: 300 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.splits).toHaveLength(2);
  });

  it('rejects a percentage split value over 100', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const account = await agent.post('/api/bank-accounts').send({ name: 'Checking', type: 'checking' });

    const res = await agent.post('/api/paychecks').send({
      label: 'Job',
      amount: 2000,
      frequency: 'biweekly',
      next_pay_date: '2026-09-01',
      splits: [{ bank_account_id: account.body.id, split_type: 'percentage', value: 500 }],
    });
    expect(res.status).toBe(400);
  });

  it('rejects a split whose bank_account_id belongs to another tenant', async () => {
    const other = tenantRepository.create("Alex's Budget", 'personal');
    const otherAccountId = db
      .prepare('INSERT INTO bank_accounts (tenant_id, name, type) VALUES (?, ?, ?)')
      .run(other.id, 'Checking', 'checking').lastInsertRowid as number;

    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const res = await agent.post('/api/paychecks').send({
      label: 'Job',
      amount: 2000,
      frequency: 'biweekly',
      next_pay_date: '2026-09-01',
      splits: [{ bank_account_id: otherAccountId, split_type: 'fixed', value: 300 }],
    });
    expect(res.status).toBe(400);
  });

  it('update replaces splits wholesale', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');
    const account = await agent.post('/api/bank-accounts').send({ name: 'Checking', type: 'checking' });

    const created = await agent.post('/api/paychecks').send({
      label: 'Job',
      amount: 2000,
      frequency: 'biweekly',
      next_pay_date: '2026-09-01',
      splits: [{ bank_account_id: account.body.id, split_type: 'percentage', value: 100 }],
    });

    const updated = await agent.put(`/api/paychecks/${created.body.id}`).send({
      label: 'Job',
      amount: 2200,
      frequency: 'biweekly',
      next_pay_date: '2026-09-15',
      splits: [],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.splits).toEqual([]);
  });

  it('an owner cannot update another tenant\'s paycheck', async () => {
    const other = tenantRepository.create("Alex's Budget", 'personal');
    const otherPaycheckId = db
      .prepare('INSERT INTO paychecks (tenant_id, label, amount, frequency, next_pay_date) VALUES (?, ?, ?, ?, ?)')
      .run(other.id, 'Other Job', 1000, 'weekly', '2026-09-01').lastInsertRowid as number;

    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const res = await agent.put(`/api/paychecks/${otherPaycheckId}`).send({
      label: 'Hijacked',
      amount: 1,
      frequency: 'weekly',
      next_pay_date: '2026-09-01',
      splits: [],
    });
    expect(res.status).toBe(403);
  });
});
