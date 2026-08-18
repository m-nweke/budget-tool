import db from '../db';
import type { TenantMembership, CreateTenantMembershipDto } from '../types';

const COLUMNS = 'id, user_id, tenant_id, role, department_id';

const tenantMembershipRepository = {
  findByUserAndTenant(userId: number, tenantId: number): TenantMembership | undefined {
    return db
      .prepare(`SELECT ${COLUMNS} FROM tenant_memberships WHERE user_id = ? AND tenant_id = ?`)
      .get(userId, tenantId) as TenantMembership | undefined;
  },

  listForUser(userId: number): TenantMembership[] {
    return db.prepare(`SELECT ${COLUMNS} FROM tenant_memberships WHERE user_id = ?`).all(userId) as
      TenantMembership[];
  },

  create({ user_id, tenant_id, role, department_id }: CreateTenantMembershipDto): TenantMembership {
    const result = db
      .prepare(
        'INSERT INTO tenant_memberships (user_id, tenant_id, role, department_id) VALUES (?, ?, ?, ?)'
      )
      .run(user_id, tenant_id, role, department_id);
    return tenantMembershipRepository.findByUserAndTenant(user_id, tenant_id) as TenantMembership;
  },

  // Used by the team-management "assign an employee's department" route —
  // a head can reassign a member's home department without them needing
  // to re-authenticate (the department_id used for authorization is
  // re-read from this table on every request, not cached in the JWT).
  updateDepartment(userId: number, tenantId: number, departmentId: number | null): TenantMembership {
    db.prepare('UPDATE tenant_memberships SET department_id = ? WHERE user_id = ? AND tenant_id = ?').run(
      departmentId,
      userId,
      tenantId
    );
    return tenantMembershipRepository.findByUserAndTenant(userId, tenantId) as TenantMembership;
  },
};

export default tenantMembershipRepository;
