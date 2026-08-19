export type TenantType = 'enterprise' | 'personal';

export interface Tenant {
  id: number;
  name: string;
  type: TenantType;
  // Only set for type='enterprise' — the code a new employee enters at
  // signup to join this company instead of creating a new tenant.
  join_code: string | null;
}
