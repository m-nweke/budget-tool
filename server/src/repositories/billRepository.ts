import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { Bill, CreateBillDto } from '../types';

const COLUMNS = 'id, tenant_id, name, category, amount, due_day, active, bank_account_id, start_on, end_date';

const billRepository = {
  findAll(tenantId: number): Bill[] {
    return db.prepare(`SELECT ${COLUMNS} FROM bills WHERE tenant_id = ?`).all(tenantId) as Bill[];
  },

  findById(id: number | string): Bill | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM bills WHERE id = ?`).get(id) as Bill | undefined;
  },

  // Cash-flow simulation only (cashflowRepository) — every active bill
  // across every personal tenant, same shape as
  // recurringTransactionRepository.findAllActive's tenant-scoped fallback.
  findAllActive(tenantId: number): Bill[] {
    return db.prepare(`SELECT ${COLUMNS} FROM bills WHERE tenant_id = ? AND active = 1`).all(tenantId) as Bill[];
  },

  create(
    { name, category, amount, due_day, active, bank_account_id, start_on, end_date }: CreateBillDto,
    tenantId: number
  ): Bill {
    const result = db
      .prepare(
        'INSERT INTO bills (tenant_id, name, category, amount, due_day, active, bank_account_id, start_on, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        tenantId,
        name,
        category,
        amount,
        due_day,
        active === false ? 0 : 1,
        bank_account_id ?? null,
        start_on || todayISO(),
        end_date ?? null
      );
    return billRepository.findById(result.lastInsertRowid as number) as Bill;
  },

  // Like savingsGoalRepository.update, an omitted bank_account_id/end_date
  // means "leave it as-is" (undefined), while an explicit null clears it —
  // only start_on falls back to "today" when neither the request nor the
  // existing row has one, mirroring create's default.
  update(
    id: number | string,
    { name, category, amount, due_day, active, bank_account_id, start_on, end_date }: CreateBillDto
  ): Bill {
    const existing = billRepository.findById(id);
    db.prepare(
      'UPDATE bills SET name = ?, category = ?, amount = ?, due_day = ?, active = ?, bank_account_id = ?, start_on = ?, end_date = ? WHERE id = ?'
    ).run(
      name,
      category,
      amount,
      due_day,
      active === false ? 0 : 1,
      bank_account_id === undefined ? (existing?.bank_account_id ?? null) : bank_account_id,
      start_on || existing?.start_on || todayISO(),
      end_date === undefined ? (existing?.end_date ?? null) : end_date,
      id
    );
    return billRepository.findById(id) as Bill;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM bills WHERE id = ?').run(id);
  },
};

export default billRepository;
