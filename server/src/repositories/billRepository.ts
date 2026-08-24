import db from '../db';
import type { Bill, CreateBillDto } from '../types';

const COLUMNS = 'id, tenant_id, name, category, amount, due_day, active';

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

  create({ name, category, amount, due_day, active }: CreateBillDto, tenantId: number): Bill {
    const result = db
      .prepare('INSERT INTO bills (tenant_id, name, category, amount, due_day, active) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tenantId, name, category, amount, due_day, active === false ? 0 : 1);
    return billRepository.findById(result.lastInsertRowid as number) as Bill;
  },

  update(id: number | string, { name, category, amount, due_day, active }: CreateBillDto): Bill {
    db.prepare('UPDATE bills SET name = ?, category = ?, amount = ?, due_day = ?, active = ? WHERE id = ?').run(
      name,
      category,
      amount,
      due_day,
      active === false ? 0 : 1,
      id
    );
    return billRepository.findById(id) as Bill;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM bills WHERE id = ?').run(id);
  },
};

export default billRepository;
