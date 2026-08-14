import db from '../db';
import type { User, CreateUserDto } from '../types';

const COLUMNS = 'id, name, email, role, department_id, password_hash';

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
