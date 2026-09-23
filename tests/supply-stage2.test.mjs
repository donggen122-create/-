// 파츠 보급(docs/27): 고르는 것 없는 무작위 + 개수 운(1·3·7), 등급 노말~전설(1·3·7·25·80개), 레벨, 친구 먼저 만나기, 코인 교환, 실패 보급권 상한, 성공 보급권(어려움 2장·단계당 하루 2번).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as R from '../game/src/rework-core.js';
import {migrate,guardianAPI,getProfile,dayKey} from '../server/src/guardian.js';

const rngSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function supplyProfile(parts={PART_F1:1}){const p=R.freshProfile();p.stages.CH01={cleared:true,stars:1};p.milestones.firstPart=true;p.gifts=30;for(const [id,n] of Object.entries(parts))p.parts[id]={copies:n,level:1};p.equippedParts=Object.keys(parts).slice(0,3);return p;}
const draw=(p,a,rng)=>R.action(p,{kind:'draw-part',...a},rng);

const pull=(p,rng)=>R.action(p,{kind:'draw-part',mode:'random'},rng);

test('supply is random only: one mode, no choices; all legendary closes',()=>{
 assert.equal(R.drawMode(supplyProfile()),'random');
 const legend=supplyProfile(Object.fromEntries(Object.keys(R.PARTS).map(id=>[id,80])));assert.equal(R.drawMode(legend),null);
 assert.throws(()=>pull(legend),/모든 파츠가 전설/);
 const p=supplyProfile(),r=R.action(p,{kind:'draw-part',mode:'random',id:'PART_L2',element:'fire'},()=>.05);
 assert.equal(r.draw.id,Object.keys(R.PARTS)[0],'보낸 id·원소는 무시하고 무작위');
});

test('old screens (element / 5th pick / new-part pick / no mode) are refused with DRAW_MODE and change nothing',()=>{
 const p=supplyProfile(),before=structuredClone(p);
 for(const a of [{mode:'element',element:'fire'},{element:'fire'},{mode:'pick',id:'PART_W1'},{mode:'new',id:'PART_W1'}]){
  let err;try{draw(p,a);}catch(e){err=e;}assert.equal(err?.code,'DRAW_MODE');assert.equal(err.mode,'random');assert.match(err.message,/새로고침/);
 }
 assert.deepEqual(p,before);
});

test('luck bundles: 1 part 80%, 3 parts 18%, 7 parts 2%; every part equally likely',()=>{
 const p=supplyProfile(),rng=rngSeed(7),qty={1:0,3:0,7:0},ids={};const N=20000;
 for(let i=0;i<N;i++){const r=pull(p,rng);qty[r.draw.qty]++;ids[r.draw.id]=(ids[r.draw.id]||0)+1;assert.equal(r.profile.gifts,p.gifts-1);assert.equal(r.profile.coins,p.coins);}
 assert.ok(Math.abs(qty[1]/N-.8)<.015&&Math.abs(qty[3]/N-.18)<.015&&Math.abs(qty[7]/N-.02)<.005,JSON.stringify(qty));
 assert.equal(Object.keys(ids).length,10);for(const n of Object.values(ids))assert.ok(Math.abs(n/N-.1)<.015,JSON.stringify(ids));
 assert.deepEqual([.5,.85,.99].map(R.bundleFor),[1,3,7]);
});

test('legendary parts never come out again; the rest share the chance',()=>{
 const p=supplyProfile({PART_F1:80,PART_W1:120});
 for(let seed=1;seed<=500;seed++){const r=pull(p,rngSeed(seed));assert.ok(!['PART_F1','PART_W1'].includes(r.draw.id),r.draw.id);}
});

test('grades by copies: 노말 1 · 레어 3 · 유니크 7 · 에픽 25 · 전설 80; old 동·은·금 keep their place',()=>{
 assert.deepEqual(R.GRADE_NAMES,['노말','레어','유니크','에픽','전설']);
 assert.deepEqual([1,2,3,6,7,24,25,79,80,300].map(R.grade),[0,0,1,1,2,2,3,3,4,4]);
 assert.deepEqual([0,1,3,7,24,25,80].map(R.nextGradeAt),[1,3,7,25,25,80,null]);
 const p=supplyProfile({PART_F1:80});p.parts.PART_F1.level=10;
 assert.ok(Math.abs(R.partBonus(p,'F1')-(.27+.80))<1e-9,'전설 +80% + Lv.10 +27%');assert.ok(Number.isFinite(R.skillDamageMultiplier(p,'F1')));
 assert.equal(R.hasGold(supplyProfile({PART_F1:7}),'F1'),true,'유니크부터 유니크 기능');assert.equal(R.hasGold(supplyProfile({PART_F1:6}),'F1'),false);
 const r=pull(supplyProfile({PART_F1:24}),()=>0);assert.equal(r.draw.id,'PART_F1');assert.equal(r.draw.gradeAfter,3);assert.match(r.message,/에픽 달성/);
 let q=supplyProfile();q.coins=5000;const start=q.coins;
 for(let i=0;i<9;i++)q=R.action(q,{kind:'upgrade-part',id:'PART_F1'}).profile;assert.equal(q.parts.PART_F1.level,10);assert.equal(start-q.coins,1260);
 q=R.action(q,{kind:'reset-part',id:'PART_F1'}).profile;assert.equal(q.coins,start,'레벨 되돌리기 전후 코인 합계가 같다');
});

test('legendary takes a long time: in 300 simulated students nobody gets one before 240 draws, median over 380',()=>{
 const firsts=[];
 for(let seed=1;seed<=300;seed++){let p=R.freshProfile();p.stages.CH01={cleared:true,stars:1};p.gifts=1e6;const rng=rngSeed(seed);let n=0,r;
  do{n++;r=pull(p,rng);p=r.profile;}while(r.draw.gradeAfter<4);firsts.push(n);}
 firsts.sort((a,b)=>a-b);assert.ok(firsts[0]>=240,`가장 빠른 학생 ${firsts[0]}번`);assert.ok(firsts[150]>=380,`중앙 ${firsts[150]}번`);
});

test('first free part is still a choice (not legendary) and a new part fills an empty slot',()=>{
 const p=supplyProfile({PART_F1:80});p.milestones.firstPart=false;
 assert.throws(()=>R.action(p,{kind:'choose-part',id:'PART_F1'}),/전설/);
 const r=R.action(p,{kind:'choose-part',id:'PART_L2'});assert.equal(r.draw.isNew,true);assert.equal(r.draw.autoEquipped,true);assert.match(r.message,/빈 칸에 끼웠어요/);
 assert.equal(r.profile.giftCounts.part,0,'첫 무료 파츠는 보급 횟수에 안 들어감');
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

test('API: old screens get 409 DRAW_MODE and keep tickets; replay returns the same random card',async()=>{
 const p=supplyProfile({PART_F1:1,PART_W1:1,PART_V1:1}),env=await setup(p);
 const stale=await api(env,'/guardian/action',{kind:'draw-part',mode:'pick',id:'PART_F1'});
 assert.equal(stale.status,409);assert.equal(stale.code,'DRAW_MODE');assert.equal(stale.mode,'random');assert.deepEqual((await getProfile(env.DB,'qa')).profile,p);
 const old=await api(env,'/guardian/action',{kind:'draw-part',element:'fire'});assert.equal(old.code,'DRAW_MODE','옛 화면(차례 정보 없음)도 새로고침 안내');
 const req={requestId:'replay_draw_request_1',kind:'draw-part',mode:'random'};
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
