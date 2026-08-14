import db from '../db';
import transactionRepository from './transactionRepository';
import { addByInterval, todayISO } from '../utils/dateUtils';
import type { RecurringTransaction, CreateRecurringTransactionDto, UpdateRecurringTransactionDto } from '../types';

const COLUMNS = 'id, amount, description, category_id, interval, next_run_date, end_date, active';

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

  create({
    amount,
    description,
    category_id,
    start_date,
    interval,
    end_date,
  }: CreateRecurringTransactionDto): RecurringTransaction {
    const result = db
      .prepare(
        'INSERT INTO recurring_transactions (amount, description, category_id, interval, next_run_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
      )
      .run(amount, description || null, category_id, interval, start_date, end_date || null);
    return recurringTransactionRepository.findById(result.lastInsertRowid as number) as RecurringTransaction;
  },

  update(
    id: number | string,
    { amount, description, category_id, interval, end_date }: UpdateRecurringTransactionDto
  ): RecurringTransaction {
    db.prepare(
      'UPDATE recurring_transactions SET amount = ?, description = ?, category_id = ?, interval = ?, end_date = ? WHERE id = ?'
    ).run(amount, description || null, category_id, interval, end_date || null, id);

    const updated = recurringTransactionRepository.findById(id) as RecurringTransaction;
    // If the new end_date already precedes where the series currently
    // stands, there's nothing left to generate — deactivate immediately
    // rather than leaving a "still active" series that will never fire.
    if (updated.end_date && updated.end_date < updated.next_run_date) {
      recurringTransactionRepository.deactivate(id);
      return recurringTransactionRepository.findById(id) as RecurringTransaction;
    }
    return updated;
  },

  countForCategory(categoryId: number | string): number {
    // Counts every row regardless of `active` — a cancelled series still
    // holds a foreign key to the category, so it still blocks deletion.
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM recurring_transactions WHERE category_id = ?')
      .get(categoryId) as { count: number };
    return row.count;
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
      let pastEnd = false;

      while (nextRun <= today) {
        if (template.end_date && nextRun > template.end_date) {
          pastEnd = true;
          break;
        }
        transactionRepository.createGenerated(
          {
            amount: template.amount,
            date: nextRun,
            description: template.description,
            category_id: template.category_id,
          },
          template.id
        );
        nextRun = addByInterval(nextRun, template.interval);
      }

      if (template.end_date && nextRun > template.end_date) {
        pastEnd = true;
      }

      if (pastEnd) {
        recurringTransactionRepository.deactivate(template.id);
      } else if (nextRun !== template.next_run_date) {
        db.prepare('UPDATE recurring_transactions SET next_run_date = ? WHERE id = ?').run(
          nextRun,
          template.id
        );
      }
    }
  },
};

export default recurringTransactionRepository;
