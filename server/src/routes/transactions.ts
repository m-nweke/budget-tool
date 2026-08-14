import express, { Request, Response } from 'express';
import transactionRepository from '../repositories/transactionRepository';
import categoryRepository from '../repositories/categoryRepository';
import type { NewTransaction } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.json(transactionRepository.findAll());
});

router.post('/', (req: Request<{}, {}, NewTransaction>, res: Response) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  if (!categoryRepository.findById(category_id)) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const transaction = transactionRepository.create({ amount, date, description, category_id });
  res.status(201).json(transaction);
});

router.put('/:id', (req: Request<{ id: string }, {}, NewTransaction>, res: Response) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const existing = transactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  if (!categoryRepository.findById(category_id)) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const transaction = transactionRepository.update(req.params.id, {
    amount,
    date,
    description,
    category_id,
  });
  res.json(transaction);
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  const existing = transactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  transactionRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
