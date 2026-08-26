import db from '../db';
import type { DebtPayoffSettings, UpdateDebtPayoffSettingsDto } from '../types';

const COLUMNS = 'id, tenant_id, monthly_amount, strategy, custom_order';

const debtPayoffSettingsRepository = {
  find(tenantId: number): DebtPayoffSettings | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM debt_payoff_settings WHERE tenant_id = ?`).get(tenantId) as
      | DebtPayoffSettings
      | undefined;
  },

  // One row per tenant — insert if this is the first time settings are
  // saved, otherwise update in place, rather than exposing separate
  // create/update methods a caller would have to choose between.
  upsert(tenantId: number, dto: UpdateDebtPayoffSettingsDto): DebtPayoffSettings {
    const customOrderJson = dto.strategy === 'custom' && dto.order ? JSON.stringify(dto.order) : null;
    const existing = debtPayoffSettingsRepository.find(tenantId);
    if (existing) {
      db.prepare('UPDATE debt_payoff_settings SET monthly_amount = ?, strategy = ?, custom_order = ? WHERE tenant_id = ?').run(
        dto.monthly_amount,
        dto.strategy,
        customOrderJson,
        tenantId
      );
    } else {
      db.prepare(
        'INSERT INTO debt_payoff_settings (tenant_id, monthly_amount, strategy, custom_order) VALUES (?, ?, ?, ?)'
      ).run(tenantId, dto.monthly_amount, dto.strategy, customOrderJson);
    }
    return debtPayoffSettingsRepository.find(tenantId) as DebtPayoffSettings;
  },
};

export default debtPayoffSettingsRepository;
