// Identity only — role and department are per-tenant now (see
// TenantMembership), since one login can belong to more than one tenant.
export interface User {
  id: number;
  name: string;
  email: string;
  // Nullable to match the DB column: rows created before password_hash
  // existed (or any inserted outside userRepository.create, which always
  // requires a hash) genuinely have no hash at rest. Login-flow code must
  // treat a null hash as "cannot authenticate," not assume it's a string.
  password_hash: string | null;
}
