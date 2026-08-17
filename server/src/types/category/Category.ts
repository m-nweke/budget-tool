export interface Category {
  id: number;
  name: string;
  budgeted_amount: number;
  start_on: string;
  department_id: number | null;
  // Optional: a head can leave a category with no approval gate at all, in
  // which case every transaction against it auto-approves regardless of
  // amount.
  approval_threshold: number | null;
}
