import { Router } from 'express';
import * as categoryRepo from '../repositories/categoryRepository';
import { HttpError } from '../middleware/errorHandler';

export const categoriesRouter = Router();

categoriesRouter.get('/', (_req, res) => {
  res.json(categoryRepo.findAll());
});

categoriesRouter.post('/', (req, res) => {
  const { name, budgeted_amount, department_id, start_on } = req.body;

  if (typeof name !== 'string' || !name.trim()) {
    throw new HttpError(400, 'name is required');
  }
  if (typeof budgeted_amount !== 'number' || budgeted_amount < 0) {
    throw new HttpError(400, 'budgeted_amount must be a non-negative number');
  }

  const category = categoryRepo.create({ name, budgeted_amount, department_id, start_on });
  res.status(201).json(category);
});

categoriesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = categoryRepo.findById(id);
  if (!existing) throw new HttpError(404, 'Category not found');

  const { name, budgeted_amount, department_id, start_on } = req.body;
  if (budgeted_amount !== undefined && (typeof budgeted_amount !== 'number' || budgeted_amount < 0)) {
    throw new HttpError(400, 'budgeted_amount must be a non-negative number');
  }

  const category = categoryRepo.update(id, { name, budgeted_amount, department_id, start_on });
  res.json(category);
});

categoriesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = categoryRepo.findById(id);
  if (!existing) throw new HttpError(404, 'Category not found');

  const txCount = categoryRepo.countTransactionsForCategory(id);
  const recurringCount = categoryRepo.countRecurringForCategory(id);
  if (txCount > 0 || recurringCount > 0) {
    throw new HttpError(400, 'Cannot delete a category that still has transactions or recurring templates referencing it');
  }

  categoryRepo.remove(id);
  res.status(204).send();
});
