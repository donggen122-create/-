import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../game/src/main.js',import.meta.url),'utf8');
const spawn=src.slice(src.indexOf('function spawnEnemyAt('),src.indexOf('function spawnRingAroundCamera('));
const cap=src.match(/const SLOW_ENEMY_CAP = (\{[^;]+\});/)[1];
const check=src.slice(src.indexOf('function slowEnemyLimited('),src.indexOf('let vignetteCache'));
function fixture(enabled,level){
 const q={enemies:[],renderQuality:{level},slowQualityMin:3,runTime:0,ENEMIES:{normal:{behavior:'chase'},elite:{behavior:'chase',elite:true}},player:{hitCount:0},runMods:{},runCfg:{},U:32,
 enemyHp:()=>10,enemyAtk:()=>1,curMult:()=>1,R:{PACE:{hp:1,atk:1}},sgMaybeTrait:e=>e.sgTrait='fast',sgApplyTrait:(e,t)=>e.sgTrait=t};
 vm.createContext(q);vm.runInContext(`const SLOW_ENEMY_CAP=${cap};SLOW_ENEMY_CAP.enabled=${enabled};SLOW_ENEMY_CAP.cap=80;${check}${spawn}`,q);
 return q;
}
test('cap is OFF and every quality creates the same 160 ordinary enemies',()=>{
 assert.equal(JSON.parse(cap.replace(/(enabled|cap):/g,'"$1":')).enabled,false);
 for(let level=0;level<6;level++){const q=fixture(false,level);vm.runInContext("for(let i=0;i<160;i++)spawnEnemyAt('normal',i,0);",q);assert.equal(q.enemies.length,160);}
});
test('only the two slow tiers cap ordinary enemies; elite, rolled/forced special and split children survive',()=>{
 for(let level=0;level<5;level++){
  const q=fixture(true,level);vm.runInContext("for(let i=0;i<160;i++)spawnEnemyAt('normal',i,0);",q);assert.equal(q.enemies.length,level>=3?80:160);
  vm.runInContext("spawnEnemyAt('elite',0,0);spawnEnemyAt('normal',0,0,false,true);spawnEnemyAt('normal',0,0,false,false,'armor');spawnEnemyAt('normal',0,0,false,false,null,true)",q);
  assert.equal(q.enemies.length,(level>=3?80:160)+4);
 }
});
