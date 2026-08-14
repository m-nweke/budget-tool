export interface UpdateCategoryDto {
  name?: string;
  budgeted_amount?: number;
  department_id?: number | null;
  // omitted -> preserve existing value (NOT reset to today)
  start_on?: string;
}
