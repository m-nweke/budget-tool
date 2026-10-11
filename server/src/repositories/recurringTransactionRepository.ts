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
async function generateDueForTemplate(template: RecurringTransaction): Promise<void> {
  const today = todayISO();
  let nextRun = template.next_run_date;
  let pastEnd = false;

  // Loaded once per template, not per occurrence — a category's threshold
  // can't change mid-loop, and generateDue() may run this for many
  // templates in one pass.
  const category = (await categoryRepository.findById(template.category_id));
  const threshold = category?.approval_threshold ?? null;

  while (nextRun <= today) {
    if (template.end_date && nextRun > template.end_date) {
      pastEnd = true;
      break;
    }
    const needsApproval = threshold !== null && template.amount > threshold;
    (await transactionRepository.createGenerated(
      {
        amount: template.amount,
        date: nextRun,
        description: template.description,
        category_id: template.category_id,
      },
      template.id,
      needsApproval,
      !needsApproval
    ));
    nextRun = addByInterval(nextRun, template.interval);
  }

  if (template.end_date && nextRun > template.end_date) {
    pastEnd = true;
  }

  if (pastEnd) {
    (await recurringTransactionRepository.deactivate(template.id));
  } else if (nextRun !== template.next_run_date) {
    (await db.run('UPDATE recurring_transactions SET next_run_date = ? WHERE id = ?', nextRun, template.id));
  }
}

// Existence-only check for generateDue()'s short-circuit — same tenant-scoping
// shape as findAllActive (tenantId given = one tenant via the categories
// join, omitted = every tenant), but a single indexed LIMIT 1 lookup instead
// of materializing every active template's full row.
async function hasDueTemplates(tenantId?: number): Promise<boolean> {
  const today = todayISO();
  if (tenantId !== undefined) {
    const row = (await db.get(`SELECT 1 FROM recurring_transactions rt
         JOIN categories c ON c.id = rt.category_id
         WHERE rt.active = 1 AND c.tenant_id = ? AND rt.next_run_date <= ?
         LIMIT 1`, tenantId, today));
    return row !== undefined;
  }
  const row = (await db.get('SELECT 1 FROM recurring_transactions WHERE active = 1 AND next_run_date <= ? LIMIT 1', today));
  return row !== undefined;
}

// Wrapped in a single transaction: a multi-month backfill can mean many
// inserts in one call, and without this each one commits (and fsyncs)
// individually — batching them is both faster and makes the whole
// generation pass atomic (a crash mid-backfill can't leave next_run_date
// out of sync with which transactions actually got created).
const generateDueTransaction = db.transaction(async (tenantId?: number) => {
  for (const template of (await recurringTransactionRepository.findAllActive(undefined, tenantId))) {
    (await generateDueForTemplate(template));
  }
});

const recurringTransactionRepository = {
  // departmentIds (enterprise) wins when given; tenantId (personal) is the
  // fallback. Omitting both returns every active template, unscoped — used
  // internally by generateDue() (materializes for the whole app, not one
  // user's view).
  async findAllActive(departmentIds?: number[], tenantId?: number): Promise<RecurringTransaction[]> {
    if (departmentIds) {
      if (departmentIds.length === 0) return [];
      const placeholders = departmentIds.map(() => '?').join(', ');
      return (await db.all(`SELECT rt.${COLUMNS.split(', ').join(', rt.')} FROM recurring_transactions rt
           JOIN categories c ON c.id = rt.category_id
           WHERE rt.active = 1 AND c.department_id IN (${placeholders})`, ...departmentIds)) as RecurringTransaction[];
    }
    if (tenantId !== undefined) {
      return (await db.all(`SELECT rt.${COLUMNS.split(', ').join(', rt.')} FROM recurring_transactions rt
           JOIN categories c ON c.id = rt.category_id
           WHERE rt.active = 1 AND c.tenant_id = ?`, tenantId)) as RecurringTransaction[];
    }
    return (await db.all(`SELECT ${COLUMNS} FROM recurring_transactions WHERE active = 1`)) as RecurringTransaction[];
  },

  async findById(id: number | string): Promise<RecurringTransaction | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM recurring_transactions WHERE id = ?`, id)) as
      | RecurringTransaction
      | undefined;
  },

  async create({
    amount,
    description,
    category_id,
    start_date,
    interval,
    end_date,
  }: CreateRecurringTransactionDto): Promise<RecurringTransaction> {
    const result = (await db.run('INSERT INTO recurring_transactions (amount, description, category_id, interval, next_run_date, end_date, active) VALUES (?, ?, ?, ?, ?, ?, 1)', amount, description || null, category_id, interval, start_date, end_date || null));
    return (await recurringTransactionRepository.findById(result.lastInsertRowid as number)) as RecurringTransaction;
  },

  update: db.transaction(
    async (
      id: number | string,
      { amount, description, category_id, interval, end_date, apply_to_existing }: UpdateRecurringTransactionDto
    ): Promise<RecurringTransaction> => {
      (await db.run('UPDATE recurring_transactions SET amount = ?, description = ?, category_id = ?, interval = ?, end_date = ? WHERE id = ?', amount, description || null, category_id, interval, end_date || null, id));

      // Opt-in: rebuild history under the new config rather than just
      // patching fields on the old rows. Find when this series first
      // actually produced a transaction, delete everything it's generated
      // so far, rewind the generation cursor back to that date, and
      // regenerate from scratch — so a weekly series changed to monthly
      // ends up with genuinely monthly-spaced history, not old weekly rows
      // with new field values.
      if (apply_to_existing) {
        const earliest = (await db.get('SELECT MIN(date) AS date FROM transactions WHERE recurring_transaction_id = ?', id)) as { date: string | null };

        if (earliest.date) {
          (await db.run('DELETE FROM transactions WHERE recurring_transaction_id = ?', id));
          (await db.run('UPDATE recurring_transactions SET next_run_date = ?, active = 1 WHERE id = ?', earliest.date, id));
          (await generateDueForTemplate((await recurringTransactionRepository.findById(id)) as RecurringTransaction));
        }
      }

      const updated = (await recurringTransactionRepository.findById(id)) as RecurringTransaction;
      // If the new end_date already precedes where the series currently
      // stands, there's nothing left to generate — deactivate immediately
      // rather than leaving a "still active" series that will never fire.
      if (updated.active && updated.end_date && updated.end_date < updated.next_run_date) {
        (await recurringTransactionRepository.deactivate(id));
        return (await recurringTransactionRepository.findById(id)) as RecurringTransaction;
      }
      return updated;
    }
  ),

  async countForCategory(categoryId: number | string): Promise<number> {
    // Counts every row regardless of `active` — a cancelled series still
    // holds a foreign key to the category, so it still blocks deletion.
    const row = (await db.get('SELECT COUNT(*) AS count FROM recurring_transactions WHERE category_id = ?', categoryId)) as { count: number };
    return row.count;
  },

  async deactivate(id: number | string): Promise<void> {
    (await db.run('UPDATE recurring_transactions SET active = 0 WHERE id = ?', id));
  },

  // Materializes any due occurrences into real transactions. Called before
  // reads (transactions/dashboard/cash-flow) and after creating a new
  // template, rather than on a schedule, since there's no background job
  // runner in this deployment (see decisions.md #18).
  //
  // tenantId scopes the pass to one tenant — every production call site
  // passes the requesting user's tenant_id (see app.ts's
  // materializeDueTransactions middleware and routes/recurringTransactions.ts's
  // POST /) so one tenant's request can't pay the cost of, or write into,
  // every other tenant's due transactions. Deliberately scoped by tenant_id
  // rather than the requester's accessible department_ids (resolveScope) —
  // an enterprise head with partial department_access grants would
  // otherwise never materialize occurrences for departments outside their
  // own grants, silently starving them. Omitting tenantId keeps the old
  // unscoped (all-tenants) behavior, used by tests seeding a single tenant
  // in an isolated in-memory DB.
  //
  // hasDueTemplates is a cheap indexed-ish existence check run before the
  // write transaction, so the common case (nothing due) costs one SELECT
  // instead of a db.transaction() + full generation pass on every request.
  async generateDue(tenantId?: number): Promise<void> {
    if (!(await hasDueTemplates(tenantId))) return;
    (await generateDueTransaction(tenantId));
  },

  // Cash-flow simulation only (story 18) — same date-stepping shape as
  // generateDueForTemplate, but purely additive: no createGenerated,
  // deactivate, or next_run_date UPDATE. Assumes the caller has already run
  // generateDue() for real (the cash-flow route mounts materializeDueTransactions
  // like transactions/dashboard do), so template.next_run_date is already
  // past today and this only ever walks forward into future occurrences,
  // never re-derives backlog.
  projectOccurrences(template: RecurringTransaction, windowEnd: string): { date: string; amount: number }[] {
    const occurrences: { date: string; amount: number }[] = [];
    let nextRun = template.next_run_date;
    while (nextRun <= windowEnd) {
      if (template.end_date && nextRun > template.end_date) break;
      occurrences.push({ date: nextRun, amount: template.amount });
      nextRun = addByInterval(nextRun, template.interval);
    }
    return occurrences;
  },
};

export default recurringTransactionRepository;
