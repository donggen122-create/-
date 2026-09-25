// 친구 4종 개편 · 일일 미션(2026-09-24 밤, docs/37): 옛 6종·우정 → 친구 카드, 친구 보급(보급권 1장, 1·3·7장 운), 등급 버프·특수 능력, 미션 5개 × 보급권 2장.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as R from '../game/src/rework-core.js';
import {migrate,guardianAPI,getProfile,PETS_FIX_SNAPSHOT,CARDS_SCALE_SNAPSHOT} from '../server/src/guardian.js';
import {migrateLegacy} from '../server/src/legacy-migration.js';
import {migrateProfileV2} from '../server/src/profile-migration-v2.js';

const rngSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function base(){const p=R.freshProfile();p.stages.CH01={cleared:true,stars:1};p.milestones.firstPart=true;p.gifts=30;return p;}
const D='2026-09-24';

test('four friends = four directions (1 survival · 2 speed · 3 attack · 4 growth/coins); old sparrow → cat, seal → otter; friendship becomes cards',()=>{
 assert.deepEqual(R.PET_IDS,['turtle','cat','otter','deer']);assert.deepEqual(R.PET_IDS.map(id=>R.PETS[id].no),[1,2,3,4]);
 assert.deepEqual(Object.keys(R.PETS.turtle.buffs),['takenPct','hpPct','regenPct']);assert.deepEqual(Object.keys(R.PETS.cat.buffs),['speedPct','atkSpeedPct']);
 assert.deepEqual(Object.keys(R.PETS.otter.buffs),['dmgPct','areaPct']);assert.deepEqual(Object.keys(R.PETS.deer.buffs),['xpPct','magnetPct','coinPct']);
 const old={...base(),pets:['cat','sparrow','seal','deer','otter'],activePet:'seal',friendship:28};delete old.petCopies;delete old.petVersion;
 const p=R.migratePets(old);
 // 참새·물범이는 합쳐지고, 우정 28 → 함께 출동하던 친구(물범이 → 수달이)에 7장 → 2026-09-25 개수 1.5배(올림): cat 2→3, otter 9→14, deer 1→2
 // → 같은 날 등급 개수 1·20·40·80·120으로 옮김(구간 안 위치 그대로, 내림): cat 3→10, otter 14→44, deer 2→5
 assert.deepEqual(p.petCopies,{cat:10,otter:44,deer:5});assert.deepEqual(p.cardScale,{at:'2026-09-25',x:1.5});assert.deepEqual(p.cardRemap.to,[1,20,40,80,120]);
 assert.equal(p.activePet,'otter');assert.deepEqual(p.pets,['cat','otter','deer']);assert.equal(R.petGrade(p,'otter'),2,'44장 = 유니크(40장부터) — 옛 9장 유니크 그대로');
 assert.ok(!('friendship' in p));assert.deepEqual(p.petMigration,{pets:['cat','sparrow','seal','deer','otter'],activePet:'seal',friendship:28,bonus:7,to:'otter'});
 assert.deepEqual(R.migratePets(p),p,'여러 번 해도 같다');
 const none={...base(),pets:[],activePet:null,friendship:3};delete none.petVersion;const q=R.migratePets(none);
 assert.deepEqual(q.petCopies,{});assert.equal(q.activePet,null);assert.equal(q.petVersion,R.PET_VERSION);
 const lone={...base(),pets:['sparrow'],activePet:'sparrow',friendship:8};delete lone.petVersion;assert.deepEqual(R.migratePets(lone).petCopies,{cat:20},'우정 8 → +2장 = 3장(레어) → 5장 → 20장 레어');
});

test('legacy saves reach the four friends in one step',()=>{
 const v1=migrateLegacy({pets:{PT07:{lv:3},PT05:{lv:1}},activePet:'PT07'});
 assert.equal(v1.version,1);assert.ok(!('petVersion' in v1));
 const v2=migrateProfileV2(v1);assert.equal(v2.petVersion,R.PET_VERSION);assert.deepEqual(v2.petCopies,{cat:20,otter:5});assert.equal(v2.activePet,'cat');
});

test('friend supply: one ticket, random friend, 1·3·7 cards, grades like parts; legend friends leave the pool',()=>{
 let p=base();
 const r=R.action(p,{kind:'draw-pet'},()=>.1);assert.equal(r.profile.gifts,29);assert.equal(r.draw.mode,'pet');assert.equal(r.draw.qty,1);assert.ok(R.PET_IDS.includes(r.draw.id));
 assert.equal(r.profile.activePet,r.draw.id,'첫 친구는 바로 함께 출동');assert.ok(r.profile.pets.includes(r.draw.id));
 const counts={1:0,3:0,7:0};for(let seed=1;seed<=2000;seed++){const d=R.action(base(),{kind:'draw-pet'},rngSeed(seed)).draw;counts[d.qty]++;}
 assert.ok(counts[1]>1400&&counts[3]>250&&counts[7]>10,JSON.stringify(counts));
 p=base();p.petCopies={otter:120,turtle:120,deer:120};p.pets=['turtle','otter','deer'];p.activePet='otter';
 for(let i=0;i<5;i++)assert.equal(R.action(p,{kind:'draw-pet'},Math.random).draw.id,'cat','전설 친구는 안 나옴');
 p.petCopies.cat=120;assert.throws(()=>R.action(p,{kind:'draw-pet'}),/모든 친구가 전설/);
 const locked=R.freshProfile();locked.gifts=3;assert.throws(()=>R.action(locked,{kind:'draw-pet'}),/1-1을 성공/);
 const empty=base();empty.gifts=0;assert.throws(()=>R.action(empty,{kind:'draw-pet'}),/보급권/);
 p=base();p.petCopies={otter:39};p.pets=['otter'];p.activePet='otter';const up=R.action(p,{kind:'draw-pet'},()=>.6).draw;   // 0.6 → 3번째 친구(otter), 장수 운 0.6 → 1장
 assert.equal(up.id,'otter');assert.equal(up.gradeBefore,1);assert.equal(up.gradeAfter,2,'40장 = 유니크');
});

test('old "friend meeting" requests change nothing and ask for a refresh',()=>{
 const p=base(),before=structuredClone(p);
 assert.throws(()=>R.action(p,{kind:'gift',type:'pet',pet:'cat'}),e=>e.code==='DRAW_MODE'&&/새로고침/.test(e.message));assert.deepEqual(p,before);
});

test('friend choices: 1-3 gives one card of any friend, 1-5 gives three cards (owned friends allowed)',()=>{
 let p=base();for(const id of ['CH02','CH03'])p.stages[id]={cleared:true,stars:1};
 assert.deepEqual(R.pendingPet(p),{key:'firstPet',ids:R.PET_IDS,qty:1});
 p=R.action(p,{kind:'choose-pet',id:'deer'}).profile;assert.equal(R.petCopies(p,'deer'),1);assert.equal(p.activePet,'deer');assert.equal(R.pendingPet(p),null);assert.equal(p.gifts,30,'보급권을 쓰지 않음');
 for(const id of ['CH04','CH05'])p.stages[id]={cleared:true,stars:1};
 assert.equal(R.pendingPet(p).qty,3);const r=R.action(p,{kind:'choose-pet',id:'deer'});assert.equal(R.petCopies(r.profile,'deer'),4);assert.equal(r.draw.gradeAfter,0,'4장은 아직 노말(레어 5장)');
 assert.throws(()=>R.action(r.profile,{kind:'choose-pet',id:'cat'}),/고를 수 있는 친구가 아니/);
 assert.throws(()=>R.action(r.profile,{kind:'pet',id:'cat'}),/만나지 못한/);
});

test('buffs grow with the grade; specials open at unique (1) → epic (2) → legend (3)',()=>{
 const p=base();p.petCopies={otter:1};p.pets=['otter'];p.activePet='otter';
 const at=n=>{p.petCopies.otter=n;return {dmg:R.petBuff(p,'dmgPct'),sp:R.petSpecial(p)};};
 // 친구 카드 등급 1·20·40·80·120장(2026-09-25 사용자)
 assert.equal(at(1).dmg,.1);assert.equal(at(1).sp,null);assert.equal(at(20).sp,null);assert.equal(at(39).sp,null);
 assert.deepEqual(at(40).sp,{id:'otter',key:'splash',tier:1});assert.equal(at(80).sp.tier,2);assert.equal(at(120).sp.tier,3);assert.equal(at(119).sp.tier,2);
 assert.equal(at(120).dmg,.5);assert.equal(at(20).dmg,.2);assert.equal(at(80).dmg,.4);assert.equal(at(19).dmg,.1);assert.equal(R.petBuff(p,'takenPct'),0,'다른 친구 버프는 없음');
 p.activePet='cat';assert.equal(R.petBuff(p,'dmgPct'),0,'없는 친구가 함께 출동 중이면 0');
 // 성장 테이블: 전설(최대)의 20·40·60·80·100%(사용자 최대치)
 assert.deepEqual(R.PET_GRADE_RATE,[.2,.4,.6,.8,1]);
 assert.equal(R.petBuffText('turtle',4),'받는 피해 -30% · 최대 체력 +30% · 초당 체력 회복 +2%');assert.equal(R.petBuffText('turtle',0),'받는 피해 -6% · 최대 체력 +6% · 초당 체력 회복 +0.4%');
 assert.equal(R.petBuffText('cat',4),'이동 속도 +30% · 공격 속도 +50%');assert.equal(R.petBuffText('otter',4),'모든 스킬 피해 +50% · 스킬 범위 +30%');
 assert.equal(R.petBuffText('deer',4),'새싹 경험치 +50% · 새싹 줍기 범위 +150% · 코인 획득 +50%');assert.equal(R.petBuffText('deer',2),'새싹 경험치 +30% · 새싹 줍기 범위 +90% · 코인 획득 +30%');
 assert.ok(Math.abs(R.petIntervalCut(.5)-1/3)<1e-9,'공격 속도 +50% = 공격 간격 ×2/3');assert.equal(R.petIntervalCut(0),0);
 assert.deepEqual(R.PET_IDS.map(id=>R.PETS[id].special.key),['shell','dash','splash','magnet']);
});

test('4 growth friend (deer): coin gain +% on every settlement, using the friend taken into the run',()=>{
 const p=base();p.petCopies={deer:40,otter:1};p.pets=['otter','deer'];p.activePet='deer';
 const plain=R.completeRun({...p,activePet:'otter'},{stage:'CH01',cleared:true,seconds:300}).reward,withDeer=R.completeRun(p,{stage:'CH01',cleared:true,seconds:300}).reward;
 assert.equal(plain.petCoinPct,0);assert.equal(withDeer.petCoinPct,.3,'유니크 = 최대 50%의 60% = +30%');assert.equal(withDeer.coins,Math.floor(plain.coins*1.3));
 assert.equal(R.completeRun(p,{stage:'CH01',cleared:true,seconds:300,pet:'otter'}).reward.petCoinPct,0,'출동할 때 수달이였으면 코인 보너스 없음');
 assert.equal(R.completeRun(p,{stage:'CH01',cleared:true,seconds:300,pet:null}).reward.petCoinPct,0,'친구 없이 출동');
 const fail=R.completeRun(p,{stage:'CH01',cleared:false,seconds:300}).reward;assert.ok(fail.coins>0&&fail.petCoinPct===.3,'실패 코인에도');
});

test('daily missions: five × 2 tickets = 10 a day, paid the moment they are done; reset at the next game day',()=>{
 let p=base();p.gifts=0;p.coins=100000;const win=(day,litter=0)=>{const r=R.completeRun(p,{stage:'CH01',cleared:true,seconds:300,litter,day});p=r.profile;return r.reward;};
 assert.equal(R.MISSION_GIFTS,10);
 const first=win(D);assert.deepEqual(first.missions,[{id:'win1',name:'도전 1번 성공하기',gifts:2}]);assert.equal(p.gifts,first.gifts+2);
 const g=win(D,3);assert.deepEqual(g.missions.map(m=>m.id),['goal1']);
 const t=R.action(p,{kind:'train',stat:'hp'},Math.random,{day:D});p=t.profile;assert.match(t.message,/미션 완료! 보급권 \+2/);
 assert.doesNotMatch(R.action(p,{kind:'train',stat:'hp'},Math.random,{day:D}).message,/미션/,'같은 미션은 하루 한 번');
 assert.deepEqual(win(D).missions.map(m=>m.id),['win3']);win(D);assert.deepEqual(win(D).missions.map(m=>m.id),['win5']);assert.deepEqual(win(D).missions,[]);
 assert.equal(R.missionList(p,D).filter(m=>m.done).length,5);assert.equal(p.missions.done.length,5);
 const lost=R.completeRun(p,{stage:'CH01',cleared:false,seconds:200,day:D});assert.deepEqual(lost.reward.missions,[],'실패는 세지 않음');
 assert.deepEqual(R.missionList(p,'2026-09-25').map(m=>m.now),[0,0,0,0,0],'다음 게임 날짜에는 새로');
 assert.deepEqual(R.completeRun(p,{stage:'CH01',cleared:true,seconds:300}).reward.missions,[],'서버 날짜가 없으면 세지 않음');
 const lv=R.action({...p,parts:{PART_F1:{copies:1,level:1}}},{kind:'upgrade-part',id:'PART_F1'},Math.random,{day:'2026-09-25'});assert.match(lv.message,/미션 완료/);
});

class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(){return db.sql.prepare(sql).get(...this.args)||null;},async all(){return {results:db.sql.prepare(sql).all(...this.args)};},async run(){return {meta:{changes:Number(db.sql.prepare(sql).run(...this.args).changes)}};}};}
 async batch(statements){this.sql.exec('BEGIN IMMEDIATE');try{const r=[];for(const s of statements)r.push(await s.run());this.sql.exec('COMMIT');return r;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const now=Date.parse('2026-09-24T01:00Z');let serial=0;const uid=()=>`pets_mission_test_${++serial}`;
async function setup(p){const DB=new D1();DB.sql.prepare('INSERT INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,?,?,?)').run('qa','qa','x','y',now);await migrate(DB);DB.sql.prepare('INSERT INTO guardian_profiles(user_id,state) VALUES(?,?)').run('qa',JSON.stringify(p));return {DB};}
async function api(env,path,body,t=now){const res=await guardianAPI(new Request('http://local/api'+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify({clientVersion:2,requestId:uid(),...body})}:{})}),env,{id:'qa'},path,t);return {status:res.status,...await res.json()};}

test('API: stored old friends are converted once with a snapshot; pet supply and missions go through the server',async()=>{
 const old={...base(),pets:['seal','turtle'],activePet:'turtle',friendship:16,coins:500};delete old.petCopies;delete old.petVersion;
 const env=await setup(old);
 const {profile}=await getProfile(env.DB,'qa');assert.deepEqual(profile.petCopies,{otter:5,turtle:30},'otter 1·turtle 1+4 → ×1.5(올림) 2·8 → 1·20·40·80·120으로 5·30');assert.equal(profile.activePet,'turtle');
 const snap=env.DB.sql.prepare('SELECT state FROM guardian_profile_snapshots WHERE user_id=? AND target_version=?').get('qa',PETS_FIX_SNAPSHOT);assert.equal(JSON.parse(snap.state).friendship,16,'원본 보관');
 const d=await api(env,'/guardian/action',{kind:'draw-pet'});assert.equal(d.status,200,d.error);assert.equal(d.draw.mode,'pet');assert.equal(d.profile.gifts,29);
 const t=await api(env,'/guardian/action',{kind:'train',stat:'attack'});assert.match(t.message,/미션 완료/);assert.equal(t.profile.gifts,31);assert.equal(t.profile.missions.day,'2026-09-24');
 const old2=await api(env,'/guardian/action',{kind:'gift',type:'pet'});assert.equal(old2.status,409);assert.equal(old2.code,'DRAW_MODE');
 const s=await api(env,'/play/start',{stage:'CH01'});assert.equal(s.status,200,s.error);assert.equal(JSON.parse(env.DB.sql.prepare('SELECT result FROM play_runs WHERE id=?').get(s.runId).result).loadout.pet,'turtle','출동할 때 친구 저장');const f=await api(env,'/play/finish',{runId:s.runId,cleared:true,seconds:300,litter:3},now+301000);assert.equal(f.status,200,f.error);
 assert.deepEqual(f.reward.missions.map(m=>m.id),['win1','goal1']);assert.equal(f.profile.gifts,31+f.reward.gifts+4);
});

test('2026-09-25 카드 개수 옮기기: 어제 바뀐 학생(v2)·장비는 1.5배 → 1·20·40·80·120 기준으로, 등급 그대로, 원본은 스냅숏 2003', async () => {
 const v2 = { ...base(), hero: 'hoya', heroLocked: true, petCopies: { otter: 8, turtle: 3, cat: 1 }, pets: ['turtle', 'cat', 'otter'], activePet: 'otter', petVersion: 2,
  gear: { hoya_ranged_weapon: { copies: 7, grade: 2 }, hoya_ranged_helm: { copies: 4, grade: 1 }, hoya_melee_weapon: { copies: 1, grade: 0 } }, equippedGear: { weapon: 'hoya_ranged_weapon' } };
 const oldGrades = Object.fromEntries(Object.keys(v2.petCopies).map(id => [id, [0, 1, 2, 3, 4].filter(g => v2.petCopies[id] >= [1, 3, 7, 25, 80][g]).pop()]));
 const env = await setup(v2); const { profile } = await getProfile(env.DB, 'qa');
 assert.deepEqual(profile.petCopies, { otter: 41, turtle: 20, cat: 5 }); assert.equal(profile.petVersion, R.PET_VERSION);
 for (const id of Object.keys(oldGrades)) assert.equal(R.petGrade(profile, id), oldGrades[id], `${id} 등급 그대로`);
 assert.deepEqual(profile.gear.hoya_ranged_weapon, { copies: 40, grade: 2 }); assert.deepEqual(profile.gear.hoya_ranged_helm, { copies: 23, grade: 1 }); assert.deepEqual(profile.gear.hoya_melee_weapon, { copies: 5, grade: 0 });
 const snap = env.DB.sql.prepare('SELECT state FROM guardian_profile_snapshots WHERE user_id=? AND target_version=?').get('qa', CARDS_SCALE_SNAPSHOT); assert.equal(JSON.parse(snap.state).petCopies.otter, 8, '원본 보관');
 const again = (await getProfile(env.DB, 'qa')).profile; assert.deepEqual(again.petCopies, profile.petCopies, '한 번만');
});

test('2026-09-25 두 번째: 오늘 아침 1.5배로 바뀐 학생(v3)도 1·20·40·80·120으로 옮기고 원본은 스냅숏 2004, 등급은 그대로', async () => {
 const {CARDS_REMAP_SNAPSHOT} = await import('../server/src/guardian.js');
 const v3 = { ...base(), petCopies: { deer: 5, otter: 2, cat: 38, turtle: 120 }, pets: ['turtle', 'cat', 'otter', 'deer'], activePet: 'deer', petVersion: 3,
  hero: 'hoya', heroLocked: true, gear: { hoya_ranged_weapon: { copies: 14, grade: 2 } } };
 const oldCut = [1, 5, 11, 38, 120], g = n => [0, 1, 2, 3, 4].filter(i => n >= oldCut[i]).pop();
 const env = await setup(v3); const { profile } = await getProfile(env.DB, 'qa');
 assert.deepEqual(profile.petCopies, { deer: 20, otter: 5, cat: 80, turtle: 120 });
 for (const [id, n] of Object.entries(v3.petCopies)) assert.equal(R.petGrade(profile, id), g(n), id);
 assert.deepEqual(profile.gear.hoya_ranged_weapon, { copies: 44, grade: 2 });
 assert.equal(JSON.parse(env.DB.sql.prepare('SELECT state FROM guardian_profile_snapshots WHERE user_id=? AND target_version=?').get('qa', CARDS_REMAP_SNAPSHOT).state).petCopies.deer, 5);
});
