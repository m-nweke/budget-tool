import express, { Request, Response } from 'express';
import categoryRepository from '../repositories/categoryRepository';
import recurringTransactionRepository from '../repositories/recurringTransactionRepository';
import {
  requireRole,
  resolveScope,
  userHasDepartmentAccess,
  userHasAccessToAll,
  userCanAccessResource,
} from '../middleware/scoping';
import type { CreateCategoryDto, AuthUser } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const scope = resolveScope(req.user as AuthUser);
  res.json(categoryRepository.findAll(scope.departmentIds, scope.tenantId));
});

// Category management is 'department_head'-or-'owner'-only — a plain
// employee can't create categories at all, matching the plan's split of
// "heads/owners own budget structure, employees log spend against it." A
// personal tenant's 'owner' has no departments to select or be checked
// against — department_id is forced to null and the only boundary is
// their own tenant_id (see decisions doc for why this check is necessary:
// unlike the enterprise path, there's no department_access indirection
// keeping an owner's writes inside their own tenant by construction).
router.post(
  '/',
  requireRole('department_head', 'owner'),
  (req: Request<{}, {}, CreateCategoryDto>, res: Response) => {
    const { name, budgeted_amount, start_on, approval_threshold } = req.body;
    if (!name || budgeted_amount === undefined || budgeted_amount === null) {
      return res.status(400).json({ error: 'name and budgeted_amount are required' });
    }
    const user = req.user as AuthUser;

    let department_id: number | null;
    if (user.role === 'owner') {
      department_id = null;
    } else {
      department_id = req.body.department_id;
      if (department_id === undefined || department_id === null) {
        return res.status(400).json({ error: 'department_id is required' });
      }
      if (!userHasDepartmentAccess(user, department_id)) {
        return res.status(403).json({ error: 'Not authorized for this department' });
      }
    }

    const category = categoryRepository.create(
      { name, budgeted_amount, start_on, department_id, approval_threshold },
      user.tenant_id
    );
    res.status(201).json(category);
  }
);

router.put(
  '/:id',
  requireRole('department_head', 'owner'),
  (req: Request<{ id: string }, {}, CreateCategoryDto>, res: Response) => {
    const { name, budgeted_amount, start_on, approval_threshold } = req.body;
    if (!name || budgeted_amount === undefined || budgeted_amount === null) {
      return res.status(400).json({ error: 'name and budgeted_amount are required' });
    }
    const existing = categoryRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'category not found' });
    }
    const user = req.user as AuthUser;

    let department_id: number | null;
    if (user.role === 'owner') {
      if (!userCanAccessResource(user, existing)) {
        return res.status(403).json({ error: 'Not authorized for this category' });
      }
      department_id = null;
    } else {
      department_id = req.body.department_id;
      if (department_id === undefined || department_id === null) {
        return res.status(400).json({ error: 'department_id is required' });
      }
      // Checked against both the category's current department and the
      // target one — a head can't use an edit to move a category into a
      // department they don't have access to, nor edit one they've lost
      // access to since it was created.
      if (!userHasAccessToAll(user, [existing.department_id, department_id])) {
        return res.status(403).json({ error: 'Not authorized for this department' });
      }
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

router.delete(
  '/:id',
  requireRole('department_head', 'owner'),
  (req: Request<{ id: string }>, res: Response) => {
    const existing = categoryRepository.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'category not found' });
    }
    const user = req.user as AuthUser;
    if (!userCanAccessResource(user, existing)) {
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
  }
);

export default router;
