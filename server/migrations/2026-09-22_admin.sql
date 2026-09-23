-- 2026-09-22 선생님 관리 기능: 계정 잠금 열(locked) + 지급 표(grants)
-- 적용: npx wrangler d1 execute seoho-pangpang-db --remote --file=migrations/2026-09-22_admin.sql  (로컬은 --local)
ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS grants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gold        INTEGER NOT NULL DEFAULT 0,
  dust        INTEGER NOT NULL DEFAULT 0,
  energy      INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  INTEGER NOT NULL,
  applied_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_grants_user ON grants(user_id, applied_at);
