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

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateBankAccountDto>, res: Response) => {
  const { name, type, current_balance } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const user = req.user as AuthUser;
  const account = bankAccountRepository.create({ name, type, current_balance }, user.tenant_id);
  res.status(201).json(account);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateBankAccountDto>, res: Response) => {
  const { name, type, current_balance } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const existing = bankAccountRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'bank account not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this bank account' });
  }
  const account = bankAccountRepository.update(req.params.id, { name, type, current_balance });
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
