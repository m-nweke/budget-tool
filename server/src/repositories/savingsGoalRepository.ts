import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { SavingsGoal, CreateSavingsGoalDto } from '../types';

const COLUMNS = 'id, tenant_id, name, target_amount, start_on, target_date, bank_account_id';

const savingsGoalRepository = {
  findAll(tenantId: number): SavingsGoal[] {
    return db.prepare(`SELECT ${COLUMNS} FROM savings_goals WHERE tenant_id = ?`).all(tenantId) as SavingsGoal[];
  },

  findById(id: number | string): SavingsGoal | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM savings_goals WHERE id = ?`).get(id) as SavingsGoal | undefined;
  },

  create(
    { name, target_amount, start_on, target_date, bank_account_id }: CreateSavingsGoalDto,
    tenantId: number
  ): SavingsGoal {
    const result = db
      .prepare(
        'INSERT INTO savings_goals (tenant_id, name, target_amount, start_on, target_date, bank_account_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(tenantId, name, target_amount, start_on || todayISO(), target_date ?? null, bank_account_id ?? null);
    return savingsGoalRepository.findById(result.lastInsertRowid as number) as SavingsGoal;
  },

  // Like categoryRepository.update, an omitted start_on means "leave it
  // as-is", not "reset to today". target_date/bank_account_id get the same
  // treatment: both are optional on CreateSavingsGoalDto, so `undefined`
  // (the field wasn't sent) must preserve the existing value — only an
  // explicit `null` clears it. Using `?? null` unconditionally would treat
  // "omitted" the same as "explicitly cleared," silently unlinking the
  // account or dropping the target date on an update that only meant to
  // change the name/amount.
  update(
    id: number | string,
    { name, target_amount, start_on, target_date, bank_account_id }: CreateSavingsGoalDto
  ): SavingsGoal {
    const existing = savingsGoalRepository.findById(id);
    db.prepare(
      'UPDATE savings_goals SET name = ?, target_amount = ?, start_on = ?, target_date = ?, bank_account_id = ? WHERE id = ?'
    ).run(
      name,
      target_amount,
      start_on || existing?.start_on || todayISO(),
      target_date === undefined ? (existing?.target_date ?? null) : target_date,
      bank_account_id === undefined ? (existing?.bank_account_id ?? null) : bank_account_id,
      id
    );
    return savingsGoalRepository.findById(id) as SavingsGoal;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
  },
};

export default savingsGoalRepository;
