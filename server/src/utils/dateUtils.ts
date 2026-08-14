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

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

// Half-open range [start, end) for a 'YYYY-MM' month, so callers can filter
// with `date >= start AND date < end` without special-casing month length.
export function monthRange(month: string): { start: string; end: string } {
  const start = `${month}-01`;
  return { start, end: addOneMonth(start) };
}
