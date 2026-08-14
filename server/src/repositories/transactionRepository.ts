import { db } from '../db';
import type { Transaction, CreateTransactionDto, UpdateTransactionDto } from '../types';

export function findAll(): Transaction[] {
  return db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC').all() as Transaction[];
}

export function findById(id: number): Transaction | undefined {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined;
}

export function findByDateRange(from: string, to: string): Transaction[] {
  return db
    .prepare('SELECT * FROM transactions WHERE date >= ? AND date <= ?')
    .all(from, to) as Transaction[];
}

export function create(dto: CreateTransactionDto): Transaction {
  const info = db
    .prepare('INSERT INTO transactions (amount, date, description, category_id) VALUES (?, ?, ?, ?)')
    .run(dto.amount, dto.date, dto.description ?? null, dto.category_id);
  return findById(info.lastInsertRowid as number)!;
}

export function createRecurringInstance(
  categoryId: number,
  amount: number,
  description: string | null,
  date: string,
  recurringTransactionId: number
): Transaction {
  const info = db
    .prepare(
      'INSERT INTO transactions (amount, date, description, category_id, recurring_transaction_id) VALUES (?, ?, ?, ?, ?)'
    )
    .run(amount, date, description, categoryId, recurringTransactionId);
  return findById(info.lastInsertRowid as number)!;
}

export function update(id: number, dto: UpdateTransactionDto): Transaction | undefined {
  const existing = findById(id);
  if (!existing) return undefined;

  db.prepare('UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ? WHERE id = ?').run(
    dto.amount ?? existing.amount,
    dto.date ?? existing.date,
    dto.description !== undefined ? dto.description : existing.description,
    dto.category_id ?? existing.category_id,
    id
  );

  return findById(id);
}

export function remove(id: number): void {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
}

export function findByRecurringId(recurringTransactionId: number): Transaction[] {
  return db
    .prepare('SELECT * FROM transactions WHERE recurring_transaction_id = ? ORDER BY date ASC')
    .all(recurringTransactionId) as Transaction[];
}

export function deleteByRecurringId(recurringTransactionId: number): void {
  db.prepare('DELETE FROM transactions WHERE recurring_transaction_id = ?').run(recurringTransactionId);
}
