import express, { Request, Response } from 'express';
import categoryRepository from '../repositories/categoryRepository';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import { requireRole, resolveAccessibleDepartmentIds, userHasDepartmentAccess } from '../middleware/scoping';
import type { CreateCategoryDto, AuthUser } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  res.json(categoryRepository.findAll(accessibleIds));
});

// Category management is head-only — employees can't create categories at
// all, matching the plan's split of "heads own budget structure, employees
// log spend against it."
router.post(
  '/',
  requireRole('department_head'),
  (req: Request<{}, {}, CreateCategoryDto>, res: Response) => {
    const { name, budgeted_amount, start_on, department_id, approval_threshold } = req.body;
    if (name === undefined || budgeted_amount === undefined || budgeted_amount === null) {
      return res.status(400).json({ error: 'name and budgeted_amount are required' });
    }
    if (!userHasDepartmentAccess(req.user as AuthUser, department_id)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    const category = categoryRepository.create({
      name,
      budgeted_amount,
      start_on,
      department_id,
      approval_threshold,
    });
    res.status(201).json(category);
  }
);

router.put(
  '/:id',
  requireRole('department_head'),
  (req: Request<{ id: string }, {}, CreateCategoryDto>, res: Response) => {
    const { name, budgeted_amount, start_on, department_id, approval_threshold } = req.body;
    if (name === undefined || budgeted_amount === undefined || budgeted_amount === null) {
      return res.status(400).json({ error: 'name and budgeted_amount are required' });
    }
    const existing = categoryRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'category not found' });
    }
    // Checked against both the category's current department and the
    // target one — a head can't use an edit to move a category into a
    // department they don't have access to, nor edit one they've lost
    // access to since it was created.
    const user = req.user as AuthUser;
    if (
      !userHasDepartmentAccess(user, existing.department_id) ||
      !userHasDepartmentAccess(user, department_id)
    ) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    const category = categoryRepository.update(req.params.id, {
      name,
      budgeted_amount,
      start_on,
      department_id,
      approval_threshold,
    });
    res.json(category);
  }
);

router.delete('/:id', requireRole('department_head'), (req: Request<{ id: string }>, res: Response) => {
  const existing = categoryRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'category not found' });
  }
  if (!userHasDepartmentAccess(req.user as AuthUser, existing.department_id)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
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
