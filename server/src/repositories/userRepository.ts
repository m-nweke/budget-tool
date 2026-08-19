import db from '../db';
import type { User, CreateUserDto, AuthUser, TenantMembership, Tenant } from '../types';

const COLUMNS = 'id, name, email, password_hash';

// Combines the three rows `authenticate` resolves a session from (the
// user's identity, their membership in the active tenant, and that
// tenant's type) into the AuthUser shape routes/clients see. Centralized
// here (as toAuthUser was before tenants existed) so every call site that
// builds req.user or a login/me response body can't drift.
export function buildAuthUser(user: User, membership: TenantMembership, tenant: Tenant): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tenant_id: tenant.id,
    tenant_type: tenant.type,
    role: membership.role,
    department_id: membership.department_id,
  };
}

const userRepository = {
  findById(id: number | string): User | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id) as User | undefined;
  },

  findByEmail(email: string): User | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM users WHERE email = ?`).get(email) as User | undefined;
  },

  create({ name, email, password_hash }: CreateUserDto): User {
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, password_hash);
    return userRepository.findById(result.lastInsertRowid as number) as User;
  },
};

export default userRepository;
