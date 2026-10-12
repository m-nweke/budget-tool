import type { Commitment, FinanceData } from './types';

export interface CalendarEntry {
  id: string;
  date: string;
  name: string;
  amount_cents: number;
  kind: 'income' | 'expense' | 'transfer';
  status: 'recorded' | 'scheduled';
  account_id: number | null;
  transfer_account_id?: number | null;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
export function shiftDate(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return iso(result);
}

/** Calendar dates stay in UTC; month-end schedules retain their original anchor. */
export function scheduledDates(commitment: Commitment, from: string, to: string): string[] {
  if (commitment.active === false || !commitment.next_date) return [];
  const anchor = new Date(`${commitment.next_date}T12:00:00Z`);
  const day = commitment.day_of_month ?? anchor.getUTCDate();
  const result: string[] = [];
  let date = commitment.next_date;
  let month = 0;
  for (let count = 0; date <= to && count < 10000; count++) {
    if (commitment.end_date && date > commitment.end_date) break;
    if (date >= from) result.push(date);
    if (commitment.frequency === 'once') break;
    if (commitment.frequency === 'weekly' || commitment.frequency === 'biweekly') {
      date = shiftDate(date, commitment.frequency === 'weekly' ? 7 : 14);
    } else if (commitment.frequency === 'monthly') {
      month++;
      const next = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + month, 1, 12));
      const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, last));
      date = iso(next);
    } else if (commitment.frequency === 'semimonthly') {
      const next = new Date(`${date}T12:00:00Z`);
      const days = [...(commitment.pay_days ?? [1, 15])].sort((a, b) => a - b);
      const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      const nextDay = days.map(value => Math.min(value, last)).find(value => value > next.getUTCDate());
      if (nextDay) next.setUTCDate(nextDay);
      else {
        next.setUTCMonth(next.getUTCMonth() + 1, 1);
        const monthLast = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
        next.setUTCDate(Math.min(days[0] ?? 1, monthLast));
      }
      date = iso(next);
    } else break;
  }
  return result;
}

export function calendarEntries(data: FinanceData, from: string, to: string): CalendarEntry[] {
  const entries: CalendarEntry[] = data.movements.filter(m => m.date >= from && m.date <= to).map(m => ({
    id: `movement-${m.id}`, date: m.date, name: m.description || 'Activity', amount_cents: m.amount_cents,
    kind: m.kind, status: 'recorded', account_id: m.account_id, transfer_account_id: m.transfer_account_id,
  }));
  for (const commitment of data.commitments) {
    for (const date of scheduledDates(commitment, from, to)) {
      const paid = data.movements.filter(m => m.commitment_key === `${commitment.key}@${date}`).reduce((sum, m) => sum + m.amount_cents, 0);
      const remaining = Math.max(0, commitment.amount_cents - paid);
      if (!remaining) continue;
      entries.push({ id: `${commitment.key}@${date}`, date, name: commitment.name, amount_cents: remaining,
        kind: commitment.kind === 'income' ? 'income' : commitment.transfer_account_id ? 'transfer' : 'expense',
        status: 'scheduled', account_id: commitment.account_id, transfer_account_id: commitment.transfer_account_id,
      });
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
