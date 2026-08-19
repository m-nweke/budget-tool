export type AccountType = 'personal' | 'company' | 'join';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  accountType: AccountType;
  // Required (and only meaningful) when accountType is 'join'.
  joinCode?: string;
}
