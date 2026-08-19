export interface Category {
  id: number;
  tenant_id: number;
  name: string;
  budgeted_amount: number;
  start_on: string;
  // Null for a personal tenant's categories — there are no departments to
  // belong to; tenant_id alone is the scoping boundary in that case.
  department_id: number | null;
  approval_threshold: number | null;
}
