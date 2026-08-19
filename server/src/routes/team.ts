import express, { Request, Response } from 'express';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import departmentRepository from '../repositories/departmentRepository';
import { requireRole } from '../middleware/scoping';
import type { AuthUser } from '../types';

const router = express.Router();

// Head-only: assigns/reassigns an employee's home department within the
// head's own tenant. The minimum viable team-management surface needed
// for self-serve join-code signup to produce a working employee — a new
// joiner starts with department_id = null (zero access) until a head does
// this. Intentionally minimal: no invite management, no member removal.
router.patch(
  '/:userId',
  requireRole('department_head'),
  (req: Request<{ userId: string }, {}, { department_id?: number | null }>, res: Response) => {
    const { department_id } = req.body;
    if (department_id === undefined) {
      return res.status(400).json({ error: 'department_id is required' });
    }
    const user = req.user as AuthUser;

    const existing = tenantMembershipRepository.findByUserAndTenant(Number(req.params.userId), user.tenant_id);
    if (!existing) {
      return res.status(404).json({ error: 'user not found in this tenant' });
    }
    if (existing.role !== 'department_employee') {
      return res.status(400).json({ error: 'only an employee membership has an assignable department' });
    }

    if (department_id !== null) {
      const department = departmentRepository.findById(department_id);
      if (!department || department.tenant_id !== user.tenant_id) {
        return res.status(400).json({ error: 'department_id does not reference a department in this tenant' });
      }
    }

    const membership = tenantMembershipRepository.updateDepartment(
      Number(req.params.userId),
      user.tenant_id,
      department_id
    );
    res.json(membership);
  }
);

export default router;
