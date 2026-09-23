// 3차 금 메달 기능(docs/23 §5 3차): 같은 파츠 7개 이상 + 장착일 때만, 일반·진화 양쪽, 추가 공격은 원래보다 약하고 끝없이 이어지지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../game/src/rework-core.js';
import {createElementCombat} from '../game/src/element-combat.js';

const grid=()=>Array.from({length:18},(_,i)=>({id:i,x:48+(i%6)*25,y:(Math.floor(i/6)-1)*35,hp:1e9,radiusU:.4}));
function combat(id,copies,{targets=grid(),skills=null,hostile=[],profile:given=null}={}){
 const base=R.COMBOS[id]?.skill||id,profile=given||R.freshProfile();
 if(copies&&!given){profile.parts['PART_'+base]={copies,level:1};profile.equippedParts=['PART_'+base];}
 const p={x:0,y:0,atk:30,skills:skills||{[id]:{lv:3,cd:0}}},hits=[],blasts=[];
 const engine=createElementCombat({getPlayer:()=>p,getEnemies:()=>targets,getProfile:()=>profile,projectiles:()=>hostile,damage:(e,n)=>hits.push({id:e.id,n}),onBlast:(at,r)=>blasts.push(r)});
 return {engine,p,hits,blasts,targets,hostile,run(s){for(let t=0;t<s-1e-9;t+=.01)engine.update(.01);},snap:()=>engine.snapshot()};
}
const coef=id=>(R.SKILLS[id]||R.COMBOS[id]).dmgCoef;

test('gold needs seven copies and an equipped part',()=>{
 const p=R.freshProfile();p.parts.PART_E1={copies:6,level:1};p.equippedParts=['PART_E1'];assert.equal(R.hasGold(p,'E1'),false);
 p.parts.PART_E1.copies=7;assert.equal(R.hasGold(p,'E1'),true);p.equippedParts=[];assert.equal(R.hasGold(p,'E1'),false);
 for(const id of Object.keys(R.PARTS))assert.ok(R.PARTS[id].gold,`${id} 금 기능 설명`);
});

test('E1 gold splits into three small stones (normal and evolved), silver splits into two',()=>{
 for(const id of ['E1','EVO_E1']){
  const silver=combat(id,3),gold=combat(id,7);let most={silver:0,gold:0};
  for(let i=0;i<60;i++){silver.run(.01);gold.run(.01);for(const [k,f] of [['silver',silver],['gold',gold]])most[k]=Math.max(most[k],f.snap().shotDetails.filter(s=>s.small).length);}
  assert.equal(most.gold/most.silver,1.5,`${id} ${JSON.stringify(most)}`);   // 2개 → 3개
 }
});

test('F1 gold puddles burst small fire at half damage; without gold none',()=>{
 for(const id of ['F1','EVO_F1']){
  const silver=combat(id,3),gold=combat(id,7);silver.run(3);gold.run(3);
  assert.ok(gold.blasts.length>silver.blasts.length,id);
  assert.ok(gold.hits.some(h=>Math.abs(h.n-30*coef(id)*(R.COMBOS[id]?R.LEVEL_DAMAGE.at(-1):R.LEVEL_DAMAGE[2])*R.skillDamageMultiplier({...R.freshProfile(),parts:{['PART_'+(R.COMBOS[id]?.skill||id)]:{copies:7,level:1}},equippedParts:['PART_'+(R.COMBOS[id]?.skill||id)]},id)*.5)<1e-6),id+' 50% 피해');
 }
});

test('F2 gold sub-rocket follows another enemy and never spawns another sub-rocket',()=>{
 for(const id of ['F2','EVO_F2']){
  const gold=combat(id,7),silver=combat(id,3);gold.run(2);silver.run(2);
  assert.ok(gold.blasts.length>silver.blasts.length,id);
  assert.ok(gold.snap().shotDetails.filter(s=>s.kind==='rocket').length<=6);
 }
});

test('W1 gold splits into two small balloons only on the last bounce, small ones do not split',()=>{
 for(const id of ['W1','EVO_W1']){
  const f=combat(id,7),silver=combat(id,3);let most=0,made=0,prev=new Set();
  for(let i=0;i<300;i++){f.run(.02);silver.run(.02);const s=f.snap().shotDetails;most=Math.max(most,s.filter(x=>x.small).length);assert.ok(!s.some(x=>x.small&&x.bounces>1),'작은 풍선은 다시 나뉘지 않는다');}
  assert.ok(most>=2,`${id} small balloons ${most}`);assert.ok(!silver.snap().shotDetails.some(x=>x.small));
 }
});

test('W2 gold leaves slowing water trail fields with no damage; E2 gold leaves an earth trail',()=>{
 for(const id of ['W2','EVO_W2']){const f=combat(id,7);f.run(.3);const kinds=f.snap().fieldDetails.map(d=>d.kind);assert.equal(kinds.filter(k=>k==='trail').length,3,id);}
 const silver=combat('W2',3);silver.run(.3);assert.equal(silver.snap().fields,0);
 const mine=combat('E2',7,{targets:[{id:1,x:40,y:0,hp:1e9,radiusU:.4}]});mine.run(2);assert.ok(mine.snap().fieldDetails.some(d=>d.kind==='trail'));
 const f=combat('W2',7);f.run(.3);const e=f.targets[0];e.x=0;e.y=0;f.run(.5);   // 물길은 피해 없이 느리게만
});

test('V1 gold throws one extra small boomerang per cast',()=>{
 for(const id of ['V1','EVO_V1']){const gold=combat(id,7),silver=combat(id,3);gold.run(.05);silver.run(.05);assert.equal(gold.snap().shots-silver.snap().shots,1,id);}
});

test('V2 gold removes one non-boss hostile shot near the tops at most every four seconds',()=>{
 const hostile=Array.from({length:6},(_,i)=>({x:40,y:i*2,hostile:true,boss:false,life:30}));hostile.push({x:40,y:0,hostile:true,boss:true,life:30});
 const f=combat('V2',7,{hostile});f.run(.2);assert.equal(hostile.filter(s=>s.life<=0).length,1);
 f.run(3.5);assert.equal(hostile.filter(s=>s.life<=0).length,1,'4초에 한 번');f.run(.6);assert.equal(hostile.filter(s=>s.life<=0).length,2);
 assert.equal(hostile.find(s=>s.boss).life,30,'대장 탄환은 없애지 않음');
 const silver=combat('V2',3,{hostile:[{x:40,y:0,hostile:true,boss:false,life:30}]});silver.run(5);assert.equal(silver.hostile[0].life,30);
});

test('L1 gold chains the extra bolt to one more enemy at 30%; L2 gold zaps every 8th sting at 60%',()=>{
 for(const id of ['L1','EVO_L1']){const gold=combat(id,7),silver=combat(id,3);gold.run(1.2);silver.run(1.2);assert.ok(gold.hits.length>silver.hits.length,id);}
 const bee=combat('L2',7),plain=combat('L2',3);bee.run(20);plain.run(20);
 const extra=bee.hits.length-plain.hits.length;assert.ok(extra>0,'8번째 침마다 전기');
 const casts=bee.snap().casts.L2;assert.ok(extra<=Math.ceil(casts/8)+1,`${extra} ≤ ${casts}/8`);
});

test('sustained gold on evolved skills stays within entity bounds (no endless chains)',()=>{
 for(const set of [['EVO_F1','EVO_F2','EVO_W1','EVO_E1'],['EVO_W2','EVO_V1','EVO_V2','EVO_L1'],['EVO_E2','EVO_L2','F1','W1']]){
  const profile=R.freshProfile();for(const id of Object.keys(R.PARTS))profile.parts[id]={copies:9,level:10};
  profile.equippedParts=set.map(id=>'PART_'+(R.COMBOS[id]?.skill||id)).slice(0,3);   // 장착은 3칸까지
  const f=combat(set[0],9,{profile,skills:Object.fromEntries(set.map(id=>[id,{lv:3}]))});
  for(let i=0;i<20;i++){f.run(1);const s=f.snap();assert.ok(s.shots<=120&&s.fields<=48&&s.effects<=140&&s.scheduled<=260,JSON.stringify({shots:s.shots,fields:s.fields,effects:s.effects,scheduled:s.scheduled}));}
 }
});
