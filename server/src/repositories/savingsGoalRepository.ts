import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { SavingsGoal, CreateSavingsGoalDto } from '../types';

const COLUMNS = 'id, tenant_id, name, target_amount, start_on, target_date, bank_account_id, saved_amount';

const savingsGoalRepository = {
  findAll(tenantId: number): SavingsGoal[] {
    return db.prepare(`SELECT ${COLUMNS} FROM savings_goals WHERE tenant_id = ?`).all(tenantId) as SavingsGoal[];
  },

  findById(id: number | string): SavingsGoal | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM savings_goals WHERE id = ?`).get(id) as SavingsGoal | undefined;
  },

  create(
    { name, target_amount, start_on, target_date, bank_account_id, saved_amount }: CreateSavingsGoalDto,
    tenantId: number
  ): SavingsGoal {
    const result = db
      .prepare(
        'INSERT INTO savings_goals (tenant_id, name, target_amount, start_on, target_date, bank_account_id, saved_amount) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        tenantId,
        name,
        target_amount,
        start_on || todayISO(),
        target_date ?? null,
        bank_account_id ?? null,
        saved_amount ?? 0
      );
    return savingsGoalRepository.findById(result.lastInsertRowid as number) as SavingsGoal;
  },

  // Like categoryRepository.update, an omitted start_on means "leave it
  // as-is", not "reset to today".
  update(
    id: number | string,
    { name, target_amount, start_on, target_date, bank_account_id, saved_amount }: CreateSavingsGoalDto
  ): SavingsGoal {
    const existing = savingsGoalRepository.findById(id);
    db.prepare(
      'UPDATE savings_goals SET name = ?, target_amount = ?, start_on = ?, target_date = ?, bank_account_id = ?, saved_amount = ? WHERE id = ?'
    ).run(
      name,
      target_amount,
      start_on || existing?.start_on || todayISO(),
      target_date ?? null,
      bank_account_id ?? null,
      saved_amount ?? existing?.saved_amount ?? 0,
      id
    );
    return savingsGoalRepository.findById(id) as SavingsGoal;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
  },
};

export default savingsGoalRepository;
