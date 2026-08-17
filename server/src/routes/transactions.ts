import express, { Request, Response } from 'express';
import transactionRepository from '../repositories/transactionRepository';
import categoryRepository from '../repositories/categoryRepository';
import { requireRole, resolveAccessibleDepartmentIds, userHasDepartmentAccess } from '../middleware/scoping';
import type { CreateTransactionDto, AuthUser, Category } from '../types';

const router = express.Router();

function computeApproval(amount: number, category: Category): { needsApproval: boolean; approved: boolean } {
  const needsApproval = category.approval_threshold !== null && amount > category.approval_threshold;
  return { needsApproval, approved: !needsApproval };
}

router.get('/', (req: Request, res: Response) => {
  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  res.json(transactionRepository.findAll(accessibleIds));
});

router.post('/', (req: Request<{}, {}, CreateTransactionDto>, res: Response) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const category = categoryRepository.findById(category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const user = req.user as AuthUser;
  if (!userHasDepartmentAccess(user, category.department_id)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  const { needsApproval, approved } = computeApproval(amount, category);
  const transaction = transactionRepository.create(
    { amount, date, description, category_id },
    user.id,
    needsApproval,
    approved
  );
  res.status(201).json(transaction);
});

router.put('/:id', (req: Request<{ id: string }, {}, CreateTransactionDto>, res: Response) => {
  const { amount, date, description, category_id } = req.body;
  if (amount === undefined || amount === null || !date || !category_id) {
    return res.status(400).json({ error: 'amount, date, and category_id are required' });
  }
  const existing = transactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  const category = categoryRepository.findById(category_id);
  if (!category) {
    return res.status(400).json({ error: 'category_id does not reference an existing category' });
  }
  const user = req.user as AuthUser;
  const existingCategory = categoryRepository.findById(existing.category_id);
  if (
    !userHasDepartmentAccess(user, existingCategory?.department_id ?? null) ||
    !userHasDepartmentAccess(user, category.department_id)
  ) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  const { needsApproval, approved } = computeApproval(amount, category);
  const transaction = transactionRepository.update(
    req.params.id,
    { amount, date, description, category_id },
    needsApproval,
    approved
  );
  res.json(transaction);
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  const existing = transactionRepository.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'transaction not found' });
  }
  const category = categoryRepository.findById(existing.category_id);
  if (!userHasDepartmentAccess(req.user as AuthUser, category?.department_id ?? null)) {
    return res.status(403).json({ error: 'Not authorized for this department' });
  }
  transactionRepository.remove(req.params.id);
  res.status(204).end();
});

// Head-only, access-checked against the transaction's category's
// department. Reject clears the pending flag without deleting the row —
// it stays for audit visibility (see transactionRepository.approve).
router.post(
  '/:id/approve',
  requireRole('department_head'),
  (req: Request<{ id: string }>, res: Response) => {
    const existing = transactionRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    const category = categoryRepository.findById(existing.category_id);
    if (!userHasDepartmentAccess(req.user as AuthUser, category?.department_id ?? null)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    res.json(transactionRepository.approve(req.params.id, true));
  }
);

router.post(
  '/:id/reject',
  requireRole('department_head'),
  (req: Request<{ id: string }>, res: Response) => {
    const existing = transactionRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'transaction not found' });
    }
    const category = categoryRepository.findById(existing.category_id);
    if (!userHasDepartmentAccess(req.user as AuthUser, category?.department_id ?? null)) {
      return res.status(403).json({ error: 'Not authorized for this department' });
    }
    res.json(transactionRepository.approve(req.params.id, false));
  }
);

export default router;
