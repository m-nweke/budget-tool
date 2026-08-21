import db from '../db';
import type { BankAccount, CreateBankAccountDto } from '../types';

const COLUMNS = 'id, tenant_id, name, type, current_balance';

const bankAccountRepository = {
  findAll(tenantId: number): BankAccount[] {
    return db.prepare(`SELECT ${COLUMNS} FROM bank_accounts WHERE tenant_id = ?`).all(tenantId) as BankAccount[];
  },

  findById(id: number | string): BankAccount | undefined {
    return db.prepare(`SELECT ${COLUMNS} FROM bank_accounts WHERE id = ?`).get(id) as BankAccount | undefined;
  },

  create({ name, type, current_balance }: CreateBankAccountDto, tenantId: number): BankAccount {
    const result = db
      .prepare('INSERT INTO bank_accounts (tenant_id, name, type, current_balance) VALUES (?, ?, ?, ?)')
      .run(tenantId, name, type, current_balance ?? 0);
    return bankAccountRepository.findById(result.lastInsertRowid as number) as BankAccount;
  },

  // Unlike create() (where an omitted current_balance correctly means "this
  // new account starts at 0"), an omitted current_balance here must mean
  // "leave it as-is" — otherwise an edit that only changes name/type would
  // silently wipe the account's tracked balance back to 0.
  update(id: number | string, { name, type, current_balance }: CreateBankAccountDto): BankAccount {
    const existing = bankAccountRepository.findById(id);
    db.prepare('UPDATE bank_accounts SET name = ?, type = ?, current_balance = ? WHERE id = ?').run(
      name,
      type,
      current_balance ?? existing?.current_balance ?? 0,
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
