import { describe, it, expect } from 'vitest';
import { getInstitutionMeta } from './bankInstitutions';

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
