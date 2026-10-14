import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import * as R from '../game/src/rework-core.js';
import {migrate,guardianAPI,guardianAdmin} from '../server/src/guardian.js';
import {createDamageTracker,DAMAGE_TARGET_NAMES} from '../game/src/damage-summary.js';

test('skill measurement presets fix all conditions and use the two matching parts in each non-normal grade',()=>{
 for(const element of Object.keys(R.ELEMENTS))for(const grade of [1,2,3,4]){
  const p=R.skillTestProfile(R.freshProfile(),{element,grade,hero:'minji',since:123});
  const ids=Object.keys(R.PARTS).filter(id=>R.PARTS[id].element===element);
  assert.equal(ids.length,2);assert.deepEqual(Object.keys(p.parts),ids);assert.deepEqual(p.equippedParts,ids);
  assert.ok(Object.values(p.parts).every(part=>part.level===1&&part.copies===R.GRADE_COPIES[grade]));
  assert.deepEqual(p.training,{attack:20,hp:20,speed:20});assert.equal(p.difficulty,'normal');assert.equal(p.activePet,null);assert.deepEqual(p.petCopies,{});
  assert.equal(Object.keys(p.gear).length,6);assert.ok(Object.values(p.gear).every(g=>g.grade===1&&g.copies===20));assert.equal(p.weaponMode,'melee');
  assert.deepEqual(p.testMode,{kind:'skill',element,grade,stage:'CH03',difficulty:'normal',passes:20,perGrade:5,since:123});
  assert.equal(R.durationFor(p,'CH03'),300);assert.equal(R.testGrade(p),grade);
  assert.deepEqual(R.testInfo(p),{kind:'skill',element,grade,partLevel:1,training:20,gearGrade:1,stage:'CH03',difficulty:'normal',duration:300});
  p.coins=77; // Changing only the grade must preserve unrelated administrator grants.
  const next=R.action(p,{kind:'test-skill-grade',grade:grade===4?1:grade+1}).profile;
  assert.equal(next.testMode.since,123);assert.equal(next.testMode.element,element);assert.equal(next.training.attack,20);assert.equal(next.coins,77);
 }
 for(const grade of [0,5,-1,1.5])assert.throws(()=>R.skillTestProfile(null,{grade}));
 assert.throws(()=>R.skillTestProfile(null,{element:'ice'}));
 const p=R.skillTestProfile(null);
 for(const a of [{kind:'test-skill-grade',grade:0},{kind:'test-pet-grade',grade:1},{kind:'test-gear-type',type:'ranged'},{kind:'train',stat:'attack'},{kind:'draw-part'},{kind:'settings',difficulty:'hard'},{kind:'pet',id:'turtle'}])assert.throws(()=>R.action(p,a));
});

test('each element offers only its two basics/evolutions; upgrades and evolution work without support; exhaustion is empty',()=>{
 for(const element of Object.keys(R.ELEMENTS)){
  const p=R.skillTestProfile(null,{element}),state=R.bindRunCardContext(p,{}),skills={};
  const ids=Object.keys(R.SKILLS).filter(id=>R.SKILLS[id].element===element),allowed=new Set(ids.flatMap(id=>[id,R.EVO_OF[id]]));
  for(let step=0;step<8;step++){
   const cards=R.cardChoices(p,skills,state,0,()=>.3);
   assert.ok(cards.length>0);assert.ok(cards.every(c=>allowed.has(c.id)&&['skill-new','skill-up','evolve'].includes(c.kind)));
   R.applyRunCard(skills,state,cards[0]);
  }
  assert.deepEqual(Object.keys(skills).sort(),ids.map(id=>R.EVO_OF[id]).sort());
  assert.deepEqual(state.supports,{});assert.equal(state.fusionCount,2);
  assert.deepEqual(R.cardChoices(p,skills,state,0,()=>.9),[]);assert.deepEqual(R.cardPool(p,skills,state),[]);
 }
});

test('skill run rejects forged cards, premature evolutions and revival of evolved skills even after public context tampering',()=>{
 const p=R.skillTestProfile(null,{element:'fire'}),state={},skills={};
 R.cardPool(p,skills,state); // The real profile binds the context before cards are applied.
 state.testMode={kind:'skill',element:'water'};
 for(const card of [{kind:'skill-new',id:'W1'},{kind:'support-new',id:'S4'},{kind:'heal'},{kind:'shield'},{kind:'evolve',id:'EVO_F1'}])assert.throws(()=>R.applyRunCard(skills,state,card));
 R.applyRunCard(skills,state,{kind:'skill-new',id:'F1'});
 assert.throws(()=>R.applyRunCard(skills,state,{kind:'evolve',id:'EVO_F1'}));
 R.applyRunCard(skills,state,{kind:'skill-up',id:'F1'});R.applyRunCard(skills,state,{kind:'skill-up',id:'F1'});
 R.applyRunCard(skills,state,{kind:'evolve',id:'EVO_F1'});
 assert.throws(()=>R.applyRunCard(skills,state,{kind:'skill-new',id:'F1'}));
 assert.throws(()=>R.bindRunCardContext(R.skillTestProfile(null,{element:'water'}),state));
 const normal={},normalSkills={F1:{lv:3,cd:0}};
 assert.ok(!R.cardPool(R.freshProfile(),normalSkills,normal).some(c=>c.kind==='evolve'),'ordinary evolution still needs support');
});

test('skill settlement never changes currency, progression, daily missions or normal usage statistics',()=>{
 const p=R.skillTestProfile(null,{element:'earth'}),before=structuredClone(p);
 for(const cleared of [true,false]){
  const r=R.completeRun(p,{stage:'CH03',cleared,seconds:300,litter:99,day:'2026-10-13',skillIds:['E1','E2'],fusionIds:['EVO_E1'],supportIds:['S4'],equippedPartIds:p.equippedParts});
  assert.deepEqual(r.profile,before);assert.equal(r.reward.coins,0);assert.equal(r.reward.gifts,0);assert.equal(r.reward.stars,0);assert.deepEqual(r.reward.missions,[]);
 }
});

class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(){return db.sql.prepare(sql).get(...this.args)||null;},async all(){return {results:db.sql.prepare(sql).all(...this.args)};},async run(){const r=db.sql.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes)},success:true};}};}
 async batch(statements){if(this.beforeBatch){const f=this.beforeBatch;this.beforeBatch=null;f();}this.sql.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());this.sql.exec('COMMIT');return out;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const start=Date.parse('2026-10-13T01:00:00Z'),user={id:'qaskill'};
let seq=0;const uid=()=>`skill_request_${++seq}`;
async function setup(element='fire'){
 const DB=new D1();DB.sql.prepare('INSERT INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,?,?,?)').run(user.id,user.id,'local','local',start);await migrate(DB);
 const env={DB};const r=await admin(env,{testElement:element});assert.equal(r.status,200,r.error);return env;
}
async function api(env,path,body,now=start){const r=await guardianAPI(new Request(`http://localhost/api${path}`,{method:body?'POST':'GET',...(body?{body:JSON.stringify({clientVersion:2,...body})}:{})}),env,user,path,now);return {status:r.status,...await r.json()};}
async function admin(env,body,now=start){const r=await guardianAdmin(new Request('http://localhost',{method:'POST',body:JSON.stringify({id:user.id,...body})}),env,'test-profile','POST',now);return {status:r.status,...await r.json()};}
function fixture(env,grade,n=1){for(let i=0;i<n;i++)env.DB.sql.prepare('INSERT INTO play_runs(id,user_id,stage,started_at,duration,status,result) VALUES(?,?,?,?,?,?,?)').run(uid(),user.id,'CH03',start,300,'lost',JSON.stringify({test:{kind:'skill',element:'fire',grade}}));}
function damageFixture(){const tracker=createDamageTracker();tracker.reset('fire');tracker.acquire('F1',0);tracker.record('F1',Object.keys(DAMAGE_TARGET_NAMES)[0],12.5,1);return tracker.snapshot(300);}

test('skill API accepts only fixed conditions; active measurement blocks changing grade and admin reset',async()=>{
 const env=await setup('lightning');
 for(const b of [{testElement:'ice'},{testElement:'water',grade:0},{testElement:'water',testPet:'turtle'},{testElement:'water',training:80},{testElement:'water',stage:'CH05'},{testElement:'water',passes:100},{testElement:'water',difficulty:'hard'},{id:'student1',testElement:'water'}])assert.equal((await admin(env,b)).status,400,JSON.stringify(b));
 const first=await api(env,'/guardian');assert.equal(first.passes.total,20);assert.equal(first.passes.perGrade,5);assert.deepEqual(first.passes.byGrade,{1:{n:0,won:0},2:{n:0,won:0},3:{n:0,won:0},4:{n:0,won:0}});
 assert.equal((await api(env,'/play/start',{requestId:uid(),stage:'CH02'})).code,'TEST_MODE');
 const s=await api(env,'/play/start',{requestId:uid(),stage:'CH03'});assert.equal(s.status,200,s.error);assert.equal(s.duration,300);
 assert.equal((await api(env,'/guardian/action',{requestId:uid(),kind:'test-skill-grade',grade:2})).code,'ACTIVE_RUN');
 assert.equal((await admin(env,{testElement:'fire'})).code,'ACTIVE_RUN');
 assert.equal((await admin(env,{testPet:'turtle'})).code,'ACTIVE_RUN');
 const stored=JSON.parse(env.DB.sql.prepare('SELECT result FROM play_runs WHERE id=?').get(s.runId).result);
 assert.equal(stored.test.element,'lightning');assert.equal(stored.test.grade,1);assert.equal(stored.test.partLevel,1);assert.deepEqual(stored.loadout.equippedParts,['PART_L1','PART_L2']);
});

test('skill API counts every start, caps five per grade and twenty total without daily resets or reward pollution',async()=>{
 const env=await setup();let now=start;const initial=(await api(env,'/guardian')).profile;
 for(const grade of [1,2,3,4]){
  const changed=await api(env,'/guardian/action',{requestId:uid(),kind:'test-skill-grade',grade},now);assert.equal(changed.status,200,changed.error);
  for(let i=0;i<5;i++){
   const requestId=uid(),s=await api(env,'/play/start',{requestId,stage:'CH03'},now);assert.equal(s.status,200,s.error);
   assert.equal((await api(env,'/play/start',{requestId,stage:'CH03'},now)).passes.used,(grade-1)*5+i+1,'retry cannot spend another pass');
   const f=await api(env,'/play/finish',{requestId:uid(),runId:s.runId,cleared:i<4,seconds:300,litter:3,hpFraction:1,skillIds:['F1','F2'],damageSummary:damageFixture()},now+300000);assert.equal(f.status,200,f.error);
   assert.equal(f.test.grade,grade);assert.equal(f.reward.coins,0);assert.equal(f.reward.gifts,0);assert.equal(f.profile.runs,initial.runs);assert.equal(f.profile.wins,initial.wins);
   assert.equal(f.profile.coins,0);assert.equal(f.profile.gifts,0);assert.deepEqual(f.passes.byGrade[grade],{n:i+1,won:Math.min(i+1,4)});now+=400000;
  }
  const blocked=await api(env,'/play/start',{requestId:uid(),stage:'CH03'},now);assert.equal(blocked.status,409);assert.equal(blocked.code,'TEST_GRADE_DONE');
 }
 const final=await api(env,'/guardian',undefined,now+2*86400000);assert.equal(final.passes.remaining,0);assert.equal(final.passes.used,20);assert.ok(Object.values(final.passes.byGrade).every(g=>g.n===5&&g.won===4));
 assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM play_runs WHERE user_id=?').get(user.id).n,20);
 assert.equal(env.DB.sql.prepare('SELECT COALESCE(SUM(base_used+bonus_used),0) n FROM play_days WHERE user_id=?').get(user.id).n,0);
});

test('grade cap is atomic even if a fifth settled run arrives after preflight',async()=>{
 const env=await setup();fixture(env,1,4);env.DB.beforeBatch=()=>fixture(env,1);
 const r=await api(env,'/play/start',{requestId:uid(),stage:'CH03'});assert.equal(r.code,'TEST_GRADE_DONE');
 assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM play_runs WHERE user_id=?').get(user.id).n,5);
});

test('start rejects stale grade snapshot and grade action rejects an active run inserted during its preflight',async()=>{
 const env=await setup();env.DB.beforeBatch=()=>{
  const p=R.skillTestProfile(null,{element:'fire',grade:2,since:start});env.DB.sql.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(p),user.id);
 };
 const r=await api(env,'/play/start',{requestId:uid(),stage:'CH03'});assert.equal(r.code,'PROFILE_CHANGED');assert.equal(env.DB.sql.prepare('SELECT COUNT(*) n FROM play_runs').get().n,0);
 env.DB.beforeBatch=()=>env.DB.sql.prepare('INSERT INTO play_runs(id,user_id,stage,started_at,duration,result) VALUES(?,?,?,?,?,?)').run(uid(),user.id,'CH03',start,300,JSON.stringify({test:{kind:'skill',element:'fire',grade:2}}));
 const change=await api(env,'/guardian/action',{requestId:uid(),kind:'test-skill-grade',grade:3});assert.equal(change.code,'ACTIVE_RUN');
 assert.equal((await api(env,'/guardian')).profile.testMode.grade,2);
});

test('measurement finish rejects short/invalid/mixed-element records; valid summary is saved once and survives altered retries',async()=>{
 const env=await setup(),s=await api(env,'/play/start',{requestId:uid(),stage:'CH03'}),good=damageFixture();
 const finish={requestId:uid(),runId:s.runId,cleared:true,seconds:300,skillIds:['F1'],damageSummary:good};
 const water=createDamageTracker();water.reset('water');
 for(const change of [
  {seconds:297},
  {damageSummary:undefined},
  {damageSummary:{...good,total:NaN}},
  {damageSummary:{...good,total:good.total+1}},
  {damageSummary:{...good,otherDamage:1}},
  {damageSummary:water.snapshot(300)},
  {skillIds:['F1','W1']},
  {fusionIds:['EVO_W1']},
  {supportIds:['S1']},
 ])assert.equal((await api(env,'/play/finish',{...finish,...change},start+300000)).status,400,JSON.stringify(change));
 assert.equal((await api(env,'/play/finish',finish,start+297000)).status,400,'wall clock must also reach five minutes');
 const result=await api(env,'/play/finish',finish,start+300000);assert.equal(result.status,200,result.error);assert.deepEqual(result.damageSummary,good);
 const stored=JSON.parse(env.DB.sql.prepare('SELECT result FROM play_runs WHERE id=?').get(s.runId).result);assert.deepEqual(stored.damageSummary,good);assert.deepEqual(stored.test,result.test);
 const retry=await api(env,'/play/finish',{...finish,cleared:false,damageSummary:{...good,total:999}},start+500000);
 assert.deepEqual(retry.damageSummary,good);assert.equal(retry.cleared,true);assert.equal(retry.passes.used,1);assert.equal(retry.passes.byGrade[1].won,1);
});

const damageAt=sec=>{const t=createDamageTracker();t.reset('fire');t.acquire('F1',0);t.record('F1',Object.keys(DAMAGE_TARGET_NAMES)[0],12.5,1);return t.snapshot(sec);};
test('test accounts: leaving mid-run is void (no pass, not counted); dying stays a counted failure; expired runs are not counted',async()=>{
 const env=await setup();let now=start;
 const s1=await api(env,'/play/start',{requestId:uid(),stage:'CH03'},now);assert.equal(s1.status,200,s1.error);
 const left=await api(env,'/play/finish',{requestId:uid(),runId:s1.runId,cleared:false,seconds:40,litter:0,hpFraction:.8,left:true,skillIds:['F1'],damageSummary:damageAt(40)},now+40000);
 assert.equal(left.status,200,left.error);assert.equal(left.void,true);assert.equal(left.charged,0);
 assert.equal(env.DB.sql.prepare('SELECT status FROM play_runs WHERE id=?').get(s1.runId).status,'test_void');
 assert.equal(left.passes.used,0);assert.deepEqual(left.passes.byGrade[1],{n:0,won:0});
 now+=100000;
 const s2=await api(env,'/play/start',{requestId:uid(),stage:'CH03'},now);assert.equal(s2.status,200,s2.error);
 const died=await api(env,'/play/finish',{requestId:uid(),runId:s2.runId,cleared:false,seconds:60,litter:0,hpFraction:0,skillIds:['F1'],damageSummary:damageAt(60)},now+60000);
 assert.equal(died.status,200,died.error);assert.ok(!died.void);assert.equal(env.DB.sql.prepare('SELECT status FROM play_runs WHERE id=?').get(s2.runId).status,'lost');
 assert.equal(died.passes.used,1);assert.deepEqual(died.passes.byGrade[1],{n:1,won:0});
 now+=100000;
 const s3=await api(env,'/play/start',{requestId:uid(),stage:'CH03'},now);assert.equal(s3.status,200,s3.error);
 const later=await api(env,'/guardian',undefined,now+1900000);   // 30분 넘게 멈춘 판 → expired, 세지 않음
 const s4=await api(env,'/play/start',{requestId:uid(),stage:'CH03'},now+1900000);assert.equal(s4.status,200,s4.error);
 assert.equal(env.DB.sql.prepare('SELECT status FROM play_runs WHERE id=?').get(s3.runId).status,'expired');
 assert.equal(s4.passes.used,2,'expired run is not counted (died + active run only)');
});
