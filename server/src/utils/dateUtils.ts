import type { RecurrenceInterval } from '../types/recurringTransaction/RecurrenceInterval';
import type { PaycheckFrequency } from '../types/paycheck/Paycheck';

export function addDays(dateStr: string, days: number): string {
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

// Half-open range spanning from the start of `from` through the end of `to`
// (inclusive of both endpoint months).
export function monthRangeSpan(from: string, to: string): { start: string; end: string } {
  return { start: monthRange(from).start, end: monthRange(to).end };
}

// Inclusive count of months between two 'YYYY-MM' strings, e.g. '2026-06' to
// '2026-08' is 3 (June, July, August).
export function monthCount(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// `month` is 1-indexed. Date.UTC's day-0-of-the-following-month trick gives
// the last real day of `month` without hardcoding 28/29/30/31 per month.
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// Cash-flow simulation only (story 18): walks forward one cadence at a time
// from `anchor` — bounded by how stale `anchor` is relative to `windowStart`,
// not literally unbounded. A paycheck's next_pay_date has no auto-advance
// job the way a recurring transaction's next_run_date does (generateDue()
// runs on every request), so it can be arbitrarily stale — but even years of
// staleness at a weekly cadence is a few hundred loop iterations, negligible
// for a synchronous simulation.
function stepDatesInWindow(anchor: string, step: (d: string) => string, windowStart: string, windowEnd: string): string[] {
  let current = anchor;
  while (current < windowStart) {
    current = step(current);
  }
  const dates: string[] = [];
  while (current <= windowEnd) {
    dates.push(current);
    current = step(current);
  }
  return dates;
}

// Advances to the next semimonthly date (the 1st or the 15th) after `d`.
function nextSemimonthlyDate(d: string): string {
  const [year, month, day] = d.split('-').map(Number);
  if (day < 15) return formatDate(year, month, 15);
  if (month === 12) return formatDate(year + 1, 1, 1);
  return formatDate(year, month + 1, 1);
}

// Cash-flow simulation only (story 18). weekly/biweekly/monthly reuse the
// same day/month stepping addByInterval already uses for recurring
// transactions. semimonthly is not a fixed-length interval (no 'semimonthly'
// in RecurrenceInterval) — it always lands on the 1st and 15th of every
// month, so next_pay_date's day-of-month only decides which of the two the
// sequence starts from (confirmed decision), never a 15-day step from it.
export function stepPaycheckDates(
  nextPayDate: string,
  frequency: PaycheckFrequency,
  windowStart: string,
  windowEnd: string
): string[] {
  if (frequency === 'semimonthly') {
    const [year, month, day] = nextPayDate.split('-').map(Number);
    const anchor = day <= 15 ? formatDate(year, month, 1) : formatDate(year, month, 15);
    return stepDatesInWindow(anchor, nextSemimonthlyDate, windowStart, windowEnd);
  }
  const step = (d: string): string =>
    frequency === 'weekly' ? addDays(d, 7) : frequency === 'biweekly' ? addDays(d, 14) : addOneMonth(d);
  return stepDatesInWindow(nextPayDate, step, windowStart, windowEnd);
}

// Cash-flow simulation only (story 18). A debt's due_day (1-31) that doesn't
// exist in a given month clamps to that month's last day (confirmed
// decision) — e.g. due_day=31 lands on Feb 28 (or 29), not skipped and not
// rolled into March.
export function stepMonthlyDueDates(dueDay: number, windowStart: string, windowEnd: string): string[] {
  const [startYear, startMonth] = windowStart.split('-').map(Number);
  const [endYear, endMonth] = windowEnd.split('-').map(Number);
  const dates: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const dateStr = formatDate(year, month, Math.min(dueDay, lastDayOfMonth(year, month)));
    if (dateStr >= windowStart && dateStr <= windowEnd) {
      dates.push(dateStr);
    }
    if (month === 12) {
      month = 1;
      year += 1;
    } else {
      month += 1;
    }
  }
  return dates;
}
