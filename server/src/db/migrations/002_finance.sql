ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS finance_type TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_balance_cents BIGINT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_on TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS spendable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS essential BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE transactions ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS finance_tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS finance_kind TEXT CHECK (finance_kind IN ('income','expense','transfer'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_cents BIGINT CHECK (amount_cents > 0);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES bank_accounts(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_account_id INTEGER REFERENCES bank_accounts(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS commitment_key TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS import_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS finance_import_key ON transactions(finance_tenant_id, import_key) WHERE import_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS finance_movement_account ON transactions(finance_tenant_id,account_id,date);
CREATE TABLE IF NOT EXISTS finance_settings (
 tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id), timezone TEXT NOT NULL DEFAULT 'America/Chicago',
 cushion_cents BIGINT NOT NULL DEFAULT 0 CHECK(cushion_cents>=0),
 essential_allowance_cents BIGINT NOT NULL DEFAULT 0 CHECK(essential_allowance_cents>=0),
 spending_account_ids JSONB NOT NULL DEFAULT '[]'
);
-- Overrides map existing bills, paychecks, debts, contributions and recurrences.
-- custom:* keys are new schedules. Existing resource amounts remain canonical.
CREATE TABLE IF NOT EXISTS finance_commitments (
 tenant_id INTEGER NOT NULL REFERENCES tenants(id), key TEXT NOT NULL,
 name TEXT NOT NULL, kind TEXT NOT NULL, amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 account_id INTEGER REFERENCES bank_accounts(id), transfer_account_id INTEGER REFERENCES bank_accounts(id),
 frequency TEXT NOT NULL, next_date TEXT NOT NULL, end_date TEXT, active BOOLEAN NOT NULL DEFAULT TRUE,
 day_of_month INTEGER CHECK(day_of_month BETWEEN 1 AND 31), pay_days JSONB,
 PRIMARY KEY(tenant_id,key)
);
