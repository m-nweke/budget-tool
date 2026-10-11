import db from '../db';
import type { TenantMembership, CreateTenantMembershipDto } from '../types';

const COLUMNS = 'id, user_id, tenant_id, role, department_id';

const tenantMembershipRepository = {
  async findByUserAndTenant(userId: number, tenantId: number): Promise<TenantMembership | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM tenant_memberships WHERE user_id = ? AND tenant_id = ?`, userId, tenantId)) as TenantMembership | undefined;
  },

  async listForUser(userId: number): Promise<TenantMembership[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM tenant_memberships WHERE user_id = ?`, userId)) as
      TenantMembership[];
  },

  async create({ user_id, tenant_id, role, department_id }: CreateTenantMembershipDto): Promise<TenantMembership> {
    (await db.run('INSERT INTO tenant_memberships (user_id, tenant_id, role, department_id) VALUES (?, ?, ?, ?)', user_id, tenant_id, role, department_id));
    return (await tenantMembershipRepository.findByUserAndTenant(user_id, tenant_id)) as TenantMembership;
  },

  // Used by the team-management "assign an employee's department" route —
  // a head can reassign a member's home department without them needing
  // to re-authenticate (the department_id used for authorization is
  // re-read from this table on every request, not cached in the JWT).
  async updateDepartment(userId: number, tenantId: number, departmentId: number | null): Promise<TenantMembership> {
    (await db.run('UPDATE tenant_memberships SET department_id = ? WHERE user_id = ? AND tenant_id = ?', departmentId, userId, tenantId));
    return (await tenantMembershipRepository.findByUserAndTenant(userId, tenantId)) as TenantMembership;
  },
};

export default tenantMembershipRepository;
