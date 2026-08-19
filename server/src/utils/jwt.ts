import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, PRE_TENANT_TOKEN_EXPIRES_IN } from '../config';

interface TokenPayload {
  // The JWT spec's registered `sub` claim is a string; the userRepository
  // lookup id is numeric, so callers convert with Number(payload.sub).
  sub: string;
  // Absent only on a pre-tenant token (see signPreTenantToken) — every
  // full session token carries the tenant this session is scoped to,
  // since a login can hold membership in more than one tenant.
  tenant_id?: number;
}

export function signToken(userId: number, tenantId: number): string {
  const payload: TokenPayload = { sub: String(userId), tenant_id: tenantId };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Issued when login resolves to more than one membership — proves the
// password check passed, but doesn't name a tenant yet (that's the user's
// choice, made via POST /api/auth/select-tenant right after). Deliberately
// can't authenticate any tenant-scoped route: authenticate() requires
// tenant_id to be present.
export function signPreTenantToken(userId: number): string {
  const payload: TokenPayload = { sub: String(userId) };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: PRE_TENANT_TOKEN_EXPIRES_IN });
}

// Returns null instead of throwing so callers (the authenticate middleware)
// can treat "invalid/expired token" as a plain 401 without a try/catch.
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
    if (decoded.tenant_id !== undefined && typeof decoded.tenant_id !== 'number') return null;
    return { sub: decoded.sub, tenant_id: decoded.tenant_id };
  } catch {
    return null;
  }
}
