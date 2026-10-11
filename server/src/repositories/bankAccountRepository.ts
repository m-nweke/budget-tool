import db from '../db';
import type { BankAccount, CreateBankAccountDto } from '../types';

const COLUMNS = 'id, tenant_id, name, type, current_balance, apy, institution';

// Normalizes an empty/whitespace-only institution to null so storage stays
// consistent regardless of which client sends the request (some send '' for
// "unset" instead of omitting the field or sending null).
function normalizeInstitution(institution: string | null | undefined): string | null | undefined {
  if (institution == null) return institution;
  const trimmed = institution.trim();
  return trimmed === '' ? null : trimmed;
}

const bankAccountRepository = {
  async findAll(tenantId: number): Promise<BankAccount[]> {
    return (await db.all(`SELECT ${COLUMNS} FROM bank_accounts WHERE tenant_id = ?`, tenantId)) as BankAccount[];
  },

  async findById(id: number | string): Promise<BankAccount | undefined> {
    return (await db.get(`SELECT ${COLUMNS} FROM bank_accounts WHERE id = ?`, id)) as BankAccount | undefined;
  },

  async create({ name, type, current_balance, apy, institution }: CreateBankAccountDto, tenantId: number): Promise<BankAccount> {
    const result = (await db.run('INSERT INTO bank_accounts (tenant_id, name, type, current_balance, apy, institution) VALUES (?, ?, ?, ?, ?, ?)', tenantId, name, type, current_balance ?? 0, apy ?? null, normalizeInstitution(institution) ?? null));
    return (await bankAccountRepository.findById(result.lastInsertRowid as number)) as BankAccount;
  },

  // Unlike create() (where an omitted current_balance/apy correctly means
  // "this new account starts at 0/untracked"), an omitted value here must
  // mean "leave it as-is" — otherwise an edit that only changes name/type
  // would silently wipe the account's tracked balance (or APY) back out.
  // apy/institution specifically use an `undefined` check rather than `??`:
  // AccountForm sends an explicit `null` to clear an already-set APY or
  // institution, and `??` would treat that null the same as "omitted" and
  // silently restore the old value instead of clearing it.
  async update(id: number | string, { name, type, current_balance, apy, institution }: CreateBankAccountDto): Promise<BankAccount> {
    const existing = (await bankAccountRepository.findById(id));
    (await db.run('UPDATE bank_accounts SET name = ?, type = ?, current_balance = ?, apy = ?, institution = ? WHERE id = ?', name, type, current_balance ?? existing?.current_balance ?? 0, apy === undefined ? existing?.apy ?? null : apy, institution === undefined ? existing?.institution ?? null : normalizeInstitution(institution), id));
    return (await bankAccountRepository.findById(id)) as BankAccount;
  },

  async remove(id: number | string): Promise<void> {
    (await db.run('DELETE FROM bank_accounts WHERE id = ?', id));
  },

  // Guards against orphaning a paycheck_splits/savings_goals row that
  // still points at this account — same "count dependents before delete"
  // pattern as categoryRepository.countTransactionsFor.
  async countPaycheckSplitsFor(id: number | string): Promise<number> {
    const row = (await db.get('SELECT COUNT(*) AS count FROM paycheck_splits WHERE bank_account_id = ?', id)) as { count: number };
    return row.count;
  },

  async countSavingsGoalsFor(id: number | string): Promise<number> {
    const row = (await db.get('SELECT COUNT(*) AS count FROM savings_goals WHERE bank_account_id = ?', id)) as { count: number };
    return row.count;
  },
};

export default bankAccountRepository;
