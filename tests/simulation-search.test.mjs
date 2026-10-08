import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderedGrid, visitMovingObstacles, createTickValueCache } from '../game/src/simulation-search.js';
import { skillDamageMultiplier, freshProfile } from '../game/src/rework-core.js';

let state=10808;
const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};

test('grid + original hypot predicate equals full scan, set and order: 10000 layouts',()=>{
  const grid=createOrderedGrid(128);
  for(let n=0;n<10000;n++){
    const at={x:(rng()-.5)*5000,y:(rng()-.5)*5000},r=rng()*1000;
    const list=Array.from({length:1+n%181},(_,id)=>({id,x:(rng()-.5)*5000,y:(rng()-.5)*5000,r:rng()*160}));
    list.push({id:list.length,x:at.x+r,y:at.y,r:0});
    if(n%3===0){at.x=128;at.y=-128;list[0].x=128+r;list[0].y=-128;}
    grid.rebuild(list,e=>e.r);
    const accept=e=>Math.hypot(e.x-at.x,e.y-at.y)<=r+e.r;
    assert.deepEqual(grid.candidates(at.x,at.y,r).map(i=>list[i]).filter(accept),list.filter(accept),`layout ${n}`);
  }
});

test('square/projectile candidates retain all hits and original indices: 10000 layouts',()=>{
  const grid=createOrderedGrid(128);
  for(let n=0;n<10000;n++){
    const list=Array.from({length:n%180},(_,id)=>({id,x:(rng()-.5)*3000,y:(rng()-.5)*3000}));
    const x=(rng()-.5)*2000,y=(rng()-.5)*2000,r=rng()*200,after=n%12-1;
    grid.rebuild(list);
    const accept=e=>e.id>after&&Math.abs(e.x-x)<r&&Math.abs(e.y-y)<r;
    assert.deepEqual(grid.candidates(x,y,r,after).map(i=>list[i]).filter(accept),list.filter(accept));
  }
});

test('moving-obstacle suffix re-query equals sequential full scan, including chains: 10000 layouts',()=>{
  const grid=createOrderedGrid(32);
  function visit(ent,r,d,hits){
    if(d.opened)return false;
    const dx=ent.x-d.x,dy=ent.y-d.y,min=d.solid+r;
    if(dx>=min||dx<=-min||dy>=min||dy<=-min||dx*dx+dy*dy>=min*min)return false;
    const dd=Math.hypot(dx,dy);if(dd>=min||dd===0)return false;
    ent.x=d.x+dx/dd*min;ent.y=d.y+dy/dd*min;hits.push(d.id);return true;
  }
  for(let n=0;n<10000;n++){
    const list=Array.from({length:3+n%120},(_,id)=>({id,x:(rng()-.5)*500,y:(rng()-.5)*500,solid:5+rng()*50,opened:rng()<.1}));
    // Force long movement into a later cell, then into a third obstacle.
    if(n%2===0)list.splice(0,3,{id:0,x:-1,y:0,solid:200,opened:false},{id:1,x:205,y:1,solid:50,opened:false},{id:2,x:153,y:-1,solid:40,opened:false});
    const a={x:0,y:0},b={...a},r=5+rng()*30,ah=[],bh=[];
    grid.rebuild(list,d=>d.solid);
    for(const d of list)visit(a,r,d,ah);
    visitMovingObstacles(grid,b,r,d=>visit(b,r,d,bh));
    assert.deepEqual({ent:b,hits:bh},{ent:a,hits:ah},`layout ${n}`);
  }
});

test('opening obstacles and exceptional query coordinates use safe supersets',()=>{
  const grid=createOrderedGrid();const d={x:0,y:0,solid:20,opened:false};grid.rebuild([d],e=>e.solid);
  d.opened=true;d.solid=0;
  assert.deepEqual(grid.candidates(0,0,1),[0]);
  for(const x of [Infinity,NaN,1e300,-1e300])assert.deepEqual(grid.candidates(x,0,10),[0]);
  grid.rebuild([]);assert.deepEqual(grid.candidates(0,0,1),[]);
});

test('tick cache retains exact rule values, invalidates in-place edits, replacement and new run: 5000 profiles',()=>{
  let calls=0;const cache=createTickValueCache((p,id)=>{calls++;return skillDamageMultiplier(p,id);});
  for(let n=0;n<5000;n++){
    const p=freshProfile();p.equippedParts=['PART_F1','PART_F2','PART_W1'];
    p.parts=Object.fromEntries(p.equippedParts.map(id=>[id,{copies:Math.floor(rng()*100),level:1+Math.floor(rng()*10)}]));
    cache.begin(p);
    for(const id of ['F1','EVO_F1','W1','EVO_W1']){
      const expected=skillDamageMultiplier(p,id),before=calls;
      assert.equal(cache.get(p,id),expected);assert.equal(cache.get(p,id),expected);assert.equal(calls,before+1);
    }
    p.parts.PART_F1.level=10;cache.begin(p);assert.equal(cache.get(p,'F1'),skillDamageMultiplier(p,'F1'));
    const replacement=freshProfile();assert.equal(cache.get(replacement,'F1'),skillDamageMultiplier(replacement,'F1'));
    cache.begin(null);assert.equal(cache.get(p,'EVO_F1'),skillDamageMultiplier(p,'EVO_F1'));
  }
});
