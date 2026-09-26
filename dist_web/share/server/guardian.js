import { VERSION, SKILLS, COMBOS, SUPPORTS, runParts, action, completeRun, stageUnlocked, difficultyOf, hardGate, hardGateText, durationFor, superTestProfile, TEST_ACCOUNT_RE, needsPetMigration, migratePets } from '../../game/src/rework-core.js';
import { migrateLegacy } from './legacy-migration.js';
import { migrateProfileV2, needsPartsRepair, repairObsoleteParts, PARTS_FIX_SNAPSHOT } from './profile-migration-v2.js';

export const DAILY_PASSES = 10;
export const PETS_FIX_SNAPSHOT = 2002;   // 스냅숏 키(친구 4종 개편 전 원본). 프로필 버전이 아니다.
export const CARDS_SCALE_SNAPSHOT = 2003;   // 스냅숏 키(장비·친구 카드 개수 1.5배 전 원본, 2026-09-25).
export const CARDS_REMAP_SNAPSHOT = 2004;   // 스냅숏 키(등급 개수 1·20·40·80·120으로 옮기기 전 원본, 2026-09-25).
export const dayKey = (now=Date.now()) => new Date(now+3600000).toISOString().slice(0,10);
export const nextReset = (now=Date.now()) => (Math.floor((now+3600000)/86400000)+1)*86400000-3600000;
// 특별 이벤트(2026-09-23 사용자 요청): 추석 연휴 게임 날짜(아침 8시 기준) 2026-09-24·25·26에는 하루 이용권 20장 = 기본 10 + 이벤트 10.
// 이벤트 10장은 선생님 추가 지급과 같은 길(play_admin_grants → 트리거가 play_days.bonus_granted에 더함)로 사람마다 하루 한 번만 들어가고
// (request_id = event-<id>-<날짜>, 중복 무시), 다음 아침 8시에 다른 추가분처럼 사라진다. 학생 화면 알림은 passes.event로 보낸다.
export const PASS_EVENTS = [
  { id:'chuseok2026', days:['2026-09-24','2026-09-25','2026-09-26'], bonus:10, title:'추석 특별 이벤트', note:'추석 이벤트: 이용권 2배',
    message:'9월 24일부터 26일까지 추석 연휴 동안 매일 이용권이 20장(2배)으로 채워져요!',
    greeting:'풍성한 한가위 보내세요! 가족과 함께 즐겁고 행복한 추석 되세요.' },
];
export const activePassEvent = (now=Date.now()) => { const day=dayKey(now); return PASS_EVENTS.find(e=>e.days.includes(day))||null; };
export async function grantPassEvent(db,id,now=Date.now()){
  const ev=activePassEvent(now);if(!ev)return null;
  const day=dayKey(now);
  await db.prepare('INSERT OR IGNORE INTO play_admin_grants(request_id,user_id,day,passes,gold,note,created_at) VALUES(?,?,?,?,0,?,?)').bind(`event-${ev.id}-${day}`,id,day,ev.bonus,ev.note,now).run();
  return ev;
}
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{12,80}$/.test(s);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;

// Additive, repeatable migration. Never reads or changes the administrator secret.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS presence (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, since INTEGER NOT NULL, last_seen INTEGER NOT NULL, device TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_presence_seen ON presence(last_seen)`,
  `CREATE TABLE IF NOT EXISTS guardian_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS guardian_profile_snapshots (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, target_version INTEGER NOT NULL, state TEXT NOT NULL, revision INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,target_version))`,
  `CREATE TABLE IF NOT EXISTS play_days (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, base_used INTEGER NOT NULL DEFAULT 0 CHECK(base_used BETWEEN 0 AND 10), bonus_granted INTEGER NOT NULL DEFAULT 0 CHECK(bonus_granted>=0), bonus_used INTEGER NOT NULL DEFAULT 0 CHECK(bonus_used BETWEEN 0 AND bonus_granted), PRIMARY KEY(user_id,day))`,
  `CREATE TABLE IF NOT EXISTS play_runs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, stage TEXT NOT NULL, started_at INTEGER NOT NULL, duration INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', settled_at INTEGER, settlement_day TEXT, result TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS play_one_active ON play_runs(user_id) WHERE status='active'`,
  `CREATE INDEX IF NOT EXISTS play_user ON play_runs(user_id, started_at)`,
  `CREATE TABLE IF NOT EXISTS guardian_operations (id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, result TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(user_id,id))`,
  `CREATE TABLE IF NOT EXISTS play_admin_grants (request_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL, passes INTEGER NOT NULL CHECK(passes BETWEEN 0 AND 100), gold INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(request_id,user_id))`,
  `CREATE TRIGGER IF NOT EXISTS play_clear_charge BEFORE UPDATE OF status ON play_runs WHEN OLD.status='active' AND NEW.status='won' BEGIN
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM play_days WHERE user_id=NEW.user_id AND day=NEW.settlement_day AND base_used+bonus_used<10+bonus_granted) THEN RAISE(ABORT,'NO_PLAY_PASSES') END;
    UPDATE play_days SET bonus_used=bonus_used+CASE WHEN base_used>=10 THEN 1 ELSE 0 END, base_used=base_used+CASE WHEN base_used<10 THEN 1 ELSE 0 END WHERE user_id=NEW.user_id AND day=NEW.settlement_day;
  END`,
  `CREATE TRIGGER IF NOT EXISTS play_admin_grant_apply AFTER INSERT ON play_admin_grants BEGIN
    INSERT INTO play_days(user_id,day,bonus_granted) VALUES(NEW.user_id,NEW.day,NEW.passes) ON CONFLICT(user_id,day) DO UPDATE SET bonus_granted=bonus_granted+NEW.passes;
    UPDATE guardian_profiles SET state=json_set(state,'$.coins',json_extract(state,'$.coins')+NEW.gold), revision=revision+1 WHERE user_id=NEW.user_id AND NEW.gold>0;
  END`,
  // 보급권 지급(2026-09-24 밤 사용자 "선생님 관리에 보급권 부여 기능"): 요청 번호(request_id)마다 한 번만 → 트리거가 프로필 gifts에 더한다(만료 없음).
  `CREATE TABLE IF NOT EXISTS play_admin_gift_grants (request_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, gifts INTEGER NOT NULL CHECK(gifts BETWEEN 1 AND 100), note TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(request_id,user_id))`,
  `CREATE TRIGGER IF NOT EXISTS play_admin_gift_apply AFTER INSERT ON play_admin_gift_grants BEGIN
    UPDATE guardian_profiles SET state=json_set(state,'$.gifts',COALESCE(json_extract(state,'$.gifts'),0)+NEW.gifts), revision=revision+1 WHERE user_id=NEW.user_id;
  END`,
];
export async function migrate(db){await db.batch(SCHEMA.map(sql=>db.prepare(sql)));return {ok:true,version:VERSION};}
export async function getProfile(db,id){
  let row=await db.prepare('SELECT state,revision FROM guardian_profiles WHERE user_id=?').bind(id).first();
  if(!row){const legacy=await db.prepare('SELECT data FROM saves WHERE user_id=?').bind(id).first();
    const state=migrateLegacy(legacy?JSON.parse(legacy.data):{});
    await db.prepare('INSERT OR IGNORE INTO guardian_profiles(user_id,state) VALUES(?,?)').bind(id,JSON.stringify(state)).run();
    row=await db.prepare('SELECT state,revision FROM guardian_profiles WHERE user_id=?').bind(id).first();}
  for(let retry=0;retry<6;retry++){
    const profile=JSON.parse(row.state),isLegacy=profile.version!==VERSION,partsFix=!isLegacy&&needsPartsRepair(profile);
    if(!isLegacy&&!partsFix&&!needsPetMigration(profile))return {profile,revision:row.revision};
    // 친구 4종 개편(2026-09-24 밤): 옛 친구·우정 → 친구 카드. 원본은 스냅숏 PETS_FIX_SNAPSHOT에 남는다.
    const next=isLegacy?migrateProfileV2(profile):migratePets(repairObsoleteParts(profile));
    const target=isLegacy?2:partsFix?PARTS_FIX_SNAPSHOT:profile.petVersion===2?CARDS_SCALE_SNAPSHOT:profile.petVersion===3?CARDS_REMAP_SNAPSHOT:PETS_FIX_SNAPSHOT;   // 2003: 1.5배 전 · 2004: 1·20·40·80·120 전 원본
    // Snapshot + revision-checked write are atomic. Concurrent teacher grants are never overwritten.
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO guardian_profile_snapshots(user_id,target_version,state,revision,created_at) SELECT user_id,?,state,revision,? FROM guardian_profiles WHERE user_id=? AND revision=?').bind(target,Date.now(),id,row.revision),
      db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(JSON.stringify(next),id,row.revision),
    ]);
    row=await db.prepare('SELECT state,revision FROM guardian_profiles WHERE user_id=?').bind(id).first();
  }
  throw new Error('저장 이전 중이에요. 잠시 뒤 다시 연결해 주세요.');
}
export async function passStatus(db,id,now=Date.now()){
  const day=dayKey(now),r=await db.prepare('SELECT * FROM play_days WHERE user_id=? AND day=?').bind(id,day).first();
  const baseRemaining=10-(r?.base_used||0), bonusRemaining=(r?.bonus_granted||0)-(r?.bonus_used||0);
  const ev=activePassEvent(now);
  return {day,baseRemaining,bonusRemaining,remaining:baseRemaining+bonusRemaining,resetAt:nextReset(now),serverNow:now,dailyLimit:10+(ev?ev.bonus:0),
    event:ev?{id:ev.id,day,title:ev.title,message:ev.message,greeting:ev.greeting,bonus:ev.bonus,dailyTotal:10+ev.bonus}:null};
}
export async function expireOldRuns(db,id,now){
  return db.prepare("UPDATE play_runs SET status='expired',settled_at=? WHERE user_id=? AND status='active' AND started_at<?").bind(now,id,now-1800000).run();
}
async function status(db,id,now){const p=await getProfile(db,id);return {...p,passes:await passStatus(db,id,now)};}
export async function guardianAPI(request,env,user,path,now=Date.now()){
  const db=env.DB,id=user.id,method=request.method;
  const localhost=['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
  const testClock=env.LOCAL_TEST_CLOCK==='true'&&localhost;
  if(localhost&&env.LOCAL_TEST_OFFSET_MS)now+=Number(env.LOCAL_TEST_OFFSET_MS)||0;   // 로컬 시험 전용: 날짜를 옮겨 이벤트 등을 확인(실서버에서는 무시)
  if(path==='/guardian'&&method==='GET'){
    await expireOldRuns(db,id,now);
    await grantPassEvent(db,id,now);   // 이벤트 날이면 오늘 이벤트 이용권(하루 한 번)
    const active=await db.prepare("SELECT id,stage,started_at FROM play_runs WHERE user_id=? AND status='active'").bind(id).first();
    return reply({...await status(db,id,now),active});
  }
  let b;try{b=await request.json();}catch{return reply({error:'요청을 다시 보내 주세요.'},400);}
  if(!uuid(b.requestId))return reply({error:'요청 번호가 필요해요.'},400);
  if(['/guardian/action','/play/start'].includes(path)&&b.clientVersion!==VERSION)return reply({error:'새로운 원소 시스템으로 바뀌었어요. 화면을 새로고침해 주세요.',code:'CLIENT_UPDATE_REQUIRED',clientVersion:VERSION},409);
  if(path==='/guardian/action'&&method==='POST'){
    for(let retry=0;retry<4;retry++){
      const old=await db.prepare('SELECT result FROM guardian_operations WHERE user_id=? AND id=?').bind(id,b.requestId).first();
      if(old)return reply({...JSON.parse(old.result),...await status(db,id,now)});
      const {profile,revision}=await getProfile(db,id);let result;
      // 별 = 출동할 때의 난이도(정산은 프로필의 difficulty를 읽음) → 도전 중에는 난이도를 못 바꾼다(2026-09-23)
      if(b.kind==='settings'&&b.difficulty!==undefined&&b.difficulty!==profile.difficulty&&await db.prepare("SELECT 1 FROM play_runs WHERE user_id=? AND status='active'").bind(id).first())return reply({error:'도전 중에는 난이도를 바꿀 수 없어요. 먼저 도전을 마무리해 주세요.',code:'ACTIVE_RUN'},409);
      // 게임 날짜(아침 8시 기준)는 서버가 넣는다(코인 교환 하루 1번). 보급 차례가 어긋나면 409 DRAW_MODE — 아무것도 바뀌지 않음.
      try{result=action(profile,b,Math.random,{day:dayKey(now)});}catch(e){return e.code==='DRAW_MODE'?reply({error:e.message,code:e.code,mode:e.mode},409):reply({error:e.message},400);}
      // 결과 카드(draw)까지 함께 저장해 같은 요청이 다시 오면(재접속) 같은 결과를 다시 보여 준다.
      const event=JSON.stringify({message:result.message,...(result.draw?{draw:result.draw}:{})});
      const r=await db.batch([
        db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM guardian_operations WHERE user_id=? AND id=?)').bind(JSON.stringify(result.profile),id,revision,id,b.requestId),
        db.prepare('INSERT INTO guardian_operations(user_id,id,result,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(id,b.requestId,event,now),
      ]);
      if(r[0].meta.changes)return reply({message:result.message,...(result.draw?{draw:result.draw}:{}),...await status(db,id,now)});
    }
    return reply({error:'다른 기기에서 저장 중이에요. 잠시 뒤 다시 눌러 주세요.'},409);
  }
  if(path==='/play/start'&&method==='POST'){
    await expireOldRuns(db,id,now);
    const old=await db.prepare('SELECT * FROM play_runs WHERE id=? AND user_id=?').bind(b.requestId,id).first();
    if(old)return old.status==='active'?reply({runId:old.id,duration:old.duration,...await status(db,id,now)}):reply({error:'이미 끝난 도전이에요.'},409);
    const {profile}=await getProfile(db,id);
    if(!stageUnlocked(profile,b.stage))return reply({error:'앞 단계를 먼저 성공해 주세요.'},400);
    if(difficultyOf(profile)==='hard'){const g=hardGate(profile,b.stage);if(!g.open)return reply({error:`어려움은 아직 잠겨 있어요 · ${hardGateText(g)}`,code:'HARD_LOCKED',gate:g},409);}   // 어려움 최소 기준(HARD_MIN)
    await grantPassEvent(db,id,now);
    const duration=durationFor(profile,b.stage),day=dayKey(now);
    const r=await db.batch([
      db.prepare("UPDATE play_runs SET status='expired',settled_at=? WHERE user_id=? AND status='active' AND started_at<?").bind(now,id,now-1800000),
      db.prepare('INSERT OR IGNORE INTO play_days(user_id,day) VALUES(?,?)').bind(id,day),
      db.prepare("INSERT INTO play_runs(id,user_id,stage,started_at,duration,result) SELECT ?,?,?,?,?,? FROM play_days WHERE user_id=? AND day=? AND base_used+bonus_used<10+bonus_granted AND NOT EXISTS(SELECT 1 FROM play_runs WHERE user_id=? AND status='active')").bind(b.requestId,id,b.stage,now,duration,JSON.stringify({loadout:{equippedParts:runParts(profile),pet:profile.activePet??null}}),id,day,id),
    ]);
    if(!r[2].meta.changes){const active=await db.prepare("SELECT id,stage FROM play_runs WHERE user_id=? AND status='active'").bind(id).first();return reply({error:active?'진행 중인 도전이 있어요. 먼저 마무리해 주세요.':'오늘 이용권을 다 썼어요. 내일 아침 8시에 다시 만나요!',code:active?'ACTIVE_RUN':'NO_PASSES',active,passes:await passStatus(db,id,now)},409);}
    return reply({runId:b.requestId,duration,...await status(db,id,now)});
  }
  if(path==='/play/finish'&&method==='POST'){
    const runId=b.runId;if(!uuid(runId))return reply({error:'도전 번호가 필요해요.'},400);
    for(let retry=0;retry<4;retry++){
      const run=await db.prepare('SELECT * FROM play_runs WHERE id=? AND user_id=?').bind(runId,id).first();
      if(!run)return reply({error:'도전을 찾을 수 없어요.'},404);
      if(run.status==='expired')return reply({error:'오래 멈춘 도전이 종료되었어요. 이용권은 쓰지 않았어요.',code:'EXPIRED'},409);
      if(run.status!=='active')return reply({...JSON.parse(run.result),...await status(db,id,now)});
      const elapsed=Math.max(0,(now-run.started_at)/1000),cleared=b.cleared===true;
      if(cleared&&elapsed+3<run.duration&&!testClock)return reply({error:'도전 시간이 아직 끝나지 않았어요.'},400);
      if(!Number.isFinite(b.seconds)||b.seconds<0)return reply({error:'도전 시간이 올바르지 않아요.'},400);
      const seconds=Math.min(360,testClock?b.seconds:Math.min(b.seconds,elapsed+2));
      if(cleared&&(seconds+3<run.duration||seconds>360))return reply({error:'도전 결과를 확인할 수 없어요.'},400);
      const {profile,revision}=await getProfile(db,id);
      if(cleared)await grantPassEvent(db,id,now);   // 이벤트 날 정산일의 이벤트 이용권(없으면 넣음)
      const skillIds=Array.isArray(b.skillIds)?b.skillIds.filter(s=>SKILLS[s]).slice(0,15):[];
      const fusionIds=Array.isArray(b.fusionIds)?b.fusionIds.filter(s=>COMBOS[s]).slice(0,4):[];
      const supportIds=Array.isArray(b.supportIds)?b.supportIds.filter(s=>SUPPORTS[s]).slice(0,8):[];
      const loadout=run.result?JSON.parse(run.result).loadout:null,equippedPartIds=loadout?.equippedParts??null;
      const pet=loadout&&Object.hasOwn(loadout,'pet')?loadout.pet:undefined;   // 출동할 때의 친구(코인 +%). 배포 전에 시작한 도전은 지금 친구
      const result=completeRun(profile,{day:dayKey(now),equippedPartIds,pet,stage:run.stage,cleared,seconds,litter:Math.max(0,Math.min(99,Math.floor(Number(b.litter)||0))),hpFraction:Math.max(0,Math.min(1,Number(b.hpFraction)||0)),bossSeconds:Number.isFinite(b.bossSeconds)&&b.bossSeconds>=0?b.bossSeconds:Infinity,skillIds,fusionIds,supportIds});
      const event={reward:result.reward,cleared,stage:run.stage,runId,charged:cleared?1:0};
      try{
        const r=await db.batch([
          db.prepare('INSERT OR IGNORE INTO play_days(user_id,day) VALUES(?,?)').bind(id,dayKey(now)),
          db.prepare("UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM play_runs WHERE id=? AND user_id=? AND status='active')").bind(JSON.stringify(result.profile),id,revision,runId,id),
          db.prepare("UPDATE play_runs SET status=?,settled_at=?,settlement_day=?,result=? WHERE id=? AND user_id=? AND status='active' AND changes()=1").bind(cleared?'won':'lost',now,dayKey(now),JSON.stringify(event),runId,id),
        ]);
        if(r[2].meta.changes)return reply({...event,...await status(db,id,now)});
      }catch(e){if(String(e).includes('NO_PLAY_PASSES'))return reply({error:'오늘 이용권이 없어요.',code:'NO_PASSES'},409);throw e;}
    }
    return reply({error:'저장 중이에요. 결과 확인을 다시 눌러 주세요.'},409);
  }
  return reply({error:'없는 주소예요.'},404);
}

// Called only AFTER the existing X-Admin-Key authentication.
export async function guardianAdmin(request,env,sub,method,now=Date.now()){
  const db=env.DB;
  if(['migrate-v1','migrate-v2'].includes(sub)&&method==='POST')return reply(await migrate(db));
  if(sub==='passes'&&method==='GET'){
    const rows=(await db.prepare('SELECT u.id,u.display_id,d.base_used,d.bonus_granted,d.bonus_used FROM users u LEFT JOIN play_days d ON d.user_id=u.id AND d.day=? ORDER BY u.created_at').bind(dayKey(now)).all()).results;
    const users=rows.map(u=>{const baseRemaining=10-(u.base_used||0),bonusRemaining=(u.bonus_granted||0)-(u.bonus_used||0);return {id:u.id,display_id:u.display_id,baseRemaining,bonusRemaining,remaining:baseRemaining+bonusRemaining,resetAt:nextReset(now)};});
    // 이벤트 자동 지급(request_id event-…)은 학생마다 하루 한 줄씩 생기므로 기록 목록에서 뺀다
    const audit=(await db.prepare("SELECT request_id,user_id,day,passes,gold,note,created_at FROM play_admin_grants WHERE request_id NOT LIKE 'event-%' ORDER BY created_at DESC LIMIT 100").all()).results;
    // 보급권 지급 기록을 같은 요청(요청 번호·학생)에 합친다. 보급권만 준 요청은 새 줄
    const gifts=(await db.prepare('SELECT request_id,user_id,gifts,note,created_at FROM play_admin_gift_grants ORDER BY created_at DESC LIMIT 100').all()).results;
    for(const a of audit)a.gifts=0;
    for(const g of gifts){const a=audit.find(x=>x.request_id===g.request_id&&x.user_id===g.user_id);if(a)a.gifts=g.gifts;else audit.push({request_id:g.request_id,user_id:g.user_id,passes:0,gold:0,gifts:g.gifts,note:g.note,created_at:g.created_at});}
    audit.sort((a,b)=>b.created_at-a.created_at);audit.length=Math.min(audit.length,100);
    const ev=activePassEvent(now);
    return reply({users,audit,now,event:ev?{id:ev.id,title:ev.title,bonus:ev.bonus,days:ev.days}:null});
  }
  // 시험용 슈퍼 계정: 관리자(선생님 계정은 index.js가 403)만, 'qa'로 시작하는 계정만. 학생 계정은 절대 바꾸지 않는다.
  if(sub==='test-profile'&&method==='POST'){
    let b;try{b=await request.json();}catch{return reply({error:'입력 형식을 확인해 주세요.'},400);}
    const id=String(b.id||'').toLowerCase();
    if(!TEST_ACCOUNT_RE.test(id))return reply({error:"시험 계정(아이디가 'qa'로 시작)만 바꿀 수 있어요."},400);
    if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first())return reply({error:'없는 아이디예요.'},404);
    const {profile}=await getProfile(db,id);
    const next=superTestProfile(profile,{training:Number(b.training)||100,copies:Number(b.copies)||80,level:Number(b.level)||10});
    await db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=?').bind(JSON.stringify(next),id).run();
    return reply({ok:true,id,training:next.training,parts:Object.keys(next.parts).length,stages:Object.keys(next.stages).filter(k=>next.stages[k].cleared).length});
  }
  // 캐릭터(성별) 바꾸기: 가입 때 고정된 캐릭터를 선생님이 한 번 바꿔 준다 — 장비가 하나도 없을 때만(장비는 성별마다 달라서)
  if(sub==='set-hero'&&method==='POST'){
    let b;try{b=await request.json();}catch{return reply({error:'입력 형식을 확인해 주세요.'},400);}
    const id=String(b.id||'').toLowerCase();if(!['hoya','minji'].includes(b.hero))return reply({error:'호야나 민지를 골라 주세요.'},400);
    if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first())return reply({error:'없는 아이디예요.'},404);
    const {profile,revision}=await getProfile(db,id);
    // 첫 무료 무기(원거리·근거리 1개씩)만 가진 학생은 새 캐릭터의 같은 종류 무기로 바꿔 준다(잘못 고른 경우). 장비를 더 모았으면 거절.
    const owned=Object.entries(profile.gear||{}).filter(([,g])=>g.copies>0);
    const firstOnly=owned.every(([id,g])=>g.copies===1&&/_(ranged|melee)_weapon$/.test(id));
    if(!firstOnly)return reply({error:'장비를 모은 학생이라 캐릭터를 바꿀 수 없어요.'},400);
    const swap=id=>id.replace(/^(hoya|minji)_/,`${b.hero}_`),next={...profile,hero:b.hero,heroLocked:true,equippedGear:{}};
    if(owned.length){next.gear=Object.fromEntries(owned.map(([id,g])=>[swap(id),{...g}]));if(profile.equippedGear?.weapon)next.equippedGear={weapon:swap(profile.equippedGear.weapon)};}
    const r=await db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(JSON.stringify(next),id,revision).run();
    if(!r.meta.changes)return reply({error:'다른 곳에서 저장 중이에요. 다시 눌러 주세요.'},409);
    return reply({ok:true,id,hero:b.hero});
  }
  if(sub==='grant-passes'&&method==='POST'){
    let b;try{b=await request.json();}catch{return reply({error:'입력 형식을 확인해 주세요.'},400);}
    const passes=b.passes??0,gold=b.gold||0,gifts=b.gifts||0;
    if(!uuid(b.requestId)||!integer(passes,0,100)||!integer(gold,0,1000000)||!integer(gifts,0,100)||(!passes&&!gold&&!gifts))return reply({error:'이용권은 0~100장, 보급권은 0~100장, 코인은 0~1000000개를 입력하세요.'},400);
    const rows=(await db.prepare('SELECT u.id,s.data,g.state FROM users u LEFT JOIN saves s ON s.user_id=u.id LEFT JOIN guardian_profiles g ON g.user_id=u.id WHERE ?=1 OR u.id=?').bind(b.all===true?1:0,String(b.id||'').toLowerCase()).all()).results;
    const ids=rows.map(u=>u.id);
    if(!ids.length)return reply({error:'대상 학생을 찾을 수 없어요.'},404);
    const note=String(b.note||'선생님 추가 지급').slice(0,120),day=dayKey(now);
    const missing=rows.filter(u=>!u.state).map(u=>({id:u.id,state:migrateLegacy(u.data?JSON.parse(u.data):{})}));
    // All inserts and triggers are one transaction; retrying the request ID grants nothing twice.
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO guardian_profiles(user_id,state) SELECT json_extract(value,'$.id'),json_extract(value,'$.state') FROM json_each(?)").bind(JSON.stringify(missing)),
      ...(passes||gold?[db.prepare('INSERT OR IGNORE INTO play_admin_grants(request_id,user_id,day,passes,gold,note,created_at) SELECT ?,value,?,?,?,?,? FROM json_each(?)').bind(b.requestId,day,passes,gold,note,now,JSON.stringify(ids))]:[]),
      ...(gifts?[db.prepare('INSERT OR IGNORE INTO play_admin_gift_grants(request_id,user_id,gifts,note,created_at) SELECT ?,value,?,?,? FROM json_each(?)').bind(b.requestId,gifts,note,now,JSON.stringify(ids))]:[]),
    ]);
    return reply({ok:true,count:ids.length,passes,gold,gifts,day,expiresAt:nextReset(now)});
  }
  return null;
}
