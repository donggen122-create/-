import { STAGES, PACE, DIFFICULTIES, isBossStage } from '../../game/src/rework-core.js';

// rework-content.js chapter base densities; updateSpawning maximum ramp=2.1,
// hard density=1.2. Burst insects (chapter 1) and split traits are included.
const BASE_DENSITY = [1.05,1.10,1.20,1.30,1.40,1.12,1.18,1.26,1.34,1.42,1.16,1.22,1.30,1.38,1.44,1.18,1.24,1.32,1.40,1.46];
export const ANOMALY_RULES = Object.fromEntries(STAGES.map((s,i) => {
  const duration = isBossStage(s.id) ? 360 : 300;
  const rate = BASE_DENSITY[i]*s.density*PACE.density*2.1*DIFFICULTIES.hard.density*(i<5?2:1)*1.6;
  // Litter keeps respawning every 12 s after the goal is met (main.js), so normal runs collect 22-38;
  // the only defensible bound is the storage clamp (99). Litter is a weak cheat signal: flag > 99, hold > 198.
  return [s.id, { kills:Math.ceil(rate*duration*1.5), litter:99, storedLitter:99, seconds:360, bossSeconds:120, hpFraction:1, rate, duration }];
}));

export function inspectRun(stage, input, duration) {
  const rule=ANOMALY_RULES[stage],flags=[];
  let held=false;
  const upper=(code,value,limit) => {
    if(value===undefined || value===null)return;
    if(!Number.isFinite(value)||value<0||value>limit){
      flags.push({code,value:Number.isFinite(value)?value:null,limit});
      if(Number.isFinite(value)&&value>limit*2)held=true;
    }
  };
  upper('kills',input.kills,rule.kills);
  if(input.kills!==undefined&&!Number.isInteger(input.kills)&&!flags.some(f=>f.code==='kills'))flags.push({code:'kills_integer',value:input.kills,limit:'integer'});
  upper('litter',input.litter,rule.litter);
  upper('seconds',input.seconds,rule.seconds);
  upper('hpFraction',input.hpFraction,1);
  if(input.cleared===true&&input.seconds<duration-3)flags.push({code:'success_seconds',value:input.seconds,limit:duration-3});
  // Abandoned/failed boss runs need not have reached the boss phase.
  if(isBossStage(stage)&&input.cleared===true){
    if(!Number.isFinite(input.bossSeconds))flags.push({code:'bossSeconds_required',value:null,limit:rule.bossSeconds});
    else upper('bossSeconds',input.bossSeconds,rule.bossSeconds);
  }else if(input.bossSeconds!=null)upper('bossSeconds',input.bossSeconds,rule.bossSeconds);
  if(input.perf?.fps===0&&input.kills>=rule.kills)flags.push({code:'perf_kills',value:input.kills,limit:'fps > 0'});
  return {flags,held};
}

export async function anomaliesAdmin(request,db,sub,method,getProfile,now=Date.now()){
  const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
  if(sub==='anomalies'&&method==='GET'){
    const rows=(await db.prepare("SELECT r.id,r.user_id,u.display_id,r.stage,r.settled_at,r.result FROM play_runs r JOIN users u ON u.id=r.user_id WHERE r.flagged=1 ORDER BY r.settled_at DESC LIMIT 100").all()).results;
    return reply({runs:rows.map(r=>{const e=JSON.parse(r.result);return {id:r.id,user:r.display_id,stage:r.stage,at:r.settled_at,flags:e.flags||[],held:!!e.held,decision:e.review?.decision||null};})});
  }
  if(sub==='anomalies/release'&&method==='POST'){
    let b;try{b=await request.json();}catch{return reply({error:'입력을 확인해 주세요.'},400);}
    if(!['release','keep'].includes(b.decision))return reply({error:'보상 지급 또는 그대로를 골라 주세요.'},400);
    for(let retry=0;retry<4;retry++){
      const run=await db.prepare('SELECT * FROM play_runs WHERE id=? AND flagged=1').bind(String(b.runId||'')).first();
      if(!run)return reply({error:'판을 찾을 수 없어요.'},404);
      const e=JSON.parse(run.result);
      if(e.review)return reply({ok:true,decision:e.review.decision,already:true});
      const original=run.result;
      e.review={decision:b.decision,at:now};
      if(b.decision==='keep'||!e.held){
        const r=await db.prepare('UPDATE play_runs SET result=? WHERE id=? AND result=?').bind(JSON.stringify(e),run.id,original).run();
        if(r.meta.changes)return reply({ok:true,decision:b.decision});
        continue;
      }
      const {profile,revision}=await getProfile(db,run.user_id);
      profile.coins+=e.heldAmounts.coins;profile.gifts+=e.heldAmounts.gifts;
      e.reward=e.heldReward;e.held=false;delete e.heldReward;delete e.heldAmounts;
      const r=await db.batch([
        db.prepare('UPDATE guardian_profiles SET state=?,revision=revision+1 WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM play_runs WHERE id=? AND result=?)').bind(JSON.stringify(profile),run.user_id,revision,run.id,original),
        db.prepare('UPDATE play_runs SET result=? WHERE id=? AND result=? AND changes()=1').bind(JSON.stringify(e),run.id,original),
      ]);
      if(r[1].meta.changes)return reply({ok:true,decision:'release'});
    }
    return reply({error:'저장 중이에요. 다시 눌러 주세요.'},409);
  }
  return null;
}
