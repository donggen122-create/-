import {SKILLS as ELEMENT_SKILLS,COMBOS,STAGES} from './rework-core.js';
export function installReworkContent({SKILLS,PASSIVES,EVOLUTIONS,CHAPTERS,BOSSES}){
  // Historical data remains archived; only the live combat catalog is replaced.
  for(const id of Object.keys(SKILLS))delete SKILLS[id];
  for(const id of Object.keys(PASSIVES))delete PASSIVES[id];
  for(const id of Object.keys(EVOLUTIONS))delete EVOLUTIONS[id];
  for(const [id,d] of Object.entries({...ELEMENT_SKILLS,...COMBOS}))SKILLS[id]={...d,maxLevel:3,apply:lv=>({dmgMul:[1,1.3,1.6][lv-1]||1,areaMul:1,intervalMul:1})};
  STAGES.forEach((s,i)=>Object.assign(CHAPTERS[i],{name:s.name,enemyMult:1,density:[1.05,1.10,1.20,1.30,1.40][i],dark:i>=3?.07:0}));
  const boss=BOSSES.T1_BOSS;boss.hpMult=95;boss.atkMult=1.25;
  boss.patterns=boss.patterns.filter(p=>['scatter','cone','litter'].includes(p.kind)).map(p=>({...p,phase:undefined,telegraphS:Math.max(1.4,p.telegraphS),count:p.kind==='scatter'?4:p.count}));
}
