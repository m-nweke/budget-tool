import { describe, it, expect } from 'vitest';
import { advanceDate, monthCount, monthStart, monthEnd, isValidMonth } from '../../src/utils/dateMath';

describe('advanceDate', () => {
  it('advances daily', () => {
    expect(advanceDate('2026-01-31', 'daily')).toBe('2026-02-01');
  });

  it('advances weekly', () => {
    expect(advanceDate('2026-01-01', 'weekly')).toBe('2026-01-08');
  });

  it('advances biweekly', () => {
    expect(advanceDate('2026-01-01', 'biweekly')).toBe('2026-01-15');
  });

  it('advances monthly, clamping short months', () => {
    expect(advanceDate('2026-01-31', 'monthly')).toBe('2026-03-03');
  });

  it('advances monthly across year boundary', () => {
    expect(advanceDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });
});

describe('monthCount', () => {
  it('single month is 1', () => {
    expect(monthCount('2026-03', '2026-03')).toBe(1);
  });

  it('spans multiple months inclusive', () => {
    expect(monthCount('2026-01', '2026-03')).toBe(3);
  });

  it('spans across a year boundary', () => {
    expect(monthCount('2025-11', '2026-02')).toBe(4);
  });
});

describe('monthStart / monthEnd', () => {
  it('gives first and last day of a 31-day month', () => {
    expect(monthStart('2026-01')).toBe('2026-01-01');
    expect(monthEnd('2026-01')).toBe('2026-01-31');
  });

  it('handles February in a leap year', () => {
    expect(monthEnd('2028-02')).toBe('2028-02-29');
  });

  it('handles February in a non-leap year', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
  });
});

describe('isValidMonth', () => {
  it('accepts valid months', () => {
    expect(isValidMonth('2026-01')).toBe(true);
    expect(isValidMonth('2026-12')).toBe(true);
  });

  it('rejects out-of-range month component', () => {
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-00')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidMonth('2026-1')).toBe(false);
    expect(isValidMonth('not-a-month')).toBe(false);
  });
});
