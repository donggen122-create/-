// 등급 능력(docs/27): 피해 노말 0 · 레어 10 · 유니크 25 · 에픽 45 · 전설 80%, 발동 간격(유니크 -5 · 에픽 -15 · 전설 -25%),
// 에픽부터 유니크 기능 강화(추가 공격 피해 2배), 전설은 30% 확률로 한 번 더 발동(팽이·벌은 +2개). 끝없는 연쇄 없이 상한 안.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../game/src/rework-core.js';
import {createElementCombat} from '../game/src/element-combat.js';

const grid=()=>Array.from({length:18},(_,i)=>({id:i,x:48+(i%6)*25,y:(Math.floor(i/6)-1)*35,hp:1e9,radiusU:.4}));
function combat(id,copies,skills=null){
 const base=R.COMBOS[id]?.skill||id,profile=R.freshProfile();profile.parts['PART_'+base]={copies,level:1};profile.equippedParts=['PART_'+base];
 const p={x:0,y:0,atk:30,skills:skills||{[id]:{lv:3,cd:0}}},hits=[],targets=grid();
 const engine=createElementCombat({getPlayer:()=>p,getEnemies:()=>targets,getProfile:()=>profile,damage:(e,n)=>hits.push(n)});
 return {engine,p,hits,profile,run(s){for(let t=0;t<s-1e-9;t+=.01)engine.update(.01);},snap:()=>engine.snapshot()};
}

test('grade damage and firing interval tables',()=>{
 assert.deepEqual(R.GRADE_DAMAGE,[0,.10,.25,.45,.80]);assert.deepEqual(R.GRADE_INTERVAL,[1,1,.95,.85,.75]);
 for(const [copies,g] of [[1,0],[3,1],[7,2],[25,3],[80,4]]){
  const f=combat('F2',copies);assert.equal(R.partGrade(f.profile,'F2'),g);
  assert.ok(Math.abs(R.partBonus(f.profile,'F2')-R.GRADE_DAMAGE[g])<1e-9);assert.equal(R.partIntervalMul(f.profile,'F2'),R.GRADE_INTERVAL[g]);
 }
 const none=R.freshProfile();assert.equal(R.partGrade(none,'F2'),-1);assert.equal(R.partIntervalMul(none,'F2'),1);
});

test('legendary fires much more often: faster interval plus a 30% extra cast',()=>{
 const normal=combat('F2',1),epic=combat('F2',25),legend=combat('F2',80);normal.run(30);epic.run(30);legend.run(30);
 const n=normal.snap().casts.F2,e=epic.snap().casts.F2,l=legend.snap().casts.F2;
 assert.ok(e>n,`에픽 ${e} > 노말 ${n}`);assert.ok(l>=n*1.5,`전설 ${l} ≥ 노말 ${n}×1.5`);
 const extra=legend.snap().legendCasts||0;assert.ok(extra>0&&extra<l*.5,`한 번 더 ${extra}/${l}`);
 assert.equal(epic.snap().legendCasts||0,0,'에픽은 한 번 더 발동 없음');
});

test('legendary tops and bees get two more',()=>{
 for(const [id,key] of [['V2','orbits'],['EVO_V2','orbits'],['L2','bees'],['EVO_L2','bees']]){
  const a=combat(id,25),b=combat(id,80);a.run(.2);b.run(.2);assert.equal(b.snap()[key]-a.snap()[key],2,id);
 }
});

test('epic doubles the unique extra attack (F1 small fire)',()=>{
 const expect=(copies,g)=>{const prof=R.freshProfile();prof.parts.PART_F1={copies,level:1};prof.equippedParts=['PART_F1'];return 30*R.SKILLS.F1.dmgCoef*R.LEVEL_DAMAGE[2]*R.skillDamageMultiplier(prof,'F1')*.5*g;};
 const uni=combat('F1',7),epic=combat('F1',25);uni.run(3);epic.run(3);
 assert.ok(uni.hits.some(h=>Math.abs(h-expect(7,1))<1e-6),'유니크 50%');assert.ok(epic.hits.some(h=>Math.abs(h-expect(25,2))<1e-6),'에픽 100%');
});

test('sustained legendary parts stay within entity bounds',()=>{
 const f=combat('EVO_F1',80,{EVO_F1:{lv:3},EVO_F2:{lv:3},EVO_V2:{lv:3},EVO_L2:{lv:3}});
 for(const id of ['PART_F2','PART_V2'])f.profile.parts[id]={copies:80,level:10};f.profile.equippedParts=['PART_F1','PART_F2','PART_V2'];
 for(let i=0;i<20;i++){f.run(1);const s=f.snap();assert.ok(s.shots<=120&&s.fields<=48&&s.effects<=140&&s.scheduled<=260,JSON.stringify({shots:s.shots,fields:s.fields,effects:s.effects,scheduled:s.scheduled}));}
});
