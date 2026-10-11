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
  async findById(id: number | string): Promise<Tenant | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM tenants WHERE id = ?`, id)) as Tenant | undefined;
  },

  async findByJoinCode(joinCode: string): Promise<Tenant | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM tenants WHERE join_code = ?`, joinCode)) as
      | Tenant
      | undefined;
  },

  async create(name: string, type: TenantType): Promise<Tenant> {
    const joinCode = type === 'enterprise' ? generateJoinCode() : null;
    const result = (await db.run('INSERT INTO tenants (name, type, join_code) VALUES (?, ?, ?)', name, type, joinCode));
    return (await tenantRepository.findById(result.lastInsertRowid as number)) as Tenant;
  },
};

export default tenantRepository;
