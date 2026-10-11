import db from '../db';
import type { Department } from '../types';

const COLUMNS = 'id, tenant_id, name';

const departmentRepository = {
  // Omitting departmentIds returns every department, unscoped — no route
  // handler does this (departments.ts always passes the caller's
  // accessible ids); an empty array (zero access) returns zero rows rather
  // than falling through to "no filter," same convention as every other
  // scoped repo.
  async findAll(departmentIds?: number[]): Promise<Department[]> {
    if (!departmentIds) {
      return (await db.all(`SELECT ${COLUMNS} FROM departments`)) as Department[];
    }
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => '?').join(', ');
    return (await db.all(`SELECT ${COLUMNS} FROM departments WHERE id IN (${placeholders})`, ...departmentIds)) as Department[];
  },

  async findById(id: number | string): Promise<Department | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM departments WHERE id = ?`, id)) as
      | Department
      | undefined;
  },

  async create(name: string, tenantId: number): Promise<Department> {
    const result = (await db.run('INSERT INTO departments (name, tenant_id) VALUES (?, ?)', name, tenantId));
    return (await departmentRepository.findById(result.lastInsertRowid as number)) as Department;
  },
};

export default departmentRepository;
