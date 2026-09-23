-- 서호팡팡수호대 저장 서버 스키마 (D1 / SQLite)
-- 적용: npx wrangler d1 execute seoho-pangpang-db --remote --file=schema.sql  (로컬 테스트는 --local)

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,          -- 아이디(소문자 정규화, 2~12자)
  display_id  TEXT NOT NULL,             -- 입력한 그대로(표시용)
  pw_hash     TEXT NOT NULL,             -- PBKDF2-SHA256 결과(hex)
  salt        TEXT NOT NULL,             -- 사용자별 무작위 소금(hex)
  created_at  INTEGER NOT NULL,          -- epoch ms
  last_login  INTEGER,
  locked      INTEGER NOT NULL DEFAULT 0 -- 1이면 선생님이 잠근 계정(로그인·저장 불가). 기존 DB는 migrations/2026-09-22_admin.sql
);

-- 선생님 지급(금화·별가루·에너지). 학생이 다음에 저장본을 내려받을 때(GET /api/save) 합쳐지고 applied_at이 찍힌다
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

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,          -- 무작위 32바이트(hex)
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS saves (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,             -- 게임 저장 JSON(localStorage와 같은 형식)
  updated_at  INTEGER NOT NULL,
  device      TEXT                       -- 마지막으로 저장한 기기 표식(충돌 안내용)
);

-- 접속 신호(누가 지금 게임 중인지). /api/presence 가 30초마다 갱신. 기존 DB는 migrations/2026-09-22_presence.sql
CREATE TABLE IF NOT EXISTS presence (
  user_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  since     INTEGER NOT NULL,   -- 이번 접속이 시작된 시각(신호가 2분 넘게 끊겼다 오면 새로 시작)
  last_seen INTEGER NOT NULL,   -- 마지막 신호 시각(epoch ms)
  device    TEXT                -- 'phone' | 'pc'
);
CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence(last_seen);

-- 로그인·가입 시도 제한(아이피+시각 창). 무차별 대입 완화용
CREATE TABLE IF NOT EXISTS attempts (
  key         TEXT PRIMARY KEY,          -- "login:<ip>" 또는 "register:<ip>"
  count       INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
