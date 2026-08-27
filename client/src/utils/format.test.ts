import { describe, it, expect } from 'vitest';
import { formatCurrency, capitalize } from './format';

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
