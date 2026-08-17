import db from '../db';
import type { Department } from '../types';

const COLUMNS = 'id, name';

const departmentRepository = {
  findAll(): Department[] {
    return db.prepare(`SELECT ${COLUMNS} FROM departments`).all() as Department[];
  },

  findById(id: number | string): Department | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM departments WHERE id = ?`).get(id) as
      | Department
      | undefined;
  },
};

export default departmentRepository;
