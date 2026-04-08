-- DatACT Reporter schema. SQLite-compatible; minor tweaks for Postgres later.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','operator','approver')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    INTEGER NOT NULL
);

-- Phase 2+ tables (created early so the DB is stable)
CREATE TABLE IF NOT EXISTS templates (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  description  TEXT,
  sheet_json   TEXT NOT NULL,
  input_cells  TEXT NOT NULL DEFAULT '[]',
  created_by   INTEGER NOT NULL REFERENCES users(id),
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_rules (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id        INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  required_count     INTEGER NOT NULL,
  approver_user_ids  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id       INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  cron_expression   TEXT NOT NULL,
  timezone          TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  active            INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS instances (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id   INTEGER NOT NULL REFERENCES templates(id),
  filled_data   TEXT NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL CHECK (status IN ('draft','pending','approved','rejected')),
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    INTEGER NOT NULL,
  due_at        INTEGER,
  submitted_at  INTEGER,
  completed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS approvals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id       INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  approver_user_id  INTEGER NOT NULL REFERENCES users(id),
  decision          TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  comment           TEXT,
  decided_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scopes       TEXT NOT NULL DEFAULT 'read',
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);
