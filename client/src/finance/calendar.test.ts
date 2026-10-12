import { describe, expect, it } from 'vitest';
import { calendarEntries, scheduledDates } from './calendar';
import { createDemo } from './demo';
import type { Commitment } from './types';
const schedule: Commitment = { key:'rent', name:'Rent', kind:'bill', amount_cents:100000, account_id:1, transfer_account_id:null, frequency:'monthly', next_date:'2028-01-31', end_date:null };
describe('finance calendar', () => {
  it('clamps month end and restores the anchor in later months', () => {
    expect(scheduledDates(schedule,'2028-02-01','2028-04-30')).toEqual(['2028-02-29','2028-03-31','2028-04-30']);
  });
  it('honors weekly, twice-monthly, stopped and ended schedules', () => {
    expect(scheduledDates({...schedule, frequency:'weekly',next_date:'2028-02-01',end_date:'2028-02-15'},'2028-02-01','2028-03-01')).toEqual(['2028-02-01','2028-02-08','2028-02-15']);
    expect(scheduledDates({...schedule,frequency:'semimonthly',next_date:'2028-02-10',pay_days:[10,25]},'2028-02-01','2028-03-31')).toEqual(['2028-02-10','2028-02-25','2028-03-10','2028-03-25']);
    expect(scheduledDates({...schedule,active:false},'2028-01-01','2028-12-31')).toEqual([]);
  });
  it('shows recorded and remaining scheduled amounts without double-counting matched payments', () => {
    const data = createDemo(); data.commitments=[schedule];
    data.movements=[{id:1, date:'2028-01-31',kind:'expense',amount_cents:35000,account_id:1,transfer_account_id:null,description:'Partial rent',commitment_key:'rent@2028-01-31'}];
    const entries=calendarEntries(data,'2028-01-01','2028-01-31');
    expect(entries.find(e=>e.status==='recorded')?.amount_cents).toBe(35000);
    expect(entries.find(e=>e.status==='scheduled')?.amount_cents).toBe(65000);
    data.movements[0]!.amount_cents=100000;
    expect(calendarEntries(data,'2028-01-01','2028-01-31').map(e=>e.status)).toEqual(['recorded']);
  });
});
