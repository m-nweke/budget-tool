import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { Bill, CreateBillDto } from '../types';

const COLUMNS = 'id, tenant_id, name, category, amount, due_day, active, bank_account_id, start_on, end_date';

const billRepository = {
  async findAll(tenantId: number): Promise<Bill[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM bills WHERE tenant_id = ?`, tenantId)) as Bill[];
  },

  async findById(id: number | string): Promise<Bill | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM bills WHERE id = ?`, id)) as Bill | undefined;
  },

  // Cash-flow simulation only (cashflowRepository) — every active bill
  // across every personal tenant, same shape as
  // recurringTransactionRepository.findAllActive's tenant-scoped fallback.
  async findAllActive(tenantId: number): Promise<Bill[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM bills WHERE tenant_id = ? AND active = 1`, tenantId)) as Bill[];
  },

  async create(
    { name, category, amount, due_day, active, bank_account_id, start_on, end_date }: CreateBillDto,
    tenantId: number
  ): Promise<Bill> {
    const result = (await db.run('INSERT INTO bills (tenant_id, name, category, amount, due_day, active, bank_account_id, start_on, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', tenantId, name, category, amount, due_day, active === false ? 0 : 1, bank_account_id ?? null, start_on || todayISO(), end_date ?? null));
    return (await billRepository.findById(result.lastInsertRowid as number)) as Bill;
  },

  // Like savingsGoalRepository.update, an omitted bank_account_id/end_date
  // means "leave it as-is" (undefined), while an explicit null clears it —
  // only start_on falls back to "today" when neither the request nor the
  // existing row has one, mirroring create's default.
  async update(
    id: number | string,
    { name, category, amount, due_day, active, bank_account_id, start_on, end_date }: CreateBillDto
  ): Promise<Bill> {
    const existing = (await billRepository.findById(id));
    (await db.run('UPDATE bills SET name = ?, category = ?, amount = ?, due_day = ?, active = ?, bank_account_id = ?, start_on = ?, end_date = ? WHERE id = ?', name, category, amount, due_day, active === false ? 0 : 1, bank_account_id === undefined ? (existing?.bank_account_id ?? null) : bank_account_id, start_on || existing?.start_on || todayISO(), end_date === undefined ? (existing?.end_date ?? null) : end_date, id));
    return (await billRepository.findById(id)) as Bill;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM bills WHERE id = ?', id));
  },
};

export default billRepository;
