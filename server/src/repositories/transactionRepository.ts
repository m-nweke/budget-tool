import db from '../db';
import type { Transaction, CreateTransactionDto } from '../types';

const COLUMNS =
  't.id, t.amount, t.date, t.description, t.category_id, t.recurring_transaction_id, ' +
  't.needs_approval, t.approved, t.created_by';

function mapRow(row: Record<string, unknown>): Transaction {
  // SQLite stores booleans as 0/1 — map at the read boundary so every
  // caller (routes, other repos) works with real booleans, not ints.
  return { ...row, needs_approval: !!row.needs_approval, approved: !!row.approved } as Transaction;
}

const transactionRepository = {
  // Omitting departmentIds returns every transaction, unscoped — used by
  // internal callers (recurringTransactionRepository) that already scope
  // by other means. A route handler always passes the caller's accessible
  // department ids; an empty array (zero access) returns zero rows.
  findAll(departmentIds?: number[]): Transaction[] {
    if (!departmentIds) {
      return (db.prepare(`SELECT ${COLUMNS} FROM transactions t`).all() as Record<string, unknown>[]).map(
        mapRow
      );
    }
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => '?').join(', ');
    return (
      db
        .prepare(
          `SELECT ${COLUMNS} FROM transactions t
           JOIN categories c ON c.id = t.category_id
           WHERE c.department_id IN (${placeholders})`
        )
        .all(...departmentIds) as Record<string, unknown>[]
    ).map(mapRow);
  },

  findById(id: number | string): Transaction | undefined {
    const row = db.prepare(`SELECT ${COLUMNS} FROM transactions t WHERE t.id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : undefined;
  },

  // needsApproval/approved are computed by the caller (the route, which
  // already has the category loaded to validate category_id) by comparing
  // amount against category.approval_threshold — kept out of this repo so
  // it doesn't need a dependency on categoryRepository.
  create(
    { amount, date, description, category_id }: CreateTransactionDto,
    createdBy: number | null,
    needsApproval: boolean,
    approved: boolean
  ): Transaction {
    const result = db
      .prepare(
        'INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(amount, date, description || null, category_id, needsApproval ? 1 : 0, approved ? 1 : 0, createdBy);
    return transactionRepository.findById(result.lastInsertRowid as number) as Transaction;
  },

  // No live user behind a generated occurrence, so created_by is always
  // null — but it still needs the same threshold computation as a manual
  // create, hence the same needsApproval/approved parameters.
  createGenerated(
    { amount, date, description, category_id }: CreateTransactionDto,
    recurringTransactionId: number,
    needsApproval: boolean,
    approved: boolean
  ): Transaction {
    const result = db
      .prepare(
        'INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved, recurring_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        amount,
        date,
        description || null,
        category_id,
        needsApproval ? 1 : 0,
        approved ? 1 : 0,
        recurringTransactionId
      );
    return transactionRepository.findById(result.lastInsertRowid as number) as Transaction;
  },

  update(
    id: number | string,
    { amount, date, description, category_id }: CreateTransactionDto,
    needsApproval: boolean,
    approved: boolean
  ): Transaction {
    // needs_approval/approved are recomputed unconditionally on every
    // update (not diffed against the old value) — an edit that changes the
    // amount or moves the transaction to a category with a different
    // threshold must re-evaluate against the current rule, not keep
    // whatever was decided at creation time.
    db.prepare(
      'UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ?, needs_approval = ?, approved = ? WHERE id = ?'
    ).run(amount, date, description || null, category_id, needsApproval ? 1 : 0, approved ? 1 : 0, id);
    return transactionRepository.findById(id) as Transaction;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  },

  // Never deletes — a rejected transaction stays for audit visibility, just
  // with approved=0 and needs_approval cleared so it drops off the pending
  // list either way.
  approve(id: number | string, approved: boolean): Transaction {
    db.prepare('UPDATE transactions SET approved = ?, needs_approval = 0 WHERE id = ?').run(
      approved ? 1 : 0,
      id
    );
    return transactionRepository.findById(id) as Transaction;
  },

  findPendingApproval(departmentIds: number[]): Transaction[] {
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => '?').join(', ');
    return (
      db
        .prepare(
          `SELECT ${COLUMNS} FROM transactions t
           JOIN categories c ON c.id = t.category_id
           WHERE t.needs_approval = 1 AND c.department_id IN (${placeholders})`
        )
        .all(...departmentIds) as Record<string, unknown>[]
    ).map(mapRow);
  },
};

export default transactionRepository;
