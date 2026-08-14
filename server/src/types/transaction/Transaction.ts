export interface Transaction {
  id: number;
  amount: number;
  date: string;
  description: string | null;
  category_id: number;
}
