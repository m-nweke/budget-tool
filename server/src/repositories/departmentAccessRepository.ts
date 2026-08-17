import db from '../db';

const departmentAccessRepository = {
  // INSERT OR IGNORE: the composite (user_id, department_id) primary key
  // already prevents a duplicate row, but without OR IGNORE a repeat grant
  // would throw a constraint error instead of being a no-op.
  grant(userId: number, departmentId: number): void {
    db.prepare('INSERT OR IGNORE INTO department_access (user_id, department_id) VALUES (?, ?)').run(
      userId,
      departmentId
    );
  },

  revoke(userId: number, departmentId: number): void {
    db.prepare('DELETE FROM department_access WHERE user_id = ? AND department_id = ?').run(
      userId,
      departmentId
    );
  },

  listForUser(userId: number): number[] {
    const rows = db
      .prepare('SELECT department_id FROM department_access WHERE user_id = ?')
      .all(userId) as { department_id: number }[];
    return rows.map((row) => row.department_id);
  },
};

export default departmentAccessRepository;
