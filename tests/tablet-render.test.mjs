import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpriteScaleCache } from '../game/src/runtime-performance.js';
import { distanceComparator } from '../game/src/element-combat.js';

test('cached distance sorting retains the old comparator order: 10000 seeds, ties and targeting penalties', () => {
  let state=10808;
  const rng=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let seed=0;seed<10000;seed++){
    const at={x:rng()*1000,y:rng()*1000};
    const enemies=Array.from({length:24+seed%137},(_,id)=>({id,x:Math.round(rng()*30)*32,y:Math.round(rng()*30)*32,claimed:rng()<.5}));
    // Exact ties, very large coordinates and fractional distances are all legal.
    enemies[1]={...enemies[0],id:1};
    if(seed%3===0){at.x=0;at.y=0;enemies[2].x=1e12;enemies[3].x=1e12+.001;}
    const distance=e=>Math.hypot(e.x-at.x,e.y-at.y);
    for(const penalty of [null,e=>e.claimed?96:0]){
      const old=penalty?(a,b)=>distance(a)+penalty(a)-distance(b)-penalty(b):(a,b)=>distance(a)-distance(b);
      const comparator=distanceComparator(at,penalty);
      assert.deepEqual([...enemies].sort(comparator).map(e=>e.id),[...enemies].sort(old).map(e=>e.id),`seed ${seed}`);
      assert.equal(comparator(enemies[0],enemies[1]),old(enemies[0],enemies[1]));
    }
  }
});

test('sprite scale cache coalesces pending work, retains recent sizes and closes evicted bitmaps', async()=>{
  const source={naturalWidth:256,naturalHeight:256};let builds=0,closed=0;
  const cache=createSpriteScaleCache(2,async(_,options)=>{builds++;return {width:options.resizeWidth,height:options.resizeHeight,close(){closed++;}};});
  assert.equal(cache.get(source,32),source);assert.equal(cache.get(source,32),source);assert.equal(builds,1);
  await Promise.resolve();
  assert.equal(cache.get(source,32).height,32);
  cache.get(source,64);await Promise.resolve();
  cache.get(source,64);cache.get(source,96);await Promise.resolve();
  assert.equal(cache.size,2);assert.equal(closed,1);
  cache.clear();assert.equal(cache.size,0);assert.equal(closed,3);
});

test('a late bitmap completion is closed if its cache entry was evicted or cleared',async()=>{
  const source={naturalWidth:256,naturalHeight:256};const resolves=[];let closed=0;
  const cache=createSpriteScaleCache(1,()=>new Promise(resolve=>resolves.push(resolve)));
  cache.get(source,16);cache.get(source,32);
  resolves[0]({close(){closed++;}});await Promise.resolve();assert.equal(closed,1);
  cache.clear();resolves[1]({close(){closed++;}});await Promise.resolve();assert.equal(closed,2);assert.equal(cache.size,0);
});

test('unsupported resize or an already-small sprite retains the original without endless retries',async()=>{
  const source={naturalWidth:256,naturalHeight:256};let builds=0;
  const cache=createSpriteScaleCache(2,()=>{builds++;return Promise.reject(new Error('unsupported'));});
  assert.equal(cache.get(source,240),source);assert.equal(builds,0);
  cache.get(source,32);await Promise.resolve();await Promise.resolve();
  assert.equal(cache.get(source,32),source);assert.equal(builds,1);
  assert.equal(createSpriteScaleCache(2,null).get(source,32),source);
});
