import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { SavingsGoal, CreateSavingsGoalDto } from '../types';

const COLUMNS = 'id, tenant_id, name, target_amount, start_on, target_date, bank_account_id, saved_amount';

const savingsGoalRepository = {
  async findAll(tenantId: number): Promise<SavingsGoal[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM savings_goals WHERE tenant_id = ?`, tenantId)) as SavingsGoal[];
  },

  async findById(id: number | string): Promise<SavingsGoal | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM savings_goals WHERE id = ?`, id)) as SavingsGoal | undefined;
  },

  async create(
    { name, target_amount, start_on, target_date, bank_account_id, saved_amount }: CreateSavingsGoalDto,
    tenantId: number
  ): Promise<SavingsGoal> {
    const result = (await db.run('INSERT INTO savings_goals (tenant_id, name, target_amount, start_on, target_date, bank_account_id, saved_amount) VALUES (?, ?, ?, ?, ?, ?, ?)', tenantId, name, target_amount, start_on || todayISO(), target_date ?? null, bank_account_id ?? null, saved_amount ?? 0));
    return (await savingsGoalRepository.findById(result.lastInsertRowid as number)) as SavingsGoal;
  },

  // Like categoryRepository.update, an omitted start_on means "leave it
  // as-is", not "reset to today". target_date/bank_account_id get the same
  // treatment: both are optional on CreateSavingsGoalDto, so `undefined`
  // (the field wasn't sent) must preserve the existing value — only an
  // explicit `null` clears it. Using `?? null` unconditionally would treat
  // "omitted" the same as "explicitly cleared," silently unlinking the
  // account or dropping the target date on an update that only meant to
  // change the name/amount.
  async update(
    id: number | string,
    { name, target_amount, start_on, target_date, bank_account_id, saved_amount }: CreateSavingsGoalDto
  ): Promise<SavingsGoal> {
    const existing = (await savingsGoalRepository.findById(id));
    (await db.run('UPDATE savings_goals SET name = ?, target_amount = ?, start_on = ?, target_date = ?, bank_account_id = ?, saved_amount = ? WHERE id = ?', name, target_amount, start_on || existing?.start_on || todayISO(), target_date === undefined ? (existing?.target_date ?? null) : target_date, bank_account_id === undefined ? (existing?.bank_account_id ?? null) : bank_account_id, saved_amount ?? existing?.saved_amount ?? 0, id));
    return (await savingsGoalRepository.findById(id)) as SavingsGoal;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM savings_goals WHERE id = ?', id));
  },
};

export default savingsGoalRepository;
