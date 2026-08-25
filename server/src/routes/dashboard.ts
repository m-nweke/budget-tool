import express, { Request, Response } from 'express';
import dashboardRepository from '../repositories/dashboardRepository';
import { resolveScope } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

function isValidDepartmentId(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

router.get('/', (req: Request, res: Response) => {
  const { from, to, department_id: departmentIdParam } = req.query;

  if (from !== undefined && !isValidMonth(from)) {
    return res.status(400).json({ error: 'from must be in YYYY-MM format' });
  }
  if (to !== undefined && !isValidMonth(to)) {
    return res.status(400).json({ error: 'to must be in YYYY-MM format' });
  }
  if (isValidMonth(from) && isValidMonth(to) && from > to) {
    return res.status(400).json({ error: 'from must not be after to' });
  }
  if (departmentIdParam !== undefined && !isValidDepartmentId(departmentIdParam)) {
    return res.status(400).json({ error: 'department_id must be a positive integer' });
  }

  // Only one of from/to given means "just that single month" — defaulting
  // the missing side to today's month (instead of mirroring the given side)
  // could silently produce an inverted or unintended range.
  const resolvedFrom = isValidMonth(from) ? from : isValidMonth(to) ? to : undefined;
  const resolvedTo = isValidMonth(to) ? to : resolvedFrom;

  const scope = resolveScope(req.user as AuthUser);

  let departmentIds = scope.departmentIds;
  if (departmentIdParam !== undefined) {
    // A personal tenant (scope.departmentIds undefined, scoped by tenantId
    // instead) has no departments to narrow to — reject rather than
    // silently ignoring the param.
    if (!departmentIds) {
      return res.status(400).json({ error: 'department_id is not applicable for a personal tenant' });
    }
    const requestedId = Number(departmentIdParam);
    // Narrow, don't bypass: requesting a department outside the caller's
    // accessible set must fail closed, not fall back to the full scope.
    if (!departmentIds.includes(requestedId)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    departmentIds = [requestedId];
  }

  res.json(dashboardRepository.findSummary(resolvedFrom, resolvedTo, departmentIds, scope.tenantId));
});

export default router;
