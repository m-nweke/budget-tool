import db from '../db';
import { monthRange, currentMonth } from '../utils/dateUtils';
import type { DashboardRow } from '../types';

const dashboardRepository = {
  findSummary(month: string = currentMonth()): DashboardRow[] {
    const { start, end } = monthRange(month);
    return db
      .prepare(
        `SELECT
           c.id AS category_id,
           c.name AS name,
           c.budgeted_amount AS budgeted_amount,
           COALESCE(SUM(t.amount), 0) AS actual_spend,
           c.budgeted_amount - COALESCE(SUM(t.amount), 0) AS difference
         FROM categories c
         LEFT JOIN transactions t
           ON t.category_id = c.id AND t.date >= ? AND t.date < ?
         WHERE c.created_at < ?
         GROUP BY c.id, c.name, c.budgeted_amount`
      )
      .all(start, end, end) as DashboardRow[];
  },
};

export default dashboardRepository;
