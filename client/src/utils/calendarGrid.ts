import type { ProjectedOutflow } from '../types';

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  inRange: boolean;
  outflows: ProjectedOutflow[];
}

// `from`/`to`/outflow dates are plain YYYY-MM-DD calendar dates with no
// timezone of their own — parsed and manipulated entirely in UTC (Z
// suffix + UTC getters/setters) so day bucketing can't drift by ±1 for
// users west of UTC. Mixing local-time parsing with toISOString's UTC
// formatting was the bug this fixes: a local midnight can format as the
// previous UTC day, mis-assigning outflows to the wrong cell.
export function buildCalendarWeeks(outflows: ProjectedOutflow[], from: string, to: string): CalendarDay[][] {
  const byDate = new Map<string, ProjectedOutflow[]>();
  for (const outflow of outflows) {
    const bucket = byDate.get(outflow.date);
    if (bucket) bucket.push(outflow);
    else byDate.set(outflow.date, [outflow]);
  }

  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());
  const gridEnd = new Date(end);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  const days: CalendarDay[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    days.push({
      date: iso,
      dayOfMonth: d.getUTCDate(),
      inRange: d >= start && d <= end,
      outflows: byDate.get(iso) ?? [],
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}
