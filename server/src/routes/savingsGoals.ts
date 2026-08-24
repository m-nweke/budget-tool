import express, { Request, Response } from 'express';
import savingsGoalRepository from '../repositories/savingsGoalRepository';
import bankAccountRepository from '../repositories/bankAccountRepository';
import { requireRole } from '../middleware/scoping';
import type { CreateSavingsGoalDto, AuthUser } from '../types';

const router = express.Router();

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(savingsGoalRepository.findAll(user.tenant_id));
});

// A linked bank_account_id must belong to the caller's own tenant — a
// null-check alone (bank_account_id doesn't exist) isn't enough, since a
// value could otherwise point at another tenant's account.
function validateLinkedAccount(
  user: AuthUser,
  bankAccountId: number | null | undefined
): { error: string } | null {
  if (bankAccountId === null || bankAccountId === undefined) return null;
  const account = bankAccountRepository.findById(bankAccountId);
  if (!account || account.tenant_id !== user.tenant_id) {
    return { error: 'bank_account_id does not reference an account in this tenant' };
  }
  return null;
}

function validateSavedAmount(savedAmount: unknown): string | null {
  if (savedAmount === undefined) return null;
  if (typeof savedAmount !== 'number' || savedAmount < 0) {
    return 'saved_amount must be a non-negative number';
  }
  return null;
}

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateSavingsGoalDto>, res: Response) => {
  const { name, target_amount, start_on, target_date, bank_account_id, saved_amount } = req.body;
  if (!name || target_amount === undefined || target_amount === null) {
    return res.status(400).json({ error: 'name and target_amount are required' });
  }
  const savedAmountError = validateSavedAmount(saved_amount);
  if (savedAmountError) {
    return res.status(400).json({ error: savedAmountError });
  }
  const user = req.user as AuthUser;
  const linkError = validateLinkedAccount(user, bank_account_id);
  if (linkError) {
    return res.status(400).json(linkError);
  }
  const goal = savingsGoalRepository.create(
    { name, target_amount, start_on, target_date, bank_account_id, saved_amount },
    user.tenant_id
  );
  res.status(201).json(goal);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateSavingsGoalDto>, res: Response) => {
  const { name, target_amount, start_on, target_date, bank_account_id, saved_amount } = req.body;
  if (!name || target_amount === undefined || target_amount === null) {
    return res.status(400).json({ error: 'name and target_amount are required' });
  }
  const savedAmountError = validateSavedAmount(saved_amount);
  if (savedAmountError) {
    return res.status(400).json({ error: savedAmountError });
  }
  const existing = savingsGoalRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'savings goal not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this savings goal' });
  }
  const linkError = validateLinkedAccount(user, bank_account_id);
  if (linkError) {
    return res.status(400).json(linkError);
  }
  const goal = savingsGoalRepository.update(req.params.id, {
    name,
    target_amount,
    start_on,
    target_date,
    bank_account_id,
    saved_amount,
  });
  res.json(goal);
});

router.delete('/:id', requireRole('owner'), (req: Request<{ id: string }>, res: Response) => {
  const existing = savingsGoalRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'savings goal not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this savings goal' });
  }
  savingsGoalRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
