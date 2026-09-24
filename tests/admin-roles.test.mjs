// 관리 페이지 역할(2026-09-23): 관리자 = 전부, 선생님 계정 = 학생 계정 삭제·진행 초기화·그림 보내기 불가(서버가 거절).
// 실제 Worker(server/src/index.js)의 fetch를 가짜 D1(node:sqlite)로 돌린다. 여기 값은 검사 전용(실제 비밀값과 무관).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import worker from '../server/src/index.js';
import { migrate } from '../server/src/guardian.js';

class D1 {
  constructor() { this.sql = new DatabaseSync(':memory:'); this.sql.exec(fs.readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8')); }
  prepare(sql) { const db = this; return { args: [], bind(...args) { this.args = args; return this; }, async first() { return db.sql.prepare(sql).get(...this.args) || null; }, async all() { return { results: db.sql.prepare(sql).all(...this.args) }; }, async run() { const r = db.sql.prepare(sql).run(...this.args); return { meta: { changes: Number(r.changes) }, success: true }; } }; }
  async batch(statements) { this.sql.exec('BEGIN IMMEDIATE'); try { const out = []; for (const s of statements) out.push(await s.run()); this.sql.exec('COMMIT'); return out; } catch (e) { this.sql.exec('ROLLBACK'); throw e; } }
}
const OWNER = { id: 'test-school', pw: 'owner-secret-pw' }, TEACHER = { id: 'test-school', pw: 'teacher-pin' };   // 아이디가 같아도 비밀번호로 구분
// 서버는 "게임 표를 만들었음"을 메모리에 기억하므로(실서버는 DB가 하나), 검사마다 새 DB에는 표를 직접 만든다
const makeEnv = async (extra = {}) => { const DB = new D1(); await migrate(DB); return envWith(DB, extra); };
const envWith = (DB, extra) => ({ DB, ADMIN_KEY: 'test-only-admin-key-0123456789', ADMIN_ID: OWNER.id, ADMIN_PW: OWNER.pw, TEACHER_ID: TEACHER.id, TEACHER_PW: TEACHER.pw, ASSETS: { fetch: async () => new Response('', { status: 404 }) }, ...extra });
let ipSeq = 0;
async function call(env, path, { body, token, key, method, ip } = {}) {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || `10.0.0.${(ipSeq++ % 200) + 1}` };
  if (token) headers['X-Admin-Token'] = token;
  if (key) headers['X-Admin-Key'] = key;
  const res = await worker.fetch(new Request('http://local/api' + path, { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined }), env);
  let data = {}; try { data = await res.json(); } catch {}
  return { status: res.status, ...data };
}
const uid = () => 'req_' + crypto.randomUUID().replace(/-/g, '');

test('같은 아이디라도 비밀번호에 따라 관리자·선생님으로 들어가고, 틀리면 거절', async () => {
  const env = await makeEnv();
  const owner = await call(env, '/admin/login', { body: OWNER });
  assert.equal(owner.status, 200); assert.equal(owner.role, 'owner'); assert.match(owner.token, /^\d{13}\.[0-9a-f]{64}$/, '관리자 토큰 형식은 예전 그대로');
  const teacher = await call(env, '/admin/login', { body: TEACHER });
  assert.equal(teacher.status, 200); assert.equal(teacher.role, 'teacher'); assert.match(teacher.token, /^t\d{13}\.[0-9a-f]{64}$/);
  assert.equal((await call(env, '/admin/login', { body: { id: OWNER.id, pw: 'wrong' } })).status, 401);
  assert.equal((await call(env, '/admin/me', { token: owner.token })).role, 'owner');
  assert.equal((await call(env, '/admin/me', { token: teacher.token })).role, 'teacher');
  assert.equal((await call(env, '/admin/me', { key: env.ADMIN_KEY })).role, 'owner', '스크립트 열쇠는 관리자');
});

test('선생님 계정: 통계·접속·비번·잠금·선물은 되고, 삭제·초기화·그림 보내기·관리자 설정은 403', async () => {
  const env = await makeEnv();
  const reg = await call(env, '/register', { body: { id: '학생하나', pw: '1234' } }); assert.equal(reg.status, 200);
  const t = (await call(env, '/admin/login', { body: TEACHER })).token;
  for (const p of ['stats', 'online', 'passes']) assert.equal((await call(env, '/admin/' + p, { token: t })).status, 200, p);
  assert.equal((await call(env, '/admin/lock', { token: t, body: { id: '학생하나', locked: true } })).status, 200);
  assert.equal((await call(env, '/admin/lock', { token: t, body: { id: '학생하나', locked: false } })).status, 200);
  assert.equal((await call(env, '/admin/reset-password', { token: t, body: { id: '학생하나', pw: '5678' } })).status, 200);
  const grant = await call(env, '/admin/grant-passes', { token: t, body: { requestId: uid(), id: '학생하나', passes: 2, gold: 50, note: '1반 보상' } });
  assert.equal(grant.status, 200, JSON.stringify(grant));
  const audit = (await call(env, '/admin/passes', { token: t })).audit;
  assert.equal(audit[0].note, '[선생님] 1반 보상', '선생님 지급은 기록에 [선생님]');
  for (const [p, body] of [['delete', { id: '학생하나' }], ['reset-save', { id: '학생하나' }], ['migrate-v2', {}], ['as-teacher', {}]]) {
    const r = await call(env, '/admin/' + p, { token: t, body }); assert.equal(r.status, 403, p);
  }
  for (const p of ['upload/list', 'config']) assert.equal((await call(env, '/admin/' + p, { token: t })).status, 403, p);
  const stats = await call(env, '/admin/stats', { key: env.ADMIN_KEY });
  assert.ok(stats.users.some(u => u.id === '학생하나'), '삭제가 거절되어 계정이 남아 있다');
});

test('관리자: 삭제·초기화 가능, 설정 확인·선생님 화면 미리보기, 관리자 지급 메모는 그대로', async () => {
  const env = await makeEnv();
  await call(env, '/register', { body: { id: '학생둘', pw: '1234' } });
  const o = (await call(env, '/admin/login', { body: OWNER })).token;
  const cfg = await call(env, '/admin/config', { token: o });
  assert.deepEqual(cfg.teacher, { configured: true, sameIdAsAdmin: true });
  const preview = await call(env, '/admin/as-teacher', { token: o, body: {} });
  assert.equal(preview.role, 'teacher'); assert.equal((await call(env, '/admin/me', { token: preview.token })).role, 'teacher');
  await call(env, '/admin/grant-passes', { token: o, body: { requestId: uid(), id: '학생둘', passes: 1, note: '관리자 지급' } });
  assert.equal((await call(env, '/admin/passes', { token: o })).audit[0].note, '관리자 지급');
  assert.equal((await call(env, '/admin/reset-save', { token: o, body: { id: '학생둘' } })).status, 200);
  assert.equal((await call(env, '/admin/delete', { token: o, body: { id: '학생둘' } })).status, 200);
});

test('선생님 비밀번호를 바꾸면 기존 선생님 로그인이 풀리고, 설정이 없으면 선생님 로그인은 꺼진다', async () => {
  const env = await makeEnv();
  const t = (await call(env, '/admin/login', { body: TEACHER })).token;
  const changed = { ...env, TEACHER_PW: 'new-teacher-pin' };
  assert.equal((await call(changed, '/admin/me', { token: t })).status, 401);
  const off = { ...env, TEACHER_ID: '', TEACHER_PW: '' };
  assert.equal((await call(off, '/admin/login', { body: TEACHER })).status, 401);
  assert.equal((await call(off, '/admin/login', { body: OWNER })).status, 200, '관리자는 그대로');
});

test('선생님 비밀번호 10번 틀리면 선생님 로그인만 15분 잠김(관리자 로그인은 그대로)', async () => {
  const env = await makeEnv();
  for (let i = 0; i < 10; i++) assert.equal((await call(env, '/admin/login', { body: { id: TEACHER.id, pw: 'guess' + i } })).status, 401);
  assert.equal((await call(env, '/admin/login', { body: TEACHER })).status, 429, '맞는 비밀번호도 잠시 막힘');
  const owner = await call(env, '/admin/login', { body: OWNER });
  assert.equal(owner.status, 200); assert.equal(owner.role, 'owner');
});

test('시험용 슈퍼 계정: 관리자만, qa로 시작하는 계정만 모든 단계·훈련·파츠를 채운다(학생 계정은 거절)', async () => {
  const env = await makeEnv();
  for (const id of ['qasuper', 'student1']) assert.equal((await call(env, '/register', { body: { id, pw: 'pw-1234' } })).status, 200);
  const owner = (await call(env, '/admin/login', { body: OWNER })).token, teacher = (await call(env, '/admin/login', { body: TEACHER })).token;
  assert.equal((await call(env, '/admin/test-profile', { token: teacher, body: { id: 'qasuper' } })).status, 403, '선생님 계정은 못 한다');
  assert.equal((await call(env, '/admin/test-profile', { token: owner, body: { id: 'student1' } })).status, 400, '학생 계정은 절대 바꾸지 않는다');
  assert.equal((await call(env, '/admin/test-profile', { token: owner, body: { id: 'qanobody' } })).status, 404);
  const r = await call(env, '/admin/test-profile', { token: owner, body: { id: 'qasuper' } });
  assert.equal(r.status, 200); assert.equal(r.stages, 10); assert.equal(r.parts, 10); assert.deepEqual(r.training, { attack: 100, hp: 100, speed: 100 });
  const row = env.DB.sql.prepare("SELECT state FROM guardian_profiles WHERE user_id='qasuper'").get(), p = JSON.parse(row.state);
  assert.ok(p.stages.CH10.cleared && p.parts.PART_L2.copies === 80 && p.pets.length === 4 && p.petCopies.otter === 80 && p.coins === 999999 && p.testAccount);
  assert.equal(env.DB.sql.prepare("SELECT COUNT(*) c FROM guardian_profiles WHERE user_id='student1' AND state LIKE '%testAccount%'").get().c, 0);
});

test('보급권 지급: 선생님은 학생 한 명씩(보급권·코인·이용권), 모두에게 한 번에는 최고 관리자만 — 같은 요청은 두 번 지급되지 않는다', async () => {
  const env = await makeEnv();
  for (const id of ['학생가', '학생나']) assert.equal((await call(env, '/register', { body: { id, pw: '1234' } })).status, 200);
  const o = (await call(env, '/admin/login', { body: OWNER })).token, t = (await call(env, '/admin/login', { body: TEACHER })).token;
  const gifts = (id) => JSON.parse(env.DB.sql.prepare('SELECT state FROM guardian_profiles WHERE user_id=?').get(id)?.state || '{}').gifts || 0;
  // 선생님: 모두에게 한 번에(all, 또는 아이디 없음)는 거절, 아무것도 바뀌지 않음
  for (const body of [{ all: true, gifts: 3 }, { gifts: 3 }]) {
    const r = await call(env, '/admin/grant-passes', { token: t, body: { requestId: uid(), note: '전체', ...body } });
    assert.equal(r.status, 403, JSON.stringify(body)); assert.match(r.error, /최고 관리자만/);
  }
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) c FROM play_admin_gift_grants').get().c, 0);
  // 선생님: 학생 한 명에게 보급권 3장(같은 요청 번호로 두 번 보내도 한 번만)
  const req = { requestId: uid(), id: '학생가', gifts: 3, note: '발표 보상' };
  assert.equal((await call(env, '/admin/grant-passes', { token: t, body: req })).status, 200);
  assert.equal((await call(env, '/admin/grant-passes', { token: t, body: req })).status, 200);
  assert.equal(gifts('학생가'), 3); assert.equal(gifts('학생나'), 0);
  const audit = (await call(env, '/admin/passes', { token: t })).audit;
  assert.equal(audit[0].gifts, 3); assert.equal(audit[0].passes, 0); assert.equal(audit[0].note, '[선생님] 발표 보상');
  assert.equal((await call(env, '/admin/grant-passes', { token: t, body: { requestId: uid(), id: '학생가', gifts: 101 } })).status, 400, '보급권은 100장까지');
  // 최고 관리자: 모두에게 보급권 2장 + 코인 50을 한 요청으로
  const all = await call(env, '/admin/grant-passes', { token: o, body: { requestId: uid(), all: true, gifts: 2, gold: 50, note: '전체 보상' } });
  assert.equal(all.status, 200); assert.equal(all.count, 2); assert.equal(all.gifts, 2);
  assert.equal(gifts('학생가'), 5); assert.equal(gifts('학생나'), 2);
  const a2 = (await call(env, '/admin/passes', { token: o })).audit.filter((a) => a.note === '전체 보상');
  assert.equal(a2.length, 2); assert.ok(a2.every((a) => a.gifts === 2 && a.gold === 50));
  const stats = await call(env, '/admin/stats', { token: t });
  assert.equal(stats.users.find((u) => u.id === '학생가').gifts, 5, '학생 목록에 지금 보급권');
});
