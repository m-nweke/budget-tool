// Mirrors server/src/types/user/AuthUser.ts — the shape returned by
// /api/auth/login (single-membership case), /api/auth/select-tenant, and
// /api/auth/me. Never has a password field. tenant_id/tenant_type/role
// describe the *active* tenant this session is scoped to — a login can
// hold membership in more than one tenant (see MembershipSummary), but
// req.user/AuthUser is always exactly one of them at a time.
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  tenant_id: number;
  tenant_type: 'enterprise' | 'personal';
  role: 'department_head' | 'department_employee' | 'owner';
  department_id: number | null;
}
