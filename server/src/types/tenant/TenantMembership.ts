// 'owner' only applies to a personal tenant's sole member — an enterprise
// tenant's members are always 'department_head' or 'department_employee'.
export type MembershipRole = 'department_head' | 'department_employee' | 'owner';

export interface TenantMembership {
  id: number;
  user_id: number;
  tenant_id: number;
  role: MembershipRole;
  // The employee's home department; null until a head assigns one, and
  // always null for 'owner' (personal) and for a fresh 'department_head'
  // (a head's visibility comes from department_access grants, not this).
  department_id: number | null;
}
