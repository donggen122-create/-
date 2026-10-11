import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateStageStats,stageStats} from '../server/src/stage-stats.js';
const now=1800000000000,perf={v:'test',fps:60,p1:30,long33:.02,long50:.01,q:2,qmax:3,ratio:.85,dev:'tablet',w:1024,h:768,dpr:1.5,sec:180};
const run=(user_id,stage,status,result={},started_at=now)=>({user_id,stage,status,result:JSON.stringify(result),started_at});
const profile=(user_id,highest)=>({user_id,state:JSON.stringify({stages:Object.fromEntries(Array.from({length:highest},(_,i)=>['CH'+String(i+1).padStart(2,'0'),{cleared:true}]))})});
test('stage stats: deduplicated students, current stopped students, won rate, old difficulty, test account and period exclusion',()=>{
 const runs=[run('a','CH02','lost',{loadout:{difficulty:'easy'},perf,cause:{id:'T1_BOTTLE',kind:'enemy',at:60}}),run('a','CH02','lost',{perf:{...perf,fps:30,p1:15}}),run('b','CH02','won',{loadout:{difficulty:'normal'}}),run('qa','CH02','won',{perf}),run('test23','CH02','lost'),run('c','CH02','lost',{},now-40*86400000),run('a','CH03','active',{loadout:{difficulty:'hard'}})];
 const profiles=[profile('a',1),profile('b',2),profile('c',1),profile('qa',1)];
 const stats=aggregateStageStats(runs,profiles,{now});const s=stats.stages[1];
 assert.equal(stats.stages.length,20);assert.equal(s.attempts,3);assert.equal(s.wins,1);assert.equal(s.winRate,33.33);assert.equal(s.students,2);assert.equal(s.stopped,1);assert.deepEqual(s.difficulty.unknown,[1,0]);assert.deepEqual(s.difficulty.normal,[1,1]);assert.equal(s.perf.fps,45);assert.equal(s.perf.long50,.01);assert.equal(s.causes[0].n,1);assert.equal(stats.devices[0].n,2);assert.equal(stats.stages[2].stopped,0);
 assert.equal(aggregateStageStats(runs,profiles,{now,days:'all'}).stages[1].attempts,4);
 assert.deepEqual(aggregateStageStats(runs,profiles,{now,stage:'CH01'}).devices,[]);
 assert.ok(!JSON.stringify(stats).includes('user_id'));
});
test('unknown malformed diagnostics do not affect attempt totals; causes bounded to top three',()=>{
 const rows=Array.from({length:10},(_,i)=>run('u','CH01','lost',{cause:{id:'enemy'+i,kind:'enemy',at:2},perf:{...perf,dev:'invalid'}}));rows.push(run('u','CH01','lost','invalid-json'));
 const s=aggregateStageStats(rows,[profile('u',0)],{now}).stages[0];assert.equal(s.attempts,11);assert.equal(s.perf.n,0);assert.equal(s.causes.length,3);assert.equal(s.stopped,1);
});
test('120 students / 5,000 diverse runs: response remains under 50 KB with or without stage filter',()=>{
 const profiles=Array.from({length:120},(_,i)=>profile('u'+i,i%20));
 const buckets=[320,375,768,1024,1280,1600];
 const rows=Array.from({length:5000},(_,i)=>run('u'+i%120,'CH'+String(i%20+1).padStart(2,'0'),i%3?'lost':'won',{loadout:{difficulty:['easy','normal','hard'][i%3]},perf:{...perf,dev:['phone','tablet','pc'][i%3],w:buckets[Math.floor(i/3)%6],h:buckets[Math.floor(i/18)%6]},cause:{id:'enemy'+i%10,kind:'enemy',at:2}}));
 for(const stage of [null,'CH03']){const stats=aggregateStageStats(rows,profiles,{now,stage});assert.ok(Buffer.byteLength(JSON.stringify(stats))<50000);assert.ok(stats.devices.length<=108);console.log('stage-stats bytes',stage||'all',Buffer.byteLength(JSON.stringify(stats)));}
});
test('invalid period/stage rejected without DB access',async()=>{
 for(const query of ['days=0','days=NaN','days=50000','days=-1','stage=CH21'])assert.ok((await stageStats(null,new URL('http://local/?'+query))).error);
});
test('50ms proportions retain four decimal places in medians',()=>{
 const rows=[run('u','CH01','lost',{perf:{...perf,long50:.0123}}),run('u','CH01','lost',{perf:{...perf,long50:.0125}})];
 const stats=aggregateStageStats(rows,[profile('u',0)],{now});assert.equal(stats.stages[0].perf.long50,.0124);assert.equal(stats.devices[0].long50,.0124);
});
