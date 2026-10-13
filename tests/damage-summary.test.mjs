import test from 'node:test';
import assert from 'node:assert/strict';
import {createDamageTracker,effectiveHpDamage,validateDamageSummary,damageSkillIds} from '../game/src/damage-summary.js';
import {createElementCombat} from '../game/src/element-combat.js';
import * as R from '../game/src/rework-core.js';

test('counts actual HP lost after mitigation and excludes overkill/dead/healed targets',()=>{
  assert.equal(effectiveHpDamage(25,-35),25);
  assert.equal(effectiveHpDamage(100,75),25);
  assert.equal(effectiveHpDamage(0,-20),0);
  assert.equal(effectiveHpDamage(40,50),0);
  assert.equal(effectiveHpDamage(NaN,0),0);
});
test('keeps base, evolution and monster totals separate, including lingering base attacks',()=>{
  const t=createDamageTracker();t.reset('fire');t.acquire('F1',0);t.acquire('EVO_F1',80);
  t.record('F1','T1_BAGGY',20,2);t.record('EVO_F1','T1_BAGGY',70,81);t.record('F1','T1_BOTTLE',15,82);
  const s=t.snapshot(300);assert.equal(s.total,105);
  assert.equal(s.skills.find(r=>r.id==='F1').damage,35);assert.equal(s.skills.find(r=>r.id==='EVO_F1').damage,70);
  assert.equal(s.skills.find(r=>r.id==='EVO_F1').acquiredAt,80);
  assert.equal(s.skills.find(r=>r.id==='F2').acquiredAt,null);
  assert.deepEqual(validateDamageSummary(s,{element:'fire',seconds:300}),s);
  t.reset('water');assert.equal(t.snapshot(0).total,0);assert.deepEqual(t.snapshot(0).skills.map(s=>s.id),damageSkillIds('water'));
  t.reset();assert.equal(t.snapshot(300),null);
});
test('rejects inconsistent sums, duplicate rows, unknown sources and identifying fields',()=>{
  const t=createDamageTracker();t.reset('water');t.record('W1','T1_BOTTLE',3.5,20);const s=t.snapshot(300);
  const check=x=>validateDamageSummary(x,{element:'water',seconds:300});
  assert.ok(check(s));
  for(const modify of [x=>x.total++,x=>x.skills[0].damage++,x=>x.skills[0].hits++,x=>x.skills[1]={...x.skills[0]},x=>x.skills[0].targets[0].id='student_id',x=>x.skills[0].targets[0].damage=Infinity,x=>x.student='name',x=>x.skills[0].acquiredAt=301,x=>x.seconds=301,x=>x.skills[0].targets.push({...x.skills[0].targets[0]})]){
    const x=structuredClone(s);modify(x);assert.equal(check(x),null);
  }
  assert.equal(validateDamageSummary(s,{element:'fire',seconds:300}),null);
  assert.equal(validateDamageSummary(s,{element:'water',seconds:290}),null);
});
test('each of the twenty elemental attacks forwards its exact source ID to resolved damage',()=>{
  const originalRandom=Math.random;let seed=10808;
  Math.random=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};
  try{
  for(const id of Object.keys({...R.SKILLS,...R.COMBOS})){
    const ids=[],p={x:0,y:0,atk:30,skills:{[id]:{lv:3,cd:0}}};
    const enemies=Array.from({length:8},(_,i)=>({typeId:'T1_BAGGY',x:35+i*8,y:(i%3-1)*10,hp:1e7,radiusU:.6}));
    const combat=createElementCombat({getPlayer:()=>p,getEnemies:()=>enemies,getProfile:()=>R.freshProfile(),damage(e,raw,dir,knock,element,source){ids.push(source);e.hp-=Math.floor(raw*.25);}});
    for(let i=0;i<180;i++)combat.update(.1);
    assert.ok(ids.length>0,id+' hit at least once');assert.ok(ids.every(source=>source===id),id+' exact attribution');
  }
  }finally{Math.random=originalRandom;}
});
