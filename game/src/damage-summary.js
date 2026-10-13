// Bounded, anonymous damage observations. Combat/rewards never read these counters.
import { SKILLS, COMBOS } from './element-content.js';
import { T1_ENEMIES, T2_ENEMIES, T3_ENEMIES, T4_ENEMIES, T1_BOSS, T2_BOSS, T3_BOSS, T4_BOSS } from './themes.js';

export const DAMAGE_TARGET_NAMES = Object.fromEntries([
  ...Object.entries({...T1_ENEMIES,...T2_ENEMIES,...T3_ENEMIES,...T4_ENEMIES}).map(([id,d])=>[id,d.name]),
  ...[T1_BOSS,T2_BOSS,T3_BOSS,T4_BOSS].map(d=>[d.id,d.name]),
]);
export const damageSkillIds = element => {
  const base=Object.values(SKILLS).filter(s=>s.element===element);
  return [...base.map(s=>s.id),...base.flatMap(s=>Object.values(COMBOS).filter(c=>c.skill===s.id).map(c=>c.id))];
};
export const effectiveHpDamage = (before,after) => Number.isFinite(before)&&Number.isFinite(after)?Math.max(0,Math.min(Math.max(0,before),before-after)):0;
const round = n => Math.round(n*100)/100;
const amount = n => Number.isFinite(n)&&n>=0&&n<=1e9&&Math.abs(round(n)-n)<1e-7;
const count = n => Number.isInteger(n)&&n>=0&&n<=1e6;
const exact = (o,keys) => o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

export function createDamageTracker(){
  let rows=new Map(),enabled=false,otherDamage=0;
  return {
    reset(element=null){
      enabled=damageSkillIds(element).length===4;otherDamage=0;
      rows=new Map(damageSkillIds(element).map(id=>[id,{id,damage:0,hits:0,acquiredAt:null,targets:new Map()}]));
    },
    acquire(id,at){const row=rows.get(id);if(enabled&&row&&row.acquiredAt===null)row.acquiredAt=round(Math.max(0,Math.min(300,at)));},
    record(id,target,dealt,at){
      if(!enabled||!Number.isFinite(dealt)||dealt<=0)return;
      const row=rows.get(id),d=round(dealt);if(!row){otherDamage=round(otherDamage+d);return;}
      if(!Object.hasOwn(DAMAGE_TARGET_NAMES,target))return;
      if(row.acquiredAt===null)row.acquiredAt=round(Math.max(0,Math.min(300,at)));
      const t=row.targets.get(target)||{id:target,damage:0,hits:0};
      t.damage=round(t.damage+d);t.hits++;row.targets.set(target,t);row.damage=round(row.damage+d);row.hits++;
    },
    snapshot(seconds){
      if(!enabled)return null;
      const skills=[...rows.values()].map(r=>({...r,targets:[...r.targets.values()].map(t=>({...t}))}));
      return {v:1,seconds:round(Math.max(0,Math.min(300,seconds))),total:round(skills.reduce((n,r)=>n+r.damage,0)),otherDamage,skills};
    },
  };
}

// Validate client observations without accepting labels, arbitrary identifiers, or unbounded lists.
// This is telemetry validation, not server-side combat reconstruction.
export function validateDamageSummary(input,{seconds=300,element}={}){
  const ids=damageSkillIds(element);
  if(ids.length!==4||!exact(input,['v','seconds','total','otherDamage','skills'])||input.v!==1||!amount(input.seconds)||input.seconds>300||Math.abs(input.seconds-Math.min(300,seconds))>2||!amount(input.total)||!amount(input.otherDamage)||!Array.isArray(input.skills)||input.skills.length!==4)return null;
  const seen=new Set(),skills=[];
  for(const r of input.skills){
    if(!exact(r,['id','damage','hits','acquiredAt','targets'])||!ids.includes(r.id)||seen.has(r.id)||!amount(r.damage)||!count(r.hits)||!(r.acquiredAt===null||(amount(r.acquiredAt)&&r.acquiredAt<=input.seconds))||!Array.isArray(r.targets)||r.targets.length>Object.keys(DAMAGE_TARGET_NAMES).length)return null;
    seen.add(r.id);let sum=0,hits=0;const targets=[],targetSeen=new Set();
    for(const t of r.targets){
      if(!exact(t,['id','damage','hits'])||!Object.hasOwn(DAMAGE_TARGET_NAMES,t.id)||targetSeen.has(t.id)||!amount(t.damage)||!count(t.hits)||!t.hits||!t.damage)return null;
      targetSeen.add(t.id);sum+=t.damage;hits+=t.hits;targets.push({...t});
    }
    if(Math.abs(sum-r.damage)>.011||hits!==r.hits||(r.hits>0&&r.acquiredAt===null))return null;
    skills.push({id:r.id,damage:r.damage,hits:r.hits,acquiredAt:r.acquiredAt,targets});
  }
  if(Math.abs(skills.reduce((n,r)=>n+r.damage,0)-input.total)>.011)return null;
  return {v:1,seconds:input.seconds,total:input.total,otherDamage:input.otherDamage,skills};
}
