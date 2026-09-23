import { VERSION, SKILLS, COMBOS, SUPPORTS, action, completeRun, stageUnlocked, durationFor } from '../../game/src/rework-core.js';
import { migrateLegacy } from './legacy-migration.js';
import { migrateProfileV2 } from './profile-migration-v2.js';

export const DAILY_PASSES = 10;
export const dayKey = (now=Date.now()) => new Date(now+3600000).toISOString().slice(0,10);
export const nextReset = (now=Date.now()) => (Math.floor((now+3600000)/86400000)+1)*86400000-3600000;
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
];
export async function migrate(db){await db.batch(SCHEMA.map(sql=>db.prepare(sql)));return {ok:true,version:VERSION};}
export async function getProfile(db,id){
  let row=await db.prepare('SELECT state,revision FROM guardian_profiles WHERE user_id=?').bind(id).first();
  if(!row){const legacy=await db.prepare('SELECT data FROM saves WHERE user_id=?').bind(id).first();
    const state=migrateLegacy(legacy?JSON.parse(legacy.data):{});
    await db.prepare('INSERT OR IGNORE INTO guardian_profiles(user_id,state) VALUES(?,?)').bind(id,JSON.stringify(state)).run();
    row=await db.prepare('SELECT state,revision FROM guardian_profiles WHERE user_id=?').bind(id).first();}
  for(let retry=0;retry<6;retry++){
    const profile=JSON.parse(row.state);
    if(profile.version===VERSION)return {profile,revision:row.revision};
    const next=migrateProfileV2(profile);
    // Compare revision inside the batch, so a simultaneous administrator grant is never overwritten.
    const changes=await db.batch([
      db.prepare('INSERT OR IGNORE INTO guardian_profile_snapshots(user_id,target_version,state,revision,created_at) SELECT user_id,2,state,revision,? FROM guardian_profiles WHERE user_id=? AND revision=? AND json_extract(state,\'$.version\')=1').bind(Date.now(),id,row.revision),
      db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=? AND json_extract(state,\'$.version\')=1').bind(JSON.stringify(next),id,row.revision),
    ]);
    row=await db.prepare('SELECT state,revision FROM guardian_profiles WHERE user_id=?').bind(id).first();
    if(changes[1].meta.changes&&JSON.parse(row.state).version===VERSION)return {profile:JSON.parse(row.state),revision:row.revision};
  }
  throw new Error('저장 이전 중이에요. 잠시 뒤 다시 연결해 주세요.');
}
export async function passStatus(db,id,now=Date.now()){
  const day=dayKey(now),r=await db.prepare('SELECT * FROM play_days WHERE user_id=? AND day=?').bind(id,day).first();
  const baseRemaining=10-(r?.base_used||0), bonusRemaining=(r?.bonus_granted||0)-(r?.bonus_used||0);
  return {day,baseRemaining,bonusRemaining,remaining:baseRemaining+bonusRemaining,resetAt:nextReset(now),serverNow:now,dailyLimit:10};
}
async function status(db,id,now){const p=await getProfile(db,id);return {...p,passes:await passStatus(db,id,now)};}
export async function guardianAPI(request,env,user,path,now=Date.now()){
  const db=env.DB,id=user.id,method=request.method;
  const testClock=env.LOCAL_TEST_CLOCK==='true'&&['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
  if(path==='/guardian'&&method==='GET'){
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
      try{result=action(profile,b);}catch(e){return reply({error:e.message},400);}
      const event=JSON.stringify({message:result.message});
      const r=await db.batch([
        db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM guardian_operations WHERE user_id=? AND id=?)').bind(JSON.stringify(result.profile),id,revision,id,b.requestId),
        db.prepare('INSERT INTO guardian_operations(user_id,id,result,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(id,b.requestId,event,now),
      ]);
      if(r[0].meta.changes)return reply({message:result.message,...await status(db,id,now)});
    }
    return reply({error:'다른 기기에서 저장 중이에요. 잠시 뒤 다시 눌러 주세요.'},409);
  }
  if(path==='/play/start'&&method==='POST'){
    const old=await db.prepare('SELECT * FROM play_runs WHERE id=? AND user_id=?').bind(b.requestId,id).first();
    if(old)return old.status==='active'?reply({runId:old.id,duration:old.duration,...await status(db,id,now)}):reply({error:'이미 끝난 도전이에요.'},409);
    const {profile}=await getProfile(db,id);
    if(!stageUnlocked(profile,b.stage))return reply({error:'앞 단계를 먼저 성공해 주세요.'},400);
    const duration=durationFor(profile,b.stage),day=dayKey(now);
    const r=await db.batch([
      db.prepare("UPDATE play_runs SET status='expired',settled_at=? WHERE user_id=? AND status='active' AND started_at<?").bind(now,id,now-7200000),
      db.prepare('INSERT OR IGNORE INTO play_days(user_id,day) VALUES(?,?)').bind(id,day),
      db.prepare("INSERT INTO play_runs(id,user_id,stage,started_at,duration) SELECT ?,?,?,?,? FROM play_days WHERE user_id=? AND day=? AND base_used+bonus_used<10+bonus_granted AND NOT EXISTS(SELECT 1 FROM play_runs WHERE user_id=? AND status='active')").bind(b.requestId,id,b.stage,now,duration,id,day,id),
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
      const skillIds=Array.isArray(b.skillIds)?b.skillIds.filter(s=>SKILLS[s]).slice(0,15):[];
      const fusionIds=Array.isArray(b.fusionIds)?b.fusionIds.filter(s=>COMBOS[s]).slice(0,4):[];
      const supportIds=Array.isArray(b.supportIds)?b.supportIds.filter(s=>SUPPORTS[s]).slice(0,8):[];
      const result=completeRun(profile,{stage:run.stage,cleared,seconds,litter:Math.max(0,Math.min(99,Math.floor(Number(b.litter)||0))),hpFraction:Math.max(0,Math.min(1,Number(b.hpFraction)||0)),bossSeconds:Number.isFinite(b.bossSeconds)&&b.bossSeconds>=0?b.bossSeconds:Infinity,skillIds,fusionIds,supportIds});
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
    const audit=(await db.prepare('SELECT request_id,user_id,day,passes,gold,note,created_at FROM play_admin_grants ORDER BY created_at DESC LIMIT 100').all()).results;
    return reply({users,audit,now});
  }
  if(sub==='grant-passes'&&method==='POST'){
    let b;try{b=await request.json();}catch{return reply({error:'입력 형식을 확인해 주세요.'},400);}
    if(!uuid(b.requestId)||!integer(b.passes,0,100)||!integer(b.gold||0,0,1000000)||(!b.passes&&!b.gold))return reply({error:'이용권은 0~100장, 코인은 0~1000000개를 입력하세요.'},400);
    const rows=(await db.prepare('SELECT u.id,s.data,g.state FROM users u LEFT JOIN saves s ON s.user_id=u.id LEFT JOIN guardian_profiles g ON g.user_id=u.id WHERE ?=1 OR u.id=?').bind(b.all===true?1:0,String(b.id||'').toLowerCase()).all()).results;
    const ids=rows.map(u=>u.id);
    if(!ids.length)return reply({error:'대상 학생을 찾을 수 없어요.'},404);
    const note=String(b.note||'선생님 추가 지급').slice(0,120),day=dayKey(now);
    const missing=rows.filter(u=>!u.state).map(u=>({id:u.id,state:migrateLegacy(u.data?JSON.parse(u.data):{})}));
    // All inserts and triggers are one transaction; retrying the request ID grants nothing twice.
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO guardian_profiles(user_id,state) SELECT json_extract(value,'$.id'),json_extract(value,'$.state') FROM json_each(?)").bind(JSON.stringify(missing)),
      db.prepare('INSERT OR IGNORE INTO play_admin_grants(request_id,user_id,day,passes,gold,note,created_at) SELECT ?,value,?,?,?,?,? FROM json_each(?)').bind(b.requestId,day,b.passes,b.gold||0,note,now,JSON.stringify(ids)),
    ]);
    return reply({ok:true,count:ids.length,passes:b.passes,gold:b.gold||0,day,expiresAt:nextReset(now)});
  }
  return null;
}
