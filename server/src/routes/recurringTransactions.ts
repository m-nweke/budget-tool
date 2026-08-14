import express, { Request, Response } from 'express';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import categoryRepository from '../repositories/categoryRepository';
import type { CreateRecurringTransactionDto } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.json(recurringTransactionRepository.findAllActive());
});

router.post('/', (req: Request<{}, {}, CreateRecurringTransactionDto>, res: Response) => {
  const { amount, description, category_id, start_date } = req.body;
  if (amount === undefined || amount === null || !category_id || !start_date) {
    return res.status(400).json({ error: 'amount, category_id, and start_date are required' });
  }
  if (!categoryRepository.findById(category_id)) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const recurringTransaction = recurringTransactionRepository.create({
    amount,
    description,
    category_id,
    start_date,
  });
  recurringTransactionRepository.generateDue();
  res.status(201).json(recurringTransaction);
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  const existing = recurringTransactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'recurring transaction not found' });
  }
  recurringTransactionRepository.deactivate(req.params.id);
  res.status(204).end();
});

export default router;
