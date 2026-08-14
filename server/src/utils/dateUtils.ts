import type { RecurrenceInterval } from '../types/recurringTransaction/RecurrenceInterval';

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

// Known limitation: naive month rollover (e.g. Jan 31 -> Mar 3, not Feb 28/29)
// since JS Date normalizes out-of-range days instead of clamping. Acceptable
// for the MVP; a real implementation would clamp to the last day of the
// target month.
export function addOneMonth(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + 1, day));
  return next.toISOString().slice(0, 10);
}

export function addByInterval(dateStr: string, interval: RecurrenceInterval): string {
  switch (interval) {
    case 'daily':
      return addDays(dateStr, 1);
    case 'weekly':
      return addDays(dateStr, 7);
    case 'biweekly':
      return addDays(dateStr, 14);
    case 'monthly':
      return addOneMonth(dateStr);
  }
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
