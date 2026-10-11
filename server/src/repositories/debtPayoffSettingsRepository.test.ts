import { describe, it, expect, beforeEach } from 'vitest';
import db from '../db';
import debtPayoffSettingsRepository from './debtPayoffSettingsRepository';

let tenantId: number;

beforeEach(async () => {
  (await db.exec('DELETE FROM debt_payoff_settings; DELETE FROM tenants;'));
  tenantId = (await db.run("INSERT INTO tenants (name, type) VALUES ('Pat''s Budget', 'personal')"))
    .lastInsertRowid as number;
});

describe('debtPayoffSettingsRepository', () => {
  it('returns undefined before any settings are saved', async () => {
    (await expect((await debtPayoffSettingsRepository.find(tenantId))).toBeUndefined());
  });

  it('inserts on first upsert, updates in place on subsequent calls', async () => {
    const created = (await debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 300, strategy: 'snowball' }));
    expect(created).toMatchObject({ tenant_id: tenantId, monthly_amount: 300, strategy: 'snowball', custom_order: null });

    const updated = (await debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 450, strategy: 'avalanche' }));
    expect(updated.id).toBe(created.id);
    expect(updated).toMatchObject({ monthly_amount: 450, strategy: 'avalanche' });
  });

  it('JSON-encodes order into custom_order only when strategy is custom', async () => {
    const withOrder = (await debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 300, strategy: 'custom', order: [3, 1, 2] }));
    expect(withOrder.custom_order).toBe('[3,1,2]');

    const withoutOrder = (await debtPayoffSettingsRepository.upsert(tenantId, { monthly_amount: 300, strategy: 'snowball', order: [3, 1, 2] }));
    expect(withoutOrder.custom_order).toBeNull();
  });
});
