// Mirrors server/src/types/auth/MembershipSummary.ts — enough to render a
// tenant picker (login with >1 membership, or "switch workspace") without
// needing a full AuthUser, which requires already knowing which tenant is
// active — the thing being chosen here.
export interface MembershipSummary {
  tenant_id: number;
  tenant_name: string;
  tenant_type: 'enterprise' | 'personal';
  role: 'department_head' | 'department_employee' | 'owner';
}
