import db from '../db';
import type { Debt, CreateDebtDto } from '../types';

const COLUMNS = 'id, tenant_id, name, balance, interest_rate, minimum_payment, due_day';

const debtRepository = {
  findAll(tenantId: number): Debt[] {
    return db.prepare(`SELECT ${COLUMNS} FROM debts WHERE tenant_id = ?`).all(tenantId) as Debt[];
  },

  findById(id: number | string): Debt | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM debts WHERE id = ?`).get(id) as Debt | undefined;
  },

  create(
    { name, balance, interest_rate, minimum_payment, due_day }: CreateDebtDto,
    tenantId: number
  ): Debt {
    const result = db
      .prepare(
        'INSERT INTO debts (tenant_id, name, balance, interest_rate, minimum_payment, due_day) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(tenantId, name, balance, interest_rate, minimum_payment, due_day);
    return debtRepository.findById(result.lastInsertRowid as number) as Debt;
  },

  update(
    id: number | string,
    { name, balance, interest_rate, minimum_payment, due_day }: CreateDebtDto
  ): Debt {
    db.prepare(
      'UPDATE debts SET name = ?, balance = ?, interest_rate = ?, minimum_payment = ?, due_day = ? WHERE id = ?'
    ).run(name, balance, interest_rate, minimum_payment, due_day, id);
    return debtRepository.findById(id) as Debt;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM debts WHERE id = ?').run(id);
  },
};

export default debtRepository;
