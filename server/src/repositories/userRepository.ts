import db from '../db';
import type { User, CreateUserDto, AuthUser } from '../types';

const COLUMNS = 'id, name, email, role, department_id, password_hash';

// The User -> AuthUser mapping (strip password_hash) is needed anywhere a
// route or middleware sets req.user or a response body from a User row —
// centralized here so both call sites can't drift if AuthUser's shape
// changes later.
export function toAuthUser(user: User): AuthUser {
  const { password_hash, ...authUser } = user;
  return authUser;
}

const userRepository = {
  findById(id: number | string): User | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id) as User | undefined;
  },

  findByEmail(email: string): User | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM users WHERE email = ?`).get(email) as User | undefined;
  },

  create({ name, email, role, department_id, password_hash }: CreateUserDto): User {
    const result = db
      .prepare('INSERT INTO users (name, email, role, department_id, password_hash) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, role, department_id, password_hash);
    return userRepository.findById(result.lastInsertRowid as number) as User;
  },
};

export default userRepository;
