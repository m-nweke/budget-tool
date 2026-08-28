import type { BankAccountType } from './BankAccount';

export interface CreateBankAccountDto {
  name: string;
  type: BankAccountType;
  current_balance?: number;
  apy?: number | null;
  institution?: string | null;
}
