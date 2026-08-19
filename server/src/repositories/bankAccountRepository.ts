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

  update(id: number | string, { name, type, current_balance }: CreateBankAccountDto): BankAccount {
    db.prepare('UPDATE bank_accounts SET name = ?, type = ?, current_balance = ? WHERE id = ?').run(
      name,
      type,
      current_balance ?? 0,
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
