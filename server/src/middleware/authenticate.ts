import { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME } from '../config';
import { verifyToken } from '../utils/jwt';
import userRepository, { buildAuthUser } from '../repositories/userRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import tenantRepository from '../repositories/tenantRepository';

// Resolves req.user from the JWT's (sub, tenant_id) pair — not just the
// user row. A login can hold membership in more than one tenant, so the
// token names which tenant this session is scoped to, and req.user is
// rebuilt from that tenant's membership (role, department_id) on every
// request rather than cached in the token — a head reassigning someone's
// department, or removing their membership entirely, takes effect on the
// very next request, not just the next login.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  // A pre-tenant token (no tenant_id claim — see signPreTenantToken) only
  // proves the password check passed, not which tenant's data this
  // request is allowed to touch. It can only be used to call
  // select-tenant, not any tenant-scoped route.
  if (!payload || payload.tenant_id === undefined) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = userRepository.findById(Number(payload.sub));
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const membership = tenantMembershipRepository.findByUserAndTenant(user.id, payload.tenant_id);
  const tenant = membership ? tenantRepository.findById(payload.tenant_id) : undefined;
  // Either can be gone even with a valid, unexpired token: the membership
  // if a head removed this user from the tenant since the token was
  // issued, the tenant in principle never (tenants aren't deletable
  // today), but both are checked the same way for the same reason.
  if (!membership || !tenant) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  req.user = buildAuthUser(user, membership, tenant);
  next();
}
