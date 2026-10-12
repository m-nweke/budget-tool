import { afterEach, describe, it, expect, vi } from 'vitest';
import { formatCurrency, capitalize, accountLabel, localToday } from './format';

describe('formatCurrency', () => {
  it('formats a positive number as USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats a negative number', () => {
    expect(formatCurrency(-42)).toBe('-$42.00');
  });
});

describe('capitalize', () => {
  it('capitalizes the first letter of a lowercase word', () => {
    expect(capitalize('checking')).toBe('Checking');
  });

  it('leaves an already-capitalized word unchanged', () => {
    expect(capitalize('Savings')).toBe('Savings');
  });

  it('handles a single character', () => {
    expect(capitalize('a')).toBe('A');
  });

  it('handles an empty string without throwing', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('accountLabel', () => {
  it('appends the capitalized type so same-named accounts of different types are distinguishable', () => {
    expect(accountLabel({ name: 'Chase', type: 'checking' })).toBe('Chase (Checking)');
    expect(accountLabel({ name: 'Chase', type: 'savings' })).toBe('Chase (Savings)');
  });
});

describe('localToday', () => {
  afterEach(() => vi.useRealTimers());
  it('uses the local calendar date, not UTC, late in the evening', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T03:30:00Z'));
    expect(localToday('America/Chicago')).toBe('2026-10-12');
    expect(localToday('UTC')).toBe('2026-10-13');
  });
});
