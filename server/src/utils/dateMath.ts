import type { Interval } from '../types';

/** Advance a YYYY-MM-DD date string by one occurrence of the given interval. */
export function advanceDate(date: string, interval: Interval): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));

  switch (interval) {
    case 'daily':
      dt.setUTCDate(dt.getUTCDate() + 1);
      break;
    case 'weekly':
      dt.setUTCDate(dt.getUTCDate() + 7);
      break;
    case 'biweekly':
      dt.setUTCDate(dt.getUTCDate() + 14);
      break;
    case 'monthly':
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      break;
  }

  return toDateString(dt);
}

function toDateString(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM month string into { year, month } (1-indexed month). */
function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number);
  return { year: y, month: m };
}

/** Number of whole calendar months spanned by [from, to] inclusive, e.g. 2026-01..2026-03 = 3. */
export function monthCount(from: string, to: string): number {
  const a = parseMonth(from);
  const b = parseMonth(to);
  return (b.year - a.year) * 12 + (b.month - a.month) + 1;
}

/** First calendar day (YYYY-MM-DD) of a YYYY-MM month string. */
export function monthStart(month: string): string {
  return `${month}-01`;
}

/** Last calendar day (YYYY-MM-DD) of a YYYY-MM month string. */
export function monthEnd(month: string): string {
  const { year, month: m } = parseMonth(month);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

/** Current month as YYYY-MM. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Valid YYYY-MM with month bounded 01-12. */
export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
