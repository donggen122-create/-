import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as R from '../game/src/rework-core.js';
import {createElementCombat} from '../game/src/element-combat.js';
import {migrate,guardianAPI,getProfile,passStatus} from '../server/src/guardian.js';
import {repairObsoleteParts,migrateProfileV2,PARTS_FIX_SNAPSHOT} from '../server/src/profile-migration-v2.js';
import {createFrameClock,createRenderQuality,setText} from '../game/src/runtime-performance.js';
const rngSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function partProfile(ids=['PART_F1']){const p=R.freshProfile();p.stages.CH01={cleared:true,stars:1};p.gifts=20;for(const id of ids)R.addPart(p,id);return p;}

test('first choice and rerolls: 10,000 seeds always include a valid equipped skill even at low HP',()=>{
 for(const ids of [['PART_F1'],['PART_F1','PART_W1','PART_E1']]){
  const p=partProfile(ids),expected=new Set(ids.map(id=>R.PARTS[id].skill));
  for(let i=0;i<10000;i++){
   const random=rngSeed(i),state={};
   for(let n=0;n<2;n++){
    const cards=R.cardChoices(p,{},state,n?.2:1,random);
    assert.ok(cards.some(c=>expected.has(c.id)));assert.equal(cards.length,3);assert.equal(new Set(cards.map(c=>c.kind+':'+c.id)).size,3);
   }
  }
 }
});
test('invalid equipped entries cannot grant a card; no-part RNG calls retain original path',()=>{
 const p=R.freshProfile();p.equippedParts=['PART_F1','NOT_REAL'];let calls=0;
 const cards=R.cardChoices(p,{}, {},1,()=>{calls++;return .3;});assert.equal(calls,3);
 assert.deepEqual(cards,R.cardChoices(R.freshProfile(),{},{},1,()=>.3));assert.deepEqual(p.parts,{});
});
test('completed choice is rejected without consuming rewards or free milestone',()=>{
 const p=partProfile();p.parts.PART_F1.copies=7;p.giftCounts.part=4;const before=structuredClone(p);
 assert.throws(()=>R.action(p,{kind:'draw-part',id:'PART_F1'}),/특급/);
 assert.throws(()=>R.action(p,{kind:'choose-part',id:'PART_F1'}),/특급/);assert.deepEqual(p,before);
 const next=R.action(p,{kind:'draw-part',id:'PART_W1'}).profile;assert.equal(next.gifts,19);assert.equal(next.giftCounts.part,5);assert.equal(next.parts.PART_W1.copies,1);
});
test('first reward stays one free part and does not advance draw counter',()=>{
 const p=partProfile([]),next=R.action(p,{kind:'choose-part',id:'PART_L1'}).profile;
 assert.equal(next.gifts,p.gifts);assert.equal(next.giftCounts.part,0);assert.deepEqual(next.equippedParts,['PART_L1']);
});
test('part activity uses run snapshot and evolved skills; duplicate equipped IDs are counted once',()=>{
 const p=partProfile(['PART_F1','PART_W1']);
 const r=R.completeRun(p,{stage:'CH01',cleared:false,seconds:15,equippedPartIds:['PART_F1','PART_F1','PART_W1','evil'],fusionIds:['EVO_F1']});
 assert.deepEqual(r.profile.partUsage,{PART_F1:{equipped:1,active:1},PART_W1:{equipped:1,active:0}});
 assert.equal(R.completeRun(p,{stage:'CH01',cleared:false,seconds:0}).profile.partUsage,undefined);
});
function combat(id,part,targets=Array.from({length:18},(_,i)=>({id:i,x:48+(i%6)*25,y:(Math.floor(i/6)-1)*35,hp:1e9,radiusU:.4}))){
 const p={x:0,y:0,atk:30,skills:{[id]:{lv:3,cd:0}}},profile=partProfile(part?['PART_'+(R.COMBOS[id]?.skill||id)]:[]),hits=[],blasts=[];
 const engine=createElementCombat({getPlayer:()=>p,getEnemies:()=>targets,getProfile:()=>profile,damage:(e,n)=>hits.push({id:e.id,n}),onBlast:(at,r)=>blasts.push(r)});
 return {engine,p,hits,blasts,targets,run(s){for(let t=0;t<s-1e-9;t+=.01)engine.update(.01);}};
}
test('F1 evolved lava is six seconds with part, five without',()=>{
 for(const [part,life] of [[true,6],[false,5]]){const f=combat('EVO_F1',part);f.run(.5);const s=f.engine.snapshot();assert.equal(s.fields,3);for(const d of s.fieldDetails)assert.ok(Math.abs(d.life+d.age-life)<1e-8);assert.equal(s.parts.EVO_F1||0,part?3:0);}
});
test('F2 evolved part adds 15% radius only; no part means original radius',()=>{
 const base=combat('EVO_F2',false),boost=combat('EVO_F2',true);base.run(.35);boost.run(.35);
 assert.ok(base.blasts.length&&boost.blasts.length);assert.ok(Math.abs(boost.blasts[0]/base.blasts[0]-1.15)<1e-9);assert.ok(boost.engine.snapshot().parts.EVO_F2>0);assert.equal(base.engine.snapshot().parts.EVO_F2,undefined);
});
test('W1 evolved balloon gains two extra bounces, with no premature activation credit',()=>{
 for(const part of [false,true]){const f=combat('EVO_W1',part,[{x:220,y:0,hp:1e9,radiusU:.4}]);f.run(.01);for(const s of f.engine.snapshot().shotDetails)assert.equal(s.bounces,part?12:10);assert.equal(f.engine.snapshot().parts.EVO_W1,undefined);}
});
test('E1 boulder splits once per boulder, small stones do not recurse',()=>{
 const f=combat('EVO_E1',true);f.run(.5);let s=f.engine.snapshot();assert.ok(s.parts.EVO_E1>0);assert.ok(s.parts.EVO_E1<=2);assert.ok(s.shots<=6);f.run(.6);s=f.engine.snapshot();assert.ok(s.parts.EVO_E1<=2);
 const no=combat('EVO_E1',false);no.run(.5);assert.equal(no.engine.snapshot().parts.EVO_E1,undefined);assert.ok(!no.engine.snapshot().shotDetails.some(s=>s.small));
});
test('L1 storm adds one 30% bolt per tick only when another target exists',()=>{
 const no=combat('EVO_L1',false),yes=combat('EVO_L1',true);no.run(.4);yes.run(.4);assert.equal(yes.engine.snapshot().parts.EVO_L1,2);assert.equal(yes.hits.length-no.hits.length,2);
 assert.ok(yes.hits.some(h=>Math.abs(h.n-30*R.COMBOS.EVO_L1.dmgCoef*1.9*.3)<1e-8));
 const one=combat('EVO_L1',true,[{x:80,y:0,hp:1e9,radiusU:.4}]);one.run(.4);assert.equal(one.engine.snapshot().parts.EVO_L1,undefined);
});
test('sustained evolved parts obey existing entity bounds',()=>{
 const f=combat('EVO_E1',true);f.p.skills={EVO_F1:{lv:3},EVO_F2:{lv:3},EVO_E1:{lv:3},EVO_L1:{lv:3}};
 for(let i=0;i<30;i++){f.run(1);const s=f.engine.snapshot();assert.ok(s.shots<=120&&s.fields<=48&&s.effects<=140&&s.scheduled<=260);}
});
test('obsolete repair conserves value and is repeatable; same element mappings accumulate instead of overwrite',()=>{
 const p=partProfile(['PART_E2']);p.parts.PART_E2={copies:5,level:4};p.parts.PART_E3={copies:6,level:3};p.parts.PART_V3={copies:1,level:1};p.equippedParts=['PART_E3','PART_E2','PART_V3'];p.coins=123;
 const r=repairObsoleteParts(p);assert.equal(r.parts.PART_E2.copies,7);assert.equal(r.parts.PART_E2.level,4);assert.equal(r.gifts,p.gifts+4);assert.equal(r.coins,123+140);assert.deepEqual(r.equippedParts,['PART_E2','PART_V2']);assert.equal(r.parts.PART_E3,undefined);assert.deepEqual(repairObsoleteParts(r),r);assert.equal(p.parts.PART_E3.copies,6);
 const old={version:1,coins:77,gifts:2,gear:{seed_ARM:5,seed_BTS:6},equipped:{ARM:'seed_ARM',BTS:'seed_BTS'}};
 const migrated=migrateProfileV2(old);assert.equal(migrated.parts.PART_E2.copies,7);assert.equal(migrated.gifts,6);assert.deepEqual(migrated.equippedParts,['PART_E2']);assert.equal(migrated.coins,77);
});
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(){return db.sql.prepare(sql).get(...this.args)||null;},async all(){return {results:db.sql.prepare(sql).all(...this.args)};},async run(){return {meta:{changes:Number(db.sql.prepare(sql).run(...this.args).changes)}};}};}
 async batch(statements){this.sql.exec('BEGIN IMMEDIATE');try{const r=[];for(const s of statements)r.push(await s.run());this.sql.exec('COMMIT');return r;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const now=Date.parse('2026-09-23T01:00Z');let serial=0;const uid=()=>`stage1_test_${++serial}`;
async function setup(p){const DB=new D1();DB.sql.prepare('INSERT INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,?,?,?)').run('qa','qa','x','y',now);await migrate(DB);DB.sql.prepare('INSERT INTO guardian_profiles(user_id,state) VALUES(?,?)').run('qa',JSON.stringify(p||R.freshProfile()));return {DB};}
async function api(env,path,body,t=now){const res=await guardianAPI(new Request('http://local/api'+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify({clientVersion:2,requestId:uid(),...body})}:{})}),env,{id:'qa'},path,t);return {status:res.status,...await res.json()};}
test('server snapshots repair exactly once and preserves protocol version and unrelated account fields',async()=>{
 const p=partProfile();p.parts.PART_W3={copies:3,level:2};const env=await setup(p);
 const first=await getProfile(env.DB,'qa'),second=await getProfile(env.DB,'qa');assert.deepEqual(first,second);assert.equal(first.profile.version,2);assert.equal(first.profile.coins,60);assert.deepEqual(first.profile.stages,p.stages);
 const rows=env.DB.sql.prepare('SELECT * FROM guardian_profile_snapshots').all();assert.equal(rows.length,1);assert.equal(rows[0].target_version,PARTS_FIX_SNAPSHOT);assert.deepEqual(JSON.parse(rows[0].state),p);
});
test('server repair revision conflict retries rather than overwriting a simultaneous teacher grant',async()=>{
 const p=partProfile();p.parts.PART_W3={copies:1,level:1};const env=await setup(p),batch=env.DB.batch.bind(env.DB);let race=true;
 env.DB.batch=async statements=>{if(race){race=false;env.DB.sql.exec("UPDATE guardian_profiles SET state=json_set(state,'$.coins',55), revision=revision+1");}return batch(statements);};
 const r=await getProfile(env.DB,'qa');assert.equal(r.profile.coins,55);assert.equal(r.profile.parts.PART_W2.copies,1);const snapshot=env.DB.sql.prepare('SELECT state FROM guardian_profile_snapshots').get();assert.equal(JSON.parse(snapshot.state).coins,55);
});
test('30-minute expiry on lobby and start is free; five-minute active run is preserved',async()=>{
 const env=await setup();const s=await api(env,'/play/start',{stage:'CH01'});assert.equal((await api(env,'/guardian',null,now+300000)).active.id,s.runId);
 assert.ok((await api(env,'/guardian',null,now+1800000)).active);
 const expired=await api(env,'/guardian',null,now+1800001);assert.equal(expired.active,null);assert.equal(expired.profile.runs,0);assert.equal(expired.passes.remaining,10);
 assert.equal((await api(env,'/play/start',{stage:'CH01',requestId:s.runId},now+1800001)).status,409);
 assert.equal((await api(env,'/play/start',{stage:'CH01'},now+1800001)).status,200);
 const other=await setup();await api(other,'/play/start',{stage:'CH01'});assert.equal((await api(other,'/play/start',{stage:'CH01'},now+1800001)).status,200);
});
test('server records run-start equipment, counts evolved use, and never doubles settlement',async()=>{
 const env=await setup(partProfile(['PART_F1','PART_W1'])),s=await api(env,'/play/start',{stage:'CH01'});
 await api(env,'/guardian/action',{kind:'unequip-part',id:'PART_F1'});
 const payload={runId:s.runId,cleared:false,seconds:20,fusionIds:['EVO_F1'],equippedPartIds:['PART_E1']};
 const r=await api(env,'/play/finish',payload,now+20000),dup=await api(env,'/play/finish',payload,now+20000);
 assert.deepEqual(r.profile.partUsage,{PART_F1:{equipped:1,active:1},PART_W1:{equipped:1,active:0}});assert.deepEqual(dup.profile.partUsage,r.profile.partUsage);assert.equal(r.passes.remaining,10);
});
test('full-part choice is rejected by API too and leaves currency and counter intact',async()=>{
 const p=partProfile();p.parts.PART_F1.copies=7;p.giftCounts.part=4;const env=await setup(p);
 const r=await api(env,'/guardian/action',{kind:'draw-part',id:'PART_F1'});assert.equal(r.status,400);assert.deepEqual((await getProfile(env.DB,'qa')).profile,p);
});
for(const hz of [30,60,120,144])test(`fixed step advances exactly 60 simulated ticks in one second at ${hz}Hz`,()=>{
 const clock=createFrameClock();let ticks=0;for(let i=0;i<hz;i++)ticks+=clock.advance(1/hz);assert.equal(ticks,60);
});
test('overdue frame is bounded; pause clears fractional remainder and background time',()=>{
 const c=createFrameClock();assert.equal(c.advance(10),4);assert.equal(c.advance(0),0);c.advance(1/120);assert.equal(c.advance(3,false),0);assert.equal(c.advance(1/120),0);assert.equal(c.advance(1/120),1);
});
test('adaptive quality uses hysteresis and never increases beyond device resolution',()=>{
 const q=createRenderQuality(2);for(let i=0;i<40;i++)q.sample(.06);assert.equal(q.ratio,1.5);
 for(let i=0;i<30;i++)q.sample(.06);assert.equal(q.ratio,1.5);for(let i=0;i<400;i++)q.sample(.06);assert.equal(q.ratio,1);
 for(let i=0;i<180;i++)q.sample(1/60);assert.equal(q.ratio,1);for(let i=0;i<2100;i++)q.sample(1/60);assert.ok(q.ratio>1&&q.ratio<=2);
 const low=createRenderQuality(1);for(let i=0;i<500;i++)low.sample(.1);assert.equal(low.ratio,1);
});
test('unchanged HUD text causes zero DOM writes',()=>{
 let changes=0,text='same';const node={get textContent(){return text;},set textContent(v){changes++;text=v;}};
 for(let i=0;i<1000;i++)setText(node,'same');assert.equal(changes,0);assert.equal(setText(node,'changed'),true);assert.equal(changes,1);
});
