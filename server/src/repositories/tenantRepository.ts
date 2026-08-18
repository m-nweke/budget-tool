import { randomInt } from 'crypto';
import db from '../db';
import type { Tenant, TenantType } from '../types';

const COLUMNS = 'id, name, type, join_code';

// Excludes visually ambiguous characters (0/O, 1/I) — still human-typeable,
// but every character is drawn from `crypto.randomInt` rather than
// `Math.random()`, since this code is the sole gate on who can join an
// enterprise tenant (not just an accidental-guess deterrent).
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;

function generateJoinCode(): string {
  let random = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    random += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
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
