import {TEST_ACCOUNT_RE,stageLabel,STAGES} from '../../game/src/rework-core.js';
import {displayName,member} from './nickname.js';
export const WEEKLY_STAGES=['CH03','CH08','CH13','CH18','CH05','CH10','CH15','CH20'];
export const WEEKLY_GOAL=300;
export const TITLES=[
 {id:'village',name:'쓰레기 마을 수호대',stage:'CH05'},
 {id:'factory',name:'공장 지대 수호대',stage:'CH10'},
 {id:'river',name:'오염된 하천 수호대',stage:'CH15'},
 {id:'forest',name:'불타는 숲 수호대',stage:'CH20'},
 {id:'weekly',name:'이번 주 1등'}, {id:'first',name:'첫 출동'},
];
const WEEK=7*86400000,KST=9*3600000,ANCHOR=Date.UTC(2026,9,12)-KST;
export function weekInfo(now=Date.now()){
 const local=new Date(now+KST),day=(local.getUTCDay()+6)%7;
 const monday=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-day);
 const thursday=new Date(monday+3*86400000),year=thursday.getUTCFullYear();
 const jan4=new Date(Date.UTC(year,0,4)),firstMonday=jan4.getTime()-((jan4.getUTCDay()+6)%7)*86400000;
 return {key:`${year}-W${String(1+Math.round((monday-firstMonday)/WEEK)).padStart(2,'0')}`,start:monday-KST,end:monday-KST+WEEK};
}
export const defaultWeeklyStage=now=>WEEKLY_STAGES[((Math.floor((weekInfo(now).start-ANCHOR)/WEEK)%8)+8)%8];
export const impossible=e=>!!e.held||(e.flags||[]).some(f=>typeof f.limit==='number'&&typeof f.value==='number'&&f.value>f.limit*2);
export function rankRuns(rows,stage){
 const best=new Map();
 const compare=(a,b)=>b.kills-a.kills||b.litter-a.litter||a.at-b.at||a.runId.localeCompare(b.runId);
 for(const r of rows){
  if(r.stage!==stage||r.status!=='won'||TEST_ACCOUNT_RE.test(r.user_id))continue;
  const e=typeof r.result==='string'?JSON.parse(r.result):r.result;
  if(impossible(e)||!e.cleared||!Number.isInteger(e.kills)||e.kills<0)continue;
  const value={id:r.user_id,kills:e.kills,litter:e.litter||0,at:r.settled_at,runId:r.id};
  if(!best.has(value.id)||compare(value,best.get(value.id))<0)best.set(value.id,value);
 }
 return [...best.values()].sort(compare).map((r,i)=>({...r,rank:i+1}));
}
export function titlesFor({bosses=[],runs=0,winner=false}){
 return TITLES.filter(t=>t.stage?bosses.includes(t.stage):t.id==='first'?runs>0:winner);
}
const caches=new WeakMap();
export function invalidateRanking(db){caches.delete(db);}
async function settings(db,now=Date.now()){
 const current=weekInfo(now),previous=weekInfo(current.start-1);
 const rows=(await db.prepare("SELECT key,value FROM settings WHERE key IN ('weekly_stage','weekly_goal',?,?)").bind('weekly_stage:'+current.key,'weekly_stage:'+previous.key).all()).results;
 return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}
function pickedStage(config,week,now){
 try{const override=JSON.parse(config.weekly_stage||'null');if(override?.week===week.key&&WEEKLY_STAGES.includes(override.stage))return override.stage;}catch{}
 const stored=config['weekly_stage:'+week.key];return WEEKLY_STAGES.includes(stored)?stored:defaultWeeklyStage(now);
}
async function aggregate(db,week,stage,config,now){
 let cache=caches.get(db);if(!cache){cache=new Map();caches.set(db,cache);}
 const key=week.key+':'+stage;
 if(cache.has(key)&&now-cache.get(key).at<60000)return cache.get(key).data;
 const rows=(await db.prepare("SELECT id,user_id,stage,status,settled_at,result FROM play_runs INDEXED BY play_settled WHERE settled_at>=? AND settled_at<? AND status='won'").bind(week.start,week.end).all()).results;
 const previous=weekInfo(week.start-1),prevStage=pickedStage(config,previous,previous.start);
 const prevRows=(await db.prepare("SELECT id,user_id,stage,status,settled_at,result FROM play_runs INDEXED BY play_settled WHERE settled_at>=? AND settled_at<? AND status='won' AND stage=?").bind(previous.start,previous.end,prevStage).all()).results;
 // Distinct successful boss membership (historical kills were not collected).
 const hall=(await db.prepare("SELECT DISTINCT user_id,stage FROM play_runs WHERE status='won' AND stage IN ('CH05','CH10','CH15','CH20') AND COALESCE(json_extract(result,'$.held'),0)=0 AND NOT EXISTS(SELECT 1 FROM json_each(result,'$.flags') f WHERE json_type(f.value,'$.limit') IN ('integer','real') AND json_extract(f.value,'$.value')>2*json_extract(f.value,'$.limit'))").all()).results.filter(r=>!TEST_ACCOUNT_RE.test(r.user_id));
 const data={ranks:rankRuns(rows,stage),winner:rankRuns(prevRows,prevStage)[0]?.id,hall,
  successes:rows.filter(r=>!TEST_ACCOUNT_RE.test(r.user_id)&&!impossible(JSON.parse(r.result))).length,
  readRows:{week:rows.length,previous:prevRows.length,hall:hall.length}};
 cache.clear();cache.set(key,{at:now,data});return data;
}
export async function rankingData(db,id,now=Date.now()){
 const week=weekInfo(now),config=await settings(db,now),stage=pickedStage(config,week,now),data=await aggregate(db,week,stage,config,now);
 // Refresh names/title selection even on a cache hit (revoked names disappear immediately).
 const users=(await db.prepare("SELECT u.id,u.nickname,u.nickname_status,u.title,COALESCE(json_extract(g.state,'$.runs'),0) runs FROM users u LEFT JOIN guardian_profiles g ON g.user_id=u.id").all()).results;
 const names=new Map(await Promise.all(users.map(async u=>[u.id,{...u,name:await displayName(u)}])));
 const earned=user=>titlesFor({bosses:data.hall.filter(r=>r.user_id===user.id).map(r=>r.stage),runs:user.runs,winner:data.winner===user.id});
 const publicRow=r=>{const u=names.get(r.id);return {rank:r.rank,name:u.name,title:earned(u).find(t=>t.id===u.title)?.name||null,kills:r.kills,litter:r.litter};};
 const ranks=data.ranks.filter(r=>names.has(r.id)).map((r,i)=>({...r,rank:i+1}));
 const me=names.get(id),myRow=ranks.find(r=>r.id===id);
 const hall=TITLES.filter(t=>t.stage).map(t=>{
  const students=data.hall.filter(r=>r.stage===t.stage).map(r=>names.get(r.user_id)).filter(Boolean);
  return {stage:t.stage,label:stageLabel(t.stage),names:students.filter(u=>u.nickname_status==='approved').map(u=>u.name).sort((a,b)=>a.localeCompare(b,'ko')),others:students.filter(u=>u.nickname_status!=='approved').length};
 });
 const goal=Number(config.weekly_goal)||WEEKLY_GOAL;
 return {week:week.key,stage,label:stageLabel(stage),stageName:STAGES.find(s=>s.id===stage).name,endsAt:week.end,
  top:ranks.slice(0,10).map(publicRow),me:myRow?publicRow(myRow):{rank:null,name:me.name,title:null,kills:null,litter:null},hall,titles:earned(me),member:await member(db,id),cooperation:{successes:data.successes,goal},cacheSeconds:60};
}
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function rankingAPI(request,db,id,path,method,now=Date.now()){
 if(path==='/ranking'&&method==='GET')return reply(await rankingData(db,id,now));
 if(path==='/title'&&method==='POST'){
  let b;try{b=await request.json();}catch{return reply({error:'입력을 확인해 주세요.'},400);}
  const data=await rankingData(db,id,now);
  if(b.title!==null&&!data.titles.some(t=>t.id===b.title))return reply({error:'아직 얻지 않은 칭호예요.'},400);
  await db.prepare('UPDATE users SET title=? WHERE id=?').bind(b.title,id).run();
  return reply({ok:true,member:await member(db,id)});
 }
 return reply({error:'없는 주소예요.'},404);
}
export async function rankingAdmin(request,db,method,now=Date.now()){
 if(method==='GET'){
  const week=weekInfo(now),config=await settings(db,now);return reply({week:week.key,stage:pickedStage(config,week,now),stages:WEEKLY_STAGES.map(s=>({id:s,label:stageLabel(s)})),goal:Number(config.weekly_goal)||WEEKLY_GOAL});
 }
 if(method!=='POST')return reply({error:'없는 주소예요.'},404);
 let b;try{b=await request.json();}catch{return reply({error:'입력을 확인해 주세요.'},400);}
 if(!WEEKLY_STAGES.includes(b.stage)||!Number.isInteger(b.goal)||b.goal<1||b.goal>100000)return reply({error:'단계와 목표 판 수를 확인해 주세요.'},400);
 const week=weekInfo(now);
 await db.batch([
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('weekly_stage',JSON.stringify({week:week.key,stage:b.stage})),
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('weekly_stage:'+week.key,b.stage),
  db.prepare("INSERT INTO settings(key,value) VALUES('weekly_goal',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(b.goal)),
 ]);invalidateRanking(db);return reply({ok:true});
}
