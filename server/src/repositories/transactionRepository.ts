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
  // departmentIds (enterprise scoping) wins when given. tenantId (personal
  // scoping) is the fallback when departmentIds is omitted — a personal
  // tenant's transactions all belong to categories with department_id =
  // NULL, so they're scoped by the category's tenant_id instead. Omitting
  // both returns every transaction, unscoped — used by internal callers
  // (recurringTransactionRepository) that already scope by other means.
  async findAll(departmentIds?: number[], tenantId?: number): Promise<Transaction[]> {
    if (departmentIds) {
      if (departmentIds.length === 0) return [];
      const placeholders = departmentIds.map(() => '?').join(', ');
      return (
        (await db.all(`SELECT ${COLUMNS} FROM transactions t
             JOIN categories c ON c.id = t.category_id
             WHERE c.department_id IN (${placeholders})`, ...departmentIds)) as Record<string, unknown>[]
      ).map(mapRow);
    }
    if (tenantId !== undefined) {
      return (
        (await db.all(`SELECT ${COLUMNS} FROM transactions t
             JOIN categories c ON c.id = t.category_id
             WHERE c.tenant_id = ?`, tenantId)) as Record<string, unknown>[]
      ).map(mapRow);
    }
    return ((await db.all(`SELECT ${COLUMNS} FROM transactions t`)) as Record<string, unknown>[]).map(mapRow);
  },

  async findById(id: number | string): Promise<Transaction | undefined> {
    const row = (await db.get(`SELECT ${COLUMNS} FROM transactions t WHERE t.id = ?`, id)) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRow(row) : undefined;
  },

  // needsApproval/approved are computed by the caller (the route, which
  // already has the category loaded to validate category_id) by comparing
  // amount against category.approval_threshold — kept out of this repo so
  // it doesn't need a dependency on categoryRepository.
  async create(
    { amount, date, description, category_id }: CreateTransactionDto,
    createdBy: number | null,
    needsApproval: boolean,
    approved: boolean
  ): Promise<Transaction> {
    const result = (await db.run('INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', amount, date, description || null, category_id, needsApproval ? 1 : 0, approved ? 1 : 0, createdBy));
    return (await transactionRepository.findById(result.lastInsertRowid as number)) as Transaction;
  },

  // No live user behind a generated occurrence, so created_by is always
  // null — but it still needs the same threshold computation as a manual
  // create, hence the same needsApproval/approved parameters.
  async createGenerated(
    { amount, date, description, category_id }: CreateTransactionDto,
    recurringTransactionId: number,
    needsApproval: boolean,
    approved: boolean
  ): Promise<Transaction> {
    const result = (await db.run('INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved, recurring_transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)', amount, date, description || null, category_id, needsApproval ? 1 : 0, approved ? 1 : 0, recurringTransactionId));
    return (await transactionRepository.findById(result.lastInsertRowid as number)) as Transaction;
  },

  async update(
    id: number | string,
    { amount, date, description, category_id }: CreateTransactionDto,
    needsApproval: boolean,
    approved: boolean
  ): Promise<Transaction> {
    // needs_approval/approved are recomputed unconditionally on every
    // update (not diffed against the old value) — an edit that changes the
    // amount or moves the transaction to a category with a different
    // threshold must re-evaluate against the current rule, not keep
    // whatever was decided at creation time.
    (await db.run('UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ?, needs_approval = ?, approved = ? WHERE id = ?', amount, date, description || null, category_id, needsApproval ? 1 : 0, approved ? 1 : 0, id));
    return (await transactionRepository.findById(id)) as Transaction;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM transactions WHERE id = ?', id));
  },

  // Never deletes — a rejected transaction stays for audit visibility, just
  // with approved=0 and needs_approval cleared so it drops off the pending
  // list either way.
  async approve(id: number | string, approved: boolean): Promise<Transaction> {
    (await db.run('UPDATE transactions SET approved = ?, needs_approval = 0 WHERE id = ?', approved ? 1 : 0, id));
    return (await transactionRepository.findById(id)) as Transaction;
  },

  // Same departmentIds/tenantId split as findAll: enterprise scoping wins
  // when departmentIds is given, tenantId is the fallback for a personal
  // tenant's owner (whose categories have department_id = NULL).
  async findPendingApproval(departmentIds?: number[], tenantId?: number): Promise<Transaction[]> {
    if (departmentIds) {
      if (departmentIds.length === 0) return [];
      const placeholders = departmentIds.map(() => '?').join(', ');
      return (
        (await db.all(`SELECT ${COLUMNS} FROM transactions t
             JOIN categories c ON c.id = t.category_id
             WHERE t.needs_approval = 1 AND c.department_id IN (${placeholders})`, ...departmentIds)) as Record<string, unknown>[]
      ).map(mapRow);
    }
    if (tenantId !== undefined) {
      return (
        (await db.all(`SELECT ${COLUMNS} FROM transactions t
             JOIN categories c ON c.id = t.category_id
             WHERE t.needs_approval = 1 AND c.tenant_id = ?`, tenantId)) as Record<string, unknown>[]
      ).map(mapRow);
    }
    return [];
  },
};

export default transactionRepository;
