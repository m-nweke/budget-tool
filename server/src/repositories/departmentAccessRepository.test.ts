import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import departmentAccessRepository from './departmentAccessRepository';

let userId: number;
let deptA: number;
let deptB: number;
let deptC: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM department_access; DELETE FROM users; DELETE FROM departments; DELETE FROM tenants;'));
  const tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')"))
    .lastInsertRowid as number;
  deptA = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Engineering', tenantId))
    .lastInsertRowid as number;
  deptB = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Marketing', tenantId))
    .lastInsertRowid as number;
  deptC = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Sales', tenantId))
    .lastInsertRowid as number;
  userId = (await db.run('INSERT INTO users (name, email) VALUES (?, ?)', 'Dana Head', 'dana@example.com'))
    .lastInsertRowid as number;
});

describe('departmentAccessRepository', () => {
  it('a new user has zero access until granted', async () => {
    (await expect((await departmentAccessRepository.listForUser(userId))).toEqual([]));
  });

  it('grant adds a department to the user\'s accessible list', async () => {
    (await departmentAccessRepository.grant(userId, deptA));
    (await expect((await departmentAccessRepository.listForUser(userId))).toEqual([deptA]));
  });

  it('a head can be granted multiple (but not all) departments — the "c-suite" case', async () => {
    (await departmentAccessRepository.grant(userId, deptA));
    (await departmentAccessRepository.grant(userId, deptB));
    // deptC deliberately not granted.
    const access = (await departmentAccessRepository.listForUser(userId));
    expect(access.sort()).toEqual([deptA, deptB].sort());
    expect(access).not.toContain(deptC);
  });

  it('granting the same department twice is a no-op, not an error', async () => {
    (await departmentAccessRepository.grant(userId, deptA));
    await expect(departmentAccessRepository.grant(userId, deptA)).resolves.toBeUndefined();
    (await expect((await departmentAccessRepository.listForUser(userId))).toEqual([deptA]));
  });

  it('revoke removes access', async () => {
    (await departmentAccessRepository.grant(userId, deptA));
    (await departmentAccessRepository.grant(userId, deptB));
    (await departmentAccessRepository.revoke(userId, deptA));
    (await expect((await departmentAccessRepository.listForUser(userId))).toEqual([deptB]));
  });

  it('revoking an ungranted department is a no-op, not an error', async () => {
    await expect(departmentAccessRepository.revoke(userId, deptA)).resolves.toBeUndefined();
  });
});
