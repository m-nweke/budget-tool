import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import tenantRepository from './tenantRepository';

beforeEach(async () => {
  (await db.exec('DELETE FROM tenants;'));
});

describe('tenantRepository', () => {
  it('creates an enterprise tenant with a generated join code', async () => {
    const tenant = (await tenantRepository.create('Acme Co', 'enterprise'));
    expect(tenant).toMatchObject({ name: 'Acme Co', type: 'enterprise' });
    expect(tenant.join_code).toMatch(/^TEAM-/);
  });

  it('creates a personal tenant with no join code', async () => {
    const tenant = (await tenantRepository.create("Pat's Budget", 'personal'));
    expect(tenant).toMatchObject({ name: "Pat's Budget", type: 'personal' });
    expect(tenant.join_code).toBeNull();
  });

  it('findById finds a tenant', async () => {
    const created = (await tenantRepository.create('Acme Co', 'enterprise'));
    (await expect((await tenantRepository.findById(created.id))).toEqual(created));
  });

  it('findById returns undefined for an unknown id', async () => {
    (await expect((await tenantRepository.findById(999999))).toBeUndefined());
  });

  it('findByJoinCode finds the tenant with a matching code', async () => {
    const created = (await tenantRepository.create('Acme Co', 'enterprise'));
    (await expect((await tenantRepository.findByJoinCode(created.join_code as string))).toEqual(created));
  });

  it('findByJoinCode returns undefined for an unknown code', async () => {
    (await expect((await tenantRepository.findByJoinCode('NOT-A-REAL-CODE'))).toBeUndefined());
  });

  it('two enterprise tenants get different join codes', async () => {
    const first = (await tenantRepository.create('Acme Co', 'enterprise'));
    const second = (await tenantRepository.create('Other Co', 'enterprise'));
    expect(first.join_code).not.toBe(second.join_code);
  });
});
