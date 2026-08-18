import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import departmentAccessRepository from '../repositories/departmentAccessRepository';
import categoryRepository from '../repositories/categoryRepository';
import { hashPassword } from '../utils/password';

let tenantId: number;
let deptA: number;
let deptB: number;

async function loginAs(email: string, password = 'password123') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function createHead(name: string, email: string, ...grantedDeptIds: number[]) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: tenantId,
    role: 'department_head',
    department_id: null,
  });
  for (const deptId of grantedDeptIds) {
    departmentAccessRepository.grant(user.id, deptId);
  }
  return user;
}

async function createEmployee(name: string, email: string, departmentId: number | null) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: tenantId,
    role: 'department_employee',
    department_id: departmentId,
  });
  return user;
}

beforeEach(() => {
  db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; DELETE FROM department_access; DELETE FROM tenant_memberships; DELETE FROM users; DELETE FROM departments; DELETE FROM tenants;'
  );
  tenantId = tenantRepository.create('Acme Co', 'enterprise').id;
  deptA = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Engineering', tenantId)
    .lastInsertRowid as number;
  deptB = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Marketing', tenantId)
    .lastInsertRowid as number;
});

describe('GET /api/departments', () => {
  it('an employee sees only their home department', async () => {
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent.get('/api/departments');
    expect(res.body.map((d: { id: number }) => d.id)).toEqual([deptA]);
  });

  it('a head sees only departments they were granted, not every department', async () => {
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');

    const res = await agent.get('/api/departments');
    expect(res.body.map((d: { id: number }) => d.id)).toEqual([deptA]);
  });
});

describe('GET /api/categories scoping', () => {
  it('an employee only sees categories in their own department', async () => {
    categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId);
    categoryRepository.create({ name: 'Ads', budgeted_amount: 1000, department_id: deptB }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent.get('/api/categories');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Software');
  });
});

describe('category management is head-only', () => {
  it('an employee cannot create a category', async () => {
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent
      .post('/api/categories')
      .send({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(res.status).toBe(403);
  });

  it('a head cannot create a category in a department they have no access to', async () => {
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');

    const res = await agent
      .post('/api/categories')
      .send({ name: 'Ads', budgeted_amount: 1000, department_id: deptB });
    expect(res.status).toBe(403);
  });

  it('a head can create a category in a department they have access to', async () => {
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');

    const res = await agent
      .post('/api/categories')
      .send({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    expect(res.status).toBe(201);
  });

  it('rejects an empty name with 400, not a silent create', async () => {
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');

    const res = await agent
      .post('/api/categories')
      .send({ name: '', budgeted_amount: 500, department_id: deptA });
    expect(res.status).toBe(400);
  });

  it('rejects a missing department_id with 400, not a misleading 403', async () => {
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');

    const res = await agent.post('/api/categories').send({ name: 'Software', budgeted_amount: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/department_id/);
  });

  it('rejects an explicit null department_id with 400, not a misleading 403', async () => {
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');

    const res = await agent
      .post('/api/categories')
      .send({ name: 'Software', budgeted_amount: 500, department_id: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/department_id/);
  });
});

describe('transactions: employees can transact within their own department', () => {
  it('an employee can create a transaction in their own department', async () => {
    const category = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent
      .post('/api/transactions')
      .send({ amount: 50, date: '2026-08-01', description: 'SaaS', category_id: category.id });
    expect(res.status).toBe(201);
    expect(res.body.needs_approval).toBe(false);
    expect(res.body.approved).toBe(true);
  });

  it('an employee cannot create a transaction in a department they don\'t belong to', async () => {
    const category = categoryRepository.create({ name: 'Ads', budgeted_amount: 1000, department_id: deptB }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent
      .post('/api/transactions')
      .send({ amount: 50, date: '2026-08-01', description: 'Ads spend', category_id: category.id });
    expect(res.status).toBe(403);
  });

  it('a transaction over the category threshold is created pending, not approved', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', description: 'Big license', category_id: category.id });
    expect(res.body.needs_approval).toBe(true);
    expect(res.body.approved).toBe(false);
  });

  it('GET /api/transactions is scoped to the caller\'s accessible departments', async () => {
    const categoryA = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId);
    const categoryB = categoryRepository.create({ name: 'Ads', budgeted_amount: 1000, department_id: deptB }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    await agent.post('/api/transactions').send({ amount: 10, date: '2026-08-01', category_id: categoryA.id });

    // Seed a transaction in the other department directly (no employee
    // there to create it through the API in this test).
    db.prepare(
      'INSERT INTO transactions (amount, date, category_id, needs_approval, approved) VALUES (10, ?, ?, 0, 1)'
    ).run('2026-08-01', categoryB.id);

    const res = await agent.get('/api/transactions');
    expect(res.body).toHaveLength(1);
  });

  it('editing only the description of an approved transaction does not revert its approval', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const employeeAgent = await loginAs('evan@example.com');
    const created = await employeeAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', description: 'Big license', category_id: category.id });

    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');
    await headAgent.post(`/api/transactions/${created.body.id}/approve`);

    // Same amount, same category — only the description changes.
    const edited = await employeeAgent.put(`/api/transactions/${created.body.id}`).send({
      amount: 250,
      date: '2026-08-01',
      description: 'Big license (renewed)',
      category_id: category.id,
    });
    expect(edited.body).toMatchObject({ approved: true, needs_approval: false });

    const stillApproved = await employeeAgent.get('/api/transactions');
    const found = stillApproved.body.find((t: { id: number }) => t.id === created.body.id);
    expect(found).toMatchObject({ approved: true, needs_approval: false });
  });

  it('changing the amount of an approved transaction does re-evaluate against the threshold', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const employeeAgent = await loginAs('evan@example.com');
    const created = await employeeAgent
      .post('/api/transactions')
      .send({ amount: 50, date: '2026-08-01', description: 'Small purchase', category_id: category.id });
    expect(created.body).toMatchObject({ approved: true, needs_approval: false });

    // Amount increased past the threshold — this is a real change, so it
    // should re-trigger approval, unlike the no-op-edit case above.
    const edited = await employeeAgent.put(`/api/transactions/${created.body.id}`).send({
      amount: 250,
      date: '2026-08-01',
      description: 'Small purchase',
      category_id: category.id,
    });
    expect(edited.body).toMatchObject({ approved: false, needs_approval: true });
  });

  it('editing a rejected transaction to a lower amount goes back to pending, not straight to approved', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const employeeAgent = await loginAs('evan@example.com');
    const created = await employeeAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', description: 'Big license', category_id: category.id });

    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');
    const rejected = await headAgent.post(`/api/transactions/${created.body.id}/reject`);
    expect(rejected.body).toMatchObject({ approved: false, needs_approval: false });

    // Amount lowered back under the threshold — computeApproval alone
    // would auto-approve this, silently overturning the head's rejection
    // with no re-review. It must land back in pending instead.
    const edited = await employeeAgent.put(`/api/transactions/${created.body.id}`).send({
      amount: 50,
      date: '2026-08-01',
      description: 'Big license',
      category_id: category.id,
    });
    expect(edited.body).toMatchObject({ approved: false, needs_approval: true });
  });
});

describe('approve/reject workflow', () => {
  it('an employee cannot approve a transaction', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');
    const created = await agent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', category_id: category.id });

    const res = await agent.post(`/api/transactions/${created.body.id}/approve`);
    expect(res.status).toBe(403);
  });

  it('a head can approve a pending transaction in their department', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const employeeAgent = await loginAs('evan@example.com');
    const created = await employeeAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', category_id: category.id });

    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');

    const res = await headAgent.post(`/api/transactions/${created.body.id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ approved: true, needs_approval: false });
  });

  it('a head cannot approve a transaction outside their granted departments', async () => {
    const category = categoryRepository.create({
      name: 'Ads',
      budgeted_amount: 1000,
      department_id: deptB,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Erin', 'erin@example.com', deptB);
    const employeeAgent = await loginAs('erin@example.com');
    const created = await employeeAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', category_id: category.id });

    // Dana only has deptA, not deptB.
    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');

    const res = await headAgent.post(`/api/transactions/${created.body.id}/approve`);
    expect(res.status).toBe(403);
  });

  it('rejecting a transaction clears needs_approval without deleting it', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const employeeAgent = await loginAs('evan@example.com');
    const created = await employeeAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', category_id: category.id });

    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');

    const res = await headAgent.post(`/api/transactions/${created.body.id}/reject`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ approved: false, needs_approval: false });

    const stillThere = await headAgent.get('/api/transactions');
    expect(stillThere.body.some((t: { id: number }) => t.id === created.body.id)).toBe(true);
  });

  it('a head cannot approve their own submitted transaction', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');
    const created = await headAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', category_id: category.id });

    const res = await headAgent.post(`/api/transactions/${created.body.id}/approve`);
    expect(res.status).toBe(403);
  });

  it('a head cannot reject their own submitted transaction', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');
    const created = await headAgent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', category_id: category.id });

    const res = await headAgent.post(`/api/transactions/${created.body.id}/reject`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/transactions/:id is head-only', () => {
  it('an employee cannot delete a transaction, even one they created', async () => {
    const category = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');
    const created = await agent
      .post('/api/transactions')
      .send({ amount: 50, date: '2026-08-01', category_id: category.id });

    const res = await agent.delete(`/api/transactions/${created.body.id}`);
    expect(res.status).toBe(403);
  });

  it('a head can delete a transaction in their department', async () => {
    const category = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA }, tenantId);
    await createHead('Dana', 'dana@example.com', deptA);
    const agent = await loginAs('dana@example.com');
    const created = await agent
      .post('/api/transactions')
      .send({ amount: 50, date: '2026-08-01', category_id: category.id });

    const res = await agent.delete(`/api/transactions/${created.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe('GET /api/approvals', () => {
  it('is head-only', async () => {
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');
    const res = await agent.get('/api/approvals');
    expect(res.status).toBe(403);
  });

  it('lists only pending transactions scoped to the head\'s departments', async () => {
    const categoryA = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    }, tenantId);
    const categoryB = categoryRepository.create({
      name: 'Ads',
      budgeted_amount: 1000,
      department_id: deptB,
      approval_threshold: 100,
    }, tenantId);
    await createEmployee('Evan', 'evan@example.com', deptA);
    const evanAgent = await loginAs('evan@example.com');
    await evanAgent.post('/api/transactions').send({ amount: 250, date: '2026-08-01', category_id: categoryA.id });

    // Pending in deptB, seeded directly — no head has deptB access in this test.
    db.prepare(
      'INSERT INTO transactions (amount, date, category_id, needs_approval, approved) VALUES (250, ?, ?, 1, 0)'
    ).run('2026-08-01', categoryB.id);

    await createHead('Dana', 'dana@example.com', deptA);
    const headAgent = await loginAs('dana@example.com');

    const res = await headAgent.get('/api/approvals');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category_id).toBe(categoryA.id);
  });
});
