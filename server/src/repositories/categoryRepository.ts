import db from '../db';
import type { Category, NewCategory } from '../types';

const categoryRepository = {
  findAll(): Category[] {
    return db.prepare('SELECT * FROM categories').all() as Category[];
  },

  findById(id: number | string): Category | undefined {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | undefined;
  },

  create({ name, budgeted_amount }: NewCategory): Category {
    const result = db
      .prepare('INSERT INTO categories (name, budgeted_amount) VALUES (?, ?)')
      .run(name, budgeted_amount);
    return categoryRepository.findById(result.lastInsertRowid as number) as Category;
  },

  update(id: number | string, { name, budgeted_amount }: NewCategory): Category {
    db.prepare('UPDATE categories SET name = ?, budgeted_amount = ? WHERE id = ?').run(
      name,
      budgeted_amount,
      id
    );
    return categoryRepository.findById(id) as Category;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  countTransactionsFor(id: number | string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM transactions WHERE category_id = ?')
      .get(id) as { count: number };
    return row.count;
  },
};

export default categoryRepository;
