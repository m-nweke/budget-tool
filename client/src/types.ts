export interface Category {
  id: number;
  name: string;
  budgeted_amount: number;
}

export interface NewCategory {
  name: string;
  budgeted_amount: number;
}

export interface Transaction {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_id: number;
}

export interface NewTransaction {
  amount: number;
  date: string;
  description?: string | null;
  category_id: number;
}

export interface DashboardRow {
  category_id: number;
  name: string;
  budgeted_amount: number;
  actual_spend: number;
  difference: number;
}
