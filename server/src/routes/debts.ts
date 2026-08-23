import express, { Request, Response } from 'express';
import debtRepository from '../repositories/debtRepository';
import { requireRole } from '../middleware/scoping';
import type { CreateDebtDto, AuthUser } from '../types';

const router = express.Router();

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(debtRepository.findAll(user.tenant_id));
});

function validateBody(body: CreateDebtDto): string | null {
  const { name, balance, interest_rate, minimum_payment, due_day } = body;
  if (!name || balance === undefined || balance === null) {
    return 'name and balance are required';
  }
  if (interest_rate === undefined || interest_rate === null) {
    return 'interest_rate is required';
  }
  if (minimum_payment === undefined || minimum_payment === null) {
    return 'minimum_payment is required';
  }
  if (due_day === undefined || due_day === null || due_day < 1 || due_day > 31) {
    return 'due_day is required and must be between 1 and 31';
  }
  return null;
}

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateDebtDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const user = req.user as AuthUser;
  const debt = debtRepository.create(req.body, user.tenant_id);
  res.status(201).json(debt);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateDebtDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const existing = debtRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'debt not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this debt' });
  }
  const debt = debtRepository.update(req.params.id, req.body);
  res.json(debt);
});

router.delete('/:id', requireRole('owner'), (req: Request<{ id: string }>, res: Response) => {
  const existing = debtRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'debt not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this debt' });
  }
  debtRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
