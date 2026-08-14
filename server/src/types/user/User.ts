export interface User {
  id: number;
  name: string;
  email: string;
  role: 'department_head' | 'department_employee';
  department_id: number | null;
  // Nullable to match the DB column: rows created before password_hash
  // existed (or any inserted outside userRepository.create, which always
  // requires a hash) genuinely have no hash at rest. Login-flow code must
  // treat a null hash as "cannot authenticate," not assume it's a string.
  password_hash: string | null;
}
