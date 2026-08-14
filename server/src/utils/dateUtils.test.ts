import { describe, it, expect } from 'vitest';
import { addOneMonth, addByInterval, todayISO, monthRange, monthRangeSpan, monthCount } from './dateUtils';

describe('addOneMonth', () => {
  it('advances to the same day next month', () => {
    expect(addOneMonth('2026-04-01')).toBe('2026-05-01');
  });

  it('rolls over across a year boundary', () => {
    expect(addOneMonth('2026-12-15')).toBe('2027-01-15');
  });

  it('known limitation: rolls into the next month instead of clamping on short months', () => {
    // Jan 31 + 1 month has no Feb 31, so JS Date normalizes it to Mar 3
    // (2027 is not a leap year). Documented in dateUtils.ts.
    expect(addOneMonth('2027-01-31')).toBe('2027-03-03');
  });
});

describe('addByInterval', () => {
  it('daily adds 1 day', () => {
    expect(addByInterval('2026-08-01', 'daily')).toBe('2026-08-02');
  });

  it('weekly adds 7 days', () => {
    expect(addByInterval('2026-08-01', 'weekly')).toBe('2026-08-08');
  });

  it('biweekly adds 14 days', () => {
    expect(addByInterval('2026-08-01', 'biweekly')).toBe('2026-08-15');
  });

  it('monthly delegates to addOneMonth', () => {
    expect(addByInterval('2026-08-01', 'monthly')).toBe('2026-09-01');
  });

  it('daily rolls over a month boundary', () => {
    expect(addByInterval('2026-08-31', 'daily')).toBe('2026-09-01');
  });
});

describe('todayISO', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('monthRange', () => {
  it('returns a half-open [start, end) range for the month', () => {
    expect(monthRange('2026-08')).toEqual({ start: '2026-08-01', end: '2026-09-01' });
  });

  it('rolls over into January for December', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });
});

describe('monthRangeSpan', () => {
  it('spans from the start of `from` to the end of `to`', () => {
    expect(monthRangeSpan('2026-06', '2026-08')).toEqual({ start: '2026-06-01', end: '2026-09-01' });
  });

  it('a single-month span equals monthRange', () => {
    expect(monthRangeSpan('2026-08', '2026-08')).toEqual(monthRange('2026-08'));
  });
});

describe('monthCount', () => {
  it('counts inclusively within the same year', () => {
    expect(monthCount('2026-06', '2026-08')).toBe(3);
  });

  it('counts a single month as 1', () => {
    expect(monthCount('2026-08', '2026-08')).toBe(1);
  });

  it('counts across a year boundary', () => {
    expect(monthCount('2026-11', '2027-02')).toBe(4);
  });
});
