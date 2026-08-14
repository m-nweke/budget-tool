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
    department_id INTEGER REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    budgeted_amount REAL NOT NULL,
    department_id INTEGER REFERENCES departments(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
`);

export default db;
