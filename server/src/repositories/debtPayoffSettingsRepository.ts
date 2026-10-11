import db from '../db';
import type { DebtPayoffSettings, UpdateDebtPayoffSettingsDto } from '../types';

const COLUMNS = 'id, tenant_id, monthly_amount, strategy, custom_order';

const debtPayoffSettingsRepository = {
  async find(tenantId: number): Promise<DebtPayoffSettings | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM debt_payoff_settings WHERE tenant_id = ?`, tenantId)) as
      | DebtPayoffSettings
      | undefined;
  },

  // One row per tenant — insert if this is the first time settings are
  // saved, otherwise update in place, rather than exposing separate
  // create/update methods a caller would have to choose between.
  async upsert(tenantId: number, dto: UpdateDebtPayoffSettingsDto): Promise<DebtPayoffSettings> {
    const customOrderJson = dto.strategy === 'custom' && dto.order ? JSON.stringify(dto.order) : null;
    const existing = (await debtPayoffSettingsRepository.find(tenantId));
    if (existing) {
      (await db.run('UPDATE debt_payoff_settings SET monthly_amount = ?, strategy = ?, custom_order = ? WHERE tenant_id = ?', dto.monthly_amount, dto.strategy, customOrderJson, tenantId));
    } else {
      (await db.run('INSERT INTO debt_payoff_settings (tenant_id, monthly_amount, strategy, custom_order) VALUES (?, ?, ?, ?)', tenantId, dto.monthly_amount, dto.strategy, customOrderJson));
    }
    return (await debtPayoffSettingsRepository.find(tenantId)) as DebtPayoffSettings;
  },
};

export default debtPayoffSettingsRepository;
