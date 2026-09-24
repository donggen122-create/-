// 스킬 크기 상한(2026-09-24 사용자 "오브젝트들이 너무 커지기만 한다, 두더지 폭발이 무식하게 크다"):
// 크기 보너스(큰 물통·물범이·진화·단계·넓히는 파츠)는 더해서 최대 +35%까지만 크기로, 넘치는 보너스는 절반만큼 피해로.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../game/src/rework-core.js';
import {createElementCombat,SIZE_BONUS_CAP} from '../game/src/element-combat.js';

const U=32;
function engineFor(id,{part=false,areaMul=1,lv=3}={}){
 const p={x:0,y:0,atk:30,skills:{[id]:{lv,cd:0}}},profile=R.freshProfile();profile.stages.CH01={cleared:true,stars:1};profile.gifts=20;
 if(part)R.addPart(profile,'PART_'+(R.COMBOS[id]?.skill||id));
 const targets=Array.from({length:24},(_,i)=>({id:i,x:Math.cos(i/24*Math.PI*2)*2.2*U,y:Math.sin(i/24*Math.PI*2)*2.2*U,hp:1e9,radiusU:.4}));
 const hits=[],blasts=[];
 const engine=createElementCombat({U,getPlayer:()=>p,getEnemies:()=>targets,getProfile:()=>profile,getMods:()=>({dmgMul:1,areaMul,intervalMul:1}),damage:(e,n)=>hits.push(n),onBlast:(at,r)=>blasts.push(r)});
 return {hits,blasts,run(s){for(let t=0;t<s-1e-9;t+=.01)engine.update(.01);}};
}

test('size bonus cap is +35%',()=>{assert.equal(SIZE_BONUS_CAP,.35);});

test('mole bomb field explosion no longer balloons: big water jug + seal + part stays at 2.1 x 1.35 tiles (was 6.4 tiles)',()=>{
 const f=engineFor('EVO_E2',{part:true,areaMul:1.7});f.run(3);
 assert.ok(f.blasts.length>0);for(const r of f.blasts)assert.ok(Math.abs(r-2.1*1.35*U)<1e-9,`radius ${r/U} tiles`);
});

test('bonus beyond the size cap turns into damage (half of the overflow)',()=>{
 const small=engineFor('EVO_E2',{part:true,areaMul:1}),big=engineFor('EVO_E2',{part:true,areaMul:1.7});small.run(3);big.run(3);
 assert.ok(small.hits.length&&big.hits.length);
 // 진화 .2 + 파츠 .3 = .5 → 넘침 .15 → 피해 ×1.075 / 큰 물통·물범이 .7 더해 1.2 → 넘침 .85 → 피해 ×1.425
 assert.ok(Math.abs(big.hits[0]/small.hits[0]-1.425/1.075)<1e-9);
 assert.ok(Math.abs(small.blasts[0]-big.blasts[0])<1e-9,'same (capped) size');
});

test('without bonuses sizes are unchanged: mole mine level 1 = 1.9 tiles',()=>{
 const f=engineFor('E2',{lv:1});f.run(3);assert.ok(f.blasts.length>0);assert.ok(Math.abs(f.blasts[0]-1.9*U)<1e-9);
});
