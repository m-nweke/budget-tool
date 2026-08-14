import express, { Request, Response } from 'express';
import categoryRepository from '../repositories/categoryRepository';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import type { CreateCategoryDto } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  res.json(categoryRepository.findAll());
});

router.post('/', (req: Request<{}, {}, CreateCategoryDto>, res: Response) => {
  const { name, budgeted_amount } = req.body;
  if (!name || budgeted_amount === undefined || budgeted_amount === null) {
    return res.status(400).json({ error: 'name and budgeted_amount are required' });
  }
  const category = categoryRepository.create({ name, budgeted_amount });
  res.status(201).json(category);
});

router.put('/:id', (req: Request<{ id: string }, {}, CreateCategoryDto>, res: Response) => {
  const { name, budgeted_amount } = req.body;
  if (!name || budgeted_amount === undefined || budgeted_amount === null) {
    return res.status(400).json({ error: 'name and budgeted_amount are required' });
  }
  const existing = categoryRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  const category = categoryRepository.update(req.params.id, { name, budgeted_amount });
  res.json(category);
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  const existing = categoryRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  if (categoryRepository.countTransactionsFor(req.params.id) > 0) {
    return res.status(400).json({ error: 'cannot delete a category that has transactions' });
  }
  if (recurringTransactionRepository.countForCategory(req.params.id) > 0) {
    return res
      .status(400)
      .json({ error: 'cannot delete a category that has recurring transactions' });
  }
  categoryRepository.remove(req.params.id);
  res.status(204).end();
});

export default router;
