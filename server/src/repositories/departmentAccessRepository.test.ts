import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import departmentAccessRepository from './departmentAccessRepository';

let userId: number;
let deptA: number;
let deptB: number;
let deptC: number;

beforeEach(() => {
  db.exec('DELETE FROM department_access; DELETE FROM users; DELETE FROM departments; DELETE FROM tenants;');
  const tenantId = db.prepare("INSERT INTO tenants (name, type) VALUES ('Acme Co', 'enterprise')").run()
    .lastInsertRowid as number;
  deptA = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Engineering', tenantId)
    .lastInsertRowid as number;
  deptB = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Marketing', tenantId)
    .lastInsertRowid as number;
  deptC = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Sales', tenantId)
    .lastInsertRowid as number;
  userId = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Dana Head', 'dana@example.com')
    .lastInsertRowid as number;
});

describe('departmentAccessRepository', () => {
  it('a new user has zero access until granted', () => {
    expect(departmentAccessRepository.listForUser(userId)).toEqual([]);
  });

  it('grant adds a department to the user\'s accessible list', () => {
    departmentAccessRepository.grant(userId, deptA);
    expect(departmentAccessRepository.listForUser(userId)).toEqual([deptA]);
  });

  it('a head can be granted multiple (but not all) departments — the "c-suite" case', () => {
    departmentAccessRepository.grant(userId, deptA);
    departmentAccessRepository.grant(userId, deptB);
    // deptC deliberately not granted.
    const access = departmentAccessRepository.listForUser(userId);
    expect(access.sort()).toEqual([deptA, deptB].sort());
    expect(access).not.toContain(deptC);
  });

  it('granting the same department twice is a no-op, not an error', () => {
    departmentAccessRepository.grant(userId, deptA);
    expect(() => departmentAccessRepository.grant(userId, deptA)).not.toThrow();
    expect(departmentAccessRepository.listForUser(userId)).toEqual([deptA]);
  });

  it('revoke removes access', () => {
    departmentAccessRepository.grant(userId, deptA);
    departmentAccessRepository.grant(userId, deptB);
    departmentAccessRepository.revoke(userId, deptA);
    expect(departmentAccessRepository.listForUser(userId)).toEqual([deptB]);
  });

  it('revoking an ungranted department is a no-op, not an error', () => {
    expect(() => departmentAccessRepository.revoke(userId, deptA)).not.toThrow();
  });
});
