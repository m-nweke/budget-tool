// Centralizes env-derived settings so auth code doesn't read process.env
// directly in multiple places. The JWT_SECRET dev default is fine for local
// use (matches the dev-only seeded credentials), but a production process
// silently starting on that hardcoded value would let anyone who's read the
// repo forge a valid token for any user, so production refuses to boot
// without a real one set via env var.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';
export const COOKIE_NAME = 'auth_token';
export const JWT_EXPIRES_IN = '7d';

// Cookies are only sent over HTTPS in production; local dev runs over plain
// HTTP so `secure: true` there would silently drop the cookie.
export const COOKIE_SECURE = process.env.NODE_ENV === 'production';
