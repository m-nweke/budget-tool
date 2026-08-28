import { describe, it, expect } from 'vitest';
import { buildCalendarWeeks } from './calendarGrid';
import type { ProjectedOutflow } from '../types';

function outflow(date: string, overrides: Partial<ProjectedOutflow> = {}): ProjectedOutflow {
  return { date, source: 'bill', id: 1, label: 'Test', amount: 10, ...overrides };
}

describe('buildCalendarWeeks', () => {
  it('pads to a full Sunday-first week even for a single-day range', () => {
    // 2026-08-28 is a Friday.
    const weeks = buildCalendarWeeks([], '2026-08-28', '2026-08-28');
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0].map((d) => d.date)).toEqual([
      '2026-08-23',
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
    ]);
  });

  it('marks only days inside [from, to] as inRange', () => {
    const weeks = buildCalendarWeeks([], '2026-08-28', '2026-08-28');
    const flat = weeks.flat();
    const inRangeDates = flat.filter((d) => d.inRange).map((d) => d.date);
    expect(inRangeDates).toEqual(['2026-08-28']);
  });

  it('does not drift the boundary days by ±1 (regression for the local-time/UTC mixing bug)', () => {
    // The original bug parsed `from`/`to` in local time but formatted grid
    // days via toISOString (always UTC) — in a timezone behind UTC, a
    // local midnight could format one day earlier, moving the range
    // boundary and mis-marking the first/last real day as out-of-range.
    // from=Thu, to=Fri leaves Sat (2026-01-03) in the padded grid as a
    // real out-of-range day to assert against, alongside Dec 31 before it.
    const weeks = buildCalendarWeeks([], '2026-01-01', '2026-01-02');
    const flat = weeks.flat();
    const jan1 = flat.find((d) => d.date === '2026-01-01');
    const jan2 = flat.find((d) => d.date === '2026-01-02');
    expect(jan1?.inRange).toBe(true);
    expect(jan2?.inRange).toBe(true);
    // The days immediately before/after the range must NOT be marked in-range.
    const dec31 = flat.find((d) => d.date === '2025-12-31');
    const jan3 = flat.find((d) => d.date === '2026-01-03');
    expect(dec31?.inRange).toBe(false);
    expect(jan3?.inRange).toBe(false);
  });

  it('buckets an outflow onto its own date, not an adjacent day', () => {
    const weeks = buildCalendarWeeks([outflow('2026-08-27', { label: 'Rent' })], '2026-08-25', '2026-08-30');
    const flat = weeks.flat();
    const day27 = flat.find((d) => d.date === '2026-08-27');
    const day26 = flat.find((d) => d.date === '2026-08-26');
    const day28 = flat.find((d) => d.date === '2026-08-28');
    expect(day27?.outflows.map((o) => o.label)).toEqual(['Rent']);
    expect(day26?.outflows).toEqual([]);
    expect(day28?.outflows).toEqual([]);
  });

  it('groups multiple outflows landing on the same date', () => {
    const weeks = buildCalendarWeeks(
      [outflow('2026-08-27', { label: 'Rent', id: 1 }), outflow('2026-08-27', { label: 'Electric', id: 2 })],
      '2026-08-25',
      '2026-08-30'
    );
    const day27 = weeks.flat().find((d) => d.date === '2026-08-27');
    expect(day27?.outflows.map((o) => o.label)).toEqual(['Rent', 'Electric']);
  });

  it('splits a multi-week range into correctly sized week rows', () => {
    const weeks = buildCalendarWeeks([], '2026-08-01', '2026-08-31');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks.length).toBeGreaterThanOrEqual(5);
  });
});
