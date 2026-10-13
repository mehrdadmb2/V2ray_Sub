-- V2ray Sub Radar v5: per-recipient delivery ledger. Safe to re-run on the existing D1.
-- Keeps one recipient's temporary error from stopping delivery to all later subscribers.
CREATE TABLE IF NOT EXISTS broadcast_delivery (
  digest TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  source_key TEXT NOT NULL DEFAULT 'mix',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (digest, chat_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_delivery_digest_status
  ON broadcast_delivery(digest, source_key, status, attempts);
CREATE INDEX IF NOT EXISTS idx_broadcast_delivery_chat
  ON broadcast_delivery(chat_id, updated_at DESC);
