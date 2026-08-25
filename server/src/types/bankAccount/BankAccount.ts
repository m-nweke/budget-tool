export type BankAccountType = 'checking' | 'savings' | 'other';

export interface BankAccount {
  id: number;
  tenant_id: number;
  name: string;
  type: BankAccountType;
  current_balance: number;
  // Optional annual percentage yield — meaningful for a 'savings' account
  // (e.g. a HYSA), null when not tracked. Not restricted to type='savings'
  // at the schema/type level (see routes/bankAccounts.ts validation).
  apy: number | null;
}
