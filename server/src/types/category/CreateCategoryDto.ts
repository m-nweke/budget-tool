export interface CreateCategoryDto {
  name: string;
  budgeted_amount: number;
  department_id?: number | null;
  // omitted -> defaults to today
  start_on?: string;
}
