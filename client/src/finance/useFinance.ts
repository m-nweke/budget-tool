import { reactive, ref } from 'vue';
import type { FinanceData } from './types';
import { createDemo, demoForecast } from './demo';
const demo=ref<FinanceData>(createDemo());
export type DemoVaultRule = { mode: 'none' | 'percent' | 'fixed'; value: number; accountId: number | null };
const startingRules = (): Record<number, DemoVaultRule> => ({ 1: { mode: 'percent', value: 12, accountId: 1 }, 2: { mode: 'fixed', value: 150, accountId: 1 } });
export const demoVaultRules = reactive<Record<number, DemoVaultRule>>(startingRules());
export async function financeRequest<T>(path:string, body?:unknown, method=body===undefined?'GET':'POST'):Promise<T> {
 const response=await fetch('/api/finance'+path,{method,credentials:'include',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}); const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error??`Unable to load your finances (${response.status}).`);return result;
}
export function useFinance(isDemo:()=>boolean) {
 const data=ref<FinanceData|null>(null),loading=ref(false),error=ref('');
 async function load() {loading.value=true;error.value='';try{data.value=isDemo()?demo.value:await financeRequest<FinanceData>('/bootstrap');}catch(e){error.value=(e as Error).message;}finally{loading.value=false}}
 function resetDemo(){demo.value=createDemo();data.value=demo.value;for(const id of Object.keys(demoVaultRules))delete demoVaultRules[Number(id)];Object.assign(demoVaultRules,startingRules())}
 function refreshDemo(){if(data.value){data.value.forecast=demoForecast(data.value);demo.value=data.value}}
 return {data,loading,error,load,resetDemo,refreshDemo};
}
