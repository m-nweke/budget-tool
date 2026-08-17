import express, { Request, Response } from 'express';
import transactionRepository from '../repositories/transactionRepository';
import { requireRole, resolveAccessibleDepartmentIds } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();

router.get('/', requireRole('department_head'), (req: Request, res: Response) => {
  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  res.json(transactionRepository.findPendingApproval(accessibleIds));
});

export default router;
