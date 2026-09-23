// 2차 개편(docs/23 §4·§6): 보급 1개 / 5번째 고른 파츠 3개 / 처음 3종 고르기 / 금 제외, 메달·레벨, 친구 먼저 만나기, 코인 교환, 실패 보급권 상한.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as R from '../game/src/rework-core.js';
import {migrate,guardianAPI,getProfile,dayKey} from '../server/src/guardian.js';

const rngSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function supplyProfile(parts={PART_F1:1}){const p=R.freshProfile();p.stages.CH01={cleared:true,stars:1};p.milestones.firstPart=true;p.gifts=30;for(const [id,n] of Object.entries(parts))p.parts[id]={copies:n,level:1};p.equippedParts=Object.keys(parts).slice(0,3);return p;}
const draw=(p,a,rng)=>R.action(p,{kind:'draw-part',...a},rng);

test('supply turn order: 5th pick first, then pick-a-new-part until 3 kinds, then element; all gold closes',()=>{
 assert.equal(R.drawMode(supplyProfile()),'new');
 assert.equal(R.drawMode(supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1})),'element');
 const four=supplyProfile();four.giftCounts.part=4;assert.equal(R.drawMode(four),'pick','개편 전에 4번 보급했으면 다음은 선택 회차');
 const gold=supplyProfile(Object.fromEntries(Object.keys(R.PARTS).map(id=>[id,7])));assert.equal(R.drawMode(gold),null);
 assert.throws(()=>draw(gold,{mode:'element',element:'fire'}),/모든 파츠가 금/);
});

test('mismatched or missing turn is refused with DRAW_MODE and changes nothing',()=>{
 const p=supplyProfile(),before=structuredClone(p);
 for(const a of [{mode:'element',element:'fire'},{element:'fire'},{mode:'pick',id:'PART_W1'}]){
  let err;try{draw(p,a);}catch(e){err=e;}assert.equal(err?.code,'DRAW_MODE');assert.equal(err.mode,'new');
 }
 assert.deepEqual(p,before);
 assert.throws(()=>draw(p,{mode:'new',id:'PART_F1'}),/아직 없는 파츠/,'가진 파츠는 새 파츠로 고를 수 없다');
});

test('ordinary supply is exactly one part; the 5th is three of the chosen part; no 60-coin conversion',()=>{
 let p=supplyProfile({PART_F1:5,PART_W1:1,PART_V1:1});p.giftCounts.part=4;
 const r=draw(p,{mode:'pick',id:'PART_F1'});
 assert.deepEqual(r.draw,{id:'PART_F1',qty:3,before:5,after:8,gradeBefore:1,gradeAfter:2,isNew:false,autoEquipped:false,mode:'pick'});
 assert.equal(r.profile.coins,p.coins);assert.equal(r.profile.gifts,p.gifts-1);assert.match(r.message,/금 달성/);
 p=supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1});
 for(let seed=1;seed<=200;seed++){const x=draw(p,{mode:'element',element:'fire'},rngSeed(seed));assert.equal(x.draw.qty,1);assert.equal(Object.values(x.profile.parts).reduce((n,v)=>n+v.copies,0),4);}
});

test('gold parts never come from element supply; the other part is certain',()=>{
 const p=supplyProfile({PART_F1:7,PART_W1:1,PART_V1:1});
 for(let seed=1;seed<=1000;seed++)assert.equal(draw(p,{mode:'element',element:'fire'},rngSeed(seed)).draw.id,'PART_F2');
 const both=supplyProfile({PART_F1:7,PART_F2:9,PART_W1:1}),before=structuredClone(both);
 assert.throws(()=>draw(both,{mode:'element',element:'fire'}),/모두 금/);assert.deepEqual(both,before);
});

test('worst luck still reaches gold within 10 supplies from one copy',()=>{
 let p=supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1});const worst=()=>.99;   // 원소 보급은 늘 다른 쪽이 나오는 최악의 운
 for(let i=1;i<=10;i++)p=draw(p,R.drawMode(p)==='pick'?{mode:'pick',id:'PART_F1'}:{mode:'element',element:'fire'},worst).profile;
 assert.ok(p.parts.PART_F1.copies>=7,JSON.stringify(p.parts));assert.equal(R.grade(p.parts.PART_F1.copies),2);
});

test('new-part picks count as supplies and auto-equip into an empty slot',()=>{
 const p=supplyProfile(),r=draw(p,{mode:'new',id:'PART_L2'});
 assert.equal(r.profile.giftCounts.part,1);assert.equal(r.draw.isNew,true);assert.equal(r.draw.autoEquipped,true);assert.deepEqual(r.profile.equippedParts,['PART_F1','PART_L2']);
 assert.match(r.message,/빈 칸에 끼웠어요/);
});

test('medals and levels: grade × 6% and level × 3% stay finite beyond seven copies',()=>{
 const p=supplyProfile({PART_F1:15});p.parts.PART_F1.level=10;
 assert.equal(R.GRADE_NAMES.join(''),'동은금');
 assert.ok(Math.abs(R.partBonus(p,'F1')-(.27+.12))<1e-9);assert.ok(Number.isFinite(R.skillDamageMultiplier(p,'F1')));
 assert.equal(R.nextGradeAt(1),3);assert.equal(R.nextGradeAt(3),7);assert.equal(R.nextGradeAt(8),null);
 let q=supplyProfile();q.coins=5000;const start=q.coins;
 for(let i=0;i<9;i++)q=R.action(q,{kind:'upgrade-part',id:'PART_F1'}).profile;assert.equal(q.parts.PART_F1.level,10);assert.equal(start-q.coins,1260);
 q=R.action(q,{kind:'reset-part',id:'PART_F1'}).profile;assert.equal(q.coins,start,'레벨 되돌리기 전후 코인 합계가 같다');
});

test('three different elements add 5% max HP; same-element pair keeps +4% only',()=>{
 const rainbow=supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1});assert.equal(R.rainbowSet(rainbow),true);assert.ok(Math.abs(R.bonuses(rainbow).hpPct-.05)<1e-9);
 const pair=supplyProfile({PART_F1:1,PART_F2:1,PART_V1:1});assert.equal(R.rainbowSet(pair),false);assert.equal(R.bonuses(pair).hpPct,0);assert.equal(R.elementBonus(pair,'fire'),.04);
});

test('full slots: equipping asks which part to replace; levels stay on the removed part',()=>{
 const p=supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1,PART_E1:1});p.parts.PART_W1.level=4;
 assert.throws(()=>R.action(p,{kind:'equip-part',id:'PART_E1'}),/바꿀 파츠/);
 const r=R.action(p,{kind:'equip-part',id:'PART_E1',replace:'PART_W1'}).profile;
 assert.deepEqual(r.equippedParts,['PART_F1','PART_E1','PART_V1']);assert.equal(r.parts.PART_W1.level,4);
 assert.throws(()=>R.action(p,{kind:'equip-part',id:'PART_E1',replace:'PART_E2'}),/바꿀 파츠/);
});

test('friends: unmet friends come first, six meetings meet everyone; locked at all met + friendship 28',()=>{
 for(let seed=1;seed<=300;seed++){
  let p=supplyProfile();const rng=rngSeed(seed);
  for(let i=0;i<6;i++){const pet=Object.keys(R.PETS).find(id=>!p.pets.includes(id));p=R.action(p,{kind:'gift',type:'pet',pet},rng).profile;}
  assert.equal(p.pets.length,6);
 }
 let p=supplyProfile();p.pets=Object.keys(R.PETS);p.friendship=27;p=R.action(p,{kind:'gift',type:'pet'}).profile;assert.equal(p.friendship,28);
 const before=structuredClone(p);assert.throws(()=>R.action(p,{kind:'gift',type:'pet'}),/보급권은 파츠에/);assert.deepEqual(p,before);
});

test('coin exchange: 300 coins for one supply ticket, once per game day, only with a server day',()=>{
 const p=supplyProfile();p.coins=700;
 assert.throws(()=>R.action(p,{kind:'buy-supply'}),/서버/);
 const a=R.action(p,{kind:'buy-supply'},Math.random,{day:'2026-09-23'}).profile;assert.equal(a.coins,400);assert.equal(a.gifts,p.gifts+1);
 assert.throws(()=>R.action(a,{kind:'buy-supply'},Math.random,{day:'2026-09-23'}),/오늘은 이미/);
 const b=R.action(a,{kind:'buy-supply'},Math.random,{day:'2026-09-24'}).profile;assert.equal(b.coins,100);
 assert.throws(()=>R.action(b,{kind:'buy-supply'},Math.random,{day:'2026-09-25'}),/300/);
});

test('failure encouragement gives at most one supply ticket per game day; friendship still grows',()=>{
 let p=supplyProfile();const g=p.gifts,f=p.friendship,fail=day=>{p=R.completeRun(p,{stage:'CH01',cleared:false,seconds:200,day}).profile;};
 for(let i=0;i<4;i++)fail('2026-09-23');assert.equal(p.gifts,g+1);assert.equal(p.friendship,f+2);
 fail('2026-09-24');fail('2026-09-24');assert.equal(p.gifts,g+2);
 const cleared=R.completeRun(p,{stage:'CH01',cleared:true,seconds:300,day:'2026-09-24'});assert.equal(cleared.reward.gifts,1,'성공 보급권은 그대로');
});

class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(){return db.sql.prepare(sql).get(...this.args)||null;},async all(){return {results:db.sql.prepare(sql).all(...this.args)};},async run(){return {meta:{changes:Number(db.sql.prepare(sql).run(...this.args).changes)}};}};}
 async batch(statements){this.sql.exec('BEGIN IMMEDIATE');try{const r=[];for(const s of statements)r.push(await s.run());this.sql.exec('COMMIT');return r;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const now=Date.parse('2026-09-23T01:00Z');let serial=0;const uid=()=>`stage2_test_${++serial}`;
async function setup(p){const DB=new D1();DB.sql.prepare('INSERT INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,?,?,?)').run('qa','qa','x','y',now);await migrate(DB);DB.sql.prepare('INSERT INTO guardian_profiles(user_id,state) VALUES(?,?)').run('qa',JSON.stringify(p||R.freshProfile()));return {DB};}
async function api(env,path,body,t=now){const res=await guardianAPI(new Request('http://local/api'+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify({clientVersion:2,requestId:uid(),...body})}:{})}),env,{id:'qa'},path,t);return {status:res.status,...await res.json()};}

test('API: stale turn returns 409 DRAW_MODE with the right turn and keeps tickets; replay returns the same card',async()=>{
 const p=supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1}),env=await setup(p);
 const stale=await api(env,'/guardian/action',{kind:'draw-part',mode:'pick',id:'PART_F1'});
 assert.equal(stale.status,409);assert.equal(stale.code,'DRAW_MODE');assert.equal(stale.mode,'element');assert.deepEqual((await getProfile(env.DB,'qa')).profile,p);
 const old=await api(env,'/guardian/action',{kind:'draw-part',element:'fire'});assert.equal(old.code,'DRAW_MODE','옛 화면(차례 정보 없음)도 새로고침 안내');
 const req={requestId:'replay_draw_request_1',kind:'draw-part',mode:'element',element:'wind'};
 const first=await api(env,'/guardian/action',req),again=await api(env,'/guardian/action',req);
 assert.deepEqual(again.draw,first.draw);assert.equal(again.profile.gifts,p.gifts-1);assert.equal(again.profile.giftCounts.part,1);
});

test('API: coin exchange uses the server game day (08:00 reset)',async()=>{
 const p=supplyProfile();p.coins=1000;const env=await setup(p);
 assert.equal((await api(env,'/guardian/action',{kind:'buy-supply'})).status,200);
 const again=await api(env,'/guardian/action',{kind:'buy-supply'},now+3600000);assert.equal(again.status,400);assert.match(again.error,/오늘은 이미/);
 const reset=Date.parse('2026-09-23T23:00Z');assert.notEqual(dayKey(reset),dayKey(now));   // 한국 시간 아침 8시가 지나면 새 날
 const next=await api(env,'/guardian/action',{kind:'buy-supply'},reset);assert.equal(next.status,200);assert.equal(next.profile.coins,400);assert.equal(next.profile.gifts,p.gifts+2);
});

test('API: failure supply cap follows the settlement day',async()=>{
 const env=await setup(supplyProfile());let t=now;
 for(let i=0;i<4;i++){const s=await api(env,'/play/start',{stage:'CH01'},t);await api(env,'/play/finish',{runId:s.runId,cleared:false,seconds:200},t+210000);t+=220000;}
 const {profile}=await getProfile(env.DB,'qa');assert.equal(profile.gifts,31);assert.equal(profile.failGiftDay,dayKey(now));
});

test('clear tickets: easy/normal 1, hard 2; each stage pays tickets for only 2 clears per game day',()=>{
 let p=supplyProfile();p.gifts=0;const clear=(stage,difficulty,day='2026-09-23')=>{const r=R.completeRun(p,{stage,cleared:true,seconds:300,difficulty,day});p=r.profile;return r.reward;};
 assert.equal(clear('CH01','easy').gifts,1);assert.equal(clear('CH01','hard').gifts,2);
 const third=clear('CH01','hard');assert.equal(third.gifts,0);assert.equal(third.stageGift.capped,true);assert.ok(third.coins>0,'코인·별은 그대로');assert.equal(third.friendship,1);
 assert.equal(clear('CH02','normal').gifts,1,'다른 단계는 따로 센다');assert.equal(R.stageGiftLeft(p,'CH02','2026-09-23'),1);assert.equal(R.stageGiftLeft(p,'CH01','2026-09-23'),0);
 assert.equal(clear('CH01','hard','2026-09-24').gifts,2,'다음 날(아침 8시) 다시');assert.equal(R.stageGiftLeft(p,'CH01','2026-09-24'),1);assert.equal(R.stageGiftLeft(p,'CH02','2026-09-24'),2);
 assert.equal(p.gifts,1+2+0+1+2);
 const lost=R.completeRun(p,{stage:'CH03',cleared:false,seconds:100,day:'2026-09-24'});assert.equal(lost.reward.gifts,0);assert.equal(lost.reward.stageGift,null,'실패는 횟수에 안 들어감');
});

test('first 1-5 clear bonus stays on top of the difficulty tickets',()=>{
 const p=supplyProfile();for(const id of ['CH01','CH02','CH03','CH04'])p.stages[id]={cleared:true,stars:1};
 assert.equal(R.completeRun(p,{stage:'CH05',cleared:true,seconds:290,difficulty:'hard',day:'2026-09-23'}).reward.gifts,3);
 assert.equal(R.completeRun(p,{stage:'CH05',cleared:true,seconds:290,difficulty:'easy',day:'2026-09-23'}).reward.gifts,2);
});

test('API: the third clear of the same stage in a day pays no ticket; the settlement day resets it',async()=>{
 const p=supplyProfile();p.difficulty='hard';p.gifts=0;const env=await setup(p);let t=now;const win=async()=>{const s=await api(env,'/play/start',{stage:'CH01'},t);const r=await api(env,'/play/finish',{runId:s.runId,cleared:true,seconds:300},t+301000);t+=310000;return r;};
 assert.equal((await win()).reward.gifts,2);assert.equal((await win()).reward.gifts,2);const third=await win();assert.equal(third.reward.gifts,0);assert.equal(third.reward.stageGift.capped,true);
 t=Date.parse('2026-09-23T23:05Z');assert.equal((await win()).reward.gifts,2,'아침 8시 뒤 새 날');
 assert.equal((await getProfile(env.DB,'qa')).profile.gifts,6);
});
