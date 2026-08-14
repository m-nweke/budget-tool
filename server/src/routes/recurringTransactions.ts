import { Router } from 'express';
import * as recurringRepo from '../repositories/recurringTransactionRepository';
import { rebuildFromScratch } from '../utils/recurringGenerator';
import { HttpError } from '../middleware/errorHandler';

export const recurringTransactionsRouter = Router();

const VALID_INTERVALS = ['daily', 'weekly', 'biweekly', 'monthly'];

recurringTransactionsRouter.get('/', (_req, res) => {
  res.json(recurringRepo.findAll());
});

recurringTransactionsRouter.post('/', (req, res) => {
  const { amount, description, category_id, interval, start_date, end_date } = req.body;

  if (typeof amount !== 'number') throw new HttpError(400, 'amount must be a number');
  if (typeof category_id !== 'number') throw new HttpError(400, 'category_id is required');
  if (!VALID_INTERVALS.includes(interval)) throw new HttpError(400, 'interval must be one of daily/weekly/biweekly/monthly');
  if (typeof start_date !== 'string' || !start_date) throw new HttpError(400, 'start_date is required');

  const recurring = recurringRepo.create({ amount, description, category_id, interval, start_date, end_date });
  res.status(201).json(recurring);
});

recurringTransactionsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = recurringRepo.findById(id);
  if (!existing) throw new HttpError(404, 'Recurring transaction not found');

  const { amount, description, category_id, interval, end_date, apply_to_existing } = req.body;
  if (interval !== undefined && !VALID_INTERVALS.includes(interval)) {
    throw new HttpError(400, 'interval must be one of daily/weekly/biweekly/monthly');
  }

  const updated = recurringRepo.update(id, { amount, description, category_id, interval, end_date });

  if (apply_to_existing === true) {
    rebuildFromScratch(id);
  }

  res.json(recurringRepo.findById(id) ?? updated);
});

recurringTransactionsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = recurringRepo.findById(id);
  if (!existing) throw new HttpError(404, 'Recurring transaction not found');

  recurringRepo.deactivate(id);
  res.status(204).send();
});
