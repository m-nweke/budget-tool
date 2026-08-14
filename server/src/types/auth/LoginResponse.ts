import type { AuthUser } from '../user';

// The JWT itself never appears in the response body — it's set as an
// httpOnly cookie by the route handler, so client-side JS can't read it.
export interface LoginResponse {
  user: AuthUser;
}
