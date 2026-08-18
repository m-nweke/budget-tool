export interface Category {
  id: number;
  tenant_id: number;
  name: string;
  budgeted_amount: number;
  start_on: string;
  // Null for a personal tenant's categories — there are no departments to
  // belong to; tenant_id alone is the scoping boundary in that case.
  department_id: number | null;
  // Optional: a head can leave a category with no approval gate at all, in
  // which case every transaction against it auto-approves regardless of
  // amount.
  approval_threshold: number | null;
}
