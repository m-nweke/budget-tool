export interface CreateDebtDto {
  name: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number;
  promo_apr?: number | null;
  promo_expires_on?: string | null;
}
