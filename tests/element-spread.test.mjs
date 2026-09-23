// 2026-09-23 사용자: "스킬들이 같은 방향으로 겹쳐 날아가지 않게" · "불꽃병이 너무 커서 맵을 가림" 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElementCombat } from '../game/src/element-combat.js';
import * as R from '../game/src/rework-core.js';

const U = 32;
const foe = (x, y, id) => ({ id, x: x * U, y: y * U, hp: 1e9, radiusU: .4 });
function fixture(skills, enemies) {
  const player = { x: 0, y: 0, atk: 30, hp: 260, hpMax: 260, skills: Object.fromEntries(Object.entries(skills).map(([id, lv]) => [id, { lv, cd: 0 }])) };
  const hits = [];
  const engine = createElementCombat({ U, getPlayer: () => player, getEnemies: () => enemies, getProfile: () => R.freshProfile(), damage: (e, amount, dir, knock, source) => hits.push({ id: e.id, source }) });
  return { engine, hits, run: (s, dt = .01) => { for (let t = 0; t < s - 1e-9; t += dt) engine.update(dt); } };
}
const apart = (list, min) => list.every((a, i) => list.every((b, j) => i === j || Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) >= min));

test('로켓 3발은 서로 다른 적(다른 방향)을 노린다 — 가까이 붙은 두 적은 한 방향으로 친다', () => {
  const f = fixture({ F2: 3 }, [foe(5, 0, 'a'), foe(5, .3, 'a2'), foe(-3, 4, 'b'), foe(0, -5, 'c')]);
  f.run(.25);
  const angles = f.engine.snapshot().shotAngles;
  assert.equal(angles.length, 3, JSON.stringify(angles));
  assert.ok(apart(angles, .3), `겹치는 방향: ${angles}`);
});

test('적이 한 마리뿐이어도 물풍선 3개는 부채꼴로 벌어진다', () => {
  const f = fixture({ W1: 3 }, [foe(4, 0, 'a')]);
  f.run(.02);
  const angles = f.engine.snapshot().shotAngles;
  assert.equal(angles.length, 3); assert.ok(apart(angles, .5), `${angles}`);
});

test('서로 다른 스킬도 같은 적에 몰리지 않는다(돌멩이 → 가까운 적, 부메랑 → 다른 적)', () => {
  const f = fixture({ E1: 1, V1: 1 }, [foe(3, 0, 'a'), foe(0, 4, 'b')]);
  f.run(.02);
  const angles = f.engine.snapshot().shotAngles;
  assert.equal(angles.length, 2); assert.ok(apart(angles, 1), `${angles}`);
});

test('불꽃병 3개는 서로 떨어진 자리에 떨어지고, 웅덩이는 1.4칸(예전 2칸)·범위 보너스 절반으로 작아졌다', () => {
  const f = fixture({ F1: 3 }, [foe(5, 0, 'a'), foe(5.3, .4, 'a2'), foe(5.2, -.4, 'a3')]);
  f.run(.5);
  const spots = f.engine.snapshot().fieldSpots;
  assert.equal(spots.length, 3, JSON.stringify(spots));
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) >= 1.5 * U, JSON.stringify(spots));
  for (const s of spots) assert.ok(s.r <= Math.round(1.4 * U * 1.08) + 1, `웅덩이 반지름 ${s.r}`);   // Lv.3 범위 +16%의 절반(+8%)까지
});

test('스킬 피해는 원소 이름을 함께 넘긴다(어려움의 원소 방패 판정)', () => {
  const f = fixture({ E1: 1 }, [foe(2, 0, 'a')]);
  f.run(.4);
  assert.ok(f.hits.length > 0); assert.ok(f.hits.every(h => h.source === 'earth'), JSON.stringify(f.hits));
});

test('어려움 특별한 적 데이터: 5종, 비율과 색이 있다', () => {
  assert.deepEqual(Object.keys(R.SPECIAL_TRAITS), ['resist', 'armor', 'fast', 'regen', 'split']);
  for (const d of Object.values(R.SPECIAL_TRAITS)) { assert.ok(d.weight > 0 && /^#[0-9a-f]{6}$/i.test(d.color) && d.name && d.desc); }
  assert.ok(R.DIFFICULTIES.hard.special > 0 && !R.DIFFICULTIES.normal.special && !R.DIFFICULTIES.easy.special);
});
