// 서호초등학교 바이브코딩 전시관 — 작품 저장 API (Cloudflare Pages Functions + D1)
// 전시관 화면은 Pages 가 그대로 보여 주고, /api/* 요청만 여기서 처리해요 (functions/api/[[path]].js).
//
// 선생님 비밀번호와 등록 코드는 두 곳 중 한 곳에 둘 수 있어요.
//   1) Pages 비밀값 ADMIN_PASSWORD / UPLOAD_CODE (GitHub 비밀값 GALLERY_ADMIN_PASSWORD / GALLERY_UPLOAD_CODE 로 배포돼요)
//   2) D1 의 settings 표: key 'admin_password' / 'upload_code', value '소금:SHA-256(소금+비밀번호)' (알아볼 수 없게 바꾼 값)
//   1)이 있으면 1)을 먼저 써요. 둘 다 없으면 삭제·추천을 할 수 없고, 등록 코드 없이 누구나 올릴 수 있어요.

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_THUMB_CHARS = 45000;
const CHUNK_CHARS = 400000; // 한글 한 글자는 3바이트라 한 조각이 D1 한 칸 제한(2MB)을 넘지 않아요.
const CATEGORIES = ["게임", "학습·퀴즈", "그림·음악", "생활 도구", "이야기", "기타"];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS works (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, title TEXT NOT NULL,
    grade INTEGER NOT NULL, klass INTEGER NOT NULL, number INTEGER NOT NULL, name TEXT NOT NULL,
    category TEXT NOT NULL, description TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '',
    thumbnail TEXT NOT NULL DEFAULT '', file_name TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0, featured INTEGER NOT NULL DEFAULT 0)`,
  "CREATE INDEX IF NOT EXISTS works_created_at ON works (created_at)",
  `CREATE TABLE IF NOT EXISTS work_files (
    work_id TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (work_id, part))`,
  "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS login_failures (ip TEXT NOT NULL, at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS login_failures_ip_at ON login_failures (ip, at)",
];

// 비밀번호를 이만큼 틀리면 잠시 막아요 (여러 번 찍어 보는 것을 막아요).
const MAX_FAILURES = 20;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const SECRETS = {
  admin: { env: "ADMIN_PASSWORD", key: "admin_password" },
  upload: { env: "UPLOAD_CODE", key: "upload_code" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    await ensureSchema(env);
    return await route(request, env, url);
  } catch (err) {
    if (err instanceof UserError) return json({ ok: false, error: err.message }, err.status);
    console.error(err);
    return json({ ok: false, error: "서버에 문제가 생겼어요. 잠시 뒤에 다시 해 보세요." }, 500);
  }
}

let schemaReady = null;
function ensureSchema(env) {
  schemaReady ??= env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

async function route(request, env, url) {
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = request.method;

  if (parts[0] === "health" && method === "GET") return json({ ok: true });
  if (parts[0] === "info" && method === "GET") return json(await info(env));
  if (parts[0] === "login" && method === "POST") {
    await checkAdmin(env, request, (await readBody(request)).password);
    return json({ ok: true });
  }

  if (parts[0] === "works") {
    const id = parts[1] ? decodeURIComponent(parts[1]) : "";
    if (!id && method === "GET") return json(await listWorks(env, url));
    if (!id && method === "POST") return json(await createWork(env, await readBody(request)));
    if (id && parts[2] === "thumb" && method === "GET") return thumbnail(env, id);
    if (id && !parts[2] && method === "GET") return json(await getWork(env, url, id));
    if (id && !parts[2] && method === "PATCH") return json(await updateWork(env, request, id, await readBody(request)));
    if (id && !parts[2] && method === "DELETE") return json(await deleteWork(env, request, id, await readBody(request)));
  }
  throw new UserError("없는 주소예요.", 404);
}

/* ---------- 읽기 ---------- */

async function info(env) {
  const [needCode, canManage] = await Promise.all([hasSecret(env, SECRETS.upload), hasSecret(env, SECRETS.admin)]);
  return { ok: true, needCode, canManage };
}

function toWork(row, url) {
  return {
    id: row.id,
    createdAt: row.created_at,
    title: row.title,
    grade: row.grade,
    klass: row.klass,
    number: row.number,
    name: row.name,
    category: row.category,
    description: row.description,
    emoji: row.emoji,
    thumbnail: row.has_thumb ? new URL(`/api/works/${encodeURIComponent(row.id)}/thumb`, url).href : "",
    featured: !!row.featured,
  };
}

const WORK_COLUMNS =
  "id, created_at, title, grade, klass, number, name, category, description, emoji, featured, thumbnail != '' AS has_thumb";

async function listWorks(env, url) {
  const { results } = await env.DB.prepare(`SELECT ${WORK_COLUMNS} FROM works ORDER BY created_at DESC`).all();
  return { ok: true, works: results.map((row) => toWork(row, url)), ...(await info(env)) };
}

async function getWork(env, url, id) {
  const row = await env.DB.prepare(`SELECT ${WORK_COLUMNS} FROM works WHERE id = ?`).bind(id).first();
  if (!row) throw new UserError("작품을 찾을 수 없어요. 지워진 작품일 수 있어요.", 404);
  const { results } = await env.DB.prepare("SELECT data FROM work_files WHERE work_id = ? ORDER BY part").bind(id).all();
  return { ok: true, work: toWork(row, url), html: results.map((r) => r.data).join("") };
}

async function thumbnail(env, id) {
  const row = await env.DB.prepare("SELECT thumbnail FROM works WHERE id = ?").bind(id).first();
  const match = row && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(row.thumbnail);
  if (!match) return new Response("Not found", { status: 404, headers: CORS });
  const bytes = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0));
  // 작품마다 id 가 새로 생기고 그림은 바뀌지 않아서 오래 보관해도 돼요.
  return new Response(bytes, { headers: { ...CORS, "Content-Type": match[1], "Cache-Control": "public, max-age=31536000, immutable" } });
}

/* ---------- 쓰기 ---------- */

async function readBody(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > MAX_BODY_BYTES) throw new UserError("작품 파일이 너무 커요. (5MB까지 올릴 수 있어요)", 413);
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

const text = (value, max) => (value === undefined || value === null ? "" : String(value).trim().slice(0, max));
const int = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};

// 작품 정보 칸을 검사해서 저장할 모양으로 돌려줘요.
// partial 이면 보낸 칸만 검사해요(선생님이 고칠 때). 학년과 반은 늘 함께 보내요.
function readFields(b, partial) {
  const has = (key) => !partial || b[key] !== undefined;
  const out = {};
  if (has("title")) {
    out.title = text(b.title, 60);
    if (!out.title) throw new UserError("작품 제목을 써 주세요.");
  }
  if (has("grade") || has("klass")) {
    out.grade = int(b.grade);
    out.klass = int(b.klass);
    if (!(out.grade >= 1 && out.grade <= 6 && out.klass >= 1 && out.klass <= 20)) throw new UserError("학년과 반을 알맞게 골라 주세요.");
  }
  if (has("number")) {
    out.number = int(b.number);
    if (!(out.number >= 1 && out.number <= 60)) throw new UserError("번호를 알맞게 써 주세요.");
  }
  if (has("name")) {
    out.name = text(b.name, 20);
    if (!out.name) throw new UserError("이름을 써 주세요.");
  }
  if (has("category")) out.category = CATEGORIES.includes(b.category) ? b.category : "기타";
  if (has("description")) {
    out.description = text(b.description, 1000);
    if (!out.description) throw new UserError("작품 내용을 써 주세요.");
  }
  return out;
}

async function createWork(env, b) {
  if ((await hasSecret(env, SECRETS.upload)) && !(await matchesSecret(env, SECRETS.upload, text(b.code, 100)))) {
    throw new UserError("등록 코드가 맞지 않아요. 선생님께 여쭤보세요.", 403);
  }
  const work = {
    ...readFields(b, false),
    emoji: Array.from(text(b.emoji, 32)).slice(0, 8).join(""),
    thumbnail: String(b.thumbnail || ""),
    fileName: text(b.fileName, 120),
  };
  const html = String(b.html || "");
  const size = new TextEncoder().encode(html).length;

  if (!html.trim()) throw new UserError("html 작품 파일을 넣어 주세요.");
  if (size > MAX_HTML_BYTES) throw new UserError("작품 파일이 너무 커요. (5MB까지 올릴 수 있어요)", 413);
  if (work.thumbnail && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(work.thumbnail) || work.thumbnail.length > MAX_THUMB_CHARS)) {
    work.thumbnail = "";
  }

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const statements = [
    env.DB.prepare(
      `INSERT INTO works (id, created_at, title, grade, klass, number, name, category, description, emoji, thumbnail, file_name, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, new Date().toISOString(), work.title, work.grade, work.klass, work.number, work.name, work.category, work.description, work.emoji, work.thumbnail, work.fileName, size),
    ...splitText(html, CHUNK_CHARS).map((data, part) => env.DB.prepare("INSERT INTO work_files (work_id, part, data) VALUES (?, ?, ?)").bind(id, part, data)),
  ];
  await env.DB.batch(statements); // 한 번에(모두 되거나 모두 안 되거나) 저장해요.
  return { ok: true, id };
}

// 선생님이 추천(featured)을 켜고 끄거나, 제목·반·번호·이름·분류·내용을 고쳐요.
async function updateWork(env, request, id, b) {
  await checkAdmin(env, request, b.password);
  const fields = readFields(b, true);
  if (b.featured !== undefined) fields.featured = b.featured ? 1 : 0;
  const columns = Object.keys(fields); // readFields 가 정한 칸 이름만 들어 있어요.
  if (!columns.length) throw new UserError("바꿀 내용이 없어요.");
  const result = await env.DB.prepare(`UPDATE works SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`)
    .bind(...columns.map((c) => fields[c]), id)
    .run();
  if (!result.meta.changes) throw new UserError("작품을 찾을 수 없어요.", 404);
  return { ok: true };
}

async function deleteWork(env, request, id, b) {
  await checkAdmin(env, request, b.password);
  const [, removed] = await env.DB.batch([
    env.DB.prepare("DELETE FROM work_files WHERE work_id = ?").bind(id),
    env.DB.prepare("DELETE FROM works WHERE id = ?").bind(id),
  ]);
  if (!removed.meta.changes) throw new UserError("작품을 찾을 수 없어요.", 404);
  return { ok: true };
}

/* ---------- 도우미 ---------- */

async function checkAdmin(env, request, password) {
  if (!(await hasSecret(env, SECRETS.admin))) throw new UserError("선생님 비밀번호가 아직 서버에 정해지지 않았어요.", 403);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_failures WHERE ip = ? AND at > ?")
    .bind(ip, new Date(now - FAILURE_WINDOW_MS).toISOString())
    .first();
  if (recent.n >= MAX_FAILURES) throw new UserError("비밀번호를 너무 많이 틀렸어요. 15분 뒤에 다시 해 보세요.", 429);
  if (!(await matchesSecret(env, SECRETS.admin, text(password, 200)))) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO login_failures (ip, at) VALUES (?, ?)").bind(ip, new Date(now).toISOString()),
      env.DB.prepare("DELETE FROM login_failures WHERE at < ?").bind(new Date(now - 86400000).toISOString()),
    ]);
    throw new UserError("선생님 비밀번호가 맞지 않아요.", 403);
  }
}

async function storedSecret(env, secret) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(secret.key).first();
  return row ? String(row.value) : "";
}

async function hasSecret(env, secret) {
  return !!env[secret.env] || !!(await storedSecret(env, secret));
}

async function matchesSecret(env, secret, given) {
  if (env[secret.env]) return sameText(given, env[secret.env]);
  const [salt, hash] = (await storedSecret(env, secret)).split(":");
  if (!salt || !hash) return false;
  return sameText(await sha256Hex(salt + given), hash);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// 비밀번호를 비교할 때 걸리는 시간으로 답을 알아낼 수 없게 해요.
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

// 긴 글을 조각으로 나눠요. 이모지 같은 두 칸짜리 글자가 반으로 잘리지 않게 해요.
function splitText(str, size) {
  const out = [];
  for (let i = 0; i < str.length; ) {
    let end = Math.min(i + size, str.length);
    const code = str.charCodeAt(end - 1);
    if (end < str.length && code >= 0xd800 && code <= 0xdbff) end -= 1;
    out.push(str.slice(i, end));
    i = end;
  }
  return out.length ? out : [""];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
