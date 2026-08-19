import express, { Request, Response } from 'express';
import transactionRepository from '../repositories/transactionRepository';
import { requireRole, resolveScope } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();

// 'owner' included: a personal tenant's owner can put an approval_threshold
// on their own categories (see routes/categories.ts), so their own pending
// list needs to be reachable too, not just an enterprise head's.
router.get('/', requireRole('department_head', 'owner'), (req: Request, res: Response) => {
  const scope = resolveScope(req.user as AuthUser);
  res.json(transactionRepository.findPendingApproval(scope.departmentIds, scope.tenantId));
});

export default router;
