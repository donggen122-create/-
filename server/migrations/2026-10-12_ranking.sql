-- One-time BEFORE the new Worker first serves requests. Runtime PRAGMA migration
-- is repeatable; this ALTER script is not. Skip ALTERs already applied by runtime.
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN nickname_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN nickname_set_at INTEGER;
ALTER TABLE users ADD COLUMN nickname_note TEXT;
ALTER TABLE users ADD COLUMN title TEXT;
ALTER TABLE play_runs ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS play_settled ON play_runs(settled_at);
CREATE INDEX IF NOT EXISTS play_flagged ON play_runs(flagged,settled_at);
