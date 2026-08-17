import type { AuthUser } from '../user';

// Augments Express's Request so route handlers can read req.user without a
// cast. Set by the authenticate middleware; absent on unauthenticated
// requests to routes that don't require it.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
