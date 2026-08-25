import express, { Request, Response } from 'express';
import debtPayoffPlanRepository from '../repositories/debtPayoffPlanRepository';
import debtPayoffSettingsRepository from '../repositories/debtPayoffSettingsRepository';
import { requireRole } from '../middleware/scoping';
import type { AuthUser, UpdateDebtPayoffSettingsDto } from '../types';

const router = express.Router();

const STRATEGIES = ['snowball', 'avalanche', 'custom'];

// Read-only — this data only exists under a personal tenant (see every
// other Phase 2 route), so 'owner'-only, no separate tenant_type check.
router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(debtPayoffPlanRepository.buildPlan(user.tenant_id));
});

function validateBody(body: UpdateDebtPayoffSettingsDto): string | null {
  const { monthly_amount, strategy, order } = body;
  if (typeof monthly_amount !== 'number' || Number.isNaN(monthly_amount) || monthly_amount < 0) {
    return 'monthly_amount is required and must be a non-negative number';
  }
  if (!STRATEGIES.includes(strategy)) {
    return `strategy must be one of: ${STRATEGIES.join(', ')}`;
  }
  if (strategy === 'custom' && (!Array.isArray(order) || order.length === 0)) {
    return 'order is required and must be a non-empty array when strategy is custom';
  }
  return null;
}

// Mounted at /settings under this same router (not nested under
// /api/debts) — see decision 26 for why this whole feature got its own
// router instead of extending debts.ts.
router.put('/settings', requireRole('owner'), (req: Request<{}, {}, UpdateDebtPayoffSettingsDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const user = req.user as AuthUser;
  debtPayoffSettingsRepository.upsert(user.tenant_id, req.body);
  // Returns the freshly recomputed plan (not just the settings row) so the
  // client gets an up-to-date result in one round trip.
  res.json(debtPayoffPlanRepository.buildPlan(user.tenant_id));
});

export default router;
