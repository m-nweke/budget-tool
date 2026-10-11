import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import userRepository from './userRepository';
import tenantRepository from './tenantRepository';
import tenantMembershipRepository from './tenantMembershipRepository';

let userId: number;
let tenantId: number;
let otherTenantId: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM tenant_memberships; DELETE FROM departments; DELETE FROM users; DELETE FROM tenants;'));
  userId = (await userRepository.create({ name: 'Dana Head', email: 'dana@example.com', password_hash: 'hash' })).id;
  tenantId = (await tenantRepository.create('Acme Co', 'enterprise')).id;
  otherTenantId = (await tenantRepository.create("Pat's Budget", 'personal')).id;
});

describe('tenantMembershipRepository', () => {
  it('creates a membership', async () => {
    const membership = (await tenantMembershipRepository.create({
      user_id: userId,
      tenant_id: tenantId,
      role: 'department_head',
      department_id: null,
    }));
    expect(membership).toMatchObject({ user_id: userId, tenant_id: tenantId, role: 'department_head', department_id: null });
  });

  it('findByUserAndTenant finds a membership', async () => {
    (await tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'owner', department_id: null }));
    (await expect((await tenantMembershipRepository.findByUserAndTenant(userId, tenantId))).toMatchObject({ role: 'owner' }));
  });

  it('findByUserAndTenant returns undefined when there is no membership for that pair', async () => {
    (await expect((await tenantMembershipRepository.findByUserAndTenant(userId, tenantId))).toBeUndefined());
  });

  it('listForUser returns every tenant the user belongs to', async () => {
    (await tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'department_head', department_id: null }));
    (await tenantMembershipRepository.create({ user_id: userId, tenant_id: otherTenantId, role: 'owner', department_id: null }));

    const memberships = (await tenantMembershipRepository.listForUser(userId));
    expect(memberships).toHaveLength(2);
    expect(memberships.map((m) => m.tenant_id).sort()).toEqual([tenantId, otherTenantId].sort());
  });

  it('updateDepartment reassigns an employee\'s home department', async () => {
    (await tenantMembershipRepository.create({
      user_id: userId,
      tenant_id: tenantId,
      role: 'department_employee',
      department_id: null,
    }));
    const deptId = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', 'Engineering', tenantId))
      .lastInsertRowid as number;

    const updated = (await tenantMembershipRepository.updateDepartment(userId, tenantId, deptId));
    expect(updated.department_id).toBe(deptId);
  });

  it('a user cannot have two memberships in the same tenant', async () => {
    (await tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'department_head', department_id: null }));
    await expect(
      tenantMembershipRepository.create({ user_id: userId, tenant_id: tenantId, role: 'department_employee', department_id: null })
    ).rejects.toThrow();
  });
});
