import express, { Request, Response } from 'express';
import dashboardRepository from '../repositories/dashboardRepository';
import { resolveAccessibleDepartmentIds } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

router.get('/', (req: Request, res: Response) => {
  const { from, to } = req.query;

  if (from !== undefined && !isValidMonth(from)) {
    return res.status(400).json({ error: 'from must be in YYYY-MM format' });
  }
  if (to !== undefined && !isValidMonth(to)) {
    return res.status(400).json({ error: 'to must be in YYYY-MM format' });
  }
  if (isValidMonth(from) && isValidMonth(to) && from > to) {
    return res.status(400).json({ error: 'from must not be after to' });
  }

  // Only one of from/to given means "just that single month" — defaulting
  // the missing side to today's month (instead of mirroring the given side)
  // could silently produce an inverted or unintended range.
  const resolvedFrom = isValidMonth(from) ? from : isValidMonth(to) ? to : undefined;
  const resolvedTo = isValidMonth(to) ? to : resolvedFrom;

  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  res.json(dashboardRepository.findSummary(resolvedFrom, resolvedTo, accessibleIds));
});

export default router;
