export interface Category {
  id: number;
  name: string;
  budgeted_amount: number;
  department_id: number | null;
  created_at: string;
  start_on: string;
}

export interface CreateCategoryDto {
  name: string;
  budgeted_amount: number;
  start_on?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  budgeted_amount?: number;
  start_on?: string;
}
