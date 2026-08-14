import path from 'path';
import Database from 'better-sqlite3';

// Tests set DB_PATH=:memory: for an isolated, disposable database per run.
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'budget.sqlite'));

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'department_employee',
    department_id INTEGER REFERENCES departments(id),
    password_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
  -- UNIQUE, not just indexed: userRepository.findByEmail does a single
  -- .get() and login will trust whatever row it returns, so two users
  -- sharing an email would make login authenticate against an arbitrary
  -- one of them. A unique index (rather than an inline UNIQUE column
  -- constraint) is used so it applies identically to a fresh table and an
  -- existing one via IF NOT EXISTS, matching every other index below.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_categories_department_id ON categories(department_id);
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

export default db;
