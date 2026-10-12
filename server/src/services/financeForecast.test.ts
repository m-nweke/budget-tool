import { describe,it,expect } from 'vitest';
import { forecast,occurrences,validDate } from './financeForecast';
import type { FinanceData } from '../types/finance';
const fixture = ():FinanceData => ({as_of:'2026-01-01',accounts:[{id:1,name:'Checking',type:'checking',opening_balance_cents:100000,opening_on:'2025-12-31',balance_cents:100000,spendable:true},{id:2,name:'Savings',type:'savings',opening_balance_cents:50000,opening_on:'2025-12-31',balance_cents:50000,spendable:false}],movements:[],commitments:[],goals:[],settings:{timezone:'America/Chicago',cushion_cents:10000,essential_allowance_cents:0,spending_account_ids:[1]},warnings:[]});
describe('financial forecast',() => {
  it('finds the lowest cash before payday and never spends payday income early',() => {
    const data=fixture();data.commitments=[{key:'rent',name:'Rent',kind:'bill',amount_cents:80000,account_id:1,frequency:'once',next_date:'2026-01-03'},{key:'pay',name:'Payday',kind:'income',amount_cents:200000,account_id:1,frequency:'once',next_date:'2026-01-05'}];
    const result=forecast(data);expect(result.safe_to_spend_cents).toBe(10000);expect(result.daily[4].balance_cents).toBe(220000);expect(result.window_end).toBe('2026-01-05');
  });
  it('actual payment replaces only the paid part of one occurrence',() => {
    const data=fixture();data.commitments=[{key:'rent',name:'Rent',kind:'bill',amount_cents:80000,account_id:1,frequency:'once',next_date:'2026-01-03'}];data.movements=[{date:'2026-01-01',kind:'expense',account_id:1,amount_cents:30000,commitment_key:'rent@2026-01-03'}];
    expect(forecast(data).daily[2].balance_cents).toBe(20000);
  });
  it('snapshot includes all movements on cutoff date exactly once',() => {
    const data=fixture();data.movements=[{date:'2025-12-31',kind:'expense',account_id:1,amount_cents:50000},{date:'2026-01-01',kind:'expense',account_id:1,amount_cents:10000}];expect(forecast(data).daily[0].balance_cents).toBe(90000);
  });
  it('selected-account transfers apply atomically without artificial shortfalls',() => {
    const data=fixture();data.accounts[1].type='checking';data.accounts[1].spendable=true;data.settings.spending_account_ids=[1,2];data.commitments=[{key:'move',name:'Move',kind:'expense',amount_cents:90000,account_id:1,transfer_account_id:2,frequency:'once',next_date:'2026-01-02'}];
    expect(forecast(data).safe_to_spend_cents).toBe(140000);expect(forecast(data).daily[1].balance_cents).toBe(150000);
  });
  it('protects linked goal reserves once, excluding savings held elsewhere',() => {
    const data=fixture();data.goals=[{id:1,name:'Trip',target_cents:50000,saved_cents:20000,account_id:1,target_date:null},{id:2,name:'Emergency',target_cents:50000,saved_cents:50000,account_id:2,target_date:null}];data.commitments=[{key:'save',name:'New savings',kind:'savings',amount_cents:10000,account_id:1,transfer_account_id:2,frequency:'once',next_date:'2026-01-04'}];expect(forecast(data).safe_to_spend_cents).toBe(60000);
  });
  it('card purchases reduce card debt; cash payment reduces checking once',() => {
    const data=fixture();data.accounts[1].type='credit_card';data.accounts[1].opening_balance_cents=-50000;data.movements=[{date:'2026-01-01',kind:'expense',amount_cents:20000,account_id:2},{date:'2026-01-01',kind:'transfer',amount_cents:10000,account_id:1,transfer_account_id:2}];const result=forecast(data);expect(result.daily[0].accounts[2]).toBe(-60000);expect(result.daily[0].balance_cents).toBe(90000);
  });
  it('missing funding and unlocated savings block any claimed safe allowance',() => {
    const data=fixture();data.commitments=[{key:'rent',name:'Rent',kind:'bill',amount_cents:80000,account_id:null,frequency:'monthly',next_date:'2026-01-03'}];expect(forecast(data).safe_to_spend_cents).toBeNull();
  });
  it('returns zero allowance with a negative headroom and preserves baseline during scenario',() => {
    const data=fixture();const original=JSON.stringify(data);const baseline=forecast(data);const scenario=forecast(data,[{date:'2026-01-02',account_id:1,amount_cents:-120000}]);expect(scenario.safe_to_spend_cents).toBe(0);expect(scenario.headroom_cents).toBe(-30000);expect(baseline.safe_to_spend_cents).toBe(90000);expect(JSON.stringify(data)).toBe(original);
  });
  it('clamps month-end without drifting the anchored day and handles leap years',() => {
    expect(occurrences('2024-01-31','monthly','2024-04-30')).toEqual(['2024-01-31','2024-02-29','2024-03-31','2024-04-30']);expect(occurrences('2024-02-29','monthly','2024-04-30',{day_of_month:31})).toEqual(['2024-02-29','2024-03-31','2024-04-30']);
    expect(occurrences('2026-01-10','semimonthly','2026-02-28',{pay_days:[10,25]})).toEqual(['2026-01-10','2026-01-25','2026-02-10','2026-02-25']);expect(validDate('2026-02-29')).toBe(false);
  });
});
