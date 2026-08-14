export interface DashboardCategory {
  id: number;
  name: string;
  budgeted_amount: number;
  spent_amount: number;
}

export interface DashboardResponse {
  from: string;
  to: string;
  categories: DashboardCategory[];
}
