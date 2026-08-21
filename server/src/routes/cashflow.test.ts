import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import bankAccountRepository from '../repositories/bankAccountRepository';
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
    'DELETE FROM paycheck_splits; DELETE FROM paychecks; DELETE FROM savings_goals; DELETE FROM debts; ' +
      'DELETE FROM bank_accounts; DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM tenants;'
  );
  enterpriseTenantId = tenantRepository.create('Acme Co', 'enterprise').id;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-19T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/cash-flow', () => {
  it('is owner-only — an enterprise head gets 403', async () => {
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');
    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(403);
  });

  it('defaults to a 14-day window from today', async () => {
    const { tenantId } = await createOwner('Pat', 'pat@example.com');
    bankAccountRepository.create({ name: 'Checking', type: 'checking', current_balance: 100 }, tenantId);
    const agent = await loginAs('pat@example.com');

    const res = await agent.get('/api/cash-flow');
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('2026-08-19');
    // Inclusive of both endpoints, so a 14-day window is today + 13 more —
    // exactly 14 dates, not 15.
    expect(res.body.to).toBe('2026-09-01');
    expect(res.body.accounts[0].starting_balance).toBe(100);
  });

  it('accepts a days query param', async () => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const res = await agent.get('/api/cash-flow?days=7');
    expect(res.status).toBe(200);
    expect(res.body.to).toBe('2026-08-25');
  });

  it('returns exactly `days` dates per account, not days + 1', async () => {
    const { tenantId } = await createOwner('Pat', 'pat@example.com');
    bankAccountRepository.create({ name: 'Checking', type: 'checking' }, tenantId);
    const agent = await loginAs('pat@example.com');

    const res = await agent.get('/api/cash-flow?days=7');
    expect(res.body.accounts[0].daily).toHaveLength(7);
  });

  it.each(['0', '-1', 'abc', '91', '3.5'])('rejects an invalid days value: %s', async (days) => {
    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const res = await agent.get(`/api/cash-flow?days=${days}`);
    expect(res.status).toBe(400);
  });

  it("an owner never sees another tenant's accounts", async () => {
    const other = tenantRepository.create("Alex's Budget", 'personal');
    bankAccountRepository.create({ name: 'Other Checking', type: 'checking', current_balance: 999 }, other.id);

    await createOwner('Pat', 'pat@example.com');
    const agent = await loginAs('pat@example.com');

    const res = await agent.get('/api/cash-flow');
    expect(res.body.accounts).toEqual([]);
  });
});
