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
  async findAll(departmentIds?: number[], tenantId?: number): Promise<Category[]> {
    if (departmentIds) {
      if (departmentIds.length === 0) return [];
      const placeholders = departmentIds.map(() => '?').join(', ');
      return (await db.all(`SELECT ${COLUMNS} FROM categories WHERE department_id IN (${placeholders})`, ...departmentIds)) as Category[];
    }
    if (tenantId !== undefined) {
      return (await db.all(`SELECT ${COLUMNS} FROM categories WHERE tenant_id = ?`, tenantId)) as Category[];
    }
    return (await db.all(`SELECT ${COLUMNS} FROM categories`)) as Category[];
  },

  async findById(id: number | string): Promise<Category | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM categories WHERE id = ?`, id)) as
      | Category
      | undefined;
  },

  // tenantId is server-derived (req.user.tenant_id), never client input —
  // kept out of CreateCategoryDto for the same reason created_by is a
  // separate transactionRepository.create parameter, not part of
  // CreateTransactionDto.
  async create(
    { name, budgeted_amount, start_on, department_id, approval_threshold }: CreateCategoryDto,
    tenantId: number
  ): Promise<Category> {
    const result = (await db.run('INSERT INTO categories (tenant_id, name, budgeted_amount, start_on, department_id, approval_threshold) VALUES (?, ?, ?, ?, ?, ?)', tenantId, name, budgeted_amount, start_on || todayISO(), department_id, approval_threshold ?? null));
    return (await categoryRepository.findById(result.lastInsertRowid as number)) as Category;
  },

  async update(
    id: number | string,
    { name, budgeted_amount, start_on, department_id, approval_threshold }: CreateCategoryDto
  ): Promise<Category> {
    // Unlike create(), an omitted start_on here must mean "leave it as-is",
    // not "reset to today" — otherwise a caller that only means to change
    // name/budgeted_amount would silently move the category's effective
    // start date to now, dropping it off past months' dashboards.
    const existing = (await categoryRepository.findById(id));
    (await db.run('UPDATE categories SET name = ?, budgeted_amount = ?, start_on = ?, department_id = ?, approval_threshold = ? WHERE id = ?', name, budgeted_amount, start_on || existing?.start_on || todayISO(), department_id, approval_threshold ?? null, id));
    return (await categoryRepository.findById(id)) as Category;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM categories WHERE id = ?', id));
  },

  async countTransactionsFor(id: number | string): Promise<number> {
    const row = (await db.get('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?', id)) as { count: number };
    return row.count;
  },
};

export default categoryRepository;
