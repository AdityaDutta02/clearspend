-- ClearSpend DB schema
-- Runs once at deploy time. Do not use schema-qualified names.

CREATE TABLE IF NOT EXISTS statements (
  id               TEXT PRIMARY KEY,
  month            TEXT NOT NULL,
  bank             TEXT NOT NULL,
  account_type     TEXT NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  total_debit      NUMERIC NOT NULL DEFAULT 0,
  total_credit     NUMERIC NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'INR',
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY,
  statement_id     TEXT NOT NULL,
  date             TEXT NOT NULL,
  amount           NUMERIC NOT NULL,
  type             TEXT NOT NULL,
  merchant         TEXT NOT NULL,
  category         TEXT NOT NULL,
  upi_ref          TEXT,
  upi_merchant     TEXT,
  raw_description  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
  id                  TEXT PRIMARY KEY,
  statement_id        TEXT NOT NULL,
  month               TEXT NOT NULL,
  category_breakdown  JSONB NOT NULL DEFAULT '{}',
  top_merchants       JSONB NOT NULL DEFAULT '[]',
  upi_summary         JSONB NOT NULL DEFAULT '{}',
  monthly_total       NUMERIC NOT NULL DEFAULT 0,
  insights            JSONB NOT NULL DEFAULT '[]',
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_statements_month_bank ON statements(month, bank);
CREATE INDEX IF NOT EXISTS idx_transactions_statement ON transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_analyses_statement ON analyses(statement_id);
CREATE INDEX IF NOT EXISTS idx_analyses_month ON analyses(month);
