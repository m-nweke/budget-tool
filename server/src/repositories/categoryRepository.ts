import db from '../db';
import { todayISO } from '../utils/dateUtils';
import type { Category, CreateCategoryDto } from '../types';

const COLUMNS = 'id, name, budgeted_amount, start_on, department_id, approval_threshold';

const categoryRepository = {
  // Omitting departmentIds (undefined) returns every category, unscoped —
  // used by generateDue()/dashboard internals that already operate
  // per-user via their own scoping, not directly by a route handler.
  // Passing an empty array (a user with zero accessible departments)
  // correctly returns zero rows, not "no filter."
  findAll(departmentIds?: number[]): Category[] {
    if (!departmentIds) {
      return db.prepare(`SELECT ${COLUMNS} FROM categories`).all() as Category[];
    }
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => '?').join(', ');
    return db
      .prepare(`SELECT ${COLUMNS} FROM categories WHERE department_id IN (${placeholders})`)
      .all(...departmentIds) as Category[];
  },

  findById(id: number | string): Category | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM categories WHERE id = ?`).get(id) as
      | Category
      | undefined;
  },

  create({ name, budgeted_amount, start_on, department_id, approval_threshold }: CreateCategoryDto): Category {
    const result = db
      .prepare(
        'INSERT INTO categories (name, budgeted_amount, start_on, department_id, approval_threshold) VALUES (?, ?, ?, ?, ?)'
      )
      .run(name, budgeted_amount, start_on || todayISO(), department_id, approval_threshold ?? null);
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
