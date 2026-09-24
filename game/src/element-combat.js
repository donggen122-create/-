// 원소 스킬 전투 엔진 v3 — 스킬 10 · 진화 10 (docs/22). 주인공 기본 무기는 weapon-effects.js, 그림은 element-effects.js.
// 2026-09-23 밀도 조정: 발동 간격 40% 단축, Lv.2/3마다 개수 +1, 범위 ×1.2, 폭발마다 화면 흔들림(onBlast).
// 피해 = 주인공 공격력 × 스킬 계수 × 레벨 배수(1/1.4/1.9) × 파츠/세트 배수 × 지원품(불꽃 고추). 범위는 지원품(큰 물통)·파츠·레벨로 커진다.
import * as R from './rework-core.js';
import { SKILLS, COMBOS, LEVEL_DAMAGE, RUN_RULES } from './element-content.js';
import { drawElementScene } from './element-effects.js';

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const turn = a => Math.atan2(Math.sin(a), Math.cos(a));
const segmentDistance = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
export const DEF = { ...SKILLS, ...COMBOS };
export const SIZE_BONUS_CAP = .35;   // 스킬 크기 보너스 상한(+35%). 넘치는 보너스는 절반만큼 피해로(아래 area·sizeDmg)
export const COMBAT_TUNING = Object.fromEntries(Object.entries(DEF).map(([id, d]) => [id, d.interval]));

export function elementDamageMultiplier(profile, id) { return R.skillDamageMultiplier ? R.skillDamageMultiplier(profile, id) : 1; }

export function createElementCombat({ U = 32, getPlayer, getEnemies, getBoss = () => null, getProfile = () => ({}), damage, projectiles = () => [], getMods = () => ({ dmgMul: 1, areaMul: 1, intervalMul: 1 }), onBlast = null }) {
  // claimed: 같은 방향 중복 방지용 "방금 노린 적" 기록(아래 설명)
  let clock = 0, shots = [], fields = [], effects = [], scheduled = [], orbits = [], mines = [], bees = [], beams = [], seen = new Set(), claimed = new Map(), stats;
  function reset() { clock = 0; shots = []; fields = []; effects = []; scheduled = []; orbits = []; mines = []; bees = []; beams = []; seen = new Set(); claimed = new Map(); stats = { casts: {}, hits: {}, damage: {}, parts: {} }; }
  reset();
  const player = () => getPlayer();
  const mods = () => getMods() || {};
  const alive = () => { const b = getBoss(); return [...(getEnemies() || []), ...(b && !(getEnemies() || []).includes(b) ? [b] : [])].filter(e => e.hp > 0); };
  // 순수하게 가장 가까운 적(유도 로켓·물풍선 튕김·지뢰 추적용 — 노린 적 기록과 무관)
  const closest = (at, range, exclude = null) => alive().filter(e => !(exclude && exclude.has(e)) && dist(e, at) <= range + (e.radiusU || .45) * U).sort((a, b) => dist(a, at) - dist(b, at))[0];
  // 같은 방향 중복 방지(2026-09-23 사용자: "스킬들이 같은 방향으로 겹쳐 날아가지 않게"): 방금(0.7초 안) 다른 스킬이 노린 적은 3칸 더 먼 것처럼 취급해
  // 다음 스킬은 다른 적·다른 방향을 고른다. 한 스킬이 여러 개를 쏠 때도 pickAngles/spreadSpots로 각각 다른 적을 노린다.
  const claim = e => { if (e) claimed.set(e, clock); return e; };
  const penalty = e => { const t = claimed.get(e); return t !== undefined && clock - t < .7 ? 3 * U : 0; };
  const rank = at => (a, b) => dist(a, at) + penalty(a) - dist(b, at) - penalty(b);
  const nearest = (at = player(), range = 13 * U, exclude = null) => alive().filter(e => !(exclude && exclude.has(e)) && dist(e, at) <= range + (e.radiusU || .45) * U).sort(rank(at))[0];
  function groupTarget(at = player(), range = 12 * U) {
    const c = alive().filter(e => dist(e, at) <= range).sort(rank(at)); let best = c[0], score = -Infinity;
    for (const x of c.slice(0, 24)) { const n = c.reduce((k, e) => k + (dist(e, x) <= 2 * U ? 1 : 0), 0) - (penalty(x) ? 2 : 0); if (n > score) { best = x; score = n; } }
    return best;
  }
  // n발을 쏠 각도: 가까운 순으로 서로 다른 적(각도 차 0.3 이상)을 고르고, 적이 모자라면 base 좌우로 step씩 벌린다
  function pickAngles(n, at, base, step, range = 14 * U) {
    const angles = [], min = Math.min(step, .3), ok = a => angles.every(b => Math.abs(turn(a - b)) >= min);
    for (const e of alive().filter(e => dist(e, at) <= range).sort(rank(at))) { if (angles.length >= n) break; const a = angleTo(at, e); if (ok(a)) { angles.push(a); claim(e); } }
    for (let k = 0; angles.length < n && k < 16; k++) { const a = base + Math.ceil(k / 2) * step * (k % 2 ? -1 : 1); if (ok(a)) angles.push(a); }
    while (angles.length < n) angles.push(base + angles.length * step);
    return angles;
  }
  // 땅에 떨어지는 스킬(불꽃병·화산 폭탄·번개 구름)의 자리 n곳: 첫 자리는 가장 뭉친 무리, 나머지는 gap 이상 떨어진 다른 적. 모자라면 옆으로 gap×0.75씩.
  // pull: 무리에서 주인공 쪽으로 당겨 떨어뜨리는 비율(불꽃병 0.35 — 적이 걸어 들어오게, 번개는 0 = 적 머리 위)
  function spreadSpots(n, fallback, pull, gap) {
    const p = player(), land = t => pull && dist(t, p) < 1.5 * U ? { x: p.x, y: p.y } : { x: t.x + (p.x - t.x) * pull, y: t.y + (p.y - t.y) * pull };
    const g = groupTarget() || fallback; if (!g) return [];
    const spots = [land(claim(g))], ga = angleTo(p, g);
    for (const t of alive().filter(x => x !== g && dist(x, p) <= 12 * U).sort(rank(p))) { if (spots.length >= n) break; const s = land(t); if (spots.every(q => dist(q, s) >= gap)) { spots.push(s); claim(t); } }
    for (let k = 1; spots.length < n; k++) { const off = Math.ceil(k / 2) * gap * .75 * (k % 2 ? 1 : -1); spots.push({ x: spots[0].x + Math.cos(ga + Math.PI / 2) * off, y: spots[0].y + Math.sin(ga + Math.PI / 2) * off }); }
    return spots;
  }
  const baseId = id => COMBOS[id] ? COMBOS[id].skill : id;
  const part = id => !!R.hasPart?.(getProfile(), baseId(id));
  const feature = id => part(id) ? R.PARTS[`PART_${baseId(id)}`]?.feature : null;
  const markPart = id => { stats.parts[id] = (stats.parts[id] || 0) + 1; };
  // 유니크 등급(같은 파츠 7개, 옛 금 메달) 기능(docs/26·27): 일반·진화 양쪽. 추가 공격은 원래보다 약하고, 추가로 생긴 것은 다시 추가를 만들지 않는다(small/sub).
  const gold = id => part(id) && !!R.hasGold?.(getProfile(), baseId(id));
  // 등급 능력: 에픽부터 유니크 기능 강화(gp = 2 → 추가 공격 피해 2배·길 1.5배·탄환 없애기 더 자주), 전설은 한 번 더 발동, 발동 간격은 등급별 배수
  const pgrade = id => (R.partGrade ? R.partGrade(getProfile(), baseId(id)) : -1);
  const gp = id => (pgrade(id) >= 3 ? 2 : 1);
  const legend = id => pgrade(id) >= 4;
  const pint = id => (R.partIntervalMul ? R.partIntervalMul(getProfile(), baseId(id)) : 1);
  const trail = (id, at, r, life) => { life *= gp(id) > 1 ? 1.5 : 1; return field(id, at, r, 0, { kind: 'trail', life, tickS: .3, maxTicks: Math.ceil(life / .3), onTick: f => { for (const e of within(f, f.r)) slow(e, .6, .5); } }); };
  const MAXLV = RUN_RULES.maxSkillLevel;
  const lv = id => clamp(player().skills?.[id]?.lv || 1, 1, MAXLV);
  const level = id => COMBOS[id] ? LEVEL_DAMAGE[LEVEL_DAMAGE.length - 1] : LEVEL_DAMAGE[lv(id) - 1];
  const count = (id, base, step = 1) => COMBOS[id] ? base : base + (lv(id) - 1) * step;     // Lv.2·Lv.3마다 개수 +step
  // 크기(2026-09-24 사용자 "오브젝트들이 너무 커지기만 한다, 두더지 폭발이 무식하게 크다"): 크기 보너스(큰 물통·물범이·진화·단계·넓히는 파츠)를
  // 곱하지 않고 더해서 크기는 최대 +35%까지만, 넘치는 보너스는 그 절반만큼 피해로 바꾼다.
  // 예) 두더지 폭탄밭 + 큰 물통 3단계 + 물범이 + 파츠: 전에는 크기 ×2.65(폭발 반지름 6.4칸) → 이제 크기 ×1.35(2.8칸)·피해 ×1.43
  const partSize = id => { const f = feature(id); return f === 'mineWider' ? .3 : f === 'widerOrbit' ? .25 : f === 'homing' && COMBOS[id] ? .15 : 0; };
  const sizeBonus = id => (mods().areaMul || 1) - 1 + (COMBOS[id] ? .2 : (lv(id) - 1) * .08) + partSize(id);
  const area = id => 1 + Math.min(SIZE_BONUS_CAP, sizeBonus(id));
  const sizeDmg = id => 1 + Math.max(0, sizeBonus(id) - SIZE_BONUS_CAP) * .5;
  const element = id => DEF[id]?.element || 'wind';
  function fx(kind, at, r, id, extra = {}) { effects.push({ kind, x: at.x, y: at.y, r, element: element(id), life: .4, maxLife: .4, ...extra }); if (effects.length > 140) effects.splice(0, effects.length - 140); }
  function after(delay, fn) { if (scheduled.length < 260) scheduled.push({ at: clock + delay, fn }); }
  function hit(id, e, coef, at = player(), knock = 0) {
    if (!e || e.hp <= 0 || coef <= 0) return;
    const amount = Math.max(0, player().atk || 30) * coef * level(id) * elementDamageMultiplier(getProfile(), id) * (mods().dmgMul || 1) * sizeDmg(id);
    damage(e, amount, { x: e.x - at.x, y: e.y - at.y }, knock, element(id));   // 5번째 인자 = 원소(어려움의 저항 적 판정)
    stats.hits[id] = (stats.hits[id] || 0) + 1; stats.damage[id] = (stats.damage[id] || 0) + amount;
  }
  function slow(e, mul = .7, seconds = 1.5) { if (e === getBoss()) return; e.v2SlowT = Math.max(e.v2SlowT || 0, seconds); e.v2SlowMul = Math.min(e.v2SlowMul || 1, mul); }
  const within = (at, r) => alive().filter(e => dist(e, at) <= r + (e.radiusU || .45) * U);
  function blast(id, at, r, coef, { knock = .2, kind = 'boom', extra = {}, big = false } = {}) {
    fx(kind, at, r, id, extra); fx('sparks', at, r, id, { life: .45, maxLife: .45 });
    onBlast?.(at, r, big || r >= 1.8 * U);
    for (const e of within(at, r)) hit(id, e, coef, at, knock);
  }
  function shot(id, at, a, coef, options = {}) {
    const s = { id, x: at.x, y: at.y, angle: a, speed: 10 * U, r: .3 * U * area(id), life: 1.3, age: 0, coef, hit: new Set(), maxHits: 1, trail: [], element: element(id), kind: 'stone', ...options };
    shots.push(s); if (shots.length > 120) shots.splice(0, shots.length - 120); return s;
  }
  // 장판(불 웅덩이·용암·천둥 장판)은 범위 보너스를 절반만 받는다 — 큰 물통·레벨이 겹쳐도 화면을 덮지 않게(2026-09-23)
  function field(id, at, r, coef, options = {}) {
    const f = { id, x: at.x, y: at.y, r: r * (1 + (area(id) - 1) * .5), coef, life: 3, age: 0, tick: 0, tickS: .5, maxTicks: 6, ticks: 0, kind: 'puddle', element: element(id), ...options };
    fields.push(f); if (fields.length > 48) fields.splice(0, fields.length - 48); return f;
  }

  // ---------- 스킬별 발동 ----------
  function cast(id) {
    const d = DEF[id]; if (!d) return false;
    const p = player(), kind = d.kind;
    if (['orbit', 'typhoon', 'bee', 'swarm'].includes(kind)) return true;   // 상시 동작(아래 update에서)
    const e = nearest(p, 14 * U), a = e ? angleTo(p, e) : (p.aimAngle || 0);
    if (kind === 'mine' || kind === 'molefield') {
      // 적이 오는 길목에 심는다(가장 가까운 적 방향 ±35°, 1.6~3.2칸). 적이 가까이(1.2칸) 오면 터진다 — 밟아야만 터지던 것을 고침(적중률)
      const max = kind === 'molefield' ? 12 : count(id, 4, 2); if (mines.filter(m => m.id === id).length >= max) return false;
      const ang = e ? a + (Math.random() - .5) * 1.2 : Math.random() * TAU, r = (1.6 + Math.random() * 1.6) * U; claim(e);
      mines.push({ id, x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r, life: 25, age: 0, kind: kind === 'molefield' ? 'molemine' : 'mine', element: element(id), coef: d.dmgCoef, r: (kind === 'molefield' ? 2.1 : 1.9) * U * area(id) });   // 폭탄밭 2.4→2.1칸(연쇄로 여러 개가 한꺼번에 터진다)
      stats.casts[id] = (stats.casts[id] || 0) + 1; return true;
    }
    if (!e) return false;
    stats.casts[id] = (stats.casts[id] || 0) + 1;
    switch (kind) {
      case 'bottle': case 'volcano': {
        // 적은 주인공 쪽으로 몰려오므로 무리와 주인공 사이에 떨어뜨리고 웅덩이를 오래(4초) 남긴다 — 적중률. 병마다 다른 무리를 노린다(spreadSpots).
        // 2026-09-23 조정: 웅덩이 반지름 2.0→1.4칸(화산 2.6→1.7칸, 화산 폭발 2.1→1.7칸), 범위 보너스는 절반만(field) + 그림은 반투명(element-effects) — 주인공·바닥이 가려지지 않게
        const n = kind === 'volcano' ? 3 : count(id, 1);
        for (const dest of spreadSpots(n, e, .35, 2.4 * U)) {
          const flight = .4; const s = shot(id, p, angleTo(p, dest), 0, { kind, speed: Math.max(1, dist(p, dest)) / flight, life: flight, flight, lob: true, maxHits: 0, noContact: true, r: .45 * U });
          s.onExpire = () => {
            const r = (kind === 'volcano' ? 1.7 : 1.4) * U, life = (kind === 'volcano' ? 5 : 4) + (feature(id) === 'puddleLonger' ? 1 : 0);
            if (feature(id) === 'puddleLonger') markPart(id);
            if (kind === 'volcano') blast(id, s, 1.7 * U * area(id), 1.6, { kind: 'boom', knock: .35, big: true });
            else blast(id, s, 1.0 * U * area(id), d.dmgCoef * 1.2, { kind: 'splashfire', knock: .1 });
            const burst = gold(id) ? f => { if (f.ticks % 3) return; const t = within(f, f.r)[0]; if (!t) return; markPart(id); blast(id, t, .8 * U, d.dmgCoef * .5 * gp(id), { kind: 'splashfire', knock: .05 }); } : null;
            field(id, s, r, d.dmgCoef, { kind: kind === 'volcano' ? 'lava' : 'puddle', life, maxTicks: Math.round(life / .4), tickS: .4, onTick: burst });
          };
        }
        break;
      }
      case 'rocket': case 'firework': {
        const n = kind === 'firework' ? 3 : count(id, 1);
        pickAngles(n, p, a, .5).forEach((ang, i) => after(i * .1, () => {   // 로켓마다 다른 적·다른 방향
          const s = shot(id, player(), ang, 0, { kind: kind === 'firework' ? 'frocket' : 'rocket', speed: 10 * U, r: .35 * U, life: 1.6, homing: feature(id) === 'homing' || kind === 'firework', maxHits: 1, noDirect: true });
          // 유도 기능은 실제 방향을 바꿀 때만 센다. 진화판은 폭발 크기로 구분한다.
          s.onHit = (t2, s2) => {
            if (kind === 'firework' && feature(id) === 'homing') markPart(id);
            blast(id, s2, (kind === 'firework' ? 2.2 : 1.8) * U * area(id), d.dmgCoef, { kind: kind === 'firework' ? 'fwork' : 'boom', knock: .4, big: kind === 'firework' });
            if (kind === 'firework') for (let k = 0; k < 6; k++) shot(id, s2, k / 6 * TAU + Math.random() * .3, .45, { kind: 'sparkshot', speed: 8 * U, life: .4, r: .3 * U, maxHits: 1 });
            const t3 = gold(id) && !s2.sub ? closest(s2, 7 * U, new Set([t2])) : null;
            if (t3) { markPart(id); shot(id, s2, angleTo(s2, t3), 0, { kind: 'rocket', speed: 11 * U, r: .25 * U, life: 1.2, homing: true, partGuided: true, maxHits: 1, noDirect: true, sub: true, onHit: (t4, s4) => blast(id, s4, 1.1 * U * area(id), d.dmgCoef * .5 * gp(id), { kind: 'boom', knock: .2 }) }); }
          };
        }));
        break;
      }
      case 'balloon': case 'kballoon': {
        const n = kind === 'kballoon' ? 2 : count(id, 1), big = kind === 'kballoon';
        for (const ang of pickAngles(n, p, a, big ? .7 : .6)) shot(id, p, ang, d.dmgCoef, { kind, speed: 8 * U, r: (big ? .85 : .55) * U, life: 5, maxHits: 99, bounces: (big ? 10 : 5) + (feature(id) === 'extraBounce' ? 2 : 0), knock: .15, onHit: (t, s) => {
          if (feature(id) === 'extraBounce' && s.bounces <= 2) markPart(id);
          blast(id, s, (big ? 1.8 : 1.2) * U * area(id), d.dmgCoef * .6, { kind: big ? 'ksplash' : 'splash', knock: .15 }); slow(t, .65, big ? 3 : 1.5);
          s.bounces--;
          if (s.bounces <= 0) {
            s.life = 0;
            if (gold(id) && !s.small) { markPart(id); for (const dd of [-.8, .8]) shot(id, s, s.angle + Math.PI + dd, d.dmgCoef * .4 * gp(id), { kind: 'balloon', speed: 8 * U, r: .35 * U, life: 1.5, maxHits: 99, bounces: 1, small: true, knock: .1, onHit: (t3, s3) => { blast(id, s3, .8 * U * area(id), d.dmgCoef * .25 * gp(id), { kind: 'splash', knock: .1 }); slow(t3, .7, 1); s3.life = 0; } }); }
            return;
          }
          const next = closest(s, 8 * U, s.hit); if (next) s.angle = angleTo(s, next); else s.angle += Math.PI + (Math.random() - .5);
          if (s.hit.size >= 6) s.hit.clear();
        } });
        break;
      }
      case 'beam': case 'rbeam': {
        const big = kind === 'rbeam'; claim(e);
        beams.push({ id, angle: a, len: (big ? 7.5 : 6.5) * U, width: (big ? 1.8 : 1) * U * area(id), life: (big ? 1 : .45) + (feature(id) === 'longerBeam' ? .2 : 0) + (lv(id) >= 3 && !big ? .2 : 0), age: 0, tick: 0, tickS: big ? .15 : .1, coef: d.dmgCoef, kind, element: element(id), stun: big });
        if (feature(id) === 'longerBeam') markPart(id);
        break;
      }
      case 'boomerang': case 'mboomerang': {
        const n = kind === 'mboomerang' ? 4 : count(id, 1);
        for (const ang of pickAngles(n, p, a, .55)) {
          const s = shot(id, p, ang, d.dmgCoef, { kind, speed: 9 * U, r: (kind === 'mboomerang' ? .6 : .5) * U, life: 2.4, returnAt: .55, maxHits: 99, knock: .15, onHit: (t, s2) => { if (kind === 'mboomerang' && s2.returning && t !== getBoss()) { const pl = player(), l = dist(t, pl); if (l > U) { t.x += (pl.x - t.x) / l * .8 * U; t.y += (pl.y - t.y) / l * .8 * U; } fx('pull', t, .5 * U, id, { x0: pl.x, y0: pl.y, life: .25, maxLife: .25 }); } } });
          s.onReturn = () => { if (feature(id) === 'extraBlade') { markPart(id); shot(id, player(), s.angle + Math.PI, d.dmgCoef * .4, { kind: 'swirl', speed: 13 * U, life: .5, r: .35 * U, maxHits: 3 }); } };
        }
        if (gold(id)) { markPart(id); shot(id, p, a + .45, d.dmgCoef * .5 * gp(id), { kind: 'boomerang', speed: 9 * U, r: .35 * U, life: 2, returnAt: .5, maxHits: 99, knock: .1, small: true }); }
        break;
      }
      case 'stone': case 'boulder': {
        const n = kind === 'boulder' ? 2 : count(id, 1), big = kind === 'boulder';
        for (const ang of pickAngles(n, p, a, big ? .6 : .5)) shot(id, p, ang, d.dmgCoef, { kind, speed: (big ? 6.5 : 10) * U, r: (big ? .95 : .45) * U, life: big ? 1.7 : 1.3, maxHits: big ? 99 : 1, knock: big ? .35 : .7, onHit: (t, s) => {
          fx(big ? 'crack' : 'dust', t, (big ? 1 : .8) * U, id); fx('sparks', t, .6 * U, id, { life: .3, maxLife: .3 }); onBlast?.(t, .6 * U, false);
          if (!s.partSplitDone && feature(id) === 'splitStone') { s.partSplitDone = true; markPart(id); for (const dd of gold(id) ? [-.7, 0, .7] : [-.6, .6]) shot(id, s, s.angle + dd, d.dmgCoef * .4 * (gold(id) ? gp(id) : 1), { kind: 'stone', speed: 8 * U, r: .25 * U, life: .5, maxHits: 1, small: true }); }
        } });
        break;
      }
      case 'cloud': case 'storm': {
        // 구름마다 2.2칸 이상 떨어진 다른 적 머리 위(같은 자리에 겹쳐 떨어지지 않게)
        const n = kind === 'storm' ? 1 : count(id, 1);
        for (const at of spreadSpots(n, e, 0, 2.2 * U)) {
          if (kind === 'storm') { field(id, at, 1.9 * U, d.dmgCoef, { kind: 'storm', life: 3, tickS: .375, maxTicks: 8, knock: .15, onTick: f => { fx('tbolt', { x: f.x + (Math.random() - .5) * f.r, y: f.y + (Math.random() - .5) * f.r * .6 }, f.r, id, { life: .3, maxLife: .3 }); onBlast?.(f, f.r, false);
            if (feature(id) === 'doubleBolt') {
              const primary = closest(f, f.r), target = primary && closest(primary, 5 * U, new Set([primary]));
              if (target) { hit(id, target, d.dmgCoef * .3, f); markPart(id); fx('bolt', target, .7 * U, id, { life: .25, maxLife: .25 });
                const next = gold(id) && closest(target, 4 * U, new Set([primary, target])); if (next) { hit(id, next, d.dmgCoef * .3 * gp(id), target); fx('bolt', next, .7 * U, id, { life: .25, maxLife: .25 }); } }
            }
          } }); }
          else {
            fx('cloudmark', at, 1 * U, id, { life: .45, maxLife: .45 });
            after(.45, () => { blast(id, at, 1.5 * U * area(id), d.dmgCoef, { kind: 'bolt', knock: .25 }); if (feature(id) === 'doubleBolt') { after(.2, () => { blast(id, at, 1.5 * U * area(id), d.dmgCoef * .3, { kind: 'bolt' }); markPart(id);
              const next = gold(id) && closest(at, 4 * U, new Set(within(at, 1.5 * U * area(id)))); if (next) { hit(id, next, d.dmgCoef * .3 * gp(id), at); fx('bolt', next, .8 * U, id, { life: .25, maxLife: .25 }); } }); } });
          }
        }
        break;
      }
      default: return false;
    }
    return true;
  }

  // ---------- 상시 동작: 회오리 팽이·태풍, 벌 ----------
  function updateOrbits(dt) {
    const p = player(); orbits = [];
    for (const [id, st] of Object.entries(p.skills || {})) {
      const d = DEF[id]; if (!d || !['orbit', 'typhoon'].includes(d.kind)) continue;
      const big = d.kind === 'typhoon', n = (big ? 5 : count(id, 2)) + (legend(id) ? 2 : 0), radius = (big ? 2.3 : 1.7) * U * area(id), r = (big ? .95 : .6) * U;   // 넓히는 파츠는 area(partSize) 안에
      const interval = (big ? .35 : (lv(id) >= 3 ? .38 : .45)) * (mods().intervalMul || 1) * pint(id);
      st.v2OrbitHits ??= new Map();
      for (const [e, t] of st.v2OrbitHits) if (e.hp <= 0 || clock - t > 2) st.v2OrbitHits.delete(e);
      const spin = big ? 3.6 : (lv(id) >= 3 ? 3.3 : 2.8);
      for (let i = 0; i < n; i++) {
        const a = clock * spin + i * TAU / n, o = { id, x: p.x + Math.cos(a) * radius, y: p.y + Math.sin(a) * radius, r, angle: a, kind: big ? 'typhoon' : 'top', element: element(id) };
        orbits.push(o);
        for (const e of within(o, o.r)) if (clock - (st.v2OrbitHits.get(e) ?? -10) >= interval) { st.v2OrbitHits.set(e, clock); hit(id, e, d.dmgCoef, o, big ? .35 : .1); fx('swirl', e, .55 * U, id, { life: .25, maxLife: .25 }); }
      }
      if (big) { st.v2RingT = (st.v2RingT || 0) - dt; if (st.v2RingT <= 0) { st.v2RingT = 1.6; fx('windring', p, radius + r, id, { life: .5, maxLife: .5 }); onBlast?.(p, radius, true); for (const e of within(p, radius + r)) if (e !== getBoss()) { const l = dist(e, p) || 1; e.kbVx = (e.kbVx || 0) + (e.x - p.x) / l * 200; e.kbVy = (e.kbVy || 0) + (e.y - p.y) / l * 200; } } }
      if (feature(id) === 'widerOrbit' && !st.v2PartMarked) { st.v2PartMarked = true; markPart(id); }
      if (gold(id)) { st.v2GoldT = (st.v2GoldT || 0) - dt; if (st.v2GoldT <= 0) { const q = (projectiles() || []).find(x => x.hostile && !x.boss && x.life > 0 && dist(x, p) <= radius + r); if (q) { q.life = 0; markPart(id); fx('swirl', q, .7 * U, id, { life: .3, maxLife: .3 }); st.v2GoldT = gp(id) > 1 ? 2.5 : 4; } else st.v2GoldT = .2; } }
    }
  }
  function updateBees(dt) {
    const p = player(); const want = [];
    for (const [id] of Object.entries(p.skills || {})) { const d = DEF[id]; if (!d || !['bee', 'swarm'].includes(d.kind)) continue; const n = (d.kind === 'swarm' ? 5 : count(id, 1)) + (legend(id) ? 2 : 0); for (let i = 0; i < n; i++) want.push({ id, i, n, d }); }
    bees = bees.filter(b => want.some(w => w.id === b.id && w.i === b.i));
    for (const w of want) if (!bees.some(b => b.id === w.id && b.i === w.i)) bees.push({ id: w.id, i: w.i, x: p.x, y: p.y, cd: .3, kind: w.d.kind === 'swarm' ? 'swarmbee' : 'bee', element: element(w.id), wing: 0 });
    for (const b of bees) {
      const w = want.find(x => x.id === b.id && x.i === b.i), d = w.d, a = clock * 1.3 + b.i * TAU / w.n, tx = p.x + Math.cos(a) * 1.4 * U, ty = p.y + Math.sin(a) * 1.4 * U - .8 * U;
      b.x += (tx - b.x) * Math.min(1, dt * 6); b.y += (ty - b.y) * Math.min(1, dt * 6); b.wing += dt;
      b.cd -= dt; if (b.cd > 0) continue;
      const e = nearest(b, 9 * U); if (!e) { b.cd = .2; continue; } claim(e);   // 벌마다 다른 적
      const fast = feature(b.id) === 'fasterBee'; if (fast) markPart(b.id);
      b.cd = d.interval * (mods().intervalMul || 1) * (fast ? .75 : 1) * (lv(b.id) >= 3 && !COMBOS[b.id] ? .8 : 1) * pint(b.id);
      stats.casts[b.id] = (stats.casts[b.id] || 0) + 1;
      const zap = gold(b.id) && (b.stings = (b.stings || 0) + 1) % 8 === 0;
      shot(b.id, b, angleTo(b, e), d.dmgCoef, { kind: d.kind === 'swarm' ? 'hstinger' : 'stinger', speed: 13 * U, r: .28 * U, life: 1, maxHits: 1, homing: d.kind === 'swarm', onHit: t => { fx(d.kind === 'swarm' ? 'bigburst' : 'spark', t, (d.kind === 'swarm' ? 1 : .6) * U, b.id); fx('sparks', t, .5 * U, b.id, { life: .3, maxLife: .3 });
        const next = zap && closest(t, 4 * U, new Set([t])); if (next) { markPart(b.id); hit(b.id, next, d.dmgCoef * .6 * gp(b.id), t); fx('bolt', next, .6 * U, b.id, { life: .25, maxLife: .25 }); } } });
    }
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i], old = { x: s.x, y: s.y }; s.age += dt; s.life -= dt;
      if (s.homing && !s.returning) { const t = closest(s, 8 * U, s.hit); if (t) { const change = clamp(turn(angleTo(s, t) - s.angle), -3 * dt, 3 * dt); s.angle += change; if (s.kind === 'rocket' && !s.partGuided && Math.abs(change) > .0001 && feature(s.id) === 'homing') { s.partGuided = true; markPart(s.id); } } }
      if (s.returnAt && s.age >= s.returnAt) { if (!s.returning) { s.returning = true; s.hit.clear(); } s.angle = angleTo(s, player()); if (dist(s, player()) < .6 * U) { s.onReturn?.(); shots.splice(i, 1); continue; } }
      s.x += Math.cos(s.angle) * s.speed * dt; s.y += Math.sin(s.angle) * s.speed * dt;
      s.trail.push(old); if (s.trail.length > 6) s.trail.shift();
      let remove = s.life <= 0;
      if (!s.noContact) {
        const touched = alive().filter(e => !s.hit.has(e) && segmentDistance(e, old, s) <= s.r + (e.radiusU || .45) * U).sort((a, b) => dist(a, old) - dist(b, old));
        for (const e of touched) {
          s.hit.add(e);
          if (!s.noDirect) hit(s.id, e, s.coef, old, s.knock || 0);
          s.onHit?.(e, s); if (!s.onHit) fx('hit', e, .4 * U, s.id);
          if (s.life <= 0 || s.hit.size >= s.maxHits) { remove = true; break; }
        }
      }
      if (remove) { s.onExpire?.(); const k = shots.indexOf(s); if (k >= 0) shots.splice(k, 1); }
    }
  }
  function updateFields(dt) {
    for (let i = fields.length - 1; i >= 0; i--) {
      const f = fields[i]; f.age += dt; f.life -= dt; f.tick -= dt;
      if (f.tick <= 0 && f.ticks < f.maxTicks) { f.tick += f.tickS; f.ticks++; for (const e of within(f, f.r)) hit(f.id, e, f.coef, f, f.knock || 0); f.onTick?.(f); }
      if (f.life <= 0) { f.onExpire?.(); fields.splice(i, 1); }
    }
  }
  function updateBeams(dt) {
    const p = player();
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i]; b.age += dt; b.life -= dt; b.tick -= dt; b.x = p.x; b.y = p.y;
      if (b.tick <= 0) {
        b.tick += b.tickS; const end = { x: b.x + Math.cos(b.angle) * b.len, y: b.y + Math.sin(b.angle) * b.len };
        for (const e of alive()) if (segmentDistance(e, b, end) <= b.width / 2 + (e.radiusU || .45) * U) { hit(b.id, e, b.coef, b, .08); if (b.stun) slow(e, .05, .6); else slow(e, .75, .4); }
        if (!b.trailed && gold(b.id)) { b.trailed = true; markPart(b.id); for (const k of [.35, .65, .95]) trail(b.id, { x: b.x + Math.cos(b.angle) * b.len * k, y: b.y + Math.sin(b.angle) * b.len * k }, b.width * .7, 2); }
        fx(b.kind === 'rbeam' ? 'rspray' : 'spray', end, b.width, b.id, { life: .25, maxLife: .25 });
      }
      if (b.life <= 0) beams.splice(i, 1);
    }
  }
  function triggerMine(m, chain = false) {
    const k = mines.indexOf(m); if (k < 0) return; mines.splice(k, 1);
    if (feature(m.id) === 'mineWider') markPart(m.id);
    blast(m.id, m, m.r, m.coef, { kind: m.kind === 'molemine' ? 'bigdirt' : 'dirt', knock: .4, big: m.kind === 'molemine' });
    if (gold(m.id)) trail(m.id, m, m.r * .7, 2.5);
    if (m.kind === 'molemine') { fx('chainring', m, 2.6 * U, m.id, { life: .4, maxLife: .4 }); for (const o of mines.filter(o => o !== m && dist(o, m) <= 2.6 * U)) after(.12, () => triggerMine(o, true)); }
  }
  function updateMines(dt) {
    for (const m of [...mines]) {
      m.age += dt; m.life -= dt; if (m.life <= 0) { const k = mines.indexOf(m); if (k >= 0) mines.splice(k, 1); continue; }
      // 심은 지 1초가 지나면 두더지가 땅속으로 가까운 적(4.5칸)을 향해 파고든다(5칸/초) → 적이 안 밟아도 맞는다
      if (m.age > 1) { const e = closest(m, 4.5 * U); if (e) { const l = dist(e, m) || 1, sp = 5 * U * dt; m.x += (e.x - m.x) / l * Math.min(sp, l); m.y += (e.y - m.y) / l * Math.min(sp, l); m.moving = true; } else m.moving = false; }
      if (within(m, Math.max(1.2 * U, m.r * .7)).length) triggerMine(m);
    }
  }
  function update(dt) {
    if (!player()) return; dt = clamp(Number(dt) || 0, 0, .1); clock += dt;
    if (claimed.size > 150) for (const [e, t] of claimed) if (clock - t > .7 || e.hp <= 0) claimed.delete(e);   // 오래된 기록 정리
    const im = mods().intervalMul || 1;
    for (const [id, st] of Object.entries(player().skills || {})) {
      const d = DEF[id]; if (!d) continue;
      if (!seen.has(id)) { seen.add(id); st.cd = 0; }
      if (['orbit', 'typhoon', 'bee', 'swarm'].includes(d.kind)) continue;
      st.cd = (st.cd || 0) - dt;
      if (st.cd <= 0) {
        const fired = cast(id); st.cd = fired ? d.interval * im * (!COMBOS[id] && lv(id) >= MAXLV ? .8 : 1) * pint(id) : .2;
        // 전설: 30% 확률로 0.18초 뒤 한 번 더 발동(추가 발동은 다시 추가를 부르지 않는다)
        if (fired && legend(id) && Math.random() < (R.LEGEND_EXTRA_CAST ?? .3)) { markPart(id); stats.legendCasts = (stats.legendCasts || 0) + 1; fx('sparks', player(), .9 * U, id, { life: .35, maxLife: .35 }); after(.18, () => { if (player().skills?.[id]) cast(id); }); }
      }
    }
    const due = scheduled.filter(x => x.at <= clock); scheduled = scheduled.filter(x => x.at > clock); for (const ev of due) ev.fn();
    updateShots(dt); updateFields(dt); updateBeams(dt); updateMines(dt); updateOrbits(dt); updateBees(dt);
    for (const e of effects) e.life -= dt; effects = effects.filter(e => e.life > 0);
  }
  // 두 겹으로 그린다(2026-09-23): drawGround = 웅덩이·용암·지뢰·팽이 그림자(적·주인공보다 아래), draw = 나머지(투사체·폭발·빔·벌)
  const scene = () => ({ shots, fields, effects, orbits, mines, bees, beams, clock, U, player: player() });
  function draw(ctx, worldToScreen) { drawElementScene(ctx, scene(), worldToScreen, 'air'); }
  function drawGround(ctx, worldToScreen) { drawElementScene(ctx, scene(), worldToScreen, 'ground'); }
  function snapshot() { return { time: clock, shots: shots.length, scheduled: scheduled.length, shotDetails: shots.map(s=>({kind:s.kind,bounces:s.bounces,small:!!s.small,partSplitDone:!!s.partSplitDone})), fieldDetails: fields.map(f=>({kind:f.kind,life:f.life,age:f.age,maxTicks:f.maxTicks,ticks:f.ticks})), fields: fields.length, orbits: orbits.length, mines: mines.length, bees: bees.length, beams: beams.length, effects: effects.length, kinds: [...new Set([...shots, ...fields, ...effects, ...orbits, ...mines, ...bees, ...beams].map(e => e.kind))], shotAngles: shots.map(s => Number(s.angle.toFixed(2))), fieldSpots: fields.map(f => ({ x: Math.round(f.x), y: Math.round(f.y), r: Math.round(f.r) })), ...JSON.parse(JSON.stringify(stats)) }; }
  return { reset, update, draw, drawGround, snapshot };
}
