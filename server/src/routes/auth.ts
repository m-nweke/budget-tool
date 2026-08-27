import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { COOKIE_NAME, COOKIE_SECURE } from '../config';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken, signPreTenantToken, verifyToken } from '../utils/jwt';
import { authenticate } from '../middleware/authenticate';
import userRepository, { buildAuthUser } from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import tenantMembershipRepository from '../repositories/tenantMembershipRepository';
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  SelectTenantRequest,
  AuthUser,
  MembershipRole,
  MembershipSummary,
} from '../types';

// Shared by /login's multi-membership branch and GET /memberships (used by
// the client's "switch workspace" UI for an already-authenticated user) —
// one place building the picker shape from a user's membership rows.
// A missing tenant here means a data-integrity issue (a membership
// pointing at a tenant that no longer exists — tenants are never deleted
// today, so this shouldn't happen) — skip that membership from the picker
// rather than crash building it, so one bad row doesn't 500 out every
// other, valid membership this identity has.
function buildMembershipSummaries(userId: number): MembershipSummary[] {
  return tenantMembershipRepository.listForUser(userId).flatMap((membership) => {
    const tenant = tenantRepository.findById(membership.tenant_id);
    if (!tenant) return [];
    return [{ tenant_id: tenant.id, tenant_name: tenant.name, tenant_type: tenant.type, role: membership.role }];
  });
}

// A hash of an unguessable, never-issued password, used to give a
// nonexistent-user login attempt the same bcrypt.compare cost as a real one
// (see the timing note below). Comparing against it always fails.
const DUMMY_HASH = '$2b$10$DCDkFenFV5VYAwMnrKG9eecUDVmh3IXyasd.MOsGyK5/4UlgCXL76';

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Shorter-lived cookie for a pre-tenant token — matches
// PRE_TENANT_TOKEN_EXPIRES_IN so the cookie doesn't outlive the token it
// carries (a merely-expired cookie is harmless, but there's no reason to
// keep sending a token past the point the server would reject it anyway).
const PRE_TENANT_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: 10 * 60 * 1000 };

// Deliberately NOT httpOnly (unlike COOKIE_NAME) — carries no auth
// authority, just which palette to paint. index.html reads it in a
// blocking inline script before the app mounts, so a returning user's
// browser paints the right personal/enterprise theme on first frame
// instead of the default neutral one flashing while the session round
// trip (App.vue's data-mode watcher) is still in flight. Cleared on
// logout so a shared/public machine doesn't leak "was this a personal
// budget or a company account" after signing out.
const TENANT_TYPE_COOKIE_NAME = 'tenant_type';
const TENANT_TYPE_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, httpOnly: false };

// Guards the two endpoints that run bcrypt.compare against a real password
// hash: /login (an existing user's own password) and /register's "join"
// path (re-registering against an already-used email re-checks that
// email's password the same way — see below). Without this, either is an
// unlimited password-guessing oracle. Skipped under NODE_ENV=test, since
// the existing test suite legitimately calls these routes many times per
// run from the same test client — throttling them would make the tests
// flaky, not the app safer.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/login', authRateLimiter, async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = userRepository.findByEmail(email);
  // Always run a bcrypt.compare, even for a nonexistent user (against
  // DUMMY_HASH, which never matches) — skipping it when `user` is missing
  // would make login attempts for unregistered emails return measurably
  // faster than ones for registered emails, letting response timing leak
  // which emails exist despite the identical error message below.
  const passwordValid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !user.password_hash || !passwordValid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const memberships = tenantMembershipRepository.listForUser(user.id);
  if (memberships.length === 1) {
    const membership = memberships[0];
    const tenant = tenantRepository.findById(membership.tenant_id);
    if (!tenant) {
      // Data integrity issue (a membership pointing at a tenant that no
      // longer exists) — tenants are never deleted today, so this
      // shouldn't happen, but failing closed is safer than crashing on
      // buildAuthUser's assumption that tenant is defined.
      return res.status(500).json({ error: 'Internal server error' });
    }
    const token = signToken(user.id, tenant.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.cookie(TENANT_TYPE_COOKIE_NAME, tenant.type, TENANT_TYPE_COOKIE_OPTIONS);
    const body: LoginResponse = { user: buildAuthUser(user, membership, tenant) };
    return res.json(body);
  }

  // Zero or multiple memberships. Zero shouldn't happen (every account is
  // created with one — see /register), but is handled the same way as
  // multiple rather than crashing: the client gets an (empty) picker
  // instead of a 500.
  const preToken = signPreTenantToken(user.id);
  res.cookie(COOKIE_NAME, preToken, PRE_TENANT_COOKIE_OPTIONS);
  const body: LoginResponse = { memberships: buildMembershipSummaries(user.id) };
  res.json(body);
});

router.post('/select-tenant', (req: Request<{}, {}, SelectTenantRequest>, res: Response) => {
  // Reads the cookie directly rather than via the `authenticate`
  // middleware: authenticate requires the token's CURRENT tenant_id to
  // resolve to a real membership, but a pre-tenant token (the multi-
  // membership login case) has no tenant_id at all — resolving one is
  // exactly this endpoint's job. A full session token is also accepted
  // here (the "switch workspace" case), since sub is all this needs.
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { tenant_id } = req.body;
  if (typeof tenant_id !== 'number') {
    return res.status(400).json({ error: 'tenant_id must be a number' });
  }

  const user = userRepository.findById(Number(payload.sub));
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const membership = tenantMembershipRepository.findByUserAndTenant(user.id, tenant_id);
  const tenant = membership ? tenantRepository.findById(tenant_id) : undefined;
  if (!membership || !tenant) {
    return res.status(403).json({ error: 'Not a member of this tenant' });
  }

  const newToken = signToken(user.id, tenant.id);
  res.cookie(COOKIE_NAME, newToken, COOKIE_OPTIONS);
  res.cookie(TENANT_TYPE_COOKIE_NAME, tenant.type, TENANT_TYPE_COOKIE_OPTIONS);
  const body: LoginResponse = { user: buildAuthUser(user, membership, tenant) };
  res.json(body);
});

router.post('/register', authRateLimiter, async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  const { name, email, password, accountType, joinCode } = req.body;
  if (
    typeof name !== 'string' || !name ||
    typeof email !== 'string' || !email ||
    typeof password !== 'string' || !password
  ) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (accountType !== 'personal' && accountType !== 'company' && accountType !== 'join') {
    return res.status(400).json({ error: "accountType must be 'personal', 'company', or 'join'" });
  }
  if (accountType === 'join' && (typeof joinCode !== 'string' || !joinCode)) {
    return res.status(400).json({ error: 'joinCode is required to join a company' });
  }

  let tenant = accountType === 'join' ? tenantRepository.findByJoinCode(joinCode as string) : undefined;
  if (accountType === 'join' && !tenant) {
    return res.status(404).json({ error: 'Invalid join code' });
  }

  // Find-or-create the identity. An existing email means this is the
  // multi-tenant case — someone with, say, a personal budget registering
  // a new membership in a company — so the password must actually match
  // that existing account, not silently attach a membership to it.
  let user = userRepository.findByEmail(email);
  if (user) {
    if (!user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'An account with this email already exists' });
    }
  } else {
    const password_hash = await hashPassword(password);
    user = userRepository.create({ name, email, password_hash });
  }

  // A personal budget is meant to be singular per person — unlike 'join'
  // (checked below, against a specific existing tenant) and 'company'
  // (each call is an unambiguous "start a new company," plausibly
  // intentional more than once), there's no tenant to check "already a
  // member of" yet for 'personal' at this point, since none has been
  // created. Checked by role instead: 'owner' only ever comes from this
  // path, so having one anywhere means a personal tenant already exists
  // for this identity. Without this, a retried/double-submitted request
  // would silently create a second personal tenant every time (no tenant
  // exists yet for the "already a member" check below to catch).
  if (accountType === 'personal' && tenantMembershipRepository.listForUser(user.id).some((m) => m.role === 'owner')) {
    return res.status(400).json({ error: 'You already have a personal budget' });
  }

  if (accountType === 'personal') {
    tenant = tenantRepository.create(`${name}'s Budget`, 'personal');
  } else if (accountType === 'company') {
    tenant = tenantRepository.create(`${name}'s Company`, 'enterprise');
  }
  // 'join' already resolved tenant above (or 404'd before this point).
  const resolvedTenant = tenant as NonNullable<typeof tenant>;

  if (tenantMembershipRepository.findByUserAndTenant(user.id, resolvedTenant.id)) {
    return res.status(400).json({ error: 'You already belong to this tenant' });
  }

  const role: MembershipRole =
    accountType === 'personal' ? 'owner' : accountType === 'company' ? 'department_head' : 'department_employee';
  const membership = tenantMembershipRepository.create({
    user_id: user.id,
    tenant_id: resolvedTenant.id,
    role,
    department_id: null,
  });

  const token = signToken(user.id, resolvedTenant.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.cookie(TENANT_TYPE_COOKIE_NAME, resolvedTenant.type, TENANT_TYPE_COOKIE_OPTIONS);
  const body: LoginResponse = { user: buildAuthUser(user, membership, resolvedTenant) };
  res.status(201).json(body);
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.clearCookie(TENANT_TYPE_COOKIE_NAME, TENANT_TYPE_COOKIE_OPTIONS);
  res.status(204).end();
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const body: LoginResponse = { user: req.user as AuthUser };
  res.json(body);
});

// For an already-authenticated user's "switch workspace" UI — distinct
// from the picker /login returns for a multi-membership login, which only
// exists before a session is established. Always includes the tenant the
// caller is currently in, so the client doesn't need to merge it in
// separately with req.user.
router.get('/memberships', authenticate, (req: Request, res: Response) => {
  const user = req.user as AuthUser;
  res.json({ memberships: buildMembershipSummaries(user.id) });
});

export default router;
