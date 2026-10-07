// 4장 「불타는 숲」(CH16~CH20, 이미지 에셋/테마4_숲_프롬프트.md): 단계·해금·대왕 단계·보상, 학생 숲 몬스터·대왕 데이터, 기술표, 그림 파일.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../game/src/rework-core.js';
import {T4_ENEMIES,T4_BOSS,T4_STAGES,THEMES,stageInfo} from '../game/src/themes.js';
import {BOSS_PATTERNS_T4,pickBossPattern} from '../game/src/boss-patterns.js';

test('twenty stages: chapter 4 opens after 3-5, 4-5 is a boss stage with the same first-clear bonus',()=>{
 assert.equal(R.STAGES.length,20);assert.deepEqual(R.STAGES.slice(15).map(s=>s.id),['CH16','CH17','CH18','CH19','CH20']);
 const p=R.freshProfile();for(let i=1;i<=14;i++)p.stages[`CH${String(i).padStart(2,'0')}`]={cleared:true,stars:1};
 assert.equal(R.stageUnlocked(p,'CH16'),false);p.stages.CH15={cleared:true,stars:1};assert.equal(R.stageUnlocked(p,'CH16'),true);assert.equal(R.stageUnlocked(p,'CH17'),false);
 assert.ok(R.isBossStage('CH20')&&!R.isBossStage('CH19'));assert.equal(R.durationFor(p,'CH20'),240);assert.equal(R.durationFor(p,'CH16'),300);
 for(let i=16;i<=19;i++)p.stages[`CH${i}`]={cleared:true,stars:1};
 const r=R.completeRun(p,{stage:'CH20',cleared:true,seconds:300,litter:5,difficulty:'normal'});
 assert.equal(r.reward.gifts,2);assert.ok(r.reward.coins>=260+120+60+30);
 for(const s of R.STAGES.slice(15)){assert.match(s.goal,/불씨/);assert.ok(s.tip&&s.unlock&&s.story,s.id);}
 // 시안 값: 같은 자리 3장 단계보다 세게(4-5는 3-5처럼 체력은 낮게, 공격만 높게)
 for(let i=0;i<5;i++){const a=R.STAGES[10+i],b=R.STAGES[15+i];assert.ok(b.enemyHp>a.enemyHp&&b.enemyAtk>a.enemyAtk,b.id);}
 assert.ok(R.STAGES[19].enemyHp<R.STAGES[18].enemyHp);
 assert.equal(R.stageLabel('CH18'),'4-3');assert.equal(R.hardGate(p,'CH18').chapter,4);assert.equal(R.hardReadiness(p,'CH18').chapter,4);
});

test('chapter-4 names, student monsters and stage mixes line up',()=>{
 assert.equal(THEMES[3].name,'불타는 숲');assert.equal(T4_BOSS.name,'산불 거인');assert.equal(THEMES[3].boss,T4_BOSS.name);
 assert.deepEqual(stageInfo(16),{themeIndex:3,k:1,label:'4-2',themeName:'불타는 숲',name:'벌목장',tip:THEMES[3].tips[1],bossName:'산불 거인',isBoss:false});
 const names=Object.values(T4_ENEMIES).map(e=>e.name);for(const n of ['버너몬','톱니몬','뉴트몬','와르르 불도저','불키'])assert.ok(names.includes(n),n);
 assert.ok(!names.includes('영수몬'),'영수몬은 뺐다(2026-10-06 사용자)');
 assert.deepEqual([...new Set(Object.values(T4_ENEMIES).map(e=>e.behavior))].sort(),['charger','flamer','guarder','spinner','thrower']);
 for(const s of T4_STAGES)for(const id of [...s.mix,...s.elites.map(e=>e.id)])assert.ok(T4_ENEMIES[id],id);
 // 단계 구성: 4-1 버너몬 · 4-2 톱니몬(벌목장) · 4-3 뉴트몬 + 중간 보스 와르르 불도저 · 4-4 불키 · 4-5 산불 거인
 assert.deepEqual(T4_STAGES.map(s=>s.mix.at(-1)),['T4_BURNER','T4_SAW','T4_NUTRIA','T4_NUTRIA','T4_NUTRIA']);
 assert.equal(T4_STAGES[2].elites[0].id,'T4_DOZER');assert.equal(T4_STAGES[3].elites[0].id,'T4_BULKI');assert.equal(T4_STAGES[4].boss,'T4_BOSS');
 assert.equal(T4_ENEMIES.T4_DOZER.type,'elite');assert.ok(T4_ENEMIES.T4_DOZER.heavy);
 for(const e of Object.values(T4_ENEMIES))assert.ok(e.cleanse,e.name);
});

test('4-5 boss has close/mid/far skills, embers every third skill, fire falls leave flames',()=>{
 for(const band of ['close','mid','far'])assert.ok(BOSS_PATTERNS_T4.filter(p=>!p.phase&&p.ranges.includes(band)).length>=2,band);
 const pick=d=>new Set(Array.from({length:300},()=>pickBossPattern(BOSS_PATTERNS_T4,{distU:d,phase:1,sinceLitter:0}).name));
 assert.ok(pick(2).has('화염 내려찍기')&&pick(2).has('불길 확산'));assert.ok(pick(5).has('바위 몸통 돌진'));assert.ok(pick(10).has('불 쓰레기 던지기')&&pick(10).has('불꽃 낙하'));
 assert.equal(pickBossPattern(BOSS_PATTERNS_T4,{distU:5,phase:1,sinceLitter:3,litterOnGround:false}).name,'불씨 뿌리기');
 assert.equal(BOSS_PATTERNS_T4.find(p=>p.name==='불꽃 낙하').field,'fire');
 assert.equal(BOSS_PATTERNS_T4.find(p=>p.name==='버너몬 부르기').summon.id,'T4_BURNER');
});

test('every chapter-4 sprite referenced by the game exists',()=>{
 const assets=fs.readFileSync(new URL('../game/src/assets.js',import.meta.url),'utf8');
 const keys=[...assets.matchAll(/t4_(\w+): IMG_BASE \+ "t4\/(\w+)\.png"/g)];assert.ok(keys.length>=30);
 for(const [,,f] of keys)assert.ok(fs.existsSync(new URL(`../game/assets/sprites/t4/${f}.png`,import.meta.url)),f);
 const patterns=BOSS_PATTERNS_T4.map(p=>p.drop).filter(Boolean);
 const used=[...Object.values(T4_ENEMIES).flatMap(e=>[e.sprite,...Object.values(e.frames||{}).flat()]),T4_BOSS.img.calm,T4_BOSS.img.angry,...T4_STAGES.map(s=>s.floor),...patterns];
 for(const k of used)assert.match(assets,new RegExp(`\\b${k}:`),k);
 for(const f of ['main.js','theme-effects.js']){
  const src=fs.readFileSync(new URL(`../game/src/${f}`,import.meta.url),'utf8');
  for(const k of new Set([...src.matchAll(/["'](t4_\w+)["']/g)].map(m=>m[1])))assert.match(assets,new RegExp(`\\b${k}:`),`${f}: ${k}`);
 }
 for(const f of ['card_polluted.jpg','card_clean.jpg'])assert.ok(fs.existsSync(new URL(`../game/assets/sprites/t4/${f}`,import.meta.url)),f);
});

test('4-5 boss keeps the 3-5 base values (the stage multiplier makes it stronger)', async()=>{
 const {BOSSES,CHAPTERS,SKILLS,PASSIVES,EVOLUTIONS}=await import('../game/src/content.js');
 const {installReworkContent}=await import('../game/src/rework-content.js');
 installReworkContent({SKILLS,PASSIVES,EVOLUTIONS,CHAPTERS,BOSSES});
 assert.equal(BOSSES.T4_BOSS.hpMult,BOSSES.T3_BOSS.hpMult);assert.equal(BOSSES.T4_BOSS.atkMult,BOSSES.T3_BOSS.atkMult);
 assert.ok(BOSSES.T4_BOSS.rangePatterns&&BOSSES.T4_BOSS.patterns.length===BOSS_PATTERNS_T4.length);
 for(let i=15;i<20;i++){assert.equal(CHAPTERS[i].theme,4);assert.ok(CHAPTERS[i].floor.startsWith('t4_'));}
 assert.equal(CHAPTERS[19].boss,'T4_BOSS');
});
