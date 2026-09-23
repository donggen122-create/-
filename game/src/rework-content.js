import {SKILLS as ELEMENT_SKILLS,COMBOS,STAGES} from './rework-core.js';
import {BOSS_PATTERNS} from './boss-patterns.js';
export const BOSS_HP_MULT=1900;
export function installReworkContent({SKILLS,PASSIVES,EVOLUTIONS,CHAPTERS,BOSSES}){
  // Historical data remains archived; only the live combat catalog is replaced.
  for(const id of Object.keys(SKILLS))delete SKILLS[id];
  for(const id of Object.keys(PASSIVES))delete PASSIVES[id];
  for(const id of Object.keys(EVOLUTIONS))delete EVOLUTIONS[id];
  for(const [id,d] of Object.entries({...ELEMENT_SKILLS,...COMBOS}))SKILLS[id]={...d,maxLevel:3,apply:lv=>({dmgMul:[1,1.3,1.6][lv-1]||1,areaMul:1,intervalMul:1})};
  STAGES.forEach((s,i)=>Object.assign(CHAPTERS[i],{name:s.name,enemyMult:1,density:[1.05,1.10,1.20,1.30,1.40][i],dark:i>=3?.07:0}));
  // 보스 강화(2026-09-23 저녁 사용자 "보스가 너무 약해"): 전에는 보통에서 4~6초 만에 쓰러졌다(docs/29). 거리별 기술표는 boss-patterns.js.
  const boss=BOSSES.T1_BOSS;boss.hpMult=BOSS_HP_MULT;boss.atkMult=1.25;boss.spdU=1.6;boss.rangePatterns=true;
  boss.patterns=BOSS_PATTERNS.map(p=>({...p}));
}
