import {STAGES,TEST_ACCOUNT_RE,stageLabel} from '../../game/src/rework-core.js';
import {validatePerf,validateCause} from './run-telemetry.js';
const parse = x => {try {const p=typeof x==='string'?JSON.parse(x):x;return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}catch{return {};}};
const round = x => Math.round(x*100)/100;
export function median(values,precision=2){if(!values.length)return null;const a=[...values].sort((a,b)=>a-b),m=a.length>>1;const n=a.length%2?a[m]:(a[m-1]+a[m])/2;return Math.round(n*10**precision)/10**precision;}
const samples=()=>({fps:[],p1:[],long50:[],quality:Array(9).fill(0)});
const add=(s,p)=>{s.fps.push(p.fps);s.p1.push(p.p1);s.long50.push(p.long50);s.quality[p.q]++;};
const summary=s=>({n:s.fps.length,fps:median(s.fps),p1:median(s.p1),long50:median(s.long50,4),quality:s.quality});
export function aggregateStageStats(runs,profiles,{days=30,now=Date.now(),stage=null}={}){
 const cutoff=days==='all'?0:now-days*86400000;
 const stages=STAGES.map(s=>({stage:s.id,label:stageLabel(s.id),attempts:0,wins:0,students:new Set(),stopped:0,difficulty:{easy:[0,0],normal:[0,0],hard:[0,0],unknown:[0,0]},causes:new Map(),perf:samples()}));
 const byStage=new Map(stages.map(s=>[s.stage,s])),highest=new Map(),devices=new Map();
 for(const p of profiles){if(TEST_ACCOUNT_RE.test(p.user_id))continue;const state=parse(p.state);highest.set(p.user_id,Math.max(0,...STAGES.filter(s=>state.stages?.[s.id]?.cleared).map(s=>Number(s.id.slice(2)))));}
 for(const r of runs){
  if(TEST_ACCOUNT_RE.test(r.user_id)||r.started_at<cutoff)continue;
  const s=byStage.get(r.stage);if(!s)continue;
  const event=parse(r.result),won=r.status==='won',d=event.loadout?.difficulty||event.reward?.difficulty;
  s.attempts++;s.wins+=+won;s.students.add(r.user_id);
  const diff=s.difficulty[['easy','normal','hard'].includes(d)?d:'unknown'];diff[0]++;diff[1]+=+won;
  const cause=r.status==='lost'&&validateCause(event.cause);
  if(cause){const key=cause.kind+':'+cause.id;s.causes.set(key,{...cause,n:(s.causes.get(key)?.n||0)+1});}
  const perf=validatePerf(event.perf);if(!perf)continue;add(s.perf,perf);
  // Stage selector bounds this table to at most 108 device/screen groups, even with 5,000 runs.
  if(stage&&r.stage!==stage)continue;
  const key=[perf.dev,perf.w,perf.h].join('/');
  if(!devices.has(key))devices.set(key,{dev:perf.dev,w:perf.w,h:perf.h,stage:stage||'all',perf:samples()});add(devices.get(key).perf,perf);
 }
 return {days,stages:stages.map(s=>({stage:s.stage,label:s.label,attempts:s.attempts,wins:s.wins,winRate:s.attempts?round(s.wins/s.attempts*100):null,students:s.students.size,stopped:[...s.students].filter(id=>highest.get(id)===Number(s.stage.slice(2))-1).length,difficulty:s.difficulty,causes:[...s.causes.values()].sort((a,b)=>b.n-a.n||a.id.localeCompare(b.id)).slice(0,3).map(({id,kind,n})=>({id,kind,n})),perf:summary(s.perf)})),devices:[...devices.values()].sort((a,b)=>a.dev.localeCompare(b.dev)||a.w-b.w||a.h-b.h).map(({perf,...g})=>({...g,...summary(perf)}))};
}
export async function stageStats(db,url){
 const raw=url.searchParams.get('days')??'30';
 if(raw!=='all'&&(!/^\d{1,4}$/.test(raw)||Number(raw)<1||Number(raw)>3650))return {error:'기간은 1~3650일 또는 all로 골라 주세요.'};
 const stage=url.searchParams.get('stage');if(stage&&!STAGES.some(s=>s.id===stage))return {error:'단계를 확인해 주세요.'};
 const days=raw==='all'?'all':Number(raw),now=Date.now(),cutoff=days==='all'?0:now-days*86400000;
 // D1 paginates below its per-query result size limit. No student IDs leave this module.
 const runs=[];let cursor=-1;
 while(true){const rows=(await db.prepare('SELECT rowid AS cursor,user_id,stage,started_at,status,result FROM play_runs WHERE started_at>=? AND rowid>? ORDER BY rowid LIMIT 100').bind(cutoff,cursor).all()).results;runs.push(...rows);if(rows.length<100)break;cursor=rows.at(-1).cursor;}
 const profiles=(await db.prepare("SELECT user_id,json_object('stages',json_extract(state,'$.stages')) AS state FROM guardian_profiles").all()).results;
 return aggregateStageStats(runs,profiles,{days,now,stage});
}
