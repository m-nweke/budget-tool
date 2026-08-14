import db from '../db';
import type { Transaction, CreateTransactionDto } from '../types';

const COLUMNS = 'id, amount, date, description, category_id, recurring_transaction_id';

const transactionRepository = {
  findAll(): Transaction[] {
    return db.prepare(`SELECT ${COLUMNS} FROM transactions`).all() as Transaction[];
  },

  findById(id: number | string): Transaction | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM transactions WHERE id = ?`).get(id) as
      | Transaction
      | undefined;
  },

  create({ amount, date, description, category_id }: CreateTransactionDto): Transaction {
    const result = db
      .prepare(
        'INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved) VALUES (?, ?, ?, ?, 0, 0)'
      )
      .run(amount, date, description || null, category_id);
    return transactionRepository.findById(result.lastInsertRowid as number) as Transaction;
  },

  createGenerated(
    { amount, date, description, category_id }: CreateTransactionDto,
    recurringTransactionId: number
  ): Transaction {
    const result = db
      .prepare(
        'INSERT INTO transactions (amount, date, description, category_id, needs_approval, approved, recurring_transaction_id) VALUES (?, ?, ?, ?, 0, 0, ?)'
      )
      .run(amount, date, description || null, category_id, recurringTransactionId);
    return transactionRepository.findById(result.lastInsertRowid as number) as Transaction;
  },

  update(id: number | string, { amount, date, description, category_id }: CreateTransactionDto): Transaction {
    db.prepare(
      'UPDATE transactions SET amount = ?, date = ?, description = ?, category_id = ? WHERE id = ?'
    ).run(amount, date, description || null, category_id, id);
    return transactionRepository.findById(id) as Transaction;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  },
};

export default transactionRepository;
