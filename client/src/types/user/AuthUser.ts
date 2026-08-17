// Mirrors server/src/types/user/AuthUser.ts — the shape returned by
// /api/auth/login and /api/auth/me. Never has a password field.
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'department_head' | 'department_employee';
  department_id: number | null;
}
