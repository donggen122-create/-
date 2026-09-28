-- 서호초등학교 바이브코딩 전시관 · 작품 저장 DB (Cloudflare D1)
-- 서버(src/index.js)가 처음 요청을 받을 때 자동으로 만들어요. 직접 만들 때: npm run db:init

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  title TEXT NOT NULL,
  grade INTEGER NOT NULL,
  klass INTEGER NOT NULL,
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS works_created_at ON works (created_at);

-- 작품 html 은 D1 한 칸 크기 제한(2MB) 때문에 조각으로 나눠 저장해요.
CREATE TABLE IF NOT EXISTS work_files (
  work_id TEXT NOT NULL,
  part INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (work_id, part)
);
