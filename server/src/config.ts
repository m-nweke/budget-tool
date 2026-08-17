// Centralizes env-derived settings so auth code doesn't read process.env
// directly in multiple places. The JWT_SECRET dev default is fine for local
// use (matches the dev-only seeded credentials) but must be overridden via
// env var in any real deployment.
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';
export const COOKIE_NAME = 'auth_token';
export const JWT_EXPIRES_IN = '7d';

// Cookies are only sent over HTTPS in production; local dev runs over plain
// HTTP so `secure: true` there would silently drop the cookie.
export const COOKIE_SECURE = process.env.NODE_ENV === 'production';
