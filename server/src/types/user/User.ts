// Forward-compatibility only: no auth or role checks are implemented
// yet (see decisions 5, 6, 16). Not exposed via any route.
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'department_head' | 'department_employee';
  department_id: number | null;
}
