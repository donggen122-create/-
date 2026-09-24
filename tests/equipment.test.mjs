// 장비(2026-09-24, docs/34): 6칸 · 성별마다 원거리/근거리 세트 · 2·4·6 세트 효과 · 5등급 + 합성 · 특수 효과 · 가입 때 성별 고정 · 같은 성별만 뽑기.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as R from '../game/src/rework-core.js';
import worker from '../server/src/index.js';
import { migrate, getProfile } from '../server/src/guardian.js';

const rngSeed = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function hero(h = 'hoya', gifts = 50) { let p = R.freshProfile(); p.stages.CH01 = { cleared: true, stars: 1 }; p.gifts = gifts; p = R.action(p, { kind: 'choose-hero', hero: h }).profile; return p; }
const act = (p, a, rng = Math.random) => R.action(p, a, rng, { day: '2026-09-24' });

test('data: 24 items, 12 per hero, every slot once per set; boys and girls get identical numbers for the same role', () => {
  assert.equal(Object.keys(R.GEAR).length, 24);
  for (const h of ['hoya', 'minji']) assert.equal(R.gearIdsFor(h).length, 12);
  for (const set of Object.keys(R.GEAR_SETS)) assert.deepEqual(R.GEAR_SLOTS.map((s) => R.GEAR[`${set}_${s}`]?.slot), R.GEAR_SLOTS);
  for (const type of ['ranged', 'melee']) for (const slot of R.GEAR_SLOTS) {
    const a = R.GEAR[`hoya_${type}_${slot}`], b = R.GEAR[`minji_${type}_${slot}`];
    assert.deepEqual(a.base, b.base); assert.deepEqual(a.special, b.special); assert.notEqual(a.name, b.name === a.name ? '' : b.name);
  }
  assert.equal(R.GEAR.hoya_ranged_weapon.name, '강속구 야구 배트'); assert.equal(R.GEAR.minji_ranged_weapon.name, '번개 피구공');
  assert.equal(R.GEAR.hoya_melee_weapon.name, '목검'); assert.equal(R.GEAR.minji_melee_weapon.name, '왕 연필');
});

test('hero is chosen once at sign-up and locked; old players who already played are locked to their current hero', () => {
  const fresh = R.freshProfile(); assert.equal(R.heroLocked(fresh), false);
  const p = R.action(fresh, { kind: 'choose-hero', hero: 'minji' }).profile; assert.equal(p.hero, 'minji'); assert.equal(R.heroLocked(p), true);
  assert.throws(() => R.action(p, { kind: 'choose-hero', hero: 'hoya' }), /이미 정해졌/);
  assert.throws(() => R.action(p, { kind: 'settings', hero: 'hoya' }), /가입할 때 정해져/);
  assert.equal(R.action(p, { kind: 'settings', difficulty: 'normal' }).profile.difficulty, 'normal', '다른 설정은 그대로 바꿀 수 있다');
  const old = { ...R.freshProfile(), runs: 3, hero: 'minji' }; delete old.heroLocked; assert.equal(R.heroLocked(old), true, '한 판이라도 한 옛 학생은 지금 캐릭터로 고정');
  const unplayed = { ...R.freshProfile(), runs: 0 }; delete unplayed.heroLocked; assert.equal(R.heroLocked(unplayed), false, '안 해 본 옛 학생은 처음에 고른다');
});

test('first free gear: one normal weapon of my hero, equipped, and it decides melee/ranged', () => {
  let p = hero('hoya');
  assert.throws(() => act(p, { kind: 'choose-first-gear', id: 'minji_ranged_weapon' }), /고를 수 있는 무기가 아니/);
  assert.throws(() => act(p, { kind: 'choose-first-gear', id: 'hoya_ranged_helm' }), /고를 수 있는 무기가 아니/);
  p = act(p, { kind: 'choose-first-gear', id: 'hoya_melee_weapon' }).profile;
  assert.equal(p.gear.hoya_melee_weapon.copies, 1); assert.equal(R.gearGrade(p, 'hoya_melee_weapon'), 0); assert.equal(p.equippedGear.weapon, 'hoya_melee_weapon'); assert.equal(p.weaponMode, 'melee');
  assert.throws(() => act(p, { kind: 'choose-first-gear', id: 'hoya_ranged_weapon' }), /이미 받았/);
  assert.throws(() => act(p, { kind: 'settings', weaponMode: 'ranged' }), /근거리 무기/);
});

test('gear supply: only my gender, one ticket, 1/3/7 luck, legendary items leave the pool', () => {
  for (const h of ['hoya', 'minji']) {
    let p = hero(h, 400); const rng = rngSeed(7), qty = {};
    for (let i = 0; i < 300; i++) { const r = act(p, { kind: 'draw-gear' }, rng); p = r.profile; assert.equal(R.GEAR[r.draw.id].hero, h); qty[r.draw.qty] = (qty[r.draw.qty] || 0) + 1; }
    assert.equal(p.gifts, 100); assert.equal(p.giftCounts.gear, 300); assert.ok(qty[1] > 200 && qty[3] > 25, JSON.stringify(qty));
  }
  let p = hero('minji', 5); for (const id of R.gearIdsFor('minji').slice(1)) p.gear[id] = { copies: 80, grade: 4 };
  for (let i = 0; i < 3; i++) { const r = act(p, { kind: 'draw-gear' }); p = r.profile; assert.equal(r.draw.id, R.gearIdsFor('minji')[0], '전설(80개)이 된 장비는 안 나온다'); }
  p.gear[R.gearIdsFor('minji')[0]] = { copies: 80, grade: 4 }; assert.throws(() => act(p, { kind: 'draw-gear' }), /모든 장비가 전설/);
  assert.throws(() => act({ ...hero(), gifts: 0 }, { kind: 'draw-gear' }), /보급권이 더 필요/);
  const locked = R.freshProfile(); locked.stages.CH01 = { cleared: true }; locked.gifts = 3; assert.throws(() => act(locked, { kind: 'draw-gear' }), /캐릭터를 골라/);
});

test('merge: grade goes up only when copies reach 3 / 7 / 25 / 80, copies stay', () => {
  let p = hero(); const id = 'hoya_ranged_armor'; p.gear[id] = { copies: 2, grade: 0 };
  assert.equal(R.gearMergeReady(p, id), false); assert.throws(() => act(p, { kind: 'merge-gear', id }), /3개 모으면/);
  for (const [copies, next] of [[3, 1], [7, 2], [25, 3], [80, 4]]) {
    p.gear[id].copies = copies; assert.equal(R.gearMergeReady(p, id), true);
    p = act(p, { kind: 'merge-gear', id }).profile; assert.equal(R.gearGrade(p, id), next); assert.equal(p.gear[id].copies, copies);
  }
  assert.equal(R.gearMergeReady(p, id), false, '전설 다음은 없음');
});

test('bonuses: base stats x grade, set bonuses at 2/4/6, specials from unique (1) to legend (3); other gender gear is ignored', () => {
  let p = hero('minji');
  for (const slot of R.GEAR_SLOTS) { const id = `minji_ranged_${slot}`; p.gear[id] = { copies: 80, grade: 4 }; p = act(p, { kind: 'equip-gear', id }).profile; }
  const g = R.gearBonuses(p);
  assert.ok(Math.abs(g.stats.critPct - .08) < 1e-9); assert.ok(Math.abs(g.stats.hpPct - .20) < 1e-9, '갑옷 5% × 전설 4'); assert.ok(Math.abs(g.stats.speedPct - (.08 + .05)) < 1e-9, '신발 8% + 2세트 5%'); assert.ok(Math.abs(g.stats.weaponDmgPct - .40) < 1e-9);
  assert.ok(Math.abs(g.stats.weaponRangePct - (.16 + .15)) < 1e-9, '무기 16% + 2세트 15%'); assert.ok(Math.abs(g.stats.dmgPct - (.12 + .10)) < 1e-9, '목걸이 12% + 4세트 10%');
  assert.equal(g.stats.pierce, 1); assert.equal(g.sets.minji_ranged, 6);
  assert.deepEqual(Object.keys(g.specials).sort(), ['catch', 'cheer', 'fastball', 'focus', 'steal', 'sturdy']); assert.ok(Object.values(g.specials).every((t) => t === 3));
  const b = R.bonuses(p); assert.ok(b.hpPct >= .16); assert.deepEqual(b.gearSpecials, g.specials);
  // 등급 낮으면 특수 효과 없음, 세트 2개면 2세트만
  let q = hero('hoya'); q.gear.hoya_melee_armor = { copies: 1, grade: 0 }; q.gear.hoya_melee_helm = { copies: 7, grade: 2 };
  q = act(act(q, { kind: 'equip-gear', id: 'hoya_melee_armor' }).profile, { kind: 'equip-gear', id: 'hoya_melee_helm' }).profile;
  const h = R.gearBonuses(q); assert.ok(Math.abs(h.stats.hpPct - (.06 + .15)) < 1e-9); assert.ok(!('takenPct' in h.stats) || Math.abs(h.stats.takenPct + .04) < 1e-9);
  assert.deepEqual(h.specials, { calm: 1 });
  assert.throws(() => act(q, { kind: 'equip-gear', id: 'minji_melee_helm' }), /아직 없는|내 캐릭터/);
  q.gear.minji_melee_helm = { copies: 1, grade: 0 }; assert.throws(() => act(q, { kind: 'equip-gear', id: 'minji_melee_helm' }), /내 캐릭터 장비가 아니/);
  q = act(q, { kind: 'unequip-gear', slot: 'helm' }).profile; assert.equal(q.equippedGear.helm, undefined);
});

// ---- 서버: 관리 API로 캐릭터 바꾸기(선생님도 가능, 장비가 없을 때만) ----
class D1 {
  constructor() { this.sql = new DatabaseSync(':memory:'); this.sql.exec(fs.readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8')); }
  prepare(sql) { const db = this; return { args: [], bind(...args) { this.args = args; return this; }, async first() { return db.sql.prepare(sql).get(...this.args) || null; }, async all() { return { results: db.sql.prepare(sql).all(...this.args) }; }, async run() { const r = db.sql.prepare(sql).run(...this.args); return { meta: { changes: Number(r.changes) }, success: true }; } }; }
  async batch(statements) { this.sql.exec('BEGIN IMMEDIATE'); try { const out = []; for (const s of statements) out.push(await s.run()); this.sql.exec('COMMIT'); return out; } catch (e) { this.sql.exec('ROLLBACK'); throw e; } }
}
const OWNER = { id: 'test-school', pw: 'owner-secret-pw' }, TEACHER = { id: 'test-school', pw: 'teacher-pin' };
let ipSeq = 0;
async function call(env, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': `10.1.0.${(ipSeq++ % 200) + 1}` }; if (token) headers['X-Admin-Token'] = token;
  const res = await worker.fetch(new Request('http://local/api' + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }), env);
  let data = {}; try { data = await res.json(); } catch {} return { status: res.status, ...data };
}
test('admin set-hero: teacher can change a locked hero when the student has no gear (or only the free weapon)', async () => {
  const DB = new D1(); await migrate(DB);
  const env = { DB, ADMIN_KEY: 'test-only-admin-key-0123456789', ADMIN_ID: OWNER.id, ADMIN_PW: OWNER.pw, TEACHER_ID: TEACHER.id, TEACHER_PW: TEACHER.pw, ASSETS: { fetch: async () => new Response('', { status: 404 }) } };
  assert.equal((await call(env, '/register', { body: { id: 'kid1', pw: 'pw-1234' } })).status, 200);
  const teacher = (await call(env, '/admin/login', { body: TEACHER })).token;
  await getProfile(DB, 'kid1');
  const row = JSON.parse(DB.sql.prepare("SELECT state FROM guardian_profiles WHERE user_id='kid1'").get().state);
  DB.sql.prepare("UPDATE guardian_profiles SET state=? WHERE user_id='kid1'").run(JSON.stringify({ ...row, hero: 'hoya', heroLocked: true }));
  const r = await call(env, '/admin/set-hero', { token: teacher, body: { id: 'kid1', hero: 'minji' } }); assert.equal(r.status, 200); assert.equal(r.hero, 'minji');
  const p = JSON.parse(DB.sql.prepare("SELECT state FROM guardian_profiles WHERE user_id='kid1'").get().state); assert.equal(p.hero, 'minji'); assert.equal(p.heroLocked, true);
  DB.sql.prepare("UPDATE guardian_profiles SET state=? WHERE user_id='kid1'").run(JSON.stringify({ ...p, gear: { minji_melee_helm: { copies: 1, grade: 0 } } }));
  assert.equal((await call(env, '/admin/set-hero', { token: teacher, body: { id: 'kid1', hero: 'hoya' } })).status, 400, '장비가 있으면 못 바꿈');
  assert.equal((await call(env, '/admin/set-hero', { token: teacher, body: { id: 'nobody', hero: 'hoya' } })).status, 404);
  // 첫 무료 무기 1개만 있으면 새 캐릭터의 같은 종류 무기로 바꿔 준다
  DB.sql.prepare("UPDATE guardian_profiles SET state=? WHERE user_id='kid1'").run(JSON.stringify({ ...p, gear: { minji_ranged_weapon: { copies: 1, grade: 0 } }, equippedGear: { weapon: 'minji_ranged_weapon' }, weaponMode: 'ranged' }));
  assert.equal((await call(env, '/admin/set-hero', { token: teacher, body: { id: 'kid1', hero: 'hoya' } })).status, 200);
  const q = JSON.parse(DB.sql.prepare("SELECT state FROM guardian_profiles WHERE user_id='kid1'").get().state);
  assert.equal(q.hero, 'hoya'); assert.deepEqual(q.gear, { hoya_ranged_weapon: { copies: 1, grade: 0 } }); assert.deepEqual(q.equippedGear, { weapon: 'hoya_ranged_weapon' });
});
