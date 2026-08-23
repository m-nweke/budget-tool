export type BankAccountType = 'checking' | 'savings' | 'other';

export interface BankAccount {
  id: number;
  tenant_id: number;
  name: string;
  type: BankAccountType;
  current_balance: number;
}
