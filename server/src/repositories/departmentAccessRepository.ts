import db from '../db';

const departmentAccessRepository = {
  // INSERT OR IGNORE: the composite (user_id, department_id) primary key
  // already prevents a duplicate row, but without OR IGNORE a repeat grant
  // would throw a constraint error instead of being a no-op.
  async grant(userId: number, departmentId: number): Promise<void> {
    (await db.run('INSERT INTO department_access (user_id, department_id) VALUES (?, ?) ON CONFLICT DO NOTHING', userId, departmentId));
  },

  async revoke(userId: number, departmentId: number): Promise<void> {
    (await db.run('DELETE FROM department_access WHERE user_id = ? AND department_id = ?', userId, departmentId));
  },

  async listForUser(userId: number): Promise<number[]> {
    const rows = (await db.all('SELECT department_id FROM department_access WHERE user_id = ?', userId)) as { department_id: number }[];
    return rows.map((row) => row.department_id);
  },
};

export default departmentAccessRepository;
