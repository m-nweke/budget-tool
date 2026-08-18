import db from '../db';
import type { Tenant, TenantType } from '../types';

const COLUMNS = 'id, name, type, join_code';

function generateJoinCode(): string {
  // Short, human-typeable code (e.g. "ACME-4F2K") — not a security token,
  // just enough friction that it isn't guessable by accident. Uniqueness
  // is enforced by the join_code UNIQUE index; a collision (astronomically
  // unlikely at this length) surfaces as a constraint error the caller can
  // retry, not silently overwrite another tenant's code.
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TEAM-${random}`;
}

const tenantRepository = {
  findById(id: number | string): Tenant | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM tenants WHERE id = ?`).get(id) as Tenant | undefined;
  },

  findByJoinCode(joinCode: string): Tenant | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM tenants WHERE join_code = ?`).get(joinCode) as
      | Tenant
      | undefined;
  },

  create(name: string, type: TenantType): Tenant {
    const joinCode = type === 'enterprise' ? generateJoinCode() : null;
    const result = db
      .prepare('INSERT INTO tenants (name, type, join_code) VALUES (?, ?, ?)')
      .run(name, type, joinCode);
    return tenantRepository.findById(result.lastInsertRowid as number) as Tenant;
  },
};

export default tenantRepository;
