import express, { Request, Response } from 'express';
import { requireRole } from '../middleware/scoping';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import { simulateCashFlow } from '../lib/cashFlow';
import type { AuthUser } from '../types';

const router = express.Router();

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;

  const rawMonths = req.query.months;
  const months = rawMonths !== undefined ? parseInt(String(rawMonths), 10) : 3;
  if (isNaN(months) || months < 1 || months > 12) {
    return res.status(400).json({ error: 'months must be an integer between 1 and 12' });
  }

  // Ensure recurring templates are current before projecting forward,
  // so next_run_date reflects the actual next future occurrence.
  recurringTransactionRepository.generateDue();

  res.json(simulateCashFlow(user.tenant_id, months));
});

export default router;
