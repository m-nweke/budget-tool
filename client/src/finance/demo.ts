import type { FinanceData, Forecast, SpendBreakdown } from './types';
import { scheduledDates } from './calendar';
import { localToday as sharedLocalToday } from '../utils/format';
/** The demo workspace lives in the viewer's own timezone, so "today" is their local date rather than UTC's. */
export const demoTimezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Chicago';
export const localToday=(timeZone=demoTimezone())=>sharedLocalToday(timeZone);
export function dateOffset(offset:number, base = localToday()) { const d=new Date(base+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+offset); return d.toISOString().slice(0,10) }
export function demoForecast(data:FinanceData, adjustment = 0, adjustmentDate = data.as_of):Forecast {
 const from=data.as_of,to=dateOffset(89,from),balances=Object.fromEntries(data.accounts.map(a=>[a.id,a.balance_cents]));
 const selected=new Set(data.settings.spending_account_ids),warnings:string[]=[];
 if(!selected.size)warnings.push('Choose checking or cash accounts for spending before calculating an allowance.');
 const events=new Map<string,{accountId:number;amount:number;transfer:boolean;name:string}[]>(),incomeDates:string[]=[];
 const add=(date:string,accountId:number,amount:number,transfer=false,name='Scheduled')=>events.set(date,[...(events.get(date)??[]),{accountId,amount,transfer,name}]);
 for(const c of data.commitments){
  if(c.active===false)continue;
  if(c.account_id===null){warnings.push(`Assign a funding account to ${c.name}.`);continue}
  for(const date of scheduledDates(c,from,to)){
   const paid=data.movements.filter(m=>m.commitment_key===`${c.key}@${date}`).reduce((sum,m)=>sum+m.amount_cents,0);
   const amount=Math.max(0,c.amount_cents-paid);if(!amount)continue;
   add(date,c.account_id,c.kind==='income'?amount:-amount,Boolean(c.transfer_account_id),c.name);
   if(c.transfer_account_id)add(date,c.transfer_account_id,amount,true,c.name);
   if(c.kind==='income'&&selected.has(c.account_id))incomeDates.push(date);
  }
 }
 const scenarioAccount=data.accounts.find(a=>selected.has(a.id))?.id;
 if(adjustment&&scenarioAccount!==undefined){add(adjustmentDate,scenarioAccount,adjustment,false,'What-if');if(adjustment>0)incomeDates.push(adjustmentDate)}
 const next=incomeDates.sort()[0]??null,windowEnd=next??dateOffset(29,from);
 const protectedCents=data.goals.filter(g=>g.account_id!==null&&selected.has(g.account_id)).reduce((sum,g)=>sum+g.saved_cents,0);
 const sum=()=>[...selected].reduce((total,id)=>total+(balances[id]??0),0);
 let minimum=sum()-protectedCents-data.settings.cushion_cents;
 const cash=sum(),applied:SpendBreakdown['scheduled_items']=[];
 const snapshot=(date:string,allowance:number,days:number):SpendBreakdown=>({low_point_date:date,cash_cents:cash,scheduled_cents:sum()-cash,scheduled_items:[...applied],set_aside_cents:protectedCents,cushion_cents:data.settings.cushion_cents,allowance_cents:allowance,allowance_days:allowance?Math.min(days,30):0});
 let breakdown=snapshot(from,0,0);
 const track=(date:string,e:{accountId:number;amount:number;name:string})=>{if(selected.has(e.accountId))applied.push({date,name:e.name,amount_cents:e.amount})};
 const daily:Forecast['daily']=[];
 for(let day=0;day<90;day++){
  const date=dateOffset(day,from),allowance=Math.ceil(data.settings.essential_allowance_cents*Math.min(day+1,30)/30),dayEvents=events.get(date)??[];
  for(const event of dayEvents.filter(e=>e.amount<0||e.transfer)){balances[event.accountId]=(balances[event.accountId]??0)+event.amount;track(date,event)}
  const beforeIncome=sum()-protectedCents-data.settings.cushion_cents-allowance;
  if(date<=windowEnd&&beforeIncome<minimum){minimum=beforeIncome;breakdown=snapshot(date,allowance,day+1)}
  for(const event of dayEvents.filter(e=>e.amount>=0&&!e.transfer)){balances[event.accountId]=(balances[event.accountId]??0)+event.amount;track(date,event)}
  daily.push({date,balance_cents:sum(),headroom_cents:sum()-protectedCents-data.settings.cushion_cents-allowance,accounts:{...balances}});
 }
 return {breakdown:warnings.length?null:breakdown,from,to,daily,safe_to_spend_cents:warnings.length?null:Math.max(0,minimum),headroom_cents:warnings.length?null:minimum,next_income_date:next,window_end:windowEnd,warnings};
}
export function createDemo():FinanceData {
 const today=dateOffset(0); const data:FinanceData={as_of:today,accounts:[{id:1,name:'Everyday checking',type:'checking',balance_cents:648250,opening_balance_cents:648250,opening_on:today,spendable:true},{id:2,name:'Rainy day fund',type:'savings',balance_cents:1260000,opening_balance_cents:1260000,opening_on:today,spendable:false},{id:3,name:'Travel rewards',type:'credit_card',balance_cents:-184600,opening_balance_cents:-184600,opening_on:today,spendable:false}],movements:[{id:1,date:today,kind:'expense',amount_cents:6420,account_id:1,transfer_account_id:null,description:'Whole Foods Market',commitment_key:null},{id:2,date:dateOffset(-1),kind:'expense',amount_cents:1850,account_id:1,transfer_account_id:null,description:'Blue Bottle Coffee',commitment_key:null},{id:3,date:dateOffset(-2),kind:'income',amount_cents:325000,account_id:1,transfer_account_id:null,description:'Studio payroll',commitment_key:null},{id:4,date:dateOffset(-3),kind:'expense',amount_cents:8900,account_id:1,transfer_account_id:null,description:'Internet · monthly',commitment_key:null},{id:5,date:dateOffset(-4),kind:'transfer',amount_cents:35000,account_id:1,transfer_account_id:2,description:'A little closer to the coast',commitment_key:null}],commitments:[{key:'pay',name:'Studio payroll',kind:'income',amount_cents:325000,account_id:1,transfer_account_id:null,frequency:'biweekly',next_date:dateOffset(12),end_date:null},{key:'rent',name:'Apartment rent',kind:'bill',amount_cents:185000,account_id:1,transfer_account_id:null,frequency:'monthly',next_date:dateOffset(3),end_date:null},{key:'card',name:'Travel rewards payment',kind:'debt',amount_cents:18500,account_id:1,transfer_account_id:3,frequency:'monthly',next_date:dateOffset(6),end_date:null},{key:'save',name:'Coastal escape',kind:'savings',amount_cents:35000,account_id:1,transfer_account_id:2,frequency:'biweekly',next_date:dateOffset(13),end_date:null},{key:'internet',name:'Internet',kind:'bill',amount_cents:8900,account_id:1,transfer_account_id:null,frequency:'monthly',next_date:dateOffset(8),end_date:null},{key:'power',name:'Electricity',kind:'bill',amount_cents:12000,account_id:1,transfer_account_id:null,frequency:'monthly',next_date:dateOffset(10),end_date:null}],goals:[{id:1,name:'Coastal escape',target_cents:450000,saved_cents:285000,account_id:2,target_date:dateOffset(120)},{id:2,name:'Six months of breathing room',target_cents:1800000,saved_cents:975000,account_id:2,target_date:null}],settings:{timezone:demoTimezone(),cushion_cents:100000,essential_allowance_cents:70000,spending_account_ids:[1]},forecast:{} as Forecast};data.forecast=demoForecast(data);return data;
}
