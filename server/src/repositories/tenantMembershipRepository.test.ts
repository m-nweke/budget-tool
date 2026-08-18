import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import userRepository from './userRepository';
import tenantRepository from './tenantRepository';
import tenantMembershipRepository from './tenantMembershipRepository';

let userId: number;
let tenantId: number;
let otherTenantId: number;

beforeEach(() => {
  db.exec('DELETE FROM tenant_memberships; DELETE FROM departments; DELETE FROM users; DELETE FROM tenants;');
  userId = userRepository.create({ name: 'Dana Head', email: 'dana@example.com', password_hash: 'hash' }).id;
  tenantId = tenantRepository.create('Acme Co', 'enterprise').id;
  otherTenantId = tenantRepository.create("Pat's Budget", 'personal').id;
});

describe('tenantMembershipRepository', () => {
  it('creates a membership', () => {
    const membership = tenantMembershipRepository.create({
      user_id: userId,
      tenant_id: tenantId,
      role: 'department_head',
      department_id: null,
    });
    expect(membership).toMatchObject({ user_id: userId, tenant_id: tenantId, role: 'department_head', department_id: null });
  });

  it('findByUserAndTenant finds a membership', () => {
    tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'owner', department_id: null });
    expect(tenantMembershipRepository.findByUserAndTenant(userId, tenantId)).toMatchObject({ role: 'owner' });
  });

  it('findByUserAndTenant returns undefined when there is no membership for that pair', () => {
    expect(tenantMembershipRepository.findByUserAndTenant(userId, tenantId)).toBeUndefined();
  });

  it('listForUser returns every tenant the user belongs to', () => {
    tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'department_head', department_id: null });
    tenantMembershipRepository.create({ user_id: userId, tenant_id: otherTenantId, role: 'owner', department_id: null });

    const memberships = tenantMembershipRepository.listForUser(userId);
    expect(memberships).toHaveLength(2);
    expect(memberships.map((m) => m.tenant_id).sort()).toEqual([tenantId, otherTenantId].sort());
  });

  it('updateDepartment reassigns an employee\'s home department', () => {
    tenantMembershipRepository.create({
      user_id: userId,
      tenant_id: tenantId,
      role: 'department_employee',
      department_id: null,
    });
    const deptId = db.prepare('INSERT INTO departments (name, tenant_id) VALUES (?, ?)').run('Engineering', tenantId)
      .lastInsertRowid as number;

    const updated = tenantMembershipRepository.updateDepartment(userId, tenantId, deptId);
    expect(updated.department_id).toBe(deptId);
  });

  it('a user cannot have two memberships in the same tenant', () => {
    tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'department_head', department_id: null });
    expect(() =>
      tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'department_employee', department_id: null })
    ).toThrow();
  });
});
