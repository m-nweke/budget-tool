import express, { Request, Response } from 'express';
import billRepository from '../repositories/billRepository';
import { requireRole } from '../middleware/scoping';
import type { CreateBillDto, AuthUser, BillCategory } from '../types';

const router = express.Router();

const VALID_CATEGORIES: BillCategory[] = ['rent', 'wifi', 'electric', 'water', 'insurance', 'other'];

router.get('/', requireRole('owner'), (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json(billRepository.findAll(user.tenant_id));
});

function validateBody(body: CreateBillDto): string | null {
  const { name, category, amount, due_day } = body;
  if (!name || amount === undefined || amount === null) {
    return 'name and amount are required';
  }
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return `category must be one of: ${VALID_CATEGORIES.join(', ')}`;
  }
  if (due_day === undefined || due_day === null || due_day < 1 || due_day > 31) {
    return 'due_day is required and must be between 1 and 31';
  }
  return null;
}

router.post('/', requireRole('owner'), (req: Request<{}, {}, CreateBillDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const user = req.user as AuthUser;
  const bill = billRepository.create(req.body, user.tenant_id);
  res.status(201).json(bill);
});

router.put('/:id', requireRole('owner'), (req: Request<{ id: string }, {}, CreateBillDto>, res: Response) => {
  const validationError = validateBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const existing = billRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'bill not found' });
  }
  const user = req.user as AuthUser;
  if (existing.tenant_id !== user.tenant_id) {
    return res.status(403).json({ error: 'Not authorized for this bill' });
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
