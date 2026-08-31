import express, { Request, Response } from 'express';
import bankAccountRepository from '../repositories/bankAccountRepository';
import { requireRole } from '../middleware/scoping';
import type { CreateBankAccountDto, AuthUser, BankAccountType } from '../types';

const router = express.Router();

const VALID_TYPES: BankAccountType[] = ['checking', 'savings', 'other'];

// owner-only on every verb, unlike categories/transactions — these tables
// only ever exist under a personal tenant, so there's no enterprise-role
// read case to keep open (see the plan's confirmed access decision).
router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(bankAccountRepository.findAll(user.tenant_id));
});

// apy is optional on every account type (not restricted to 'savings' — a
// checking account promo rate isn't unheard of), but when given must be a
// sane non-negative percentage rather than a raw decimal fraction someone
// pasted in (0.042 instead of 4.2), which the UI would render nonsensically.
function validateApy(apy: unknown): string | null {
  if (apy === undefined || apy === null) return null;
  if (typeof apy !== 'number' || !Number.isFinite(apy) || apy < 0 || apy > 100) {
    return 'apy must be a number between 0 and 100 (a percentage, e.g. 4.5 for 4.5%)';
  }
  return null;
}

// Free-text (see bank_accounts.institution comment) — just bounded so a
// pasted essay can't land in what's meant to be a short badge label.
function validateInstitution(institution: unknown): string | null {
  if (institution === undefined || institution === null) return null;
  if (typeof institution !== 'string' || institution.length > 60) {
    return 'institution must be a string of 60 characters or fewer';
  }
  return null;
}

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateBankAccountDto>, res: Response) => {
  const { name, type, current_balance, apy, institution } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const apyError = validateApy(apy);
  if (apyError) {
    return res.status(400).json({ error: apyError });
  }
  const institutionError = validateInstitution(institution);
  if (institutionError) {
    return res.status(400).json({ error: institutionError });
  }
  const user = req.user as AuthUser;
  const account = bankAccountRepository.create({ name, type, current_balance, apy, institution }, user.tenant_id);
  res.status(201).json(account);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateBankAccountDto>, res: Response) => {
  const { name, type, current_balance, apy, institution } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const apyError = validateApy(apy);
  if (apyError) {
    return res.status(400).json({ error: apyError });
  }
  const institutionError = validateInstitution(institution);
  if (institutionError) {
    return res.status(400).json({ error: institutionError });
  }
  const existing = bankAccountRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'bank account not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this bank account' });
  }
  const account = bankAccountRepository.update(req.params.id, { name, type, current_balance, apy, institution });
  res.json(account);
});

router.delete('/:id', requireRole('owner'), (req: Request<{ id: string }>, res: Response) => {
  const existing = bankAccountRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'bank account not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this bank account' });
  }
  if (bankAccountRepository.countPaycheckSplitsFor(req.params.id) > 0) {
    return res.status(400).json({ error: 'cannot delete a bank account referenced by a paycheck split' });
  }
  if (bankAccountRepository.countSavingsGoalsFor(req.params.id) > 0) {
    return res.status(400).json({ error: 'cannot delete a bank account linked to a savings goal' });
  }
  bankAccountRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
