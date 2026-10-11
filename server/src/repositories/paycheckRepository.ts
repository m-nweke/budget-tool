import db from '../db';
import type { Paycheck, PaycheckSplit, CreatePaycheckDto } from '../types';

const COLUMNS = 'id, tenant_id, label, amount, frequency, next_pay_date';
const SPLIT_COLUMNS = 'id, paycheck_id, bank_account_id, split_type, value';

// Splits have no independent lifecycle of their own (see the plan's
// confirmed decision) — assembled onto their paycheck via a second query
// rather than a join, keeping the row query itself simple.
async function findSplits(paycheckId: number | string): Promise<PaycheckSplit[]> {
  return (await db.all(`SELECT ${SPLIT_COLUMNS} FROM paycheck_splits WHERE paycheck_id = ?`, paycheckId)) as PaycheckSplit[];
}

async function findRowById(id: number | string): Promise<Omit<Paycheck, 'splits'> | undefined> {
  return (await db.get(`SELECT ${COLUMNS} FROM paychecks WHERE id = ?`, id)) as
    | Omit<Paycheck, 'splits'>
    | undefined;
}

async function insertSplits(paycheckId: number | string, splits: CreatePaycheckDto['splits']): Promise<void> {
  const insert = 'INSERT INTO paycheck_splits (paycheck_id, bank_account_id, split_type, value) VALUES (?, ?, ?, ?)';
  for (const split of splits) {
    (await db.run(insert, paycheckId, split.bank_account_id, split.split_type, split.value));
  }
}

const paycheckRepository = {
  async findAll(tenantId: number): Promise<Paycheck[]> {
    const rows = (await db.all(`SELECT ${COLUMNS} FROM paychecks WHERE tenant_id = ?`, tenantId)) as Omit<
      Paycheck,
      'splits'
    >[];
    return (await Promise.all(rows.map(async (row) => ({ ...row, splits: (await findSplits(row.id)) }))));
  },

  async findById(id: number | string): Promise<Paycheck | undefined> {
    const row = (await findRowById(id));
    return row ? { ...row, splits: (await findSplits(row.id)) } : undefined;
  },

  // Wholesale replace on every write, per the confirmed "nested, no
  // independent split lifecycle" decision — delete-and-reinsert is simpler
  // than diffing an incoming array against existing rows, and splits carry
  // no history/audit requirement that a diff would need to preserve.
  create: db.transaction(async ({ label, amount, frequency, next_pay_date, splits }: CreatePaycheckDto, tenantId: number): Promise<Paycheck> => {
    const result = (await db.run('INSERT INTO paychecks (tenant_id, label, amount, frequency, next_pay_date) VALUES (?, ?, ?, ?, ?)', tenantId, label, amount, frequency, next_pay_date));
    const paycheckId = result.lastInsertRowid as number;
    (await insertSplits(paycheckId, splits));
    return (await paycheckRepository.findById(paycheckId)) as Paycheck;
  }),

  update: db.transaction(
    async (id: number | string, { label, amount, frequency, next_pay_date, splits }: CreatePaycheckDto): Promise<Paycheck> => {
      (await db.run('UPDATE paychecks SET label = ?, amount = ?, frequency = ?, next_pay_date = ? WHERE id = ?', label, amount, frequency, next_pay_date, id));
      (await db.run('DELETE FROM paycheck_splits WHERE paycheck_id = ?', id));
      (await insertSplits(id, splits));
      return (await paycheckRepository.findById(id)) as Paycheck;
    }
  ),

  // Splits are deleted first — paycheck_splits.paycheck_id has no ON
  // DELETE CASCADE (this schema doesn't use cascades anywhere else
  // either), so an orphaned split would otherwise be left behind.
  remove: db.transaction(async (id: number | string): Promise<void> => {
    (await db.run('DELETE FROM paycheck_splits WHERE paycheck_id = ?', id));
    (await db.run('DELETE FROM paychecks WHERE id = ?', id));
  }),
};

export default paycheckRepository;
