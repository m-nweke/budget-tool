import db from '../db';
import { monthRangeSpan, monthCount, currentMonth } from '../utils/dateUtils';
import type { DashboardRow } from '../types';

const dashboardRepository = {
  // departmentIds (enterprise) wins when given; tenantId (personal) is the
  // fallback for a tenant with no departments at all. Omitting both
  // returns every category, unscoped (no internal caller needs this, kept
  // consistent with the other repos' scoping convention). An empty
  // departmentIds array (zero accessible departments) returns zero rows.
  findSummary(
    from: string = currentMonth(),
    to: string = from,
    departmentIds?: number[],
    tenantId?: number
  ): DashboardRow[] {
    if (departmentIds && departmentIds.length === 0) return [];
    const { start, end } = monthRangeSpan(from, to);
    const months = monthCount(from, to);
    let scopeFilter = '';
    let scopeParams: number[] = [];
    if (departmentIds) {
      scopeFilter = `AND c.department_id IN (${departmentIds.map(() => '?').join(', ')})`;
      scopeParams = departmentIds;
    } else if (tenantId !== undefined) {
      scopeFilter = 'AND c.tenant_id = ?';
      scopeParams = [tenantId];
    }
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
         WHERE c.start_on < ? ${scopeFilter}
         GROUP BY c.id, c.name, c.budgeted_amount`
      )
      .all(months, months, start, end, end, ...scopeParams) as DashboardRow[];
  },
};

export default dashboardRepository;
