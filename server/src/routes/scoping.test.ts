import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import departmentAccessRepository from '../repositories/departmentAccessRepository';
import categoryRepository from '../repositories/categoryRepository';
import { hashPassword } from '../utils/password';

let deptA: number;
let deptB: number;

async function loginAs(email: string, password = 'password123') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function createHead(name: string, email: string, ...grantedDeptIds: number[]) {
  const user = userRepository.create({
    name,
    email,
    role: 'department_head',
    department_id: null,
    password_hash: await hashPassword('password123'),
  });
  for (const deptId of grantedDeptIds) {
    departmentAccessRepository.grant(user.id, deptId);
  }
  return user;
}

async function createEmployee(name: string, email: string, departmentId: number | null) {
  return userRepository.create({
    name,
    email,
    role: 'department_employee',
    department_id: departmentId,
    password_hash: await hashPassword('password123'),
  });
}

beforeEach(() => {
  db.exec(
    'DELETE FROM transactions; DELETE FROM recurring_transactions; DELETE FROM categories; DELETE FROM department_access; DELETE FROM users; DELETE FROM departments;'
  );
  deptA = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Engineering').lastInsertRowid as number;
  deptB = db.prepare('INSERT INTO departments (name) VALUES (?)').run('Marketing').lastInsertRowid as number;
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
    categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    categoryRepository.create({ name: 'Ads', budgeted_amount: 1000, department_id: deptB });
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
});

describe('transactions: employees can transact within their own department', () => {
  it('an employee can create a transaction in their own department', async () => {
    const category = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
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
    const category = categoryRepository.create({ name: 'Ads', budgeted_amount: 1000, department_id: deptB });
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
    });
    await createEmployee('Evan', 'evan@example.com', deptA);
    const agent = await loginAs('evan@example.com');

    const res = await agent
      .post('/api/transactions')
      .send({ amount: 250, date: '2026-08-01', description: 'Big license', category_id: category.id });
    expect(res.body.needs_approval).toBe(true);
    expect(res.body.approved).toBe(false);
  });

  it('GET /api/transactions is scoped to the caller\'s accessible departments', async () => {
    const categoryA = categoryRepository.create({ name: 'Software', budgeted_amount: 500, department_id: deptA });
    const categoryB = categoryRepository.create({ name: 'Ads', budgeted_amount: 1000, department_id: deptB });
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
});

describe('approve/reject workflow', () => {
  it('an employee cannot approve a transaction', async () => {
    const category = categoryRepository.create({
      name: 'Software',
      budgeted_amount: 500,
      department_id: deptA,
      approval_threshold: 100,
    });
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
    });
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
    });
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
    });
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
    });
    const categoryB = categoryRepository.create({
      name: 'Ads',
      budgeted_amount: 1000,
      department_id: deptB,
      approval_threshold: 100,
    });
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
