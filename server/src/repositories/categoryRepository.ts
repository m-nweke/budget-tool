import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { Category, CreateCategoryDto } from '../types';

const COLUMNS = 'id, tenant_id, name, budgeted_amount, start_on, department_id, approval_threshold';

const categoryRepository = {
  // departmentIds (enterprise scoping) wins when given — [] correctly
  // returns zero rows (a user with zero accessible departments), a
  // non-empty array filters to those departments. tenantId (personal
  // scoping) is the fallback when departmentIds is omitted — a personal
  // tenant's categories all have department_id = NULL, so there's nothing
  // to filter by except the tenant itself. Omitting both returns every
  // category, unscoped — used only by internal callers, never a route.
  findAll(departmentIds?: number[], tenantId?: number): Category[] {
    if (departmentIds) {
      if (departmentIds.length === 0) return [];
      const placeholders = departmentIds.map(() => '?').join(', ');
      return db
        .prepare(`SELECT ${COLUMNS} FROM categories WHERE department_id IN (${placeholders})`)
        .all(...departmentIds) as Category[];
    }
    if (tenantId !== undefined) {
      return db.prepare(`SELECT ${COLUMNS} FROM categories WHERE tenant_id = ?`).all(tenantId) as Category[];
    }
    return db.prepare(`SELECT ${COLUMNS} FROM categories`).all() as Category[];
  },

  findById(id: number | string): Category | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM categories WHERE id = ?`).get(id) as
      | Category
      | undefined;
  },

  // tenantId is server-derived (req.user.tenant_id), never client input —
  // kept out of CreateCategoryDto for the same reason created_by is a
  // separate transactionRepository.create parameter, not part of
  // CreateTransactionDto.
  create(
    { name, budgeted_amount, start_on, department_id, approval_threshold }: CreateCategoryDto,
    tenantId: number
  ): Category {
    const result = db
      .prepare(
        'INSERT INTO categories (tenant_id, name, budgeted_amount, start_on, department_id, approval_threshold) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(tenantId, name, budgeted_amount, start_on || todayISO(), department_id, approval_threshold ?? null);
    return categoryRepository.findById(result.lastInsertRowid as number) as Category;
  },

  update(
    id: number | string,
    { name, budgeted_amount, start_on, department_id, approval_threshold }: CreateCategoryDto
  ): Category {
    // Unlike create(), an omitted start_on here must mean "leave it as-is",
    // not "reset to today" — otherwise a caller that only means to change
    // name/budgeted_amount would silently move the category's effective
    // start date to now, dropping it off past months' dashboards.
    const existing = categoryRepository.findById(id);
    db.prepare(
      'UPDATE categories SET name = ?, budgeted_amount = ?, start_on = ?, department_id = ?, approval_threshold = ? WHERE id = ?'
    ).run(
      name,
      budgeted_amount,
      start_on || existing?.start_on || todayISO(),
      department_id,
      approval_threshold ?? null,
      id
    );
    return categoryRepository.findById(id) as Category;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  countTransactionsFor(id: number | string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?')
      .get(id) as { count: number };
    return row.count;
  },
};

export default categoryRepository;
