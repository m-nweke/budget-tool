import express, { Request, Response } from 'express';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import categoryRepository from '../repositories/categoryRepository';
import { resolveScope, userCanAccessResource } from '../middleware/scoping';
import type {
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
  RecurrenceInterval,
  AuthUser,
} from '../types';

const router = express.Router();

const VALID_INTERVALS: RecurrenceInterval[] = ['daily', 'weekly', 'biweekly', 'monthly'];

function validate(
  body: CreateRecurringTransactionDto | UpdateRecurringTransactionDto
): string | null {
  const { amount, category_id, interval, end_date } = body;
  const start_date = 'start_date' in body ? body.start_date : undefined;
  if (amount === undefined || amount === null || !category_id || !interval) {
    return 'amount, category_id, and interval are required';
  }
  if ('start_date' in body && !body.start_date) {
    return 'start_date is required';
  }
  if (!VALID_INTERVALS.includes(interval)) {
    return `interval must be one of: ${VALID_INTERVALS.join(', ')}`;
  }
  if (end_date && start_date && end_date < start_date) {
    return 'end_date cannot be before start_date';
  }
  return null;
}

router.get('/', (req: Request, res: Response) => {
  const scope = resolveScope(req.user as AuthUser);
  res.json(recurringTransactionRepository.findAllActive(scope.departmentIds, scope.tenantId));
});

router.post('/', (req: Request<{}, {}, CreateRecurringTransactionDto>, res: Response) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const category = categoryRepository.findById(req.body.category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  if (!userCanAccessResource(req.user as AuthUser, category)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  const recurringTransaction = recurringTransactionRepository.create(req.body);
  recurringTransactionRepository.generateDue();
  res.status(201).json(recurringTransaction);
});

router.put('/:id', (req: Request<{ id: string }, {}, UpdateRecurringTransactionDto>, res: Response) => {
  const error = validate(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  const existing = recurringTransactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'recurring transaction not found' });
  }
  const category = categoryRepository.findById(req.body.category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const user = req.user as AuthUser;
  const existingCategory = categoryRepository.findById(existing.category_id);
  if (!existingCategory || !userCanAccessResource(user, existingCategory) || !userCanAccessResource(user, category)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  const recurringTransaction = recurringTransactionRepository.update(req.params.id, req.body);
  res.json(recurringTransaction);
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  const existing = recurringTransactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'recurring transaction not found' });
  }
  const category = categoryRepository.findById(existing.category_id);
  if (!category || !userCanAccessResource(req.user as AuthUser, category)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  recurringTransactionRepository.deactivate(req.params.id);
  res.status(204).end();
});

export default router;
