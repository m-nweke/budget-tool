import type { MembershipRole, TenantType } from '../tenant';

// The shape exposed to routes/clients: User + the active tenant_membership
// resolved by `authenticate` from the JWT's (sub, tenant_id) pair — never
// password_hash. Attached to req.user, and what GET /api/auth/me returns.
// role/department_id come from the membership row, not a static user
// column, since one login can hold a different role in each tenant.
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
  tenant_type: TenantType;
  role: MembershipRole;
  department_id: number | null;
}
