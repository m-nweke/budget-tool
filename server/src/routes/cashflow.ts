import express, { Request, Response } from 'express';
import cashflowRepository from '../repositories/cashflowRepository';
import { requireRole } from '../middleware/scoping';
import { addDays, todayISO } from '../utils/dateUtils';
import type { AuthUser } from '../types';

const router = express.Router();

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

// Read-only — this data only exists under a personal tenant (see every
// other Phase 2 route), so 'owner'-only, no separate tenant_type check.
router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const { days } = req.query;
  let windowDays = DEFAULT_DAYS;
  if (days !== undefined) {
    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) {
      return res.status(400).json({ error: `days must be an integer between 1 and ${MAX_DAYS}` });
    }
    windowDays = parsed;
  }

  const user = req.user as AuthUser;
  const from = todayISO();
  const to = addDays(from, windowDays);
  res.json(cashflowRepository.simulate(user.tenant_id, from, to));
});

export default router;
