import {SKILLS as ELEMENT_SKILLS,COMBOS,STAGES} from './rework-core.js';
import {BOSS_PATTERNS,BOSS_PATTERNS_T2} from './boss-patterns.js';
export const BOSS_HP_MULT=1900;
export function installReworkContent({SKILLS,PASSIVES,EVOLUTIONS,CHAPTERS,BOSSES}){
  // Historical data remains archived; only the live combat catalog is replaced.
  for(const id of Object.keys(SKILLS))delete SKILLS[id];
  for(const id of Object.keys(PASSIVES))delete PASSIVES[id];
  for(const id of Object.keys(EVOLUTIONS))delete EVOLUTIONS[id];
  for(const [id,d] of Object.entries({...ELEMENT_SKILLS,...COMBOS}))SKILLS[id]={...d,maxLevel:3,apply:lv=>({dmgMul:[1,1.3,1.6][lv-1]||1,areaMul:1,intervalMul:1})};
  // 2장(CH06~)은 매연 구역이 모든 단계에 조금씩(themes.js T2_STAGES 값보다 개편판 값이 우선)
  STAGES.forEach((s,i)=>Object.assign(CHAPTERS[i],{name:s.name,enemyMult:1,density:[1.05,1.10,1.20,1.30,1.40,1.12,1.18,1.26,1.34,1.42][i]??1.4,dark:i>=5?.06+.01*(i-5):i>=3?.07:0}));
  // 보스 강화(2026-09-23 저녁 사용자 "보스가 너무 약해"): 전에는 보통에서 4~6초 만에 쓰러졌다(docs/29). 거리별 기술표는 boss-patterns.js.
  const boss=BOSSES.T1_BOSS;boss.hpMult=BOSS_HP_MULT;boss.atkMult=1.25;boss.spdU=1.6;boss.rangePatterns=true;
  boss.patterns=BOSS_PATTERNS.map(p=>({...p}));
  // 2-5 굴뚝 가스 대왕: 1-5 대왕보다 조금 더 튼튼하고 세게(2장은 훈련·파츠가 더 쌓인 뒤라서)
  const boss2=BOSSES.T2_BOSS;if(boss2){boss2.hpMult=Math.round(BOSS_HP_MULT*1.15);boss2.atkMult=1.35;boss2.spdU=1.5;boss2.rangePatterns=true;boss2.patterns=BOSS_PATTERNS_T2.map(p=>({...p}));
    // 난이도별 체력(DIFFICULTIES.bossHp 대신): 쉬움·보통은 1-5보다 약 2.5배 오래, 어려움은 적 체력이 이미 5.5배라 1-5와 비슷하게(docs/30 모의)
    boss2.diffHp={easy:1.2,normal:2.1,hard:.35};}
}
