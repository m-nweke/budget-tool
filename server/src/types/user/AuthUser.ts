// The shape exposed to routes/clients: everything on User except
// password_hash. Attached to req.user by the auth middleware, and what
// GET /api/auth/me returns — never the full User row.
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'department_head' | 'department_employee';
  department_id: number | null;
}