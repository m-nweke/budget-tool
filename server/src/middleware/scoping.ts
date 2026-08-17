import { Request, Response, NextFunction } from 'express';
import departmentAccessRepository from '../repositories/departmentAccessRepository';
import type { AuthUser } from '../types';

// Single source of truth for "which departments can this user see." An
// employee is scoped to exactly one home department (users.department_id);
// a head's access is entirely defined by department_access grants, with no
// implicit fallback to department_id — zero grants means zero access, which
// is how a newly-created head starts out before anyone grants them
// anything, not a bug to work around.
export function resolveAccessibleDepartmentIds(user: AuthUser): number[] {
  if (user.role === 'department_head') {
    return departmentAccessRepository.listForUser(user.id);
  }
  return user.department_id !== null ? [user.department_id] : [];
}

// Used inline in route handlers *after* a resource (and its department) is
// loaded, since the department usually isn't known until the DB read
// happens (e.g. a transaction's category's department) — consistent with
// how validation already happens inline in existing handlers rather than
// via a generic validation middleware.
export function userHasDepartmentAccess(user: AuthUser, departmentId: number | null): boolean {
  if (departmentId === null) return false;
  return resolveAccessibleDepartmentIds(user).includes(departmentId);
}

// Express middleware factory for head-only routes (category management,
// approve/reject). Must run after `authenticate`, which sets req.user.
export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    next();
  };
}
