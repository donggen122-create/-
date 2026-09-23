import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {migrate,guardianAPI,guardianAdmin,dayKey,nextReset,getProfile,passStatus} from '../server/src/guardian.js';
import * as R from '../game/src/rework-core.js';
import {migrateLegacy} from '../server/src/legacy-migration.js';
class D1 {
  constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8'));}
  prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(){return db.sql.prepare(sql).get(...this.args)||null;},async all(){return {results:db.sql.prepare(sql).all(...this.args)};},async run(){const r=db.sql.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes)},success:true};}};}
  async batch(statements){this.sql.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());this.sql.exec('COMMIT');return out;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const start=Date.parse('2026-09-22T01:00:00Z');
async function setup(){const db=new D1();db.sql.prepare('INSERT INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,?,?,?)').run('test','test','x','y',start);await migrate(db);return {DB:db};}
const user={id:'test'};
let seq=0;
const uid=()=>`test_request_${++seq}`;
async function api(env,path,body,now=start){const r=await guardianAPI(new Request(`http://local/api${path}`,{method:body?'POST':'GET',...(body?{body:JSON.stringify({clientVersion:2,...body})}:{})}),env,user,path,now);return {status:r.status,...await r.json()};}
async function run(env,cleared=true,now=start,seconds=300){const s=await api(env,'/play/start',{requestId:uid(),stage:'CH01'},now);assert.equal(s.status,200);return api(env,'/play/finish',{requestId:uid(),runId:s.runId,cleared,seconds},now+seconds*1000);}
test('Korea 08:00 boundary, including a UTC year boundary',()=>{
  const a=Date.parse('2026-09-21T22:59:59.999Z'),b=a+1;
  assert.equal(dayKey(a),'2026-09-21');assert.equal(dayKey(b),'2026-09-22');assert.equal(nextReset(a),b);assert.equal(nextReset(b),b+86400000);
  assert.equal(dayKey(Date.parse('2026-12-31T23:00:00Z')),'2027-01-01');
});
test('ten clears consume ten passes; failures and duplicate settlement consume none',async()=>{
  const env=await setup();const s=await api(env,'/play/start',{requestId:uid(),stage:'CH01'});
  assert.equal(s.passes.remaining,10);
  const payload={requestId:uid(),runId:s.runId,cleared:false,seconds:170};
  const loss=await api(env,'/play/finish',payload,start+170000);assert.equal(loss.charged,0);assert.equal(loss.passes.remaining,10);
  const dup=await api(env,'/play/finish',{...payload,cleared:true},start+300000);assert.equal(dup.cleared,false);assert.equal(dup.profile.runs,1);
  for(let i=0;i<10;i++){const r=await run(env,true,start+i*400000);assert.equal(r.passes.remaining,9-i);}
  const blocked=await api(env,'/play/start',{requestId:uid(),stage:'CH01'},start+4000000);assert.equal(blocked.code,'NO_PASSES');
});
test('new morning restores exactly ten; clear spanning 08:00 charges the new day',async()=>{
  const env=await setup(),before=Date.parse('2026-09-21T22:58:00Z');
  const s=await api(env,'/play/start',{requestId:uid(),stage:'CH01'},before);
  const won=await api(env,'/play/finish',{requestId:uid(),runId:s.runId,cleared:true,seconds:180},before+180000);
  assert.equal(won.passes.day,'2026-09-22');assert.equal(won.passes.remaining,9);
  assert.equal((await passStatus(env.DB,user.id,before)).remaining,10);
  assert.equal((await passStatus(env.DB,user.id,before+86400000+180000)).remaining,10);
});
test('administrator extra passes are audited, idempotent, used after base and expire at 08:00',async()=>{
  const env=await setup(),body={requestId:uid(),id:'test',passes:2,gold:80,note:'수업 보충'};
  const grant=()=>guardianAdmin(new Request('http://local',{method:'POST',body:JSON.stringify({clientVersion:2,...body})}),env,'grant-passes','POST',start);
  await grant();await grant();assert.equal((await passStatus(env.DB,'test',start)).remaining,12);assert.equal((await getProfile(env.DB,'test')).profile.coins,80);
  for(let i=0;i<11;i++)await run(env,true,start+i*400000);
  const p=await passStatus(env.DB,'test',start+4400000);assert.equal(p.baseRemaining,0);assert.equal(p.bonusRemaining,1);
  const next=await passStatus(env.DB,'test',nextReset(start));assert.equal(next.remaining,10);assert.equal(next.bonusRemaining,0);
  assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM play_admin_grants').get().n,1);
});
test('server rejects unfinished victories, locked stages and client-supplied pass counts',async()=>{
  const env=await setup();assert.equal((await api(env,'/play/start',{requestId:uid(),stage:'CH05'})).status,400);
  const s=await api(env,'/play/start',{requestId:uid(),stage:'CH01',passes:999});
  assert.equal((await api(env,'/play/finish',{requestId:uid(),runId:s.runId,cleared:true,seconds:300},start+1000)).status,400);
  assert.equal((await passStatus(env.DB,'test',start)).remaining,10);
  assert.equal((await api(env,'/guardian/action',{requestId:uid(),kind:'grant-passes',passes:999})).status,400);
});
test('actions use optimistic revision and idempotent request IDs',async()=>{
  const env=await setup();const p=await getProfile(env.DB,'test');p.profile.coins=1000;env.DB.sql.prepare('UPDATE guardian_profiles SET state=?').run(JSON.stringify(p.profile));
  const a={requestId:uid(),kind:'train',stat:'attack'};
  const r=await api(env,'/guardian/action',a);const dup=await api(env,'/guardian/action',a);
  assert.equal(r.profile.coins,900);assert.equal(dup.profile.coins,900);assert.equal(dup.profile.training.attack,2);
});
test('rewards, two qualifying losses, guaranteed milestones and no pass rewards',()=>{
  let p=R.freshProfile();let r=R.completeRun(p,{stage:'CH01',cleared:true,seconds:180});assert.equal(r.reward.coins,192);assert.equal(r.reward.gifts,1);p=r.profile;
  r=R.completeRun(p,{stage:'CH01',cleared:false,seconds:149});assert.equal(r.profile.failRemainder,0);
  r=R.completeRun(p,{stage:'CH01',cleared:false,seconds:150});p=r.profile;assert.equal(p.failRemainder,1);
  p=R.completeRun(p,{stage:'CH01',cleared:true,seconds:300}).profile;assert.equal(p.failRemainder,1);
  r=R.completeRun(p,{stage:'CH01',cleared:false,seconds:150});assert.equal(r.reward.gifts,1);assert.equal(r.profile.failRemainder,0);
  p=R.completeRun(r.profile,{stage:'CH05',cleared:true,seconds:290,litter:5,bossSeconds:70,difficulty:'hard'}).profile;assert.equal(p.stages.CH05.stars,3);assert.equal(p.gifts,r.profile.gifts+2);assert.ok(!('passes' in p));
});
test('legacy migration preserves originals, gold, stars, equipment investment and animal roles',()=>{
  const old={currencies:{GOLD:900,DUST:75},hero:'minji',progress:{chapters:{CH02:{cleared:true,stars:3,bestClearS:200}}},inv:[{uid:1,id:'EQ01',grade:4,lv:2},{uid:2,id:'EQ01',grade:0,lv:0}],pets:{PT07:{lv:3},PT03:{lv:1}},activePet:'PT07',stats:{runs:20,clears:3}};
  const before=JSON.stringify(old),p=migrateLegacy(old);
  assert.equal(JSON.stringify(old),before);assert.equal(p.stages.CH02.stars,3);assert.equal(p.hero,'minji');assert.equal(p.gear.seed_WPN,7);assert.equal(p.levels.WPN,1);
  assert.equal(p.migration.upgradeRefund,Math.round(8*5)+Math.round(8*5*2**1.2));assert.equal(p.coins,900+p.migration.upgradeRefund+60);
  assert.equal(p.activePet,'cat');assert.ok(p.pets.includes('turtle'));assert.equal(p.friendship,8);assert.equal(p.migration.archivedCurrencies.DUST,75);
  const v3=migrateLegacy({equipment:{EQ01:{grade:2,lv:0}}});assert.equal(v3.gear.seed_WPN,3);
  const actualSave=migrateLegacy({progress:{chapters:{CH01:{cleared:true,stars:[true,false,true],bestClearS:180},CH02:{cleared:true,stars:[true,true,true]}}}});
  assert.equal(actualSave.stages.CH01.stars,2);assert.equal(actualSave.stages.CH02.stars,3);
});

test('v2 migration snapshots the exact v1 profile once and preserves concurrent admin currency/pass grants',async()=>{
 const env=await setup(),db=env.DB,old=migrateLegacy({});old.coins=320;old.gifts=4;old.gear={water_WPN:7};old.equipped.WPN='water_WPN';old.levels.WPN=6;
 db.sql.prepare('INSERT INTO guardian_profiles(user_id,state,revision) VALUES(?,?,?)').run('test',JSON.stringify(old),5);
 db.sql.prepare('INSERT INTO play_days(user_id,day,base_used,bonus_granted,bonus_used) VALUES(?,?,?,?,?)').run('test',dayKey(start),7,2,0);
 const originalBatch=db.batch.bind(db);let injected=false;
 db.batch=async statements=>{if(!injected){injected=true;db.sql.prepare('INSERT INTO play_admin_grants(request_id,user_id,day,passes,gold,note,created_at) VALUES(?,?,?,?,?,?,?)').run('migration_grant','test',dayKey(start),1,80,'migration race',start);}return originalBatch(statements);};
 const a=await getProfile(db,'test'),b=await getProfile(db,'test');assert.equal(a.profile.version,2);assert.equal(a.profile.coins,400);assert.deepEqual(a.profile,b.profile);assert.equal(a.profile.training.attack,6);assert.equal(a.profile.parts.PART_W1.copies,7);
 const snapshots=db.sql.prepare('SELECT * FROM guardian_profile_snapshots').all();assert.equal(snapshots.length,1);assert.deepEqual(JSON.parse(snapshots[0].state),{...old,coins:400});assert.equal(snapshots[0].revision,6);
 const passes=await passStatus(db,'test',start);assert.equal(passes.baseRemaining,3);assert.equal(passes.bonusRemaining,3);
});
test('old clients cannot start or mutate v2 profiles; an already active old run can settle once',async()=>{
 const env=await setup();const bad=await api(env,'/play/start',{requestId:uid(),stage:'CH01',clientVersion:1});assert.equal(bad.code,'CLIENT_UPDATE_REQUIRED');
 const s=await api(env,'/play/start',{requestId:uid(),stage:'CH01'});const action=await api(env,'/guardian/action',{requestId:uid(),kind:'settings',hero:'minji',clientVersion:1});assert.equal(action.code,'CLIENT_UPDATE_REQUIRED');
 const f=await api(env,'/play/finish',{requestId:uid(),runId:s.runId,cleared:true,seconds:180,clientVersion:1},start+180000);assert.equal(f.status,200);assert.equal(f.passes.remaining,9);assert.equal(f.profile.hero,'hoya');
});
test('first part, drawing, upgrades and refunds are idempotent across duplicate requests',async()=>{
 const env=await setup();await run(env);let {profile}=await getProfile(env.DB,'test');profile.coins=2000;profile.gifts=10;env.DB.sql.prepare('UPDATE guardian_profiles SET state=?').run(JSON.stringify(profile));
 const choose={requestId:uid(),kind:'choose-part',id:'PART_F1'};let first=await api(env,'/guardian/action',choose),dup=await api(env,'/guardian/action',choose);assert.equal(dup.profile.parts.PART_F1.copies,1);assert.equal(dup.profile.gifts,10);
 // 2차 보급: 가진 종류 3개 미만이면 없는 파츠 고르기, 그다음 원소 보급, 5번째는 고른 파츠 3개
 for(const a of [{mode:'new',id:'PART_W1'},{mode:'new',id:'PART_V1'},{mode:'element',element:'fire'},{mode:'element',element:'water'}])assert.ok((await api(env,'/guardian/action',{requestId:uid(),kind:'draw-part',...a})).draw);
 const draw={requestId:uid(),kind:'draw-part',mode:'pick',id:'PART_L2'};first=await api(env,'/guardian/action',draw);dup=await api(env,'/guardian/action',draw);assert.equal(dup.profile.parts.PART_L2.copies,3);assert.equal(dup.profile.gifts,5);assert.equal(dup.profile.giftCounts.part,5);
 assert.deepEqual(dup.draw,first.draw,'같은 요청은 같은 결과 카드');assert.equal(first.draw.qty,3);assert.equal(dup.profile.coins,2000);
 const upgrade={requestId:uid(),kind:'upgrade-part',id:'PART_F1'};first=await api(env,'/guardian/action',upgrade);dup=await api(env,'/guardian/action',upgrade);assert.equal(dup.profile.parts.PART_F1.level,2);assert.equal(dup.profile.coins,1940);
 const reset={requestId:uid(),kind:'reset-part',id:'PART_F1'};first=await api(env,'/guardian/action',reset);dup=await api(env,'/guardian/action',reset);assert.equal(dup.profile.parts.PART_F1.level,1);assert.equal(dup.profile.coins,2000);assert.equal(dup.passes.remaining,9);
});

test('difficulty is locked during an active run and decides the stars at settlement',async()=>{
  const env=await setup();
  const hard=await api(env,'/guardian/action',{requestId:uid(),kind:'settings',difficulty:'hard',weaponMode:'ranged',hero:'hoya'});assert.equal(hard.status,200);assert.equal(hard.profile.difficulty,'hard');
  const s=await api(env,'/play/start',{requestId:uid(),stage:'CH01'});assert.equal(s.status,200);
  const lower=await api(env,'/guardian/action',{requestId:uid(),kind:'settings',difficulty:'easy'});assert.equal(lower.status,409);assert.equal(lower.code,'ACTIVE_RUN');
  const hero=await api(env,'/guardian/action',{requestId:uid(),kind:'settings',hero:'minji',difficulty:'hard'});assert.equal(hero.status,200,'같은 난이도로 주인공만 바꾸는 것은 허용');
  const won=await api(env,'/play/finish',{requestId:uid(),runId:s.runId,cleared:true,seconds:180,litter:3,hpFraction:.1},start+180000);
  assert.equal(won.reward.stars,3);assert.equal(won.reward.difficulty,'hard');assert.equal(won.profile.stages.CH01.stars,3);
  const easy=await api(env,'/guardian/action',{requestId:uid(),kind:'settings',difficulty:'easy'},start+181000);assert.equal(easy.status,200,'도전이 끝나면 다시 바꿀 수 있다');
});
test('Chuseok event: 2026-09-24..26 (8am KST days) give 20 passes a day, granted once, shown as passes.event, hidden from admin audit', async()=>{
  const env=await setup();
  const before=Date.parse('2026-09-23T22:59:00Z'), d24=Date.parse('2026-09-24T01:00:00Z'), lastDay=Date.parse('2026-09-26T22:59:00Z'), after=Date.parse('2026-09-26T23:00:00Z');
  const pre=await api(env,'/guardian',null,before);assert.equal(pre.passes.remaining,10);assert.equal(pre.passes.event,null,'24일 아침 8시 전은 평소');
  const g=await api(env,'/guardian',null,d24);assert.equal(g.passes.remaining,20);assert.equal(g.passes.event.id,'chuseok2026');assert.equal(g.passes.event.dailyTotal,20);
  assert.equal((await api(env,'/guardian',null,d24+60000)).passes.remaining,20,'여러 번 접속해도 한 번만 더해진다');
  for(let i=0;i<20;i++){const r=await run(env,true,d24+i*400000);assert.equal(r.passes.remaining,19-i);}
  const blocked=await api(env,'/play/start',{requestId:uid(),stage:'CH01'},d24+20*400000);assert.equal(blocked.code,'NO_PASSES');
  const last=await api(env,'/guardian',null,lastDay);assert.equal(last.passes.day,'2026-09-26');assert.equal(last.passes.remaining,20);
  const done=await api(env,'/guardian',null,after);assert.equal(done.passes.day,'2026-09-27');assert.equal(done.passes.remaining,10);assert.equal(done.passes.event,null,'27일 아침 8시부터 평소');
  const admin=await guardianAdmin(new Request('http://local/api/admin/passes'),env,'passes','GET',d24);const body=await admin.json();
  assert.ok(body.audit.every(a=>!String(a.request_id).startsWith('event-')),'이벤트 자동 지급은 기록 목록에 없음');assert.equal(body.event.id,'chuseok2026');
});