import { describe, expect, it } from 'vitest';
import { createDemo, demoForecast } from './demo';

describe('demo forecast', () => {
  it('uses a 30-day fallback and a finite amount without scheduled income', () => {
    const data = createDemo();
    data.commitments = [];
    const result = demoForecast(data);
    expect(result.next_income_date).toBeNull();
    expect(result.window_end).toBe(result.daily[29]!.date);
    expect(Number.isFinite(result.safe_to_spend_cents)).toBe(true);
  });
  it('assesses outflows before a same-day deposit and retains month-end schedules', () => {
    const data = createDemo();
    data.as_of = '2028-01-31';
    data.commitments = [
      { key:'rent',name:'Rent',kind:'bill',amount_cents:600000,account_id:1,transfer_account_id:null,frequency:'monthly',next_date:'2028-01-31',end_date:null },
      { key:'pay',name:'Pay',kind:'income',amount_cents:325000,account_id:1,transfer_account_id:null,frequency:'once',next_date:'2028-01-31',end_date:null },
    ];
    const result = demoForecast(data);
    expect(result.next_income_date).toBe('2028-01-31');
    expect(result.headroom_cents).toBeLessThan(0);
    expect(result.daily[29]!.balance_cents).toBeLessThan(result.daily[28]!.balance_cents);
  });
});
