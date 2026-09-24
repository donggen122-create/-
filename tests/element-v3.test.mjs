// 원소 스킬 v3 규칙 검사: 데이터 무결성, 카드 규칙(4+4칸, Lv.5, 지원품 Lv.3, 진화), 정산 통계
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../game/src/rework-core.js';
import { SKILLS, SUPPORTS, COMBOS, PARTS, RUN_RULES, EVO_OF } from '../game/src/element-content.js';

const rng = (seq => () => { const v = seq[i++ % seq.length]; return v; })([.1, .5, .9, .3, .7]); let i = 0;
const profile = R.freshProfile();

test('데이터: 스킬 10·지원품 8·진화 10·파츠 10, 진화 재료가 모두 존재', () => {
  assert.equal(Object.keys(SKILLS).length, 10); assert.equal(Object.keys(SUPPORTS).length, 8); assert.equal(Object.keys(COMBOS).length, 10); assert.equal(Object.keys(PARTS).length, 10);
  for (const c of Object.values(COMBOS)) { assert.ok(SKILLS[c.skill], c.id); assert.ok(SUPPORTS[c.support], c.id); assert.equal(EVO_OF[c.skill], c.id); }
  for (const p of Object.values(PARTS)) assert.ok(SKILLS[p.skill]);
  for (const s of Object.values(SUPPORTS)) assert.equal(s.values.length, 3);
});

test('카드: 첫 선택은 스킬만, 칸 제한, 레벨 상한', () => {
  const skills = {}, state = {};
  const first = R.cardChoices(profile, skills, state, 1, rng);
  assert.ok(first.every(c => c.kind === 'skill-new'), JSON.stringify(first));
  for (const id of ['F1', 'W1', 'V1', 'E1']) R.applyRunCard(skills, state, { kind: 'skill-new', id });
  assert.throws(() => R.applyRunCard(skills, state, { kind: 'skill-new', id: 'L1' }));
  for (let k = 0; k < 2; k++) R.applyRunCard(skills, state, { kind: 'skill-up', id: 'F1' });
  assert.equal(skills.F1.lv, 3);
  assert.throws(() => R.applyRunCard(skills, state, { kind: 'skill-up', id: 'F1' }));
  const pool = R.cardPool(profile, skills, state);
  assert.ok(!pool.some(c => c.kind === 'skill-new'), '칸이 찼으면 새 스킬 카드 없음');
  assert.ok(!pool.some(c => c.kind === 'evolve'), '지원품 없이는 진화 없음');
});

test('지원품과 진화: 스킬 Lv.5 + 짝 지원품 → 진화 카드가 반드시 나오고 적용된다', () => {
  const skills = { F1: { lv: 3, cd: 0 } }, state = {};
  R.applyRunCard(skills, state, { kind: 'support-new', id: 'S4' });
  assert.equal(state.supports.S4.lv, 1);
  R.applyRunCard(skills, state, { kind: 'support-up', id: 'S4' }); R.applyRunCard(skills, state, { kind: 'support-up', id: 'S4' });
  assert.throws(() => R.applyRunCard(skills, state, { kind: 'support-up', id: 'S4' }), '지원품 Lv.3 상한');
  const cards = R.cardChoices(profile, skills, state, 1, rng);
  assert.ok(cards.some(c => c.kind === 'evolve' && c.id === 'EVO_F1'), JSON.stringify(cards));
  const r = R.applyRunCard(skills, state, { kind: 'evolve', id: 'EVO_F1' });
  assert.equal(r.fusion, 'EVO_F1'); assert.ok(!skills.F1 && skills.EVO_F1?.evolved);
  assert.ok(state.supports.S4, '진화해도 지원품은 남는다');
  for (const id of ['S1', 'S2', 'S3']) assert.equal(R.applyRunCard(skills, state, { kind: 'support-new', id }).support, id);
  assert.throws(() => R.applyRunCard(skills, state, { kind: 'support-new', id: 'S6' }), '지원품 4칸(S4 포함) 초과 불가');
});

test('정산: 스킬·진화·지원품 사용 통계가 남는다', () => {
  const r = R.completeRun(profile, { stage: 'CH01', cleared: true, seconds: 120, litter: 3, hpFraction: 1, skillIds: ['F1', 'BAD'], fusionIds: ['EVO_F1'], supportIds: ['S4', 'NOPE'] });
  assert.equal(r.profile.skillUsage.F1, 1); assert.equal(r.profile.fusionUsage.EVO_F1, 1); assert.equal(r.profile.supportUsage.S4, 1); assert.ok(!r.profile.supportUsage.NOPE);
});

test('난이도: 성공하면 쉬움 ★ · 보통 ★★ · 어려움 ★★★, 환경 목표는 코인 +30(난이도 배율), 무기 원소 설정은 없음', () => {
  for (const [id, stars] of [['easy', 1], ['normal', 2], ['hard', 3]]) {
    const p = R.action(R.freshProfile(), { kind: 'settings', difficulty: id, weaponMode: 'ranged', hero: 'hoya' }).profile;
    assert.equal(p.difficulty, id); assert.ok(!('weaponElement' in p));
    const r = R.completeRun(p, { stage: 'CH01', cleared: true, seconds: 180, litter: 3, hpFraction: 1 });   // 난이도는 프로필에서 읽는다
    assert.equal(r.reward.stars, stars); assert.equal(r.profile.stages.CH01.stars, stars); assert.equal(r.reward.difficulty, id); assert.equal(r.reward.goal, true);
    const miss = R.completeRun(p, { stage: 'CH01', cleared: true, seconds: 180, litter: 0, hpFraction: 1 });
    assert.ok(Math.abs(r.reward.coins - miss.reward.coins - 30 * R.COIN_MULT[id]) <= 1); assert.equal(miss.reward.stars, stars, '체력·쓰레기는 별에 영향 없음');
    assert.equal(R.completeRun(p, { stage: 'CH01', cleared: false, seconds: 100 }).reward.stars, 0);
  }
  assert.equal(Object.keys(R.DIFFICULTIES).join(), 'easy,normal,hard');
  assert.throws(() => R.action(R.freshProfile(), { kind: 'settings', difficulty: 'insane' }), /난이도/);
  const old = R.freshProfile(); old.weaponElement = 'fire';
  assert.ok(!('weaponElement' in R.action(old, { kind: 'settings', weaponMode: 'melee' }).profile), '옛 무기 원소 키는 지워진다');
  const best = R.completeRun(R.completeRun(R.freshProfile(), { stage: 'CH01', cleared: true, seconds: 180, difficulty: 'hard' }).profile, { stage: 'CH01', cleared: true, seconds: 180, difficulty: 'easy' });
  assert.equal(best.profile.stages.CH01.stars, 3, '최고 별은 유지');
});

test('파츠 보급: 고르는 것 없이 10종 중 하나, 개수는 운', () => {
  const p = R.freshProfile(); p.stages.CH01 = { cleared: true, stars: 1, best: 100 }; p.gifts = 1;
  const r = R.action(p, { kind: 'draw-part', mode: 'random', element: 'fire' }, () => .5);
  assert.equal(r.draw.id, Object.keys(PARTS)[5]); assert.equal(r.draw.qty, 1); assert.equal(r.profile.gifts, 0);
});
