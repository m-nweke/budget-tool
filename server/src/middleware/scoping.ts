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
  if (user.role === 'department_employee') {
    return user.department_id !== null ? [user.department_id] : [];
  }
  // 'owner' — a personal tenant has no departments at all. See
  // resolveScope: an owner's data is scoped by tenant_id directly, not by
  // department, so this returning [] is correct (zero departments exist to
  // be accessible) rather than a "zero access" bug to work around.
  return [];
}

// The listing-query scope for a GET route. Enterprise roles are scoped by
// accessible department ids (resolveAccessibleDepartmentIds, existing
// behavior). A personal tenant's 'owner' has no departments to scope by —
// the only boundary is their own tenant_id. Every scoped repo's findAll
// accepts both departmentIds and tenantId for this reason: departmentIds
// wins when present (enterprise), tenantId is the fallback (personal).
export function resolveScope(user: AuthUser): { departmentIds?: number[]; tenantId?: number } {
  if (user.role === 'owner') {
    return { tenantId: user.tenant_id };
  }
  return { departmentIds: resolveAccessibleDepartmentIds(user) };
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

// For the "check access against both the existing and target department"
// pattern every PUT handler needs (categories/transactions/recurringTransactions):
// resolves the accessible-ids list once instead of once per department,
// since resolveAccessibleDepartmentIds does a real department_access query
// for a head. Also the single place that check gets fixed if its logic
// needs to change, instead of three near-identical inline copies drifting.
export function userHasAccessToAll(user: AuthUser, departmentIds: (number | null)[]): boolean {
  const accessibleIds = resolveAccessibleDepartmentIds(user);
  return departmentIds.every((id) => id !== null && accessibleIds.includes(id));
}

// Unifies the "can this user touch this category/transaction" check across
// both tenant types: an owner is authorized for anything in their own
// tenant (there's no department indirection to lean on, unlike enterprise,
// where department_access/employee assignment already keeps a user's
// writes inside their own tenant by construction — an owner has no such
// natural boundary, so tenant_id has to be checked explicitly). Enterprise
// roles fall back to the existing department check.
export function userCanAccessResource(
  user: AuthUser,
  resource: { tenant_id: number; department_id: number | null }
): boolean {
  if (user.role === 'owner') {
    return resource.tenant_id === user.tenant_id;
  }
  return userHasDepartmentAccess(user, resource.department_id);
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
