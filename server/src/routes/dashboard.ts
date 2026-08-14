import { Router } from 'express';
import { db } from '../db';
import { HttpError } from '../middleware/errorHandler';
import { currentMonth, isValidMonth, monthCount, monthStart, monthEnd } from '../utils/dateMath';
import type { Category, DashboardResponse } from '../types';

export const dashboardRouter = Router();

dashboardRouter.get('/', (req, res) => {
  const fromParam = req.query.from as string | undefined;
  const toParam = req.query.to as string | undefined;

  let from: string;
  let to: string;

  if (!fromParam && !toParam) {
    from = to = currentMonth();
  } else if (fromParam && !toParam) {
    if (!isValidMonth(fromParam)) throw new HttpError(400, 'from must be YYYY-MM with a valid month');
    from = to = fromParam;
  } else if (!fromParam && toParam) {
    if (!isValidMonth(toParam)) throw new HttpError(400, 'to must be YYYY-MM with a valid month');
    from = to = toParam;
  } else {
    if (!isValidMonth(fromParam!)) throw new HttpError(400, 'from must be YYYY-MM with a valid month');
    if (!isValidMonth(toParam!)) throw new HttpError(400, 'to must be YYYY-MM with a valid month');
    from = fromParam!;
    to = toParam!;
    if (from > to) throw new HttpError(400, 'from must be <= to');
  }

  const rangeStart = monthStart(from);
  const rangeEnd = monthEnd(to);
  const months = monthCount(from, to);

  const categories = db
    .prepare('SELECT * FROM categories WHERE start_on <= ? ORDER BY name')
    .all(rangeEnd) as Category[];

  const spentStmt = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE category_id = ? AND date >= ? AND date <= ?'
  );

  const response: DashboardResponse = {
    from,
    to,
    categories: categories.map((category) => {
      // Scope the effective range to the later of the requested range start
      // or the category's own start_on, so budget scaling reflects the
      // months the category was actually active for.
      const effectiveStart = category.start_on > rangeStart ? category.start_on.slice(0, 7) : from;
      const effectiveMonths = monthCount(effectiveStart, to);
      const spent = (spentStmt.get(category.id, rangeStart, rangeEnd) as { total: number }).total;

      return {
        id: category.id,
        name: category.name,
        budgeted_amount: category.budgeted_amount * effectiveMonths,
        spent_amount: spent,
      };
    }),
  };

  res.json(response);
});
