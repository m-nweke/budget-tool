import { db } from '../db';
import type { Category, CreateCategoryDto, UpdateCategoryDto } from '../types';

export function findAll(): Category[] {
  return db.prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}

export function findById(id: number): Category | undefined {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
}

export function create(dto: CreateCategoryDto): Category {
  const stmt = dto.start_on
    ? db.prepare(
        'INSERT INTO categories (name, budgeted_amount, department_id, start_on) VALUES (?, ?, ?, ?)'
      )
    : db.prepare('INSERT INTO categories (name, budgeted_amount, department_id) VALUES (?, ?, ?)');

  const params = dto.start_on
    ? [dto.name, dto.budgeted_amount, dto.department_id ?? null, dto.start_on]
    : [dto.name, dto.budgeted_amount, dto.department_id ?? null];

  const info = stmt.run(...params);
  return findById(info.lastInsertRowid as number)!;
}

export function update(id: number, dto: UpdateCategoryDto): Category | undefined {
  const existing = findById(id);
  if (!existing) return undefined;

  db.prepare(
    'UPDATE categories SET name = ?, budgeted_amount = ?, department_id = ?, start_on = ? WHERE id = ?'
  ).run(
    dto.name ?? existing.name,
    dto.budgeted_amount ?? existing.budgeted_amount,
    dto.department_id !== undefined ? dto.department_id : existing.department_id,
    dto.start_on !== undefined ? dto.start_on : existing.start_on,
    id
  );

  return findById(id);
}

export function remove(id: number): void {
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function countTransactionsForCategory(id: number): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?')
    .get(id) as { count: number };
  return row.count;
}

export function countRecurringForCategory(id: number): number {
  const row = db
    .prepare('SELECT COUNT(*) as count FROM recurring_transactions WHERE category_id = ?')
    .get(id) as { count: number };
  return row.count;
}
