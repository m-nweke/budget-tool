export interface Debt {
  id: number;
  tenant_id: number;
  name: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number;
  // A matched pair — both null, or both set. While promo_expires_on hasn't
  // passed yet, promo_apr applies instead of interest_rate.
  promo_apr: number | null;
  promo_expires_on: string | null;
}
