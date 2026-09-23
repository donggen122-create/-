// 어려움 재조정·훈련 만렙 100(docs/28): 훈련 비용 식은 그대로 100단계에서 멈추고, 이동 속도는 31단계까지 옛 값과 같다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../game/src/rework-core.js';

test('training goes to level 100 with the old cost formula',()=>{
 assert.equal(R.TRAINING_MAX,100);
 assert.equal(R.trainingCost(1),100);assert.equal(R.trainingCost(20),575);assert.equal(R.trainingCost(99),2550);assert.equal(R.trainingCost(100),null);
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
