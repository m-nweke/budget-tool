import { describe, it, expect } from 'vitest';
import { addOneMonth, addByInterval, todayISO } from './dateUtils';

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
