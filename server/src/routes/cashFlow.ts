import express, { Request, Response } from 'express';
import { requireRole } from '../middleware/scoping';
import { simulateCashFlow } from '../lib/cashFlow';
import type { AuthUser } from '../types';

const router = express.Router();

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;

  const rawMonths = req.query.months;
  const months = typeof rawMonths === 'string' ? Number(rawMonths) : 3;
  if (
    (rawMonths !== undefined && typeof rawMonths !== 'string') ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 12
  ) {
    return res.status(400).json({ error: 'months must be an integer between 1 and 12' });
  }

  res.json(simulateCashFlow(user.tenant_id, months));
});

export default router;
