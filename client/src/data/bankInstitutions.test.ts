import { describe, it, expect } from 'vitest';
import { BANK_INSTITUTIONS, getInstitutionMeta, logoUrl } from './bankInstitutions';

describe('getInstitutionMeta', () => {
  it('returns null for an unset institution', () => {
    expect(getInstitutionMeta(null)).toBeNull();
    expect(getInstitutionMeta(undefined)).toBeNull();
    expect(getInstitutionMeta('   ')).toBeNull();
  });

  it('matches a curated bank case-insensitively', () => {
    expect(getInstitutionMeta('chase')).toMatchObject({ name: 'Chase', mark: 'C' });
    expect(getInstitutionMeta('SOFI')).toMatchObject({ name: 'SoFi', mark: 'SF' });
  });

  it('derives a stable color and initials for an unlisted institution', () => {
    const first = getInstitutionMeta('My Local Credit Union');
    const second = getInstitutionMeta('My Local Credit Union');
    expect(first).toEqual(second);
    expect(first?.mark).toBe('ML');
    expect(first?.name).toBe('My Local Credit Union');
  });

  it('uses the first two letters of a single-word custom institution', () => {
    expect(getInstitutionMeta('Wealthfront')?.mark).toBe('WE');
  });
});

describe('logoUrl', () => {
  it('every curated bank has a domain, so logoUrl never falls back to the letter-mark for one', () => {
    for (const bank of BANK_INSTITUTIONS) {
      expect(bank.domain, `${bank.name} is missing a domain`).toBeTruthy();
      expect(logoUrl(bank)).toBe(`https://www.google.com/s2/favicons?domain=${bank.domain}&sz=64`);
    }
  });

  it('returns null for a custom institution with no known domain', () => {
    const custom = getInstitutionMeta('My Local Credit Union')!;
    expect(logoUrl(custom)).toBeNull();
  });
});
