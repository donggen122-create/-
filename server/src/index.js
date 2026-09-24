// 서호팡팡수호대 저장 서버 — Cloudflare Worker
// 역할: (1) /api/* 계정·저장 API  (2) 그 외 경로는 dist_web 정적 파일(게임 본체)
// 원칙: 개인정보 없음(아이디·비번만). 비번은 PBKDF2 해시로만 보관. 저장 데이터는 사용자당 1개 JSON.
// 2026-09-22 Codex "Guardian v2" 개편: 성장·이용권·판 시작/결과 API는 guardian.js(/api/guardian*, /api/play/*, 관리자 passes·grant-passes).
//   옛 저장(saves)은 읽기 전용 보관(PUT /save → 410), 옛 선물(grants) 지급도 종료(→ 관리자 이용권 지급). 회원·세션·관리자 인증·접속 신호는 이 파일.
import { guardianAPI, guardianAdmin, migrate as migrateGuardian, dayKey, nextReset } from "./guardian.js";
let guardianSchema;
async function ensureGuardian(env) { guardianSchema ||= migrateGuardian(env.DB).catch((e) => { guardianSchema = null; throw e; }); await guardianSchema; }

const ID_RE = /^[a-zA-Z0-9가-힣_]{2,12}$/;
const PW_MIN = 4, PW_MAX = 64;
const SAVE_MAX_BYTES = 256 * 1024;                 // 저장 JSON 상한(현재 저장본은 수십 KB)
const SESSION_DAYS = 60;
const PBKDF2_ITER = 12000;                         // Workers 무료 요금제 CPU 한도(10ms) 안에서 도는 수준
// 시도 제한 [횟수, 창(ms)].
// 학교는 교실 전체가 공인 IP 하나를 함께 쓰므로 IP 기준은 '안전밸브' 수준으로 넉넉하게 두고,
// 비밀번호 무차별 대입은 계정 기준(같은 아이디로 연속 실패)으로 막는다. 성공한 로그인은 횟수에 들어가지 않는다.
const RATE = {
  loginIp: [300, 10 * 60_000],       // IP당 로그인 시도 300회/10분 (30명 교실이 여러 번 재시도해도 여유)
  pwFail: [10, 15 * 60_000],         // 같은 아이디 비밀번호 연속 실패 10회 → 15분 잠금(맞게 입력하면 즉시 해제)
  register: [100, 60 * 60_000],      // IP당 가입 100회/시간
  admin: [20, 15 * 60_000],          // 관리자 열쇠 틀림 20회/15분 → 잠깐 잠금(맞는 요청은 세지 않음)
  teacherFail: [10, 15 * 60_000],    // 선생님 계정 비밀번호 틀림 10회/15분(모든 기기 합산) → 선생님 로그인만 15분 잠금
};
const LOCKED_MSG = "선생님이 이 계정을 잠갔어요. 선생님께 말씀해 주세요.";
const PRESENCE_GAP = 120_000;         // 접속 신호(30초마다)가 이보다 오래 끊기면 "접속 중"에서 빠지고, 다시 오면 새로 센다
const ADMIN_SESSION_MS = 12 * 3600_000; // 선생님 관리 페이지 로그인 유지 시간

// 접속 신호 스크립트. 게임 첫 화면(/)에 서버가 붙여 준다(게임 파일은 손대지 않음 — Codex가 클라이언트를 개편 중).
// 로그인하면 서버가 sp_in=1 표식 쿠키를 주고, 이 스크립트는 화면이 보이는 동안 30초마다 /api/presence에 신호를 보낸다.
// 숨기거나 닫으면 "나감" 신호(bye)를 보내 바로 접속 중 목록에서 빠진다. 단일 파일판(file://)에서는 동작하지 않는다.
const PRESENCE_JS = `(function(){
  if (location.protocol === "file:") return;
  var EVERY = 30000, last = 0;
  function on() { return /(^|; )sp_in=1(;|$)/.test(document.cookie); }
  function ping(bye) {
    if (!on()) return;
    if (bye) { try { navigator.sendBeacon("/api/presence?bye=1", ""); } catch (e) {} last = 0; return; }
    var now = Date.now(); if (now - last < 5000) return; last = now;
    try { fetch("/api/presence", { method: "POST", credentials: "same-origin", keepalive: true, body: "" }).catch(function () {}); } catch (e) {}
  }
  setInterval(function () { if (!document.hidden) ping(); }, EVERY);
  document.addEventListener("visibilitychange", function () { if (document.hidden) ping(true); else ping(); });
  window.addEventListener("pagehide", function () { ping(true); });
  ping();
})();`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return withCors(await api(request, env, url));
      } catch (e) {
        console.error("api error", e);
        return withCors(json({ error: "서버에 문제가 생겼어요. 잠시 후 다시 해 주세요." }, 500));
      }
    }
    if (url.pathname === "/presence.js") {
      return new Response(PRESENCE_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=600" } });
    }
    // 게임 첫 화면에는 접속 신호 스크립트를 붙인다. wrangler.toml의 run_worker_first가 "/"를 이 코드로 보낸다
    if (url.pathname === "/" && request.method === "GET") return injectPresence(request, env);
    return env.ASSETS.fetch(request);
  },
};

async function injectPresence(request, env) {
  const req = new Request(request);
  req.headers.delete("If-None-Match"); req.headers.delete("If-Modified-Since");   // 항상 본문을 받아 붙인다(브라우저의 옛 사본도 갱신)
  const res = await env.ASSETS.fetch(req);
  if (res.status !== 200 || !(res.headers.get("Content-Type") || "").includes("text/html")) return res;
  const out = new HTMLRewriter().on("body", { element(el) { el.append('<script src="/presence.js?v=1" defer></script>', { html: true }); } }).transform(res);
  const h = new Headers(out.headers); h.delete("ETag"); h.set("Cache-Control", "no-cache");
  return new Response(out.body, { status: 200, headers: h });
}

async function api(request, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204 });

  if (path === "/health" && method === "GET") return json({ ok: true, release: "guardian-v2-20260922", presence: true, adminRoles: true, ts: Date.now() });

  // 선생님 관리 API(/api/admin/*): X-Admin-Key 헤더가 Cloudflare 비밀값 ADMIN_KEY와 같아야 한다
  if (path.startsWith("/admin/")) return admin(request, env, path.slice(7), method);

  if (path === "/register" && method === "POST") {
    if (!(await allow(env, "register", ip(request)))) return json({ error: "가입 시도가 너무 많아요. 한 시간 뒤에 다시 해 주세요." }, 429);
    const { id, pw } = await body(request);
    const v = validate(id, pw); if (v) return json({ error: v }, 400);
    const key = id.toLowerCase();
    const exists = await env.DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(key).first();
    if (exists) return json({ error: "이미 있는 아이디예요. 다른 아이디를 골라 주세요." }, 409);
    const salt = randomHex(16);
    const hash = await pbkdf2(pw, salt);
    const now = Date.now();
    await env.DB.prepare("INSERT INTO users (id, display_id, pw_hash, salt, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(key, id, hash, salt, now, now).run();
    const token = await newSession(env, key);
    return json({ token, id, hasSave: false }, 200, sessionCookies(url, token));
  }

  if (path === "/login" && method === "POST") {
    if (!(await allow(env, "loginIp", ip(request)))) return json({ error: "로그인 시도가 너무 많아요. 10분 뒤에 다시 해 주세요." }, 429);
    const { id, pw } = await body(request);
    if (typeof id !== "string" || typeof pw !== "string") return json({ error: "아이디와 비밀번호를 입력해 주세요." }, 400);
    const key = id.toLowerCase();
    // 같은 아이디로 비밀번호를 연속으로 틀리면 잠깐 잠근다(무차별 대입 방어). 성공하면 카운터를 지운다.
    if (await isLocked(env, "pwFail", key)) return json({ error: "비밀번호를 여러 번 틀렸어요. 15분 뒤에 다시 해 주세요." }, 429);
    const user = await env.DB.prepare("SELECT id, display_id, pw_hash, salt, locked FROM users WHERE id = ?").bind(key).first();
    const bad = json({ error: "아이디 또는 비밀번호가 맞지 않아요." }, 401);
    if (!user) { await pbkdf2(pw, "00"); await allow(env, "pwFail", key); return bad; }   // 존재 여부를 시간 차로 알 수 없게 같은 계산
    const hash = await pbkdf2(pw, user.salt);
    if (!timingSafeEqual(hash, user.pw_hash)) { await allow(env, "pwFail", key); return bad; }
    if (user.locked) return json({ error: LOCKED_MSG }, 403);                              // 선생님이 잠근 계정
    await env.DB.prepare("DELETE FROM attempts WHERE key = ?").bind(`pwFail:${key}`).run();
    await env.DB.prepare("UPDATE users SET last_login = ? WHERE id = ?").bind(Date.now(), user.id).run();
    const token = await newSession(env, user.id);
    const save = await env.DB.prepare("SELECT updated_at FROM saves WHERE user_id = ?").bind(user.id).first();
    return json({ token, id: user.display_id, hasSave: !!save, updatedAt: save?.updated_at ?? null }, 200, sessionCookies(url, token));
  }

  // 접속 신호(30초마다, /presence.js가 보냄). 인증은 로그인 때 준 쿠키(sp_hb) 또는 Authorization 헤더
  if (path === "/presence" && method === "POST") {
    const u = await auth(request, env, cookie(request, "sp_hb"));
    if (!u || u.locked) return json({ error: "다시 접속해 주세요." }, u ? 403 : 401, clearCookies(url));
    await ensureGuardian(env);
    if (url.searchParams.get("bye")) {
      await env.DB.prepare("DELETE FROM presence WHERE user_id = ?").bind(u.id).run();
      return new Response(null, { status: 204 });
    }
    const now = Date.now();
    const device = /Mobile|Android|iPhone|iPad/i.test(request.headers.get("User-Agent") || "") ? "phone" : "pc";
    await env.DB.prepare(
      "INSERT INTO presence (user_id, since, last_seen, device) VALUES (?1, ?2, ?2, ?3) " +
      "ON CONFLICT(user_id) DO UPDATE SET since = CASE WHEN ?2 - presence.last_seen > ?4 THEN ?2 ELSE presence.since END, last_seen = ?2, device = ?3")
      .bind(u.id, now, device, PRESENCE_GAP).run();
    if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM presence WHERE last_seen < ?").bind(now - 7 * 86400_000).run();
    return new Response(null, { status: 204 });
  }

  // 아래는 로그인 필요
  const user = await auth(request, env);
  if (!user) return json({ error: "다시 접속해 주세요." }, 401);
  if (user.locked) return json({ error: LOCKED_MSG }, 403);

  // Codex 개편 API(성장·이용권·판 시작/결과). 표는 첫 호출 때 guardian.js가 만든다
  if (path === "/guardian" || path.startsWith("/guardian/") || path.startsWith("/play/")) {
    await ensureGuardian(env);
    return guardianAPI(request, env, user, path);
  }

  if (path === "/me" && method === "GET") return json({ id: user.display_id }, 200, sessionCookies(url, user.token));

  if (path === "/logout" && method === "POST") {
    await ensureGuardian(env);
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(user.token).run();
    await env.DB.prepare("DELETE FROM presence WHERE user_id = ?").bind(user.id).run();
    return json({ ok: true }, 200, clearCookies(url));
  }

  // 옛 저장본(개편 전 진행)은 읽기 전용 보관. 개편 클라이언트가 첫 접속 때 guardian 프로필로 옮긴다(legacy-migration.js)
  if (path === "/save" && method === "GET") {
    const row = await env.DB.prepare("SELECT data, updated_at, device FROM saves WHERE user_id = ?").bind(user.id).first();
    if (!row) return json({ save: null, updatedAt: null });
    return json({ save: JSON.parse(row.data), updatedAt: row.updated_at, device: row.device, archived: true });
  }

  if (path === "/save" && method === "PUT") {
    return json({ error: "새 버전으로 새로고침해 주세요. 이전 모험 기록은 보관되어 있어요.", code: "LEGACY_READ_ONLY" }, 410);
  }

  return json({ error: "없는 주소예요." }, 404);
}

// ---------- 선생님 관리 API ----------
// 비밀값(Cloudflare secrets, 로컬은 server/.dev.vars): ADMIN_ID·ADMIN_PW = 관리자(주인) 로그인 아이디·비밀번호,
// TEACHER_ID·TEACHER_PW = 선생님 계정 로그인(같은 관리 페이지, 학생 계정 삭제·진행 초기화·그림 보내기 없음 — 2026-09-23 사용자 요청),
// ADMIN_KEY = 스크립트용 열쇠(X-Admin-Key) 겸 로그인 토큰 서명 키. 넣는 법: `npx wrangler secret bulk <json>`. 값은 문서에 적지 않는다.
// 아이디가 같아도 된다: 비밀번호가 관리자 것이면 관리자, 선생님 것이면 선생님으로 들어간다.
const TEACHER_BLOCKED = new Set(["delete", "reset-save", "migrate-v1", "migrate-v2", "config", "as-teacher", "test-profile"]);   // test-profile: 시험용 슈퍼 계정(관리자만)   // + upload/*
async function admin(request, env, sub, method) {
  if (!env.ADMIN_KEY) return json({ error: "관리자 열쇠가 아직 설정되지 않았어요." }, 503);
  const addr = ip(request);
  if (await isLocked(env, "admin", addr)) return json({ error: "여러 번 틀렸어요. 15분 뒤에 다시 해 주세요." }, 429);

  // 로그인(아이디·비밀번호) → 12시간짜리 토큰. DB에 저장하지 않고 서명해 확인한다.
  // 관리자 토큰 = 만료시각.서명(ADMIN_KEY), 선생님 토큰 = t만료시각.서명(ADMIN_KEY+선생님 아이디·비밀번호 → 비밀번호를 바꾸면 기존 선생님 로그인은 풀린다)
  if (sub === "login" && method === "POST") {
    if (!env.ADMIN_ID || !env.ADMIN_PW) return json({ error: "관리자 아이디·비밀번호가 아직 설정되지 않았어요." }, 503);
    const b = await body(request);
    const id = norm(b.id), pw = norm(b.pw), exp = Date.now() + ADMIN_SESSION_MS;
    if (timingSafeEqual(id, norm(env.ADMIN_ID)) && timingSafeEqual(pw, norm(env.ADMIN_PW))) {
      return json({ token: `${exp}.${await adminSig(env, exp)}`, expiresAt: exp, role: "owner" });
    }
    if (teacherReady(env) && timingSafeEqual(id, norm(env.TEACHER_ID))) {
      // 선생님 비밀번호가 짧아도 버티게: 어느 기기에서든 선생님 계정 비밀번호를 10번 틀리면 15분 동안 선생님 로그인을 막는다(관리자 로그인은 영향 없음)
      if (await isLocked(env, "teacherFail", "all")) return json({ error: "선생님 계정 비밀번호를 여러 번 틀렸어요. 15분 뒤에 다시 해 주세요." }, 429);
      if (timingSafeEqual(pw, norm(env.TEACHER_PW))) return json({ token: `t${exp}.${await teacherSig(env, exp)}`, expiresAt: exp, role: "teacher" });
      await allow(env, "teacherFail", "all");
    }
    await allow(env, "admin", addr);
    return json({ error: "아이디 또는 비밀번호가 맞지 않아요." }, 401);
  }

  // 그 밖의 관리 API: 로그인 토큰(X-Admin-Token, GET은 ?token= 도 가능 — 그림 내려받기 링크용) 또는 열쇠(X-Admin-Key, 스크립트용 = 관리자)
  const key = request.headers.get("X-Admin-Key") || "";
  const tok = request.headers.get("X-Admin-Token") || (method === "GET" ? (new URL(request.url).searchParams.get("token") || "") : "");
  const role = (key && timingSafeEqual(key, env.ADMIN_KEY)) || (tok && await adminTokenOk(env, tok)) ? "owner"
    : tok && await teacherTokenOk(env, tok) ? "teacher" : null;
  if (!role) { await allow(env, "admin", addr); return json({ error: "다시 로그인해 주세요." }, 401); }
  if (sub === "me" && method === "GET") return json({ role });
  if (role === "teacher" && (TEACHER_BLOCKED.has(sub) || sub.startsWith("upload/"))) {
    return json({ error: "선생님 계정으로는 할 수 없는 작업이에요. 학생 계정 삭제·진행 초기화는 관리자만 할 수 있어요." }, 403);
  }
  // 관리자 전용: 선생님 계정 설정 확인, 선생님 화면 미리보기(선생님 토큰 발급)
  if (sub === "config" && method === "GET") {
    return json({ teacher: { configured: teacherReady(env), sameIdAsAdmin: teacherReady(env) && norm(env.TEACHER_ID) === norm(env.ADMIN_ID) } });
  }
  if (sub === "as-teacher" && method === "POST") {
    if (!teacherReady(env)) return json({ error: "선생님 계정(TEACHER_ID·TEACHER_PW)이 아직 설정되지 않았어요." }, 503);
    const exp = Date.now() + ADMIN_SESSION_MS;
    return json({ token: `t${exp}.${await teacherSig(env, exp)}`, expiresAt: exp, role: "teacher" });
  }

  // 그림 보내기(/admin/upload.html): 다른 PC에서 만든 Gemini 그림을 서버에 올려 두면 작업 PC에서 내려받는다. 조각(384KB)을 base64로 D1에 저장
  if (sub.startsWith("upload/")) return uploads(request, env, sub.slice(7), method);

  await ensureGuardian(env);
  // Codex 개편: 이용권 현황·지급 기록(passes), 이용권·코인 지급(grant-passes, requestId로 중복 방지), 표 만들기(migrate-v1)
  if (["passes", "grant-passes", "migrate-v1", "migrate-v2", "test-profile", "set-hero"].includes(sub)) {
    await ensureGuardian(env);
    let req = request;
    if (role === "teacher" && sub === "grant-passes" && method === "POST") {   // 선생님 계정 지급은 기록 메모 앞에 [선생님]을 붙인다
      const g = await body(request);
      // 전체(모든 학생) 지급은 최고 관리자만(2026-09-24 밤 사용자). 선생님은 학생 한 명씩만.
      if (g.all === true || !String(g.id || "").trim()) return json({ error: "모든 학생에게 한 번에 주기는 최고 관리자만 할 수 있어요. 학생 한 명씩 선물해 주세요." }, 403);
      g.note = `[선생님] ${String(g.note || "").trim() || "추가 지급"}`.slice(0, 120);
      req = new Request(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(g) });
    }
    return guardianAdmin(req, env, sub, method);
  }

  if (sub === "online" && method === "GET") {                               // 지금 접속 중(2분 안에 신호) + 1시간 안에 있었던 학생
    const now = Date.now();
    const rows = (await env.DB.prepare(
      "SELECT p.user_id AS id, u.display_id, p.since, p.last_seen, p.device FROM presence p JOIN users u ON u.id = p.user_id WHERE p.last_seen > ? ORDER BY p.since")
      .bind(now - 3600_000).all()).results;
    return json({ now, gap: PRESENCE_GAP, online: rows.filter((r) => now - r.last_seen <= PRESENCE_GAP), recent: rows.filter((r) => now - r.last_seen > PRESENCE_GAP) });
  }

  if (sub === "stats" && method === "GET") {
    await ensureGuardian(env);
    const now = Date.now();
    const rows = (await env.DB.prepare(`
      SELECT u.id, u.display_id, u.created_at, u.last_login, u.locked, s.updated_at AS saved_at, s.device, p.last_seen, p.device AS seen_device,
        json_extract(s.data, '$.stats.runs') AS runs, json_extract(s.data, '$.stats.clears') AS clears,
        json_extract(s.data, '$.account.level') AS acc_level, json_extract(s.data, '$.hero') AS hero,
        json_extract(s.data, '$.character') AS character_id,
        json_extract(s.data, '$.currencies.GOLD') AS gold, json_extract(s.data, '$.currencies.DUST') AS dust,
        gp.state AS guardian_state, pd.base_used, pd.bonus_granted, pd.bonus_used,
        (SELECT MAX(CAST(substr(key, 3) AS INTEGER)) FROM json_each(json_extract(s.data, '$.progress.chapters')) WHERE json_extract(value, '$.cleared') = 1) AS best_stage,
        (SELECT COUNT(*) FROM json_each(json_extract(s.data, '$.progress.chapters')) WHERE json_extract(value, '$.cleared') = 1) AS stages_cleared,
        (SELECT COUNT(*) FROM grants g WHERE g.user_id = u.id AND g.applied_at IS NULL) AS pending_grants,
        (SELECT COUNT(*) FROM sessions se WHERE se.user_id = u.id AND se.expires_at > ?) AS sessions
      FROM users u LEFT JOIN saves s ON s.user_id = u.id LEFT JOIN presence p ON p.user_id = u.id
        LEFT JOIN guardian_profiles gp ON gp.user_id = u.id LEFT JOIN play_days pd ON pd.user_id = u.id AND pd.day = ?
      ORDER BY u.created_at`).bind(now, dayKey(now)).all()).results;
    // Codex 개편 프로필(guardian_profiles)이 있으면 코인·판·성공·최고 단계는 거기서, 이용권은 play_days에서 계산
    for (const row of rows) {
      if (row.guardian_state) {
        const profile = JSON.parse(row.guardian_state);
        row.gold = profile.coins; row.gifts = profile.gifts ?? 0; row.runs = profile.runs; row.clears = profile.wins;
        row.hero = profile.hero; row.profile_version = profile.version; row.training = profile.training || null;
        row.parts_owned = Object.keys(profile.parts || {}).length;
        row.stages_cleared = Object.keys(profile.stages || {}).filter((k) => profile.stages[k].cleared).length;
        row.best_stage = Math.max(0, ...Object.keys(profile.stages || {}).filter((k) => profile.stages[k].cleared).map((k) => Number(k.slice(2))));
      }
      const baseRemaining = 10 - (row.base_used || 0), bonusRemaining = (row.bonus_granted || 0) - (row.bonus_used || 0);
      row.passes = { baseRemaining, bonusRemaining, remaining: baseRemaining + bonusRemaining, resetAt: nextReset(now) };
      row.energy = row.passes.remaining;
      delete row.guardian_state; delete row.base_used; delete row.bonus_granted; delete row.bonus_used;
    }
    return json({ users: rows, now });
  }

  const b = await body(request);
  const target = async () => {
    const id = String(b.id || "").toLowerCase();
    return id ? await env.DB.prepare("SELECT id, display_id, locked FROM users WHERE id = ?").bind(id).first() : null;
  };

  if (sub === "reset-password" && method === "POST") {
    const u = await target(); if (!u) return json({ error: "없는 아이디예요." }, 404);
    const pw = String(b.pw || "");
    if (pw.length < PW_MIN) return json({ error: `비밀번호는 ${PW_MIN}자 이상이어야 해요.` }, 400);
    if (pw.length > PW_MAX) return json({ error: "비밀번호가 너무 길어요." }, 400);
    const salt = randomHex(16), hash = await pbkdf2(pw, salt);
    await env.DB.prepare("UPDATE users SET pw_hash = ?, salt = ? WHERE id = ?").bind(hash, salt, u.id).run();
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id).run();      // 다른 기기 접속도 끊어 새 비밀번호로만
    await env.DB.prepare("DELETE FROM attempts WHERE key = ?").bind(`pwFail:${u.id}`).run();
    return json({ ok: true, id: u.display_id });
  }

  if (sub === "lock" && method === "POST") {
    const u = await target(); if (!u) return json({ error: "없는 아이디예요." }, 404);
    const locked = b.locked ? 1 : 0;
    await env.DB.prepare("UPDATE users SET locked = ? WHERE id = ?").bind(locked, u.id).run();
    if (locked) {                                                            // 지금 접속 중이어도 바로 끊는다
      await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id).run();
      await env.DB.prepare("DELETE FROM presence WHERE user_id = ?").bind(u.id).run();
    }
    return json({ ok: true, id: u.display_id, locked: !!locked });
  }

  if (sub === "reset-save" && method === "POST") {                          // 진행 초기화(계정은 남고 처음부터). 당일 이용권 사용량은 되돌리지 않음(Codex 정책)
    const u = await target(); if (!u) return json({ error: "없는 아이디예요." }, 404);
    await ensureGuardian(env);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM guardian_profiles WHERE user_id = ?").bind(u.id),
      env.DB.prepare("DELETE FROM guardian_operations WHERE user_id = ?").bind(u.id),
      env.DB.prepare("UPDATE play_runs SET status = 'expired', settled_at = ? WHERE user_id = ? AND status = 'active'").bind(Date.now(), u.id),
      env.DB.prepare("DELETE FROM saves WHERE user_id = ?").bind(u.id),
      env.DB.prepare("DELETE FROM grants WHERE user_id = ?").bind(u.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id),               // 기기의 옛 진행이 다시 올라오지 않게 재접속시킴
      env.DB.prepare("DELETE FROM presence WHERE user_id = ?").bind(u.id),
    ]);
    return json({ ok: true, id: u.display_id });
  }

  if (sub === "delete" && method === "POST") {
    const u = await target(); if (!u) return json({ error: "없는 아이디예요." }, 404);
    await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(u.id).run();
    await env.DB.prepare("DELETE FROM presence WHERE user_id = ?").bind(u.id).run();
    await env.DB.prepare("DELETE FROM saves WHERE user_id = ?").bind(u.id).run();
    await env.DB.prepare("DELETE FROM grants WHERE user_id = ?").bind(u.id).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(u.id).run();
    return json({ ok: true, id: u.display_id });
  }

  if (sub === "grant" && method === "POST") {                               // 옛 금화·별가루·에너지 지급은 종료(Codex 개편) → grant-passes
    return json({ error: "새 지급 화면을 사용하세요. 기존 에너지 지급은 종료되었어요. 이용권은 관리자 이용권 지급에서만 추가할 수 있어요." }, 410);
  }

  return json({ error: "없는 주소예요." }, 404);
}

// ---------- 도우미 ----------
function validate(id, pw) {
  if (typeof id !== "string" || !ID_RE.test(id)) return "아이디는 2~12자, 한글·영어·숫자·밑줄(_)만 쓸 수 있어요.";
  if (typeof pw !== "string" || pw.length < PW_MIN) return `비밀번호는 ${PW_MIN}자 이상이어야 해요.`;
  if (pw.length > PW_MAX) return "비밀번호가 너무 길어요.";
  return null;
}
async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
function ip(request) { return request.headers.get("CF-Connecting-IP") || "0.0.0.0"; }
// 현재 창 안에서 이미 한도에 닿았는지(횟수를 올리지 않고 확인만)
async function isLocked(env, kind, who) {
  const [max, windowMs] = RATE[kind];
  const row = await env.DB.prepare("SELECT count, window_start FROM attempts WHERE key = ?").bind(`${kind}:${who}`).first();
  return !!row && Date.now() - row.window_start <= windowMs && row.count >= max;
}
// 시도 1회를 기록하고, 한도 안이면 true
async function allow(env, kind, addr) {
  const [max, windowMs] = RATE[kind];
  const key = `${kind}:${addr}`, now = Date.now();
  const row = await env.DB.prepare("SELECT count, window_start FROM attempts WHERE key = ?").bind(key).first();
  if (!row || now - row.window_start > windowMs) {
    await env.DB.prepare("INSERT INTO attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?")
      .bind(key, now, now).run();
    return true;
  }
  if (row.count >= max) return false;
  await env.DB.prepare("UPDATE attempts SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}
async function auth(request, env, tokenOverride) {
  const h = request.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : (tokenOverride || "");
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    "SELECT s.token, s.expires_at, u.id, u.display_id, u.locked FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?")
    .bind(token).first();
  if (!row) return null;
  if (row.expires_at < Date.now()) { await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run(); return null; }
  return row;
}
async function newSession(env, userId) {
  const token = randomHex(32);
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, expires).run();
  // 만료된 세션 정리(가끔)
  if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Date.now()).run();
  return token;
}
function randomHex(nBytes) {
  const a = new Uint8Array(nBytes); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function pbkdf2(pw, saltHex) {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, keyMat, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function json(obj, status = 200, extraHeaders = []) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  for (const [k, v] of extraHeaders) headers.append(k, v);
  return new Response(JSON.stringify(obj), { status, headers });
}
// 게임을 다른 주소(예: 로컬 개발 서버)에서 열어도 API를 쓸 수 있게 허용. 토큰 방식이라 쿠키 CSRF 문제 없음.
// (접속 신호 쿠키 sp_hb는 /api/presence에만 가고, 그 API는 신호만 남기므로 CSRF로 할 수 있는 일이 없다)
function withCors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key, X-Admin-Token");
  return new Response(res.body, { status: res.status, headers: h });
}
function cookie(request, name) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? m[1].trim() : "";
}
// 접속 신호용 쿠키: sp_hb(세션 토큰, HttpOnly, /api/presence에만 전송) + sp_in(로그인 표식, presence.js가 읽음)
function sessionCookies(url, token) {
  const sec = url.protocol === "https:" ? "; Secure" : "", age = SESSION_DAYS * 86400;
  return [["Set-Cookie", `sp_hb=${token}; Path=/api/presence; Max-Age=${age}; HttpOnly; SameSite=Lax${sec}`],
          ["Set-Cookie", `sp_in=1; Path=/; Max-Age=${age}; SameSite=Lax${sec}`]];
}
function clearCookies(url) {
  const sec = url.protocol === "https:" ? "; Secure" : "";
  return [["Set-Cookie", `sp_hb=; Path=/api/presence; Max-Age=0; HttpOnly; SameSite=Lax${sec}`],
          ["Set-Cookie", `sp_in=; Path=/; Max-Age=0; SameSite=Lax${sec}`]];
}
function norm(s) { return String(s ?? "").normalize("NFC").trim(); }

// ---------- 그림 보내기(파일 올리기/내려받기) ----------
const UPLOAD_CHUNK_MAX = 400 * 1024, UPLOAD_CHUNKS_MAX = 64;   // 조각 384KB × 64 = 최대 24MB
let uploadsSchema;
async function ensureUploads(env) {
  uploadsSchema ||= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, name TEXT NOT NULL, size INTEGER NOT NULL, mime TEXT, chunks INTEGER NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS upload_chunks (id TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, idx))"),
  ]).catch((e) => { uploadsSchema = null; throw e; });
  await uploadsSchema;
}
async function uploads(request, env, op, method) {
  await ensureUploads(env);
  const url = new URL(request.url);
  if (op === "start" && method === "POST") {
    const b = await body(request);
    const name = String(b.name || "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 120) || "file";
    const size = Number(b.size) || 0, chunks = Number(b.chunks) || 0;
    if (size <= 0 || chunks <= 0 || chunks > UPLOAD_CHUNKS_MAX) return json({ error: "파일이 너무 크거나 비어 있어요(최대 24MB)." }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO uploads (id, name, size, mime, chunks, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, name, size, String(b.mime || "").slice(0, 60), chunks, Date.now()).run();
    return json({ id, name, chunks });
  }
  if (op === "chunk" && method === "POST") {
    const id = url.searchParams.get("id") || "", idx = Number(url.searchParams.get("idx"));
    const up = await env.DB.prepare("SELECT chunks FROM uploads WHERE id = ?").bind(id).first();
    if (!up || !(idx >= 0 && idx < up.chunks)) return json({ error: "잘못된 조각이에요." }, 400);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > UPLOAD_CHUNK_MAX) return json({ error: "조각 크기가 잘못됐어요." }, 413);
    await env.DB.prepare("INSERT OR REPLACE INTO upload_chunks (id, idx, data) VALUES (?, ?, ?)").bind(id, idx, b64(bytes)).run();
    return json({ ok: true, idx });
  }
  if (op === "finish" && method === "POST") {
    const b = await body(request); const id = String(b.id || "");
    const up = await env.DB.prepare("SELECT chunks FROM uploads WHERE id = ?").bind(id).first();
    if (!up) return json({ error: "없는 파일이에요." }, 404);
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM upload_chunks WHERE id = ?").bind(id).first()).n;
    if (n !== up.chunks) return json({ error: `조각이 모자라요(${n}/${up.chunks}). 다시 올려 주세요.` }, 400);
    await env.DB.prepare("UPDATE uploads SET done = 1 WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  if (op === "list" && method === "GET") {
    const rows = (await env.DB.prepare("SELECT id, name, size, mime, chunks, done, created_at FROM uploads ORDER BY created_at DESC LIMIT 100").all()).results;
    return json({ files: rows });
  }
  if (op === "file" && method === "GET") {
    const id = url.searchParams.get("id") || "";
    const up = await env.DB.prepare("SELECT name, size, mime, chunks, done FROM uploads WHERE id = ?").bind(id).first();
    if (!up || !up.done) return json({ error: "없는 파일이에요." }, 404);
    const out = new Uint8Array(up.size); let o = 0;
    for (let i = 0; i < up.chunks; i++) {
      const row = await env.DB.prepare("SELECT data FROM upload_chunks WHERE id = ? AND idx = ?").bind(id, i).first();
      if (!row) return json({ error: "조각이 빠져 있어요." }, 500);
      const part = unb64(row.data); out.set(part.subarray(0, Math.min(part.length, out.length - o)), o); o += part.length;
    }
    return new Response(out, { headers: { "Content-Type": up.mime || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(up.name)}`, "Cache-Control": "no-store" } });
  }
  if (op === "delete" && method === "POST") {
    const b = await body(request); const id = String(b.id || "");
    await env.DB.batch([env.DB.prepare("DELETE FROM upload_chunks WHERE id = ?").bind(id), env.DB.prepare("DELETE FROM uploads WHERE id = ?").bind(id)]);
    return json({ ok: true });
  }
  return json({ error: "없는 주소예요." }, 404);
}
function b64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(str) { const s = atob(str); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
async function adminSig(env, exp) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(env.ADMIN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(`admin-session:${exp}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function adminTokenOk(env, tok) {
  const m = /^(\d{13})\.([0-9a-f]{64})$/.exec(tok); if (!m) return false;
  const exp = Number(m[1]); if (exp < Date.now()) return false;
  return timingSafeEqual(m[2], await adminSig(env, exp));
}
// 선생님 계정: 비밀값 TEACHER_ID·TEACHER_PW가 둘 다 있어야 켜진다. 서명 키에 선생님 아이디·비밀번호가 들어가므로 바꾸면 기존 선생님 토큰은 무효
function teacherReady(env) { return !!(env.TEACHER_ID && env.TEACHER_PW); }
async function teacherSig(env, exp) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(`${env.ADMIN_KEY}|teacher|${norm(env.TEACHER_ID)}|${norm(env.TEACHER_PW)}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(`teacher-session:${exp}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function teacherTokenOk(env, tok) {
  if (!teacherReady(env)) return false;
  const m = /^t(\d{13})\.([0-9a-f]{64})$/.exec(tok); if (!m) return false;
  const exp = Number(m[1]); if (exp < Date.now()) return false;
  return timingSafeEqual(m[2], await teacherSig(env, exp));
}

