// 1-5 쓰레기 산 대왕 거리별 기술(docs/29): 근거리·중거리·원거리 묶음, 3번째마다 쓰레기 뿌리기, 같은 기술 연달아 안 씀, 화난 뒤 소환.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOSS_PATTERNS,BOSS_BANDS,bossBand,pickBossPattern} from '../game/src/boss-patterns.js';
import * as R from '../game/src/rework-core.js';

const seq=(...v)=>{let i=0;return ()=>v[i++%v.length];};
const pick=(state,rng=Math.random)=>pickBossPattern(BOSS_PATTERNS,{phase:1,sinceLitter:0,litterOnGround:false,...state},rng);

test('every band has at least two skills and each skill says how to dodge',()=>{
 assert.equal(bossBand(2),'close');assert.equal(bossBand(BOSS_BANDS.close),'mid');assert.equal(bossBand(7),'mid');assert.equal(bossBand(BOSS_BANDS.mid),'far');
 for(const band of ['close','mid','far']){
  const calm=BOSS_PATTERNS.filter(p=>!p.phase&&p.ranges.includes(band));assert.ok(calm.length>=2,band);
 }
 for(const p of BOSS_PATTERNS){assert.ok(p.hint&&p.telegraphS>=.75,p.name);assert.ok(Array.isArray(p.ranges),p.name);}
});

test('skills follow the distance to the boss',()=>{
 const names=d=>new Set(Array.from({length:400},()=>pick({distU:d}).name));
 assert.deepEqual(names(2),new Set(['쓰레기 내려찍기','쓰레기 흡입','악취 방귀 구름']));
 assert.deepEqual(names(5),new Set(['악취 방귀 구름','쓰레기 몸통 박치기','쓰레기 폭격']));
 assert.deepEqual(names(10),new Set(['쓰레기 폭격','쓰레기 연속 던지기','대왕 점프']));
 // 화난 뒤(2페이즈)에는 멀리서 봉지 유령도 부른다
 assert.ok(Array.from({length:400},()=>pick({distU:10,phase:2}).name).includes('봉지 유령 소환'));
});

test('never the same skill twice in a row, litter every third skill unless litter is still on the ground',()=>{
 for(let i=0;i<200;i++){const a=pick({distU:5});assert.notEqual(pick({distU:5,last:a.name}).name,a.name);}
 assert.equal(pick({distU:2,sinceLitter:3}).kind,'litter');
 assert.notEqual(pick({distU:2,sinceLitter:3,litterOnGround:true}).kind,'litter');
 assert.notEqual(pick({distU:2,sinceLitter:2}).kind,'litter');
 // 첫 기술 셋 안에서는 거리 묶음만
 assert.equal(pick({distU:10},seq(0)).name,'쓰레기 폭격');
});

test('old boss tables without ranges keep the old random choice',()=>{
 const old=[{name:'a',kind:'scatter'},{name:'b',kind:'cone',phase:2}];
 assert.equal(pickBossPattern(old,{distU:1,phase:1},()=>.9).name,'a');
 assert.equal(pickBossPattern(old,{distU:1,phase:2},()=>.9).name,'b');
});

test('every skill kind has a hit rule in main.js and a warning drawing in theme-effects.js',()=>{
 const main=fs.readFileSync(new URL('../game/src/main.js',import.meta.url),'utf8'),fx=fs.readFileSync(new URL('../game/src/theme-effects.js',import.meta.url),'utf8');
 for(const kind of new Set(BOSS_PATTERNS.map(p=>p.kind))){
  assert.match(main,new RegExp(`case "${kind}"`),kind);
  if(kind!=='litter')assert.match(fx,new RegExp(`pat\\.kind === "${kind}"`),kind);
 }
});

test('boss hp per difficulty: easy half, normal .85, hard reduced because enemy hp is already x5.5',()=>{
 const D=R.DIFFICULTIES;assert.equal(D.easy.bossHp,.5);assert.equal(D.normal.bossHp,.85);assert.equal(D.hard.bossHp,.4);
 assert.ok(D.hard.enemyHp*D.hard.bossHp>D.normal.enemyHp*D.normal.bossHp*2);
});
