import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import db from '../db';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import { hashPassword } from '../utils/password';

let tenantId: number;
let deptA: number;
let deptB: number;

async function loginAs(email: string, password = 'password123') {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function createHead(name: string, email: string) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: tenantId,
    role: 'department_head',
    department_id: null,
  });
  return user;
}

async function createEmployee(name: string, email: string, departmentId: number | null, ofTenantId = tenantId) {
  const user = userRepository.create({ name, email, password_hash: await hashPassword('password123') });
  tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: ofTenantId,
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

describe('PATCH /api/team/:userId', () => {
  it('a head assigns an employee (department_id: null) to a department', async () => {
    const employee = await createEmployee('Evan', 'evan@example.com', null);
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({ department_id: deptA });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ department_id: deptA });
    const membership = tenantMembershipRepository.findByUserAndTenant(employee.id, tenantId);
    expect(membership?.department_id).toBe(deptA);
  });

  it('a head reassigns an employee from one department to another', async () => {
    const employee = await createEmployee('Evan', 'evan@example.com', deptA);
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({ department_id: deptB });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ department_id: deptB });
  });

  it('a head can unassign an employee back to department_id: null', async () => {
    const employee = await createEmployee('Evan', 'evan@example.com', deptA);
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({ department_id: null });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ department_id: null });
  });

  it('400s when department_id is omitted entirely', async () => {
    const employee = await createEmployee('Evan', 'evan@example.com', null);
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/department_id is required/);
  });

  it('404s when the target user has no membership in the head\'s tenant', async () => {
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch('/api/team/999999').send({ department_id: deptA });

    expect(res.status).toBe(404);
  });

  it("400s when the target membership isn't an employee (e.g. another head)", async () => {
    const otherHead = await createHead('Hank', 'hank@example.com');
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${otherHead.id}`).send({ department_id: deptA });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only an employee membership/);
  });

  it('400s when department_id references a department in a different tenant', async () => {
    const otherTenantId = tenantRepository.create('Globex', 'enterprise').id;
    const otherDeptId = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run(
      'Engineering',
      otherTenantId
    ).lastInsertRowid as number;
    const employee = await createEmployee('Evan', 'evan@example.com', null);
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({ department_id: otherDeptId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not reference a department in this tenant/);
  });

  it('400s when department_id references a nonexistent department', async () => {
    const employee = await createEmployee('Evan', 'evan@example.com', null);
    await createHead('Dana', 'dana@example.com');
    const agent = await loginAs('dana@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({ department_id: 999999 });

    expect(res.status).toBe(400);
  });

  it('403s when the caller is an employee, not a head', async () => {
    const target = await createEmployee('Evan', 'evan@example.com', null);
    await createEmployee('Casey', 'casey@example.com', deptA);
    const agent = await loginAs('casey@example.com');

    const res = await agent.patch(`/api/team/${target.id}`).send({ department_id: deptA });

    expect(res.status).toBe(403);
  });

  it("a head from a different tenant cannot reassign this tenant's employee", async () => {
    const employee = await createEmployee('Evan', 'evan@example.com', null);
    const otherTenantId = tenantRepository.create('Globex', 'enterprise').id;
    const outsideHeadUser = userRepository.create({
      name: 'Outside Head',
      email: 'outside@example.com',
      password_hash: await hashPassword('password123'),
    });
    tenantMembershipRepository.create({
      user_id: outsideHeadUser.id,
      tenant_id: otherTenantId,
      role: 'department_head',
      department_id: null,
    });
    const agent = await loginAs('outside@example.com');

    const res = await agent.patch(`/api/team/${employee.id}`).send({ department_id: deptA });

    expect(res.status).toBe(404);
  });
});
