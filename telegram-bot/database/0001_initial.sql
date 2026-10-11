-- V2ray Sub Radar / Cloudflare D1

CREATE TABLE IF NOT EXISTS subscribers (
  chat_id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  notifications INTEGER NOT NULL DEFAULT 1,
  last_sent_digest TEXT,
  last_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscribers_broadcast
  ON subscribers(active, notifications, last_sent_digest);

CREATE TABLE IF NOT EXISTS bot_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  holder TEXT NOT NULL DEFAULT '',
  lease_until TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO worker_lock(id, holder, lease_until)
VALUES (1, '', '1970-01-01T00:00:00.000Z');
