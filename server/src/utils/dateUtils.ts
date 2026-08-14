// Known limitation: naive month rollover (e.g. Jan 31 -> Mar 3, not Feb 28/29)
// since JS Date normalizes out-of-range days instead of clamping. Acceptable
// for the MVP; a real implementation would clamp to the last day of the
// target month.
export function addOneMonth(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + 1, day));
  return next.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
