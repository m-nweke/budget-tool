import db from '../db';
import transactionRepository from './transactionRepository';
import { addOneMonth, todayISO } from '../utils/dateUtils';
import type { RecurringTransaction, CreateRecurringTransactionDto } from '../types';

const COLUMNS = 'id, amount, description, category_id, interval, next_run_date, active';

const recurringTransactionRepository = {
  findAllActive(): RecurringTransaction[] {
    return db
      .prepare(`SELECT ${COLUMNS} FROM recurring_transactions WHERE active = 1`)
      .all() as RecurringTransaction[];
  },

  findById(id: number | string): RecurringTransaction | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM recurring_transactions WHERE id = ?`).get(id) as
      | RecurringTransaction
      | undefined;
  },

  create({ amount, description, category_id, start_date }: CreateRecurringTransactionDto): RecurringTransaction {
    const result = db
      .prepare(
        "INSERT INTO recurring_transactions (amount, description, category_id, interval, next_run_date, active) VALUES (?, ?, ?, 'monthly', ?, 1)"
      )
      .run(amount, description || null, category_id, start_date);
    return recurringTransactionRepository.findById(result.lastInsertRowid as number) as RecurringTransaction;
  },

  deactivate(id: number | string): void {
    db.prepare('UPDATE recurring_transactions SET active = 0 WHERE id = ?').run(id);
  },

  // Materializes any due occurrences into real transactions. Called before
  // reads (transactions/dashboard) rather than on a schedule, since there's
  // no background job runner in this deployment (see decisions.md #18).
  generateDue(): void {
    const templates = recurringTransactionRepository.findAllActive();
    const today = todayISO();

    for (const template of templates) {
      let nextRun = template.next_run_date;
      while (nextRun <= today) {
        transactionRepository.createGenerated(
          {
            amount: template.amount,
            date: nextRun,
            description: template.description,
            category_id: template.category_id,
          },
          template.id
        );
        nextRun = addOneMonth(nextRun);
      }
      if (nextRun !== template.next_run_date) {
        db.prepare('UPDATE recurring_transactions SET next_run_date = ? WHERE id = ?').run(
          nextRun,
          template.id
        );
      }
    }
  },
};

export default recurringTransactionRepository;
