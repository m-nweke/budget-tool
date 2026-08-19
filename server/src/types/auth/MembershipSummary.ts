import type { MembershipRole, TenantType } from '../tenant';

// The shape shown in a tenant picker when login resolves to more than one
// membership — enough to render a choice, not the full AuthUser (which
// requires knowing which tenant is active, the thing being chosen here).
export interface MembershipSummary {
  tenant_id: number;
  tenant_name: string;
  tenant_type: TenantType;
  role: MembershipRole;
}
