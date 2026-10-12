import type { Commitment, FinanceData, Forecast, Frequency, ScenarioEvent } from '../types/finance';

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2200-12-31';
}
export function cents(value: unknown, positive = false): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000_000_000 && (!positive || value > 0);
}
export function addDays(date: string, count: number): string {
  const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + count); return d.toISOString().slice(0, 10);
}
export function todayIn(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
}
export function occurrences(anchor: string, frequency: Frequency, to: string, options: {day_of_month?:number;pay_days?:number[]} = {}): string[] {
  const result: string[] = []; let date = anchor; let month = 0;
  const initial = new Date(`${anchor}T00:00:00Z`); const day = options.day_of_month ?? initial.getUTCDate();
  while (date <= to && result.length < 10000) {
    result.push(date);
    if (frequency === 'once') break;
    if (frequency === 'weekly' || frequency === 'biweekly') date = addDays(date, frequency === 'weekly' ? 7 : 14);
    else if (frequency === 'monthly') {
      month++;
      const next = new Date(Date.UTC(initial.getUTCFullYear(), initial.getUTCMonth() + month, 1));
      const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, last)); date = next.toISOString().slice(0, 10);
    } else {
      const next = new Date(`${date}T00:00:00Z`);
      const payDays = options.pay_days ?? [1,15];
      const last = new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();
      const nextDay = payDays.map(d => Math.min(d,last)).find(d => d>next.getUTCDate());
      if(nextDay) next.setUTCDate(nextDay);
      else { next.setUTCMonth(next.getUTCMonth() + 1, 1); const monthLast=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate();next.setUTCDate(Math.min(payDays[0],monthLast)); }
      date = next.toISOString().slice(0, 10);
    }
  }
  return result;
}
export function occurrenceKey(commitment: Commitment, date: string): string { return `${commitment.key}@${date}`; }

/** Snapshot includes all actual movements through opening_on. Card debt is a negative balance;
 * purchases reduce card balance, and paired card payments move cash to the card once. */
export function forecast(data: FinanceData, events: ScenarioEvent[] = [], disabled: string[] = []): Forecast {
  const from = data.as_of; const to = addDays(from, 89); const warnings = [...data.warnings];
  const selected = new Set(data.settings.spending_account_ids);
  if (!selected.size) warnings.push('Choose checking or cash accounts for spending before calculating an allowance.');
  const balances: Record<number, number> = {};
  for (const account of data.accounts) {
    balances[account.id] = account.opening_balance_cents;
    if (!validDate(account.opening_on) || account.opening_on>from) warnings.push(`Reconcile ${account.name} to establish its opening balance date.`);
  }
  const accountMap = new Map(data.accounts.map(a => [a.id, a]));
  const actualDeltas = (movement: FinanceData['movements'][number]) => {
    const source = accountMap.get(movement.account_id);
    if (source && movement.date > source.opening_on) balances[source.id] += movement.kind === 'income' ? movement.amount_cents : -movement.amount_cents;
    if (movement.kind === 'transfer' && movement.transfer_account_id) {
      const destination = accountMap.get(movement.transfer_account_id);
      if (destination && movement.date > destination.opening_on) balances[destination.id] += movement.amount_cents;
    }
  };
  data.movements.filter(m => m.date <= from).forEach(actualDeltas);
  let protectedCents = 0;
  for (const goal of data.goals) {
    if (goal.saved_cents > 0 && goal.account_id === null) warnings.push(`Assign a holding account to ${goal.name} to locate its protected savings.`);
    if (goal.account_id !== null && selected.has(goal.account_id)) protectedCents += goal.saved_cents;
  }
  type Event = ScenarioEvent & {transfer?: boolean; protected_delta?:number};
  const dated = new Map<string, Event[]>();
  const incomes: string[] = [];
  const add = (event: Event) => { const list = dated.get(event.date) ?? []; list.push(event); dated.set(event.date, list); };
  for (const commitment of data.commitments) {
    if (commitment.active === false || disabled.includes(commitment.key)) continue;
    if (!commitment.account_id || !accountMap.has(commitment.account_id)) {
      warnings.push(`Assign a funding account to ${commitment.name}.`); continue;
    }
    for (const original of occurrences(commitment.next_date, commitment.frequency, to,commitment)) {
      if (commitment.end_date && original > commitment.end_date) continue;
      // Prior expected income is never treated as settled cash.
      if (original < from && commitment.kind === 'income') continue;
      const paid = data.movements.filter(m => m.commitment_key === occurrenceKey(commitment, original)).reduce((sum, m) => sum + m.amount_cents, 0);
      const amount = Math.max(0, commitment.amount_cents - paid);
      if (!amount) continue;
      const date = original < from ? from : original;
      add({ date, account_id: commitment.account_id, amount_cents: commitment.kind === 'income' ? amount : -amount, description: commitment.name,transfer:Boolean(commitment.transfer_account_id) });
      if (commitment.kind === 'income' && selected.has(commitment.account_id)) incomes.push(date);
      if (commitment.transfer_account_id) add({ date, account_id: commitment.transfer_account_id, amount_cents: amount, description: commitment.name,transfer:true,protected_delta:commitment.kind==='savings' && selected.has(commitment.transfer_account_id) ? amount : 0 });
    }
  }
  events.forEach(event => {add(event);if(event.amount_cents>0 && selected.has(event.account_id)) incomes.push(event.date);});
  const nextIncome = incomes.sort()[0] ?? null;
  const windowEnd = nextIncome ?? addDays(from, 29);
  const sum = () => [...selected].reduce((total, id) => total + (balances[id] ?? 0), 0);
  let fixedReserve = protectedCents + data.settings.cushion_cents;
  let minimum = sum() - fixedReserve;
  const daily: Forecast['daily'] = [];
  for (let date = from, day = 1; date <= to; date = addDays(date, 1), day++) {
    const allowance = Math.ceil(data.settings.essential_allowance_cents * Math.min(day, 30) / 30);
    const dayEvents = dated.get(date) ?? [];
    // Outflows are assessed before same-day deposits, including the boundary payday.
    for (const event of dayEvents.filter(e => e.amount_cents < 0 || e.transfer)) { balances[event.account_id] = (balances[event.account_id] ?? 0) + event.amount_cents;fixedReserve+=event.protected_delta ?? 0; }
    const beforeIncome = sum() - fixedReserve - allowance;
    if (date <= windowEnd) minimum = Math.min(minimum, beforeIncome);
    for (const event of dayEvents.filter(e => e.amount_cents >= 0 && !e.transfer)) balances[event.account_id] = (balances[event.account_id] ?? 0) + event.amount_cents;
    daily.push({ date, balance_cents: sum(), headroom_cents: sum() - fixedReserve - allowance, accounts: { ...balances } });
  }
  const complete = warnings.length === 0;
  return { from, to, daily, safe_to_spend_cents: complete ? Math.max(0, minimum) : null, headroom_cents: complete ? minimum : null, next_income_date: nextIncome, window_end: windowEnd, warnings: [...new Set(warnings)] };
}
