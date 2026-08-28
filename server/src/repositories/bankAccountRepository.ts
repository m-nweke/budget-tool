import db from '../db';
import type { BankAccount, CreateBankAccountDto } from '../types';

const COLUMNS = 'id, tenant_id, name, type, current_balance, apy, institution';

const bankAccountRepository = {
  findAll(tenantId: number): BankAccount[] {
    return db.prepare(`SELECT ${COLUMNS} FROM bank_accounts WHERE tenant_id = ?`).all(tenantId) as BankAccount[];
  },

  findById(id: number | string): BankAccount | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM bank_accounts WHERE id = ?`).get(id) as BankAccount | undefined;
  },

  create({ name, type, current_balance, apy, institution }: CreateBankAccountDto, tenantId: number): BankAccount {
    const result = db
      .prepare(
        'INSERT INTO bank_accounts (tenant_id, name, type, current_balance, apy, institution) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(tenantId, name, type, current_balance ?? 0, apy ?? null, institution ?? null);
    return bankAccountRepository.findById(result.lastInsertRowid as number) as BankAccount;
  },

  // Unlike create() (where an omitted current_balance/apy correctly means
  // "this new account starts at 0/untracked"), an omitted value here must
  // mean "leave it as-is" — otherwise an edit that only changes name/type
  // would silently wipe the account's tracked balance (or APY) back out.
  // apy/institution specifically use an `undefined` check rather than `??`:
  // AccountForm sends an explicit `null` to clear an already-set APY or
  // institution, and `??` would treat that null the same as "omitted" and
  // silently restore the old value instead of clearing it.
  update(id: number | string, { name, type, current_balance, apy, institution }: CreateBankAccountDto): BankAccount {
    const existing = bankAccountRepository.findById(id);
    db.prepare(
      'UPDATE bank_accounts SET name = ?, type = ?, current_balance = ?, apy = ?, institution = ? WHERE id = ?'
    ).run(
      name,
      type,
      current_balance ?? existing?.current_balance ?? 0,
      apy === undefined ? existing?.apy ?? null : apy,
      institution === undefined ? existing?.institution ?? null : institution,
      id
    );
    return bankAccountRepository.findById(id) as BankAccount;
  },

  remove(id: number | string): void {
    db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(id);
  },

  // Guards against orphaning a paycheck_splits/savings_goals row that
  // still points at this account — same "count dependents before delete"
  // pattern as categoryRepository.countTransactionsFor.
  countPaycheckSplitsFor(id: number | string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM paycheck_splits WHERE bank_account_id = ?')
      .get(id) as { count: number };
    return row.count;
  },

  countSavingsGoalsFor(id: number | string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM savings_goals WHERE bank_account_id = ?')
      .get(id) as { count: number };
    return row.count;
  },
};

export default bankAccountRepository;
