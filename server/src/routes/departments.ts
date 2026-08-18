import express, { Request, Response } from 'express';
import departmentRepository from '../repositories/departmentRepository';
import { resolveAccessibleDepartmentIds } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  res.json(departmentRepository.findAll(accessibleIds));
});

export default router;
