import express, { Request, Response } from 'express';
import investmentRepository from '../repositories/investmentRepository';
import bankAccountRepository from '../repositories/bankAccountRepository';
import { requireRole } from '../middleware/scoping';
import type { CreateInvestmentDto, AuthUser, InvestmentType } from '../types';

const router = express.Router();

const VALID_TYPES: InvestmentType[] = ['brokerage', 'retirement', 'crypto', 'other'];

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(investmentRepository.findAll(user.tenant_id));
});

function validateBody(body: CreateInvestmentDto): string | null {
  const { name, type, current_value, monthly_contribution, contribution_day } = body;
  if (!name) {
    return 'name is required';
  }
  if (!type || !VALID_TYPES.includes(type)) {
    return `type must be one of: ${VALID_TYPES.join(', ')}`;
  }
  if (current_value !== undefined && (typeof current_value !== 'number' || !Number.isFinite(current_value) || current_value < 0)) {
    return 'current_value must be a non-negative number';
  }
  // monthly_contribution and contribution_day are a matched pair — either
  // both set or both omitted/null, same rule as debts.promo_apr/
  // promo_expires_on.
  const hasContribution = monthly_contribution !== undefined && monthly_contribution !== null;
  const hasContributionDay = contribution_day !== undefined && contribution_day !== null;
  if (hasContribution !== hasContributionDay) {
    return 'monthly_contribution and contribution_day must be set together';
  }
  if (hasContribution && (typeof monthly_contribution !== 'number' || !Number.isFinite(monthly_contribution) || monthly_contribution <= 0)) {
    return 'monthly_contribution must be a positive number';
  }
  if (
    hasContributionDay &&
    (!Number.isInteger(contribution_day) || (contribution_day as number) < 1 || (contribution_day as number) > 31)
  ) {
    return 'contribution_day must be an integer between 1 and 31';
  }
  return null;
}

// A linked bank_account_id must belong to the caller's own tenant — same
// reasoning as savingsGoals.ts/bills.ts's validateLinkedAccount. The
// `typeof` guard matters beyond type-safety theater: a malformed request
// body (e.g. an object or array where a number is expected) would otherwise
// reach bankAccountRepository.findById and throw when better-sqlite3 tries
// to bind it as a query parameter, 500ing instead of cleanly 400ing.
function validateLinkedAccount(user: AuthUser, bankAccountId: unknown): { error: string } | null {
  if (bankAccountId === null || bankAccountId === undefined) return null;
  if (typeof bankAccountId !== 'number') {
    return { error: 'bank_account_id must be a number' };
  }
  const account = bankAccountRepository.findById(bankAccountId);
  if (!account || account.tenant_id !== user.tenant_id) {
    return { error: 'bank_account_id does not reference an account in this tenant' };
  }
  return null;
}

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateInvestmentDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const user = req.user as AuthUser;
  const linkError = validateLinkedAccount(user, req.body.bank_account_id);
  if (linkError) {
    return res.status(400).json(linkError);
  }
  const investment = investmentRepository.create(req.body, user.tenant_id);
  res.status(201).json(investment);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateInvestmentDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const existing = investmentRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'investment not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this investment' });
  }
  const linkError = validateLinkedAccount(user, req.body.bank_account_id);
  if (linkError) {
    return res.status(400).json(linkError);
  }
  const investment = investmentRepository.update(req.params.id, req.body);
  res.json(investment);
});

router.delete('/:id', requireRole('owner'), (req: Request<{ id: string }>, res: Response) => {
  const existing = investmentRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'investment not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this investment' });
  }
  investmentRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
