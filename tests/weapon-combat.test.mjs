import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeaponCombat,WEAPON_RULES} from '../game/src/weapon-effects.js';

// 2026-09-23: 기본 무기는 근거리·원거리만(무기 원소 설정 제거). 원소 부가 효과 검사는 삭제하고 출처('weapon') 전달을 검사한다.
const U=32;
const target=(x,y=0,id='enemy')=>({id,x:x*U,y:y*U,hp:100000,radiusU:.4});
function fixture({hero='hoya',mode='melee',enemies=[target(1.5)],boss=null}={}){
 const player={x:0,y:0,atk:30,hp:260,hpMax:260,shield:0,attackT:0,facing:1,aimAngle:0};
 const profile={hero,weaponMode:mode};const hits=[],sounds=[];let now=0;
 const engine=createWeaponCombat({U,getPlayer:()=>player,getEnemies:()=>enemies,getBoss:()=>boss,getProfile:()=>profile,damage:(e,damage,dir,knock,source)=>{e.hp-=damage;hits.push({id:e.id,damage,time:now,dir,knock,source});},sound:id=>sounds.push(id)});
 function step(dt){now+=dt;engine.update(dt);}
 function run(seconds,dt=.01){for(let t=0;t<seconds-1e-9;t+=dt)step(Math.min(dt,seconds-t));}
 return {player,profile,enemies,boss,hits,sounds,engine,step,run};
}
const nearly=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('melee damage lands exactly at .16 contact and only once within one swing',()=>{
 const f=fixture();f.step(0);assert.equal(f.engine.snapshot().casts,1);
 f.step(.159);assert.equal(f.hits.length,0);f.step(.001);assert.equal(f.hits.length,1);nearly(f.hits[0].time,.16);nearly(f.hits[0].damage,34.5);assert.equal(f.hits[0].source,'weapon');
 f.run(.5);assert.equal(f.hits.length,1);assert.equal(f.sounds.length,1);assert.equal(f.engine.snapshot().attack,null);
});
test('ranged ball releases at .17 contact, then must travel before impact',()=>{
 const f=fixture({mode:'ranged',enemies:[target(4)]});f.step(0);f.step(.169);assert.equal(f.engine.snapshot().shots,0);assert.equal(f.hits.length,0);
 f.step(.001);assert.equal(f.engine.snapshot().shots,1);assert.equal(f.hits.length,0);assert.equal(f.sounds[0],'shoot');
 f.run(.3);assert.equal(f.hits.length,1);assert.ok(f.hits[0].time>.3);nearly(f.hits[0].damage,25.5);assert.equal(f.hits[0].source,'weapon');assert.equal(f.engine.snapshot().shots,0);
});
test('no target, dead target or out-of-range target never starts a swing or ball',()=>{
 for(const mode of ['melee','ranged'])for(const enemies of [[],[{...target(1),hp:0}],[target(WEAPON_RULES[mode].reach+2)]]){
  const f=fixture({mode,enemies});f.run(3);assert.equal(f.engine.snapshot().casts,0);assert.equal(f.engine.snapshot().shots,0);assert.equal(f.hits.length,0);assert.equal(f.player.attackT,0);assert.equal(f.sounds.length,0);
 }
});
test('melee checks current contact range and does not hit a target that has moved away',()=>{
 const e=target(1.5),f=fixture({enemies:[e]});f.step(0);f.step(.1);e.x=8*U;f.step(.061);assert.equal(f.hits.length,0);
});
test('Hoya and Minji have identical mechanics in both weapon modes',()=>{
 for(const mode of ['melee','ranged']){
  const simulate=hero=>{const f=fixture({hero,mode,enemies:[target(1.5,0,'a'),target(2.2,.15,'b'),target(3,0,'c')]});f.run(5);return {hits:f.hits,shield:f.player.shield,casts:f.engine.snapshot().casts,shots:f.engine.snapshot().shots};};
  assert.deepEqual(simulate('hoya'),simulate('minji'),`${mode} changes hero mechanics`);
 }
});
test('ranged ball stops at its first collision, without multi-frame re-hits',()=>{
 const f=fixture({mode:'ranged',enemies:[target(1.5,0,'a'),target(2.5,0,'b')]});f.step(0);f.run(.65);assert.deepEqual(f.hits.map(h=>h.id),['a']);
});
test('support mods scale damage and cooldown, no element bonus remains',()=>{
 const player={x:0,y:0,atk:30,hp:260,hpMax:260,shield:0,attackT:0,facing:1,aimAngle:0},hits=[];
 const engine=createWeaponCombat({U,getPlayer:()=>player,getEnemies:()=>[target(1.5)],getBoss:()=>null,getProfile:()=>({hero:'hoya',weaponMode:'melee',weaponElement:'fire'}),damage:(e,d)=>hits.push(d),getMods:()=>({dmgMul:1.5,intervalMul:.5})});
 for(let t=0;t<2;t+=.01)engine.update(.01);
 nearly(hits[0],34.5*1.5);assert.ok(engine.snapshot().casts>=4,'짧아진 간격만큼 더 자주 휘두른다');assert.equal(player.shield,0,'원소 보호막 없음');assert.equal(engine.snapshot().element,undefined);
});
test('reset clears pending contacts and travelling balls',()=>{
 const f=fixture({mode:'ranged',enemies:[target(1.5)]});f.step(0);f.run(.23);assert.ok(f.hits.length);f.engine.reset();f.enemies.length=0;f.run(3);assert.equal(f.hits.length,1);assert.equal(f.engine.snapshot().casts,0);assert.equal(f.engine.snapshot().hits,0);assert.equal(f.engine.snapshot().shots,0);assert.equal(f.engine.bodyLean(),0);
});
test('projectiles resolve overlapping targets in physical contact order, regardless of spawn order',()=>{
 const f=fixture({mode:'ranged',enemies:[target(1.25,0,'far'),target(1.24,0,'near')]});f.step(0);f.run(.4);
 assert.equal(f.hits[0].id,'near');nearly(f.hits[0].damage,25.5);assert.equal(f.hits.length,1);
});
