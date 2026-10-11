import db from '../db';
import type { Debt, CreateDebtDto } from '../types';

const COLUMNS = 'id, tenant_id, name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on';

const debtRepository = {
  async findAll(tenantId: number): Promise<Debt[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM debts WHERE tenant_id = ?`, tenantId)) as Debt[];
  },

  async findById(id: number | string): Promise<Debt | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM debts WHERE id = ?`, id)) as Debt | undefined;
  },

  async create(
    { name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on }: CreateDebtDto,
    tenantId: number
  ): Promise<Debt> {
    const result = (await db.run('INSERT INTO debts (tenant_id, name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', tenantId, name, balance, interest_rate, minimum_payment, due_day, promo_apr ?? null, promo_expires_on ?? null));
    return (await debtRepository.findById(result.lastInsertRowid as number)) as Debt;
  },

  async update(
    id: number | string,
    { name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on }: CreateDebtDto
  ): Promise<Debt> {
    (await db.run('UPDATE debts SET name = ?, balance = ?, interest_rate = ?, minimum_payment = ?, due_day = ?, promo_apr = ?, promo_expires_on = ? WHERE id = ?', name, balance, interest_rate, minimum_payment, due_day, promo_apr ?? null, promo_expires_on ?? null, id));
    return (await debtRepository.findById(id)) as Debt;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM debts WHERE id = ?', id));
  },
};

export default debtRepository;
