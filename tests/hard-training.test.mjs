// 어려움 재조정·훈련 만렙 100(docs/28): 훈련 비용 식은 그대로 100단계에서 멈추고, 이동 속도는 31단계까지 옛 값과 같다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../game/src/rework-core.js';

test('training goes to level 100 with the lowered cost formula (50+12 per level)',()=>{
 assert.equal(R.TRAINING_MAX,100);
 assert.equal(R.trainingCost(1),50);assert.equal(R.trainingCost(20),278);assert.equal(R.trainingCost(99),1226);assert.equal(R.trainingCost(100),null);
 let to40=0;for(let l=1;l<40;l++)to40+=R.trainingCost(l);assert.equal(to40*3,32526,'세 가지 모두 40까지');
 const p=R.freshProfile();p.coins=1e7;p.training.attack=99;
 const up=R.action(p,{kind:'train',stat:'attack'}).profile;assert.equal(up.training.attack,100);
 assert.throws(()=>R.action(up,{kind:'train',stat:'attack'}),/최고 단계/);
});

test('training gains: attack and hp +3% per level, speed unchanged up to 31 then slow',()=>{
 for(const n of [1,20,40,100]){assert.ok(Math.abs(R.trainingGain('attack',n)-(n-1)*.03)<1e-9);assert.ok(Math.abs(R.trainingGain('hp',n)-(n-1)*.03)<1e-9);}
 for(let n=1;n<=31;n++)assert.ok(Math.abs(R.trainingGain('speed',n)-Math.min(.15,(n-1)*.005))<1e-9);
 assert.ok(Math.abs(R.trainingGain('speed',100)-.219)<1e-9);
 const p=R.freshProfile();p.training={attack:40,hp:40,speed:40};const b=R.bonuses(p);
 assert.ok(Math.abs(b.atkPct-1.17)<1e-9);assert.ok(Math.abs(b.hpPct-1.17)<1e-9);assert.ok(Math.abs(b.speedPct-.159)<1e-9);
});

test('hard is much tougher than normal and still pays 2 tickets',()=>{
 const {normal,hard}=R.DIFFICULTIES;
 assert.ok(hard.enemyHp>=5*normal.enemyHp);assert.ok(hard.taken>=4.5*normal.taken);assert.ok(hard.hpGrowth>normal.hpGrowth);
 assert.equal(R.CLEAR_GIFTS.hard,2);assert.match(hard.desc,/40단계/);assert.match(hard.desc,/유니크/);
});

test('success coins scale by difficulty (easy 0.8, normal 1, hard 2); failure coins never go above normal',()=>{
 assert.deepEqual(R.COIN_MULT,{easy:.8,normal:1,hard:2});
 const p=R.freshProfile();p.stages.CH01={cleared:true,stars:1};p.stages.CH02={cleared:true,stars:1};p.stages.CH03={cleared:true,stars:1};
 const win=d=>R.completeRun(p,{stage:'CH03',cleared:true,seconds:300,litter:5,difficulty:d}).reward.coins;
 assert.equal(win('normal'),170);assert.equal(win('easy'),136);assert.equal(win('hard'),340);   // (140+30)×배율
 const lose=d=>R.completeRun(p,{stage:'CH03',cleared:false,seconds:300,difficulty:d}).reward.coins;
 assert.equal(lose('normal'),84);assert.equal(lose('hard'),84,'어려움 실패는 2배가 아님(실패는 이용권을 쓰지 않음)');assert.equal(lose('easy'),67);
 const boss=R.completeRun({...p,stages:{...p.stages,CH04:{cleared:true,stars:1}}},{stage:'CH05',cleared:true,seconds:240,litter:5,difficulty:'hard'}).reward;
 assert.equal(boss.coins,(160+120+60+30)*2,'처음 성공·대왕·목표 보너스도 2배');
});

// 어려움 최소 기준(2026-09-26 사용자 "15, 20으로 해"): 그 단계 보통 이상 성공 + 공격력·체력 훈련 1장 15 · 2장 20. 장비·파츠·이동 속도는 기준이 아니다.
test('hard gate: clear the stage on normal first and train attack/hp to 15 (chapter 1) or 20 (chapter 2)',()=>{
 assert.deepEqual(R.HARD_MIN,{1:{attack:15,hp:15},2:{attack:20,hp:20}});
 const p=R.freshProfile();
 let g=R.hardGate(p,'CH04');assert.equal(g.open,false);assert.equal(g.missing,3);assert.equal(R.hardGateText(g),'1-4 보통 이상으로 먼저 성공 · 공격력 훈련 1/15단계 · 체력 훈련 1/15단계');
 p.stages.CH04={cleared:true,stars:1};p.training={attack:15,hp:15,speed:1};
 g=R.hardGate(p,'CH04');assert.equal(g.open,false,'쉬움 성공(별 1개)으로는 안 열림');assert.equal(R.hardGateText(g),'1-4 보통 이상으로 먼저 성공');
 p.stages.CH04.stars=2;assert.equal(R.hardGate(p,'CH04').open,true);
 p.training.hp=14;assert.equal(R.hardGate(p,'CH04').open,false);p.training.hp=15;
 p.stages.CH09={cleared:true,stars:3};g=R.hardGate(p,'CH09');assert.equal(g.chapter,2);assert.equal(g.open,false,'2장은 20단계');assert.equal(R.hardGateText(g),'공격력 훈련 15/20단계 · 체력 훈련 15/20단계');
 p.training={attack:20,hp:20,speed:1};assert.equal(R.hardGate(p,'CH09').open,true,'이동 속도·장비·파츠는 기준이 아님');
 assert.equal(R.stageLabel('CH01'),'1-1');assert.equal(R.stageLabel('CH10'),'2-5');
});
