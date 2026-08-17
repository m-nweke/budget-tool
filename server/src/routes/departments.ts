import express, { Request, Response } from 'express';
import departmentRepository from '../repositories/departmentRepository';
import { resolveAccessibleDepartmentIds } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const accessibleIds = resolveAccessibleDepartmentIds(req.user as AuthUser);
  const departments = departmentRepository.findAll().filter((d) => accessibleIds.includes(d.id));
  res.json(departments);
});

export default router;
