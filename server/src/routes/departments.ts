import express, { Request, Response } from 'express';
import departmentRepository from '../repositories/departmentRepository';
import { requireRole, resolveAccessibleDepartmentIds } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  res.json(departmentRepository.findAll(accessibleIds));
});

// Head-only — a personal tenant has no departments at all, and an employee
// can't create one for the same reason they can't create a category (heads
// own budget/org structure). Minimal viable team-management endpoint: no
// self-serve UI existed to create departments before self-serve signup, so
// a head who just registered a new company needs this to bootstrap it.
router.post('/', requireRole('department_head'), (req: Request<{}, {}, { name?: string }>, res: Response) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }
  const user = req.user as AuthUser;
  const department = departmentRepository.create(name, user.tenant_id);
  res.status(201).json(department);
});

export default router;
