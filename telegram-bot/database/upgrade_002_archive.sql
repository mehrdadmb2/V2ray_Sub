-- V2ray Sub Radar v4: persistent Mix history, per-config country/protocol index and resumable text deliveries.
-- Safe to execute repeatedly on the existing D1 database.

CREATE TABLE IF NOT EXISTS subscription_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL DEFAULT 'mix',
  file_name TEXT NOT NULL DEFAULT 'Mix.txt',
  source_updated_at TEXT,
  source_date_basis TEXT,
  captured_at TEXT NOT NULL,
  github_commit_sha TEXT,
  github_commit_url TEXT,
  raw_sha256 TEXT NOT NULL,
  normalized_sha256 TEXT NOT NULL,
  config_sha256 TEXT NOT NULL,
  file_bytes INTEGER NOT NULL DEFAULT 0,
  line_count INTEGER NOT NULL DEFAULT 0,
  config_count INTEGER NOT NULL DEFAULT 0,
  logical_count INTEGER NOT NULL DEFAULT 0,
  embedded_timestamp TEXT,
  file_text TEXT NOT NULL DEFAULT '',
  estimated_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_key, normalized_sha256)
);

CREATE INDEX IF NOT EXISTS idx_subscription_snapshots_source_id
  ON subscription_snapshots(source_key, id DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_snapshots_config_sha
  ON subscription_snapshots(source_key, config_sha256);

CREATE TABLE IF NOT EXISTS archived_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  source_key TEXT NOT NULL DEFAULT 'mix',
  line_no INTEGER NOT NULL DEFAULT 0,
  raw_line TEXT NOT NULL,
  logical_id TEXT NOT NULL,
  protocol TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'XX',
  country_name TEXT NOT NULL DEFAULT 'نامشخص',
  country_flag TEXT NOT NULL DEFAULT '🏳️',
  config_name TEXT NOT NULL DEFAULT 'بدون نام',
  embedded_timestamp TEXT,
  estimated_bytes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(snapshot_id) REFERENCES subscription_snapshots(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, raw_line)
);

CREATE INDEX IF NOT EXISTS idx_archived_configs_snapshot_id
  ON archived_configs(snapshot_id, id);
CREATE INDEX IF NOT EXISTS idx_archived_configs_country
  ON archived_configs(snapshot_id, country_code, id);
CREATE INDEX IF NOT EXISTS idx_archived_configs_protocol
  ON archived_configs(snapshot_id, protocol, id);
CREATE INDEX IF NOT EXISTS idx_archived_configs_logical
  ON archived_configs(snapshot_id, logical_id);

CREATE TABLE IF NOT EXISTS text_delivery_jobs (
  job_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  snapshot_id INTEGER NOT NULL,
  filter_country TEXT,
  filter_protocol TEXT,
  filter_label TEXT NOT NULL DEFAULT 'همه کانفیگ‌ها',
  last_config_id INTEGER NOT NULL DEFAULT 0,
  part_no INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_text_delivery_jobs_chat_status
  ON text_delivery_jobs(chat_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_text_delivery_jobs_snapshot_status
  ON text_delivery_jobs(snapshot_id, status);
