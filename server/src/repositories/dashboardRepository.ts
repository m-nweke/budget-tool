import db from '../db';
import { monthRangeSpan, monthCount, currentMonth } from '../utils/dateUtils';
import type { DashboardRow } from '../types';

const dashboardRepository = {
  // Omitting departmentIds returns every category, unscoped (no internal
  // caller currently needs this, but kept consistent with the other
  // repos' scoping convention). A route handler always passes the
  // caller's accessible ids; an empty array (zero access) returns zero rows.
  findSummary(from: string = currentMonth(), to: string = from, departmentIds?: number[]): DashboardRow[] {
    if (departmentIds && departmentIds.length === 0) return [];
    const { start, end } = monthRangeSpan(from, to);
    const months = monthCount(from, to);
    const departmentFilter = departmentIds
      ? `AND c.department_id IN (${departmentIds.map(() => '?').join(', ')})`
      : '';
    return db
      .prepare(
        `SELECT
           c.id AS category_id,
           c.name AS name,
           c.budgeted_amount * ? AS budgeted_amount,
           COALESCE(SUM(CASE WHEN t.approved = 1 THEN t.amount ELSE 0 END), 0) AS actual_spend,
           (c.budgeted_amount * ?) - COALESCE(SUM(CASE WHEN t.approved = 1 THEN t.amount ELSE 0 END), 0) AS difference
         FROM categories c
         LEFT JOIN transactions t
           ON t.category_id = c.id AND t.date >= ? AND t.date < ?
         WHERE c.start_on < ? ${departmentFilter}
         GROUP BY c.id, c.name, c.budgeted_amount`
      )
      .all(months, months, start, end, end, ...(departmentIds ?? [])) as DashboardRow[];
  },
};

export default dashboardRepository;
