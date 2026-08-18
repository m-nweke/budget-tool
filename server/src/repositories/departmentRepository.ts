import db from '../db';
import type { Department } from '../types';

const COLUMNS = 'id, name';

const departmentRepository = {
  // Omitting departmentIds returns every department, unscoped — no route
  // handler does this (departments.ts always passes the caller's
  // accessible ids); an empty array (zero access) returns zero rows rather
  // than falling through to "no filter," same convention as every other
  // scoped repo.
  findAll(departmentIds?: number[]): Department[] {
    if (!departmentIds) {
      return db.prepare(`SELECT ${COLUMNS} FROM departments`).all() as Department[];
    }
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => '?').join(', ');
    return db
      .prepare(`SELECT ${COLUMNS} FROM departments WHERE id IN (${placeholders})`)
      .all(...departmentIds) as Department[];
  },

  findById(id: number | string): Department | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM departments WHERE id = ?`).get(id) as
      | Department
      | undefined;
  },
};

export default departmentRepository;
