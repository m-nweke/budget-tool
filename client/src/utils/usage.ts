export type UsageTier = 'green' | 'orange' | 'red';

/** Single source of truth for "how urgent is this" — drives both the progress bar color and the status text. */
export function classifyUsage(spent: number, budgeted: number): UsageTier {
  if (budgeted <= 0) return spent > 0 ? 'red' : 'green';
  const pct = (spent / budgeted) * 100;
  if (pct >= 75) return 'red';
  if (pct >= 50) return 'orange';
  return 'green';
}

/** Bar width is capped at 100% for display; classification above uses the uncapped percentage. */
export function cappedPercent(spent: number, budgeted: number): number {
  if (budgeted <= 0) return spent > 0 ? 100 : 0;
  return Math.min(100, (spent / budgeted) * 100);
}
