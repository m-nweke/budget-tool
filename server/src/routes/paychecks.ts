import express, { Request, Response } from 'express';
import paycheckRepository from '../repositories/paycheckRepository';
import bankAccountRepository from '../repositories/bankAccountRepository';
import { requireRole } from '../middleware/scoping';
import type { CreatePaycheckDto, AuthUser, PaycheckFrequency, SplitType } from '../types';

const router = express.Router();

const VALID_FREQUENCIES: PaycheckFrequency[] = ['weekly', 'biweekly', 'semimonthly', 'monthly'];
const VALID_SPLIT_TYPES: SplitType[] = ['percentage', 'fixed'];

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(paycheckRepository.findAll(user.tenant_id));
});

// Validates the paycheck's own fields, and every split: split_type/value
// shape plus that each bank_account_id actually belongs to the caller's
// tenant — a split pointing at another tenant's account would be a
// data-isolation bug, not just bad input, so it's checked here rather than
// left to a foreign-key constraint (which wouldn't catch cross-tenant, only
// nonexistent, ids).
function validateBody(body: CreatePaycheckDto, user: AuthUser): string | null {
  const { label, amount, frequency, next_pay_date, splits } = body;
  if (!label || amount === undefined || amount === null || !next_pay_date) {
    return 'label, amount, and next_pay_date are required';
  }
  if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
    return `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`;
  }
  if (!Array.isArray(splits)) {
    return 'splits must be an array (may be empty)';
  }
  for (const split of splits) {
    if (!split.split_type || !VALID_SPLIT_TYPES.includes(split.split_type)) {
      return `each split's split_type must be one of: ${VALID_SPLIT_TYPES.join(', ')}`;
    }
    if (typeof split.value !== 'number' || split.value <= 0) {
      return 'each split value must be a positive number';
    }
    if (split.split_type === 'percentage' && split.value > 100) {
      return 'a percentage split value cannot exceed 100';
    }
    const account = bankAccountRepository.findById(split.bank_account_id);
    if (!account || account.tenant_id !== user.tenant_id) {
      return 'each split bank_account_id must reference an account in this tenant';
    }
  }
  return null;
}

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreatePaycheckDto>, res: Response) => {
  const user = req.user as AuthUser;
  const validationError = validateBody(req.body, user);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const paycheck = paycheckRepository.create(req.body, user.tenant_id);
  res.status(201).json(paycheck);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreatePaycheckDto>, res: Response) => {
  const user = req.user as AuthUser;
  const validationError = validateBody(req.body, user);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const existing = paycheckRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'paycheck not found' });
  }
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this paycheck' });
  }
  const paycheck = paycheckRepository.update(req.params.id, req.body);
  res.json(paycheck);
});

router.delete('/:id', requireRole('owner'), (req: Request<{ id: string }>, res: Response) => {
  const existing = paycheckRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'paycheck not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this paycheck' });
  }
  paycheckRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
