import type { AuthUser } from '../user';
import type { MembershipSummary } from './MembershipSummary';

// The JWT itself never appears in the response body — it's set as an
// httpOnly cookie by the route handler, so client-side JS can't read it.
// Two shapes: a single-membership login (or /me, or select-tenant) sets
// a full session cookie and returns `user` directly. A multi-membership
// login sets a short-lived pre-tenant cookie (identifies the user, not a
// tenant) and returns `memberships` instead — the client must call
// POST /api/auth/select-tenant with one of them to get a full session.
export type LoginResponse = { user: AuthUser } | { memberships: MembershipSummary[] };
