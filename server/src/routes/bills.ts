import express, { Request, Response } from 'express';
import billRepository from '../repositories/billRepository';
import bankAccountRepository from '../repositories/bankAccountRepository';
import { requireRole } from '../middleware/scoping';
import { todayISO } from '../utils/dateUtils';
import type { CreateBillDto, AuthUser, BillCategory } from '../types';

const router = express.Router();

const VALID_CATEGORIES: BillCategory[] = ['rent', 'wifi', 'electric', 'water', 'insurance', 'other'];

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(billRepository.findAll(user.tenant_id));
});

// `fallbackStartOn` is what start_on actually resolves to when the request
// omits it — todayISO() for a create, the existing row's start_on for an
// update (billRepository.create/update's own fallback logic) — so an
// end_date-only request is validated against the real effective start, not
// just the (possibly absent) value on the request body itself.
function validateBody(body: CreateBillDto, fallbackStartOn: string): string | null {
  const { name, category, amount, due_day, start_on, end_date } = body;
  if (!name || amount === undefined || amount === null) {
    return 'name and amount are required';
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'amount must be a positive number';
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }
  if (due_day === undefined || due_day === null || !Number.isInteger(due_day) || due_day < 1 || due_day > 31) {
    return 'due_day is required and must be an integer between 1 and 31';
  }
  if (start_on !== undefined && (typeof start_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_on))) {
    return 'start_on must be a YYYY-MM-DD date string';
  }
  if (end_date !== undefined && end_date !== null && (typeof end_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(end_date))) {
    return 'end_date must be a YYYY-MM-DD date string';
  }
  if (end_date && end_date < (start_on || fallbackStartOn)) {
    return 'end_date must be on or after start_on';
  }
  return null;
}

// A linked bank_account_id must belong to the caller's own tenant — same
// reasoning as savingsGoals.ts's validateLinkedAccount. The `typeof` guard
// matters beyond type-safety theater: a malformed request body (e.g. an
// object or array where a number is expected) would otherwise reach
// bankAccountRepository.findById and throw when better-sqlite3 tries to
// bind it as a query parameter, 500ing instead of cleanly 400ing.
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

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateBillDto>, res: Response) => {
  const validationError = validateBody(req.body, todayISO());
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const user = req.user as AuthUser;
  const linkError = validateLinkedAccount(user, req.body.bank_account_id);
  if (linkError) {
    return res.status(400).json(linkError);
  }
  const bill = billRepository.create(req.body, user.tenant_id);
  res.status(201).json(bill);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateBillDto>, res: Response) => {
  const existing = billRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'bill not found' });
  }
  const validationError = validateBody(req.body, existing.start_on);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this bill' });
  }
  const linkError = validateLinkedAccount(user, req.body.bank_account_id);
  if (linkError) {
    return res.status(400).json(linkError);
  }
  const bill = billRepository.update(req.params.id, req.body);
  res.json(bill);
});

router.delete('/:id', requireRole('owner'), (req: Request<{ id: string }>, res: Response) => {
  const existing = billRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'bill not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this bill' });
  }
  billRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
