-- 접속 신호(누가 지금 게임 중인지). /api/presence 가 30초마다 갱신, 관리 페이지 "지금 접속 중"이 읽는다.
-- 적용: npx wrangler d1 execute seoho-pangpang-db --remote --file=migrations/2026-09-22_presence.sql (로컬은 --local)
CREATE TABLE IF NOT EXISTS presence (
  user_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  since     INTEGER NOT NULL,   -- 이번 접속이 시작된 시각(신호가 2분 넘게 끊겼다 오면 새로 시작)
  last_seen INTEGER NOT NULL,   -- 마지막 신호 시각(epoch ms)
  device    TEXT                -- 'phone' | 'pc'
);
CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence(last_seen);
