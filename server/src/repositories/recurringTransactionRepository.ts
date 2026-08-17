import db from '../db';
import transactionRepository from './transactionRepository';
import categoryRepository from './categoryRepository';
import { addByInterval, todayISO } from '../utils/dateUtils';
import type { RecurringTransaction, CreateRecurringTransactionDto, UpdateRecurringTransactionDto } from '../types';

const COLUMNS = 'id, amount, description, category_id, interval, next_run_date, end_date, active';

// Generates every due occurrence for one template, starting from its
// current next_run_date. Shared by generateDue() (all active templates) and
// update()'s "apply to existing" regeneration path (one template, after its
// generation cursor has been rewound — see recurringTransactionRepository.update).
function generateDueForTemplate(template: RecurringTransaction): void {
  const today = todayISO();
  let nextRun = template.next_run_date;
  let pastEnd = false;

  // Loaded once per template, not per occurrence — a category's threshold
  // can't change mid-loop, and generateDue() may run this for many
  // templates in one pass.
  const category = categoryRepository.findById(template.category_id);
  const threshold = category?.approval_threshold ?? null;

  while (nextRun <= today) {
    if (template.end_date && nextRun > template.end_date) {
      pastEnd = true;
      break;
    }
    const needsApproval = threshold !== null && template.amount > threshold;
    transactionRepository.createGenerated(
      {
        amount: template.amount,
        date: nextRun,
        description: template.description,
        category_id: template.category_id,
      },
      template.id,
      needsApproval,
      !needsApproval
    );
    nextRun = addByInterval(nextRun, template.interval);
  }

  if (template.end_date && nextRun > template.end_date) {
    pastEnd = true;
  }

  if (pastEnd) {
    recurringTransactionRepository.deactivate(template.id);
  } else if (nextRun !== template.next_run_date) {
    db.prepare('UPDATE recurring_transactions SET next_run_date = ? WHERE id = ?').run(nextRun, template.id);
  }
}

const recurringTransactionRepository = {
  // Omitting departmentIds returns every active template, unscoped — used
  // internally by generateDue() (materializes for the whole app, not one
  // user's view). Route handlers always pass the caller's accessible ids.
  findAllActive(departmentIds?: number[]): RecurringTransaction[] {
    if (!departmentIds) {
      return db
        .prepare(`SELECT ${COLUMNS} FROM recurring_transactions WHERE active = 1`)
        .all() as RecurringTransaction[];
    }
    if (departmentIds.length === 0) return [];
    const placeholders = departmentIds.map(() => '?').join(', ');
    return db
      .prepare(
        `SELECT rt.${COLUMNS.split(', ').join(', rt.')} FROM recurring_transactions rt
         JOIN categories c ON c.id = rt.category_id
         WHERE rt.active = 1 AND c.department_id IN (${placeholders})`
      )
      .all(...departmentIds) as RecurringTransaction[];
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

  update: db.transaction(
    (
      id: number | string,
      { amount, description, category_id, interval, end_date, apply_to_existing }: UpdateRecurringTransactionDto
    ): RecurringTransaction => {
      db.prepare(
        'UPDATE recurring_transactions SET amount = ?, description = ?, category_id = ?, interval = ?, end_date = ? WHERE id = ?'
      ).run(amount, description || null, category_id, interval, end_date || null, id);

      // Opt-in: rebuild history under the new config rather than just
      // patching fields on the old rows. Find when this series first
      // actually produced a transaction, delete everything it's generated
      // so far, rewind the generation cursor back to that date, and
      // regenerate from scratch — so a weekly series changed to monthly
      // ends up with genuinely monthly-spaced history, not old weekly rows
      // with new field values.
      if (apply_to_existing) {
        const earliest = db
          .prepare('SELECT MIN(date) AS date FROM transactions WHERE recurring_transaction_id = ?')
          .get(id) as { date: string | null };

        if (earliest.date) {
          db.prepare('DELETE FROM transactions WHERE recurring_transaction_id = ?').run(id);
          db.prepare('UPDATE recurring_transactions SET next_run_date = ?, active = 1 WHERE id = ?').run(
            earliest.date,
            id
          );
          generateDueForTemplate(recurringTransactionRepository.findById(id) as RecurringTransaction);
        }
      }

      const updated = recurringTransactionRepository.findById(id) as RecurringTransaction;
      // If the new end_date already precedes where the series currently
      // stands, there's nothing left to generate — deactivate immediately
      // rather than leaving a "still active" series that will never fire.
      if (updated.active && updated.end_date && updated.end_date < updated.next_run_date) {
        recurringTransactionRepository.deactivate(id);
        return recurringTransactionRepository.findById(id) as RecurringTransaction;
      }
      return updated;
    }
  ),

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
  // Wrapped in a single transaction: a multi-month backfill can mean many
  // inserts in one call, and without this each one commits (and fsyncs)
  // individually — batching them is both faster and makes the whole
  // generation pass atomic (a crash mid-backfill can't leave next_run_date
  // out of sync with which transactions actually got created).
  generateDue: db.transaction(() => {
    for (const template of recurringTransactionRepository.findAllActive()) {
      generateDueForTemplate(template);
    }
  }),
};

export default recurringTransactionRepository;
