import db from '../db';
import type { Paycheck, PaycheckSplit, CreatePaycheckDto } from '../types';

const COLUMNS = 'id, tenant_id, label, amount, frequency, next_pay_date';
const SPLIT_COLUMNS = 'id, paycheck_id, bank_account_id, split_type, value';

// Splits have no independent lifecycle of their own (see the plan's
// confirmed decision) — assembled onto their paycheck via a second query
// rather than a join, keeping the row query itself simple.
function findSplits(paycheckId: number | string): PaycheckSplit[] {
  return db
    .prepare(`SELECT ${SPLIT_COLUMNS} FROM paycheck_splits WHERE paycheck_id = ?`)
    .all(paycheckId) as PaycheckSplit[];
}

function findRowById(id: number | string): Omit<Paycheck, 'splits'> | undefined {
  return db.prepare(`SELECT ${COLUMNS} FROM paychecks WHERE id = ?`).get(id) as
    | Omit<Paycheck, 'splits'>
    | undefined;
}

function insertSplits(paycheckId: number | string, splits: CreatePaycheckDto['splits']): void {
  const insert = db.prepare(
    'INSERT INTO paycheck_splits (paycheck_id, bank_account_id, split_type, value) VALUES (?, ?, ?, ?)'
  );
  for (const split of splits) {
    insert.run(paycheckId, split.bank_account_id, split.split_type, split.value);
  }
}

const paycheckRepository = {
  findAll(tenantId: number): Paycheck[] {
    const rows = db.prepare(`SELECT ${COLUMNS} FROM paychecks WHERE tenant_id = ?`).all(tenantId) as Omit<
      Paycheck,
      'splits'
    >[];
    return rows.map((row) => ({ ...row, splits: findSplits(row.id) }));
  },

  findById(id: number | string): Paycheck | undefined {
    const row = findRowById(id);
    return row ? { ...row, splits: findSplits(row.id) } : undefined;
  },

  // Wholesale replace on every write, per the confirmed "nested, no
  // independent split lifecycle" decision — delete-and-reinsert is simpler
  // than diffing an incoming array against existing rows, and splits carry
  // no history/audit requirement that a diff would need to preserve.
  create: db.transaction(({ label, amount, frequency, next_pay_date, splits }: CreatePaycheckDto, tenantId: number): Paycheck => {
    const result = db
      .prepare('INSERT INTO paychecks (tenant_id, label, amount, frequency, next_pay_date) VALUES (?, ?, ?, ?, ?)')
      .run(tenantId, label, amount, frequency, next_pay_date);
    const paycheckId = result.lastInsertRowid as number;
    insertSplits(paycheckId, splits);
    return paycheckRepository.findById(paycheckId) as Paycheck;
  }),

  update: db.transaction(
    (id: number | string, { label, amount, frequency, next_pay_date, splits }: CreatePaycheckDto): Paycheck => {
      db.prepare(
        'UPDATE paychecks SET label = ?, amount = ?, frequency = ?, next_pay_date = ? WHERE id = ?'
      ).run(label, amount, frequency, next_pay_date, id);
      db.prepare('DELETE FROM paycheck_splits WHERE paycheck_id = ?').run(id);
      insertSplits(id, splits);
      return paycheckRepository.findById(id) as Paycheck;
    }
  ),

  // Splits are deleted first — paycheck_splits.paycheck_id has no ON
  // DELETE CASCADE (this schema doesn't use cascades anywhere else
  // either), so an orphaned split would otherwise be left behind.
  remove: db.transaction((id: number | string): void => {
    db.prepare('DELETE FROM paycheck_splits WHERE paycheck_id = ?').run(id);
    db.prepare('DELETE FROM paychecks WHERE id = ?').run(id);
  }),
};

export default paycheckRepository;
