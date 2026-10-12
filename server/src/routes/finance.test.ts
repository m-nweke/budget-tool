import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import { hashPassword } from '../utils/password';

async function member(email: string, tenantType: 'personal' | 'enterprise', role: 'owner' | 'department_head') {
  const user = await userRepository.create({ name: email, email, password_hash: await hashPassword('password123') });
  const tenant = await tenantRepository.create(`${email} budget`, tenantType);
  await tenantMembershipRepository.create({ user_id: user.id, tenant_id: tenant.id, role, department_id: null });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: 'password123' });
  return agent;
}

const checking = { name: 'Checking', type: 'checking', opening_balance_cents: 100000, opening_on: '2026-01-01', spendable: true };

describe('/api/finance', () => {
  it('requires a signed-in personal budget owner', async () => {
    expect((await request(app).get('/api/finance/bootstrap')).status).toBe(401);
    const head = await member('head@example.com', 'enterprise', 'department_head');
    const res = await head.get('/api/finance/bootstrap');
    expect(res.status).toBe(403);
  });

  it('keeps accounts and movements inside their own tenant', async () => {
    const alice = await member('alice@example.com', 'personal', 'owner');
    const bob = await member('bob@example.com', 'personal', 'owner');
    const account = (await alice.post('/api/finance/accounts').send(checking)).body as { id: number };

    const intrusion = await bob.post('/api/finance/movements').send({ date: '2026-02-01', kind: 'expense', amount_cents: 500, account_id: account.id, transfer_account_id: null, description: 'x' });
    expect(intrusion.status).toBe(400);
    expect((await bob.put(`/api/finance/accounts/${account.id}`).send(checking)).status).toBe(400);
    expect((await bob.get('/api/finance/bootstrap')).body.accounts).toEqual([]);
    expect((await alice.get('/api/finance/bootstrap')).body.accounts).toHaveLength(1);
  });

  it('applies recorded movements to balances in integer cents', async () => {
    const owner = await member('cents@example.com', 'personal', 'owner');
    const { id } = (await owner.post('/api/finance/accounts').send(checking)).body as { id: number };
    const savings = (await owner.post('/api/finance/accounts').send({ ...checking, name: 'Savings', type: 'savings', spendable: false, opening_balance_cents: 0 })).body as { id: number };
    await owner.post('/api/finance/movements').send({ date: '2026-02-01', kind: 'expense', amount_cents: 1999, account_id: id, transfer_account_id: null, description: 'Groceries' }).expect(201);
    await owner.post('/api/finance/movements').send({ date: '2026-02-02', kind: 'transfer', amount_cents: 25000, account_id: id, transfer_account_id: savings.id, description: 'Save' }).expect(201);

    const { accounts } = (await owner.get('/api/finance/bootstrap')).body as { accounts: { id: number; balance_cents: number }[] };
    expect(accounts.find(a => a.id === id)!.balance_cents).toBe(100000 - 1999 - 25000);
    expect(accounts.find(a => a.id === savings.id)!.balance_cents).toBe(25000);
  });

  it('runs what-if scenarios without changing stored data', async () => {
    const owner = await member('scenario@example.com', 'personal', 'owner');
    const { id } = (await owner.post('/api/finance/accounts').send(checking)).body as { id: number };
    await owner.put('/api/finance/settings').send({ timezone: 'America/Chicago', cushion_cents: 0, essential_allowance_cents: 0, spending_account_ids: [id] }).expect(200);
    const before = (await owner.get('/api/finance/bootstrap')).body;

    const res = await owner.post('/api/finance/forecast').send({ events: [{ date: before.as_of, account_id: id, amount_cents: -40000 }] });
    expect(res.status).toBe(200);
    expect(res.body.scenario.daily[0].balance_cents).toBe(res.body.baseline.daily[0].balance_cents - 40000);

    const after = (await owner.get('/api/finance/bootstrap')).body;
    expect(after.accounts).toEqual(before.accounts);
    expect(after.movements).toEqual(before.movements);
    expect(after.forecast).toEqual(before.forecast);
  });
});
