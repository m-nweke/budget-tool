import { db } from '../db';
import type {
  RecurringTransaction,
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
} from '../types';

export function findAll(): RecurringTransaction[] {
  return db.prepare('SELECT * FROM recurring_transactions ORDER BY id DESC').all() as RecurringTransaction[];
}

export function findAllActive(): RecurringTransaction[] {
  return db
    .prepare('SELECT * FROM recurring_transactions WHERE active = 1')
    .all() as RecurringTransaction[];
}

export function findById(id: number): RecurringTransaction | undefined {
  return db
    .prepare('SELECT * FROM recurring_transactions WHERE id = ?')
    .get(id) as RecurringTransaction | undefined;
}

export function create(dto: CreateRecurringTransactionDto): RecurringTransaction {
  const info = db
    .prepare(
      'INSERT INTO recurring_transactions (amount, description, category_id, interval, next_run_date, end_date) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(dto.amount, dto.description ?? null, dto.category_id, dto.interval, dto.start_date, dto.end_date ?? null);
  return findById(info.lastInsertRowid as number)!;
}

export function update(id: number, dto: UpdateRecurringTransactionDto): RecurringTransaction | undefined {
  const existing = findById(id);
  if (!existing) return undefined;

  db.prepare(
    'UPDATE recurring_transactions SET amount = ?, description = ?, category_id = ?, interval = ?, end_date = ? WHERE id = ?'
  ).run(
    dto.amount ?? existing.amount,
    dto.description !== undefined ? dto.description : existing.description,
    dto.category_id ?? existing.category_id,
    dto.interval ?? existing.interval,
    dto.end_date !== undefined ? dto.end_date : existing.end_date,
    id
  );

  return findById(id);
}

export function updateNextRunDate(id: number, nextRunDate: string): void {
  db.prepare('UPDATE recurring_transactions SET next_run_date = ? WHERE id = ?').run(nextRunDate, id);
}

export function deactivate(id: number): void {
  db.prepare('UPDATE recurring_transactions SET active = 0 WHERE id = ?').run(id);
}
