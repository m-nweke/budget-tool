import path from 'path';
import Database from 'better-sqlite3';

// Tests set DB_PATH=:memory: for an isolated, disposable database per run.
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'budget.sqlite'));

db.pragma('foreign_keys = ON');

db.exec(`
  -- The top-level data-isolation boundary. Every department/category (and,
  -- transitively, every transaction) belongs to exactly one tenant. A
  -- 'personal' tenant has no departments at all — its categories carry
  -- department_id = NULL and are scoped by tenant_id alone (see
  -- scoping.ts's resolveAccessibleDepartmentIds for the 'owner' role).
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('enterprise', 'personal')),
    -- Only set for type='enterprise' — the code a new employee enters at
    -- signup to join this company instead of creating a new tenant.
    join_code TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL
  );

  -- Identity only — a user's role and department are per-tenant (see
  -- tenant_memberships below), because one login can belong to more than
  -- one tenant (e.g. a personal budget plus a company membership).
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT
  );

  -- One row per (user, tenant) the user belongs to. role/department_id used
  -- to live directly on users — moved here once a login could span more
  -- than one tenant. department_id is the employee's home department
  -- (null until a head assigns one, always null for 'owner'/personal and
  -- for a fresh 'department_head' membership — heads see departments via
  -- department_access, same as before).
  CREATE TABLE IF NOT EXISTS tenant_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    role TEXT NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    UNIQUE (user_id, tenant_id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    budgeted_amount REAL NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    start_on TEXT NOT NULL DEFAULT (date('now')),
    approval_threshold REAL
  );

  -- Grants a department_head manager-level access (view/manage/approve) to a
  -- specific department. Deliberately separate from users.department_id
  -- (an employee's single home department): a head's access is defined
  -- entirely by rows here, with no implicit fallback to department_id, so
  -- "which departments can this person see" stays fully configurable per
  -- user instead of hardcoded 1:1 — a head with rows for several
  -- departments (but not all of them) is how a c-suite-style user is
  -- modeled, without a separate "sees everything" role.
  CREATE TABLE IF NOT EXISTS department_access (
    user_id INTEGER NOT NULL REFERENCES users(id),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    PRIMARY KEY (user_id, department_id)
  );

  CREATE TABLE IF NOT EXISTS recurring_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    interval TEXT NOT NULL DEFAULT 'monthly',
    next_run_date TEXT NOT NULL,
    end_date TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    needs_approval INTEGER NOT NULL DEFAULT 0,
    approved INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    recurring_transaction_id INTEGER REFERENCES recurring_transactions(id)
  );

  -- SQLite indexes primary keys automatically but NOT foreign key columns.
  -- Every join/lookup column below is queried directly (dashboard's JOIN,
  -- countTransactionsFor, countForCategory, generateDue), so without these
  -- indexes each of those is a full table scan. See the queries doc.
  CREATE INDEX IF NOT EXISTS idx_transactions_category_id_date ON transactions(category_id, date);
  CREATE INDEX IF NOT EXISTS idx_transactions_recurring_transaction_id ON transactions(recurring_transaction_id);
  CREATE INDEX IF NOT EXISTS idx_recurring_transactions_category_id ON recurring_transactions(category_id);
  -- No index on department_access.user_id: the composite PRIMARY KEY
  -- (user_id, department_id) already gives SQLite an implicit index usable
  -- for user_id-only lookups via its leftmost column.
  CREATE INDEX IF NOT EXISTS idx_department_access_department_id ON department_access(department_id);
  -- UNIQUE, not just indexed: userRepository.findByEmail does a single
  -- .get() and login will trust whatever row it returns, so two users
  -- sharing an email would make login authenticate against an arbitrary
  -- one of them. A unique index (rather than an inline UNIQUE column
  -- constraint) is used so it applies identically to a fresh table and an
  -- existing one via IF NOT EXISTS, matching every other index below.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_categories_department_id ON categories(department_id);
  -- idx_categories_tenant_id / idx_departments_tenant_id are created below,
  -- after migrateColumn adds tenant_id to these two tables — both existed
  -- before tenant_id did, so on an existing database this index can't be
  -- created in the same batch as CREATE TABLE IF NOT EXISTS (a no-op here,
  -- since the tables already exist): the column wouldn't exist yet.
  -- No index on tenant_memberships.user_id: the composite UNIQUE
  -- (user_id, tenant_id) already gives SQLite an implicit index usable for
  -- user_id-only lookups via its leftmost column, same reasoning as
  -- department_access above. No index on department_id either — nothing
  -- queries tenant_memberships by department_id, only by user_id/tenant_id.

  -- Tracks one-time data migrations (see runOnce below) — distinct from
  -- migrateColumn, which is safe to re-run every boot. A backfill here
  -- must run exactly once ever, since re-running it after real data has
  -- been created under the new rules would corrupt that data.
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Personal-budget tables (Phase 2). Each is tenant_id-scoped directly
  -- (not via department, which doesn't exist for a personal tenant) and
  -- only ever populated under a personal tenant in practice — enforced at
  -- the route layer (requireRole('owner')), not by a CHECK here.
  CREATE TABLE IF NOT EXISTS bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'other')),
    current_balance REAL NOT NULL DEFAULT 0,
    -- Optional annual percentage yield, e.g. for a high-yield savings
    -- account. Nullable — most checking/other accounts don't carry one,
    -- and NULL (vs. 0) distinguishes "not tracked" from "tracked, 0%".
    apy REAL
  );

  CREATE TABLE IF NOT EXISTS paychecks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    label TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
    next_pay_date TEXT NOT NULL
  );

  -- No tenant_id of its own — scoped transitively through paycheck_id, the
  -- same way transactions are scoped transitively through category_id.
  CREATE TABLE IF NOT EXISTS paycheck_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paycheck_id INTEGER NOT NULL REFERENCES paychecks(id),
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
    split_type TEXT NOT NULL CHECK (split_type IN ('percentage', 'fixed')),
    value REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    -- Defaults to today, same convention as categories.start_on — when the
    -- goal starts counting toward its target, not when the row was created.
    start_on TEXT NOT NULL DEFAULT (date('now')),
    target_date TEXT,
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    -- How much has actually been set aside toward this goal so far —
    -- tracked independently of bank_accounts.current_balance (SoFi-vault
    -- style: several goals can share one linked account without each
    -- goal's progress being the account's whole balance). Manually
    -- updated by the owner, not derived from transactions.
    saved_amount REAL NOT NULL DEFAULT 0
  );

  -- promo_apr/promo_expires_on are a matched pair (both null or both set) —
  -- a promotional-APR debt (e.g. a 0% intro card) accrues interest at
  -- promo_apr until promo_expires_on, then interest_rate applies as normal.
  -- Added via migrateColumn below since this table already has real rows.
  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    balance REAL NOT NULL,
    interest_rate REAL NOT NULL,
    minimum_payment REAL NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31)
  );

  -- One row per tenant: the user-settable "how much toward debt per month"
  -- plus which order to attack debts in. custom_order is a JSON-encoded
  -- array of debt ids (nullable, only meaningful when strategy='custom')
  -- rather than a payoff_priority column on debts — self-healing at read
  -- time against a deleted/added debt instead of needing a reorder
  -- transaction (see decision 26). UNIQUE on tenant_id gives an implicit
  -- index, same reasoning as department_access/tenant_memberships above.
  CREATE TABLE IF NOT EXISTS debt_payoff_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id),
    monthly_amount REAL NOT NULL,
    strategy TEXT NOT NULL CHECK (strategy IN ('snowball', 'avalanche', 'custom')),
    custom_order TEXT
  );

  -- Recurring monthly household bills (rent, wifi, electric, water,
  -- insurance, etc.) — same due_day/month-clamp shape as debts above, so
  -- cashflowRepository can fold them into the simulation with the same
  -- stepMonthlyDueDates helper already used for debt payments. category is
  -- informational only (no behavioral branching on it), used for icon/
  -- grouping in the UI.
  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('rent', 'wifi', 'electric', 'water', 'insurance', 'other')),
    amount REAL NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    active INTEGER NOT NULL DEFAULT 1,
    -- Same "which account does this actually draw from" link as
    -- savings_goals.bank_account_id — optional (a bill doesn't need a
    -- linked account to exist), informational for now rather than wired
    -- into cashflowRepository's per-account balances yet.
    bank_account_id INTEGER REFERENCES bank_accounts(id),
    -- Same start_on/end_date shape as categories.start_on and
    -- recurring_transactions.end_date — when this bill starts/stops being
    -- due, so cashflowRepository's monthly-due-date stepping can skip
    -- occurrences outside that window (a bill that ended, or hasn't
    -- started yet, shouldn't show up in the projection).
    start_on TEXT NOT NULL DEFAULT (date('now')),
    end_date TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant_id ON bank_accounts(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_paychecks_tenant_id ON paychecks(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_paycheck_splits_paycheck_id ON paycheck_splits(paycheck_id);
  CREATE INDEX IF NOT EXISTS idx_paycheck_splits_bank_account_id ON paycheck_splits(bank_account_id);
  CREATE INDEX IF NOT EXISTS idx_savings_goals_tenant_id ON savings_goals(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_savings_goals_bank_account_id ON savings_goals(bank_account_id);
  CREATE INDEX IF NOT EXISTS idx_debts_tenant_id ON debts(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_bills_tenant_id ON bills(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_bills_bank_account_id ON bills(bank_account_id);
`);

// Lightweight migration for columns added after a database already existed.
// `CREATE TABLE IF NOT EXISTS` only handles brand-new tables — it doesn't
// alter existing ones, so a column added to the schema above needs an
// explicit ALTER TABLE here too. Guarded because SQLite errors on adding a
// column that's already there (a database created after this migration was
// written already has it from the CREATE TABLE statement).
function migrateColumn(sql: string): void {
  try {
    db.exec(sql);
  } catch (err) {
    const message = (err as Error).message;
    if (!message.includes('duplicate column name')) throw err;
  }
}

// SQLite's ALTER TABLE ADD COLUMN doesn't allow a non-constant default
// (date('now') is a function call), unlike CREATE TABLE — so the column is
// added nullable, then backfilled with today's date for any existing rows.
migrateColumn('ALTER TABLE categories ADD COLUMN start_on TEXT');
db.exec("UPDATE categories SET start_on = date('now') WHERE start_on IS NULL");

migrateColumn('ALTER TABLE users ADD COLUMN password_hash TEXT');
migrateColumn('ALTER TABLE categories ADD COLUMN approval_threshold REAL');
migrateColumn('ALTER TABLE departments ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
migrateColumn('ALTER TABLE categories ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_departments_tenant_id ON departments(tenant_id)');
migrateColumn('ALTER TABLE bank_accounts ADD COLUMN apy REAL');
migrateColumn('ALTER TABLE savings_goals ADD COLUMN saved_amount REAL NOT NULL DEFAULT 0');
migrateColumn('ALTER TABLE debts ADD COLUMN promo_apr REAL');
migrateColumn('ALTER TABLE debts ADD COLUMN promo_expires_on TEXT');
migrateColumn('ALTER TABLE bills ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id)');
migrateColumn('ALTER TABLE bills ADD COLUMN start_on TEXT');
db.exec("UPDATE bills SET start_on = date('now') WHERE start_on IS NULL");
migrateColumn('ALTER TABLE bills ADD COLUMN end_date TEXT');

// Like migrateColumn, but for a column being removed rather than added —
// dropping a column that was never there (a database created fresh, after
// this migration already shipped, never had it) is the SQLite error this
// guards against.
function dropColumnIfExists(table: string, column: string): void {
  try {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  } catch (err) {
    const message = (err as Error).message;
    if (!message.includes('no such column')) throw err;
  }
}

// Runs `fn` at most once ever, tracked in schema_migrations — unlike
// migrateColumn (idempotent, safe every boot), a data backfill must not
// repeat once real data exists that the backfill's assumption no longer
// holds for.
function runOnce(name: string, fn: () => void): void {
  const already = db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name);
  if (already) return;
  fn();
  db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name);
}

// One-time consolidation of the pre-tenancy schema into the tenant model.
// Synthesizes a default 'Default Company' tenant for any data that
// predates tenants entirely, gives every existing user a
// tenant_memberships row built from their (about-to-be-dropped)
// role/department_id columns, backfills tenant_id on departments/
// categories, then drops those now-superseded columns from users. Must
// run exactly once: by the time it could run a second time,
// users.role/department_id no longer exist to read from.
runOnce('migrate_users_and_departments_to_tenants', () => {
  const userCount = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;

  if (userCount > 0) {
    const defaultTenantId = db
      .prepare("INSERT INTO tenants (name, type) VALUES ('Default Company', 'enterprise')")
      .run().lastInsertRowid as number;

    db.prepare('UPDATE departments SET tenant_id = ? WHERE tenant_id IS NULL').run(defaultTenantId);
    db.prepare('UPDATE categories SET tenant_id = ? WHERE tenant_id IS NULL').run(defaultTenantId);

    const legacyUsers = db.prepare('SELECT id, role, department_id FROM users').all() as {
      id: number;
      role: string;
      department_id: number | null;
    }[];
    const insertMembership = db.prepare(
      'INSERT INTO tenant_memberships (user_id, tenant_id, role, department_id) VALUES (?, ?, ?, ?)'
    );
    for (const user of legacyUsers) {
      insertMembership.run(user.id, defaultTenantId, user.role, user.department_id);
    }
  }

  dropColumnIfExists('users', 'role');
  dropColumnIfExists('users', 'department_id');
});

// Before the approval workflow existed, transactionRepository.create
// hardcoded every row to needs_approval=0, approved=0 — the columns were
// forward-compat placeholders with no meaning yet, not "auto-approved."
// The dashboard now sums only approved=1 transactions, so without this
// backfill every pre-existing transaction's spend would vanish from the
// dashboard the moment this deploy goes out. Safe to run exactly once:
// at the moment this migration first runs, no transaction can yet be
// genuinely rejected by a real head decision (POST /:id/reject ships in
// this same deploy) — every row shaped (approved=0, needs_approval=0)
// at that instant is definitionally legacy, not a rejection to preserve.
runOnce('backfill_approved_pre_approval_workflow', () => {
  db.exec('UPDATE transactions SET approved = 1 WHERE approved = 0 AND needs_approval = 0');
});

export default db;
