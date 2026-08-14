import db from '../db';
import { monthRangeSpan, monthCount, currentMonth } from '../utils/dateUtils';
import type { DashboardRow } from '../types';

const dashboardRepository = {
  findSummary(from: string = currentMonth(), to: string = from): DashboardRow[] {
    const { start, end } = monthRangeSpan(from, to);
    const months = monthCount(from, to);
    return db
      .prepare(
        `SELECT
           c.id AS category_id,
           c.name AS name,
           c.budgeted_amount * ? AS budgeted_amount,
           COALESCE(SUM(t.amount), 0) AS actual_spend,
           (c.budgeted_amount * ?) - COALESCE(SUM(t.amount), 0) AS difference
         FROM categories c
         LEFT JOIN transactions t
           ON t.category_id = c.id AND t.date >= ? AND t.date < ?
         WHERE c.start_on < ?
         GROUP BY c.id, c.name, c.budgeted_amount`
      )
      .all(months, months, start, end, end) as DashboardRow[];
  },
};

export default dashboardRepository;
