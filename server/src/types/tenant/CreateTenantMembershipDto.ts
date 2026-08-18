import type { MembershipRole } from './TenantMembership';

export interface CreateTenantMembershipDto {
  user_id: number;
  tenant_id: number;
  role: MembershipRole;
  department_id: number | null;
}
