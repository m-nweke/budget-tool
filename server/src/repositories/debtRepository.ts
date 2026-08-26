import db from '../db';
import type { Debt, CreateDebtDto } from '../types';

const COLUMNS = 'id, tenant_id, name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on';

const debtRepository = {
  findAll(tenantId: number): Debt[] {
    return db.prepare(`SELECT ${COLUMNS} FROM debts WHERE tenant_id = ?`).all(tenantId) as Debt[];
  },

  findById(id: number | string): Debt | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM debts WHERE id = ?`).get(id) as Debt | undefined;
  },

  create(
    { name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on }: CreateDebtDto,
    tenantId: number
  ): Debt {
    const result = db
      .prepare(
        'INSERT INTO debts (tenant_id, name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(tenantId, name, balance, interest_rate, minimum_payment, due_day, promo_apr ?? null, promo_expires_on ?? null);
    return debtRepository.findById(result.lastInsertRowid as number) as Debt;
  },

  update(
    id: number | string,
    { name, balance, interest_rate, minimum_payment, due_day, promo_apr, promo_expires_on }: CreateDebtDto
  ): Debt {
    db.prepare(
      'UPDATE debts SET name = ?, balance = ?, interest_rate = ?, minimum_payment = ?, due_day = ?, promo_apr = ?, promo_expires_on = ? WHERE id = ?'
    ).run(name, balance, interest_rate, minimum_payment, due_day, promo_apr ?? null, promo_expires_on ?? null, id);
    return debtRepository.findById(id) as Debt;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM debts WHERE id = ?').run(id);
  },
};

export default debtRepository;
