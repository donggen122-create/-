// 3장 「오염된 하천」(CH11~CH15, docs/41): 단계·해금·대왕 단계·보상, 학생 하천 몬스터·대왕 데이터, 기술표, 그림 파일.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../game/src/rework-core.js';
import {T3_ENEMIES,T3_BOSS,T3_STAGES,THEMES,stageInfo} from '../game/src/themes.js';
import {BOSS_PATTERNS_T3,pickBossPattern} from '../game/src/boss-patterns.js';

test('fifteen stages: chapter 3 opens after 2-5, 3-5 is a boss stage with the same first-clear bonus',()=>{
 assert.equal(R.STAGES.length,15);assert.deepEqual(R.STAGES.slice(10).map(s=>s.id),['CH11','CH12','CH13','CH14','CH15']);
 const p=R.freshProfile();for(let i=1;i<=9;i++)p.stages[`CH${String(i).padStart(2,'0')}`]={cleared:true,stars:1};
 assert.equal(R.stageUnlocked(p,'CH11'),false);p.stages.CH10={cleared:true,stars:1};assert.equal(R.stageUnlocked(p,'CH11'),true);assert.equal(R.stageUnlocked(p,'CH12'),false);
 assert.ok(R.isBossStage('CH15')&&!R.isBossStage('CH14'));assert.equal(R.durationFor(p,'CH15'),240);assert.equal(R.durationFor(p,'CH11'),300);
 for(let i=11;i<=14;i++)p.stages[`CH${i}`]={cleared:true,stars:1};
 const r=R.completeRun(p,{stage:'CH15',cleared:true,seconds:300,litter:5,difficulty:'normal'});
 assert.equal(r.reward.gifts,2);assert.ok(r.reward.coins>=260+120+60+30);   // 보급권 1 + 첫 대왕 1, 코인 기본+첫 성공+대왕+목표
 for(const s of R.STAGES.slice(10)){assert.match(s.goal,/물고기/);assert.ok(s.tip&&s.unlock&&s.story,s.id);}
 // 3장 적(2026-09-30 사용자 "50% 상향" → 저녁 "승률 45%로"): 3-1~3-4는 같은 자리 2장 단계의 체력·공격 3배, 3-5는 공격 3배·체력 1.5배(대왕 체력)
 for(let i=0;i<5;i++){const a=R.STAGES[5+i],b=R.STAGES[10+i],hk=i<4?3:1.5;assert.ok(Math.abs(b.enemyHp-a.enemyHp*hk)<1e-9&&Math.abs(b.enemyAtk-a.enemyAtk*3)<1e-9,b.id);}
 assert.equal(R.stageLabel('CH13'),'3-3');assert.equal(R.hardGate(p,'CH13').chapter,3);assert.equal(R.hardReadiness(p,'CH13').chapter,3);
});

test('chapter-3 names, student monsters and stage mixes line up',()=>{
 assert.equal(THEMES[2].name,'오염된 하천');assert.equal(T3_BOSS.name,'구정물 대왕');assert.equal(THEMES[2].boss,T3_BOSS.name);
 assert.deepEqual(stageInfo(12),{themeIndex:2,k:2,label:'3-3',themeName:'오염된 하천',name:'하수구 옆',tip:THEMES[2].tips[2],bossName:'구정물 대왕',isBoss:false});
 const names=Object.values(T3_ENEMIES).map(e=>e.name);for(const n of ['거품몬','페트리','콜라 캔 몬스터','그물몬','유령그물 대장'])assert.ok(names.includes(n),n);
 assert.deepEqual([...new Set(Object.values(T3_ENEMIES).map(e=>e.behavior))].sort(),['bubbler','netter','oiler','pouncer','shooter']);
 for(const s of T3_STAGES)for(const id of [...s.mix,...s.elites.map(e=>e.id)])assert.ok(T3_ENEMIES[id],id);
 // 단계 구성(프롬프트 문서): 3-1 거품몬 · 3-2 페트리 · 3-3 콜라 캔 + 유령그물 대장 · 3-4 그물몬(녹조몬 대신, 학생 원안) · 3-5 대왕
 assert.deepEqual(T3_STAGES.map(s=>s.mix.at(-1)),['T3_BUBBLE','T3_PETRI','T3_CAN','T3_NETMON','T3_NETMON']);
 assert.equal(T3_STAGES[2].elites[0].id,'T3_NET');assert.equal(T3_STAGES[4].boss,'T3_BOSS');
 assert.equal(T3_ENEMIES.T3_NET.type,'elite');assert.ok(T3_ENEMIES.T3_NET.heavy);
 // 그물몬(2026-09-30 저녁 녹조몬 대신): 덮치기 예고 그림이 있고, 중간 보스와 달리 일반 몬스터·밀려남
 assert.equal(T3_ENEMIES.T3_NETMON.type,'normal');assert.ok(!T3_ENEMIES.T3_NETMON.heavy);assert.equal(T3_ENEMIES.T3_NETMON.frames.pounce,'t3_en_netmon_pounce');assert.ok(!Object.keys(T3_ENEMIES).some(id=>/ALGAE/.test(id)));
 for(const e of Object.values(T3_ENEMIES))assert.ok(e.cleanse,e.name);
});

test('3-5 boss has close/mid/far skills, fish rings every third skill, oil and foam drops',()=>{
 for(const band of ['close','mid','far'])assert.ok(BOSS_PATTERNS_T3.filter(p=>!p.phase&&p.ranges.includes(band)).length>=2,band);
 const pick=d=>new Set(Array.from({length:300},()=>pickBossPattern(BOSS_PATTERNS_T3,{distU:d,phase:1,sinceLitter:0}).name));
 assert.ok(pick(2).has('구정물 파도')&&pick(2).has('철퍼덕'));assert.ok(pick(5).has('구정물 미끄럼'));assert.ok(pick(10).has('쓰레기 튀기기')&&pick(10).has('거품 폭탄'));
 assert.equal(pickBossPattern(BOSS_PATTERNS_T3,{distU:5,phase:1,sinceLitter:3,litterOnGround:false}).name,'비닐 고리 뿌리기');
 assert.equal(BOSS_PATTERNS_T3.find(p=>p.name==='기름 웅덩이 뿌리기').field,'oil');
 assert.equal(BOSS_PATTERNS_T3.find(p=>p.name==='거품몬 부르기').summon.id,'T3_BUBBLE');
 assert.equal(BOSS_PATTERNS_T3.find(p=>p.kind==='cone').fx,'wave');
});

test('every chapter-3 sprite referenced by the game exists',()=>{
 const assets=fs.readFileSync(new URL('../game/src/assets.js',import.meta.url),'utf8');
 const keys=[...assets.matchAll(/t3_(\w+): IMG_BASE \+ "t3\/(\w+)\.png"/g)];assert.ok(keys.length>=27);
 for(const [,,f] of keys)assert.ok(fs.existsSync(new URL(`../game/assets/sprites/t3/${f}.png`,import.meta.url)),f);
 const patterns=BOSS_PATTERNS_T3.map(p=>p.drop).filter(Boolean);
 const used=[...Object.values(T3_ENEMIES).flatMap(e=>[e.sprite,...Object.values(e.frames||{}).flat()]),T3_BOSS.img.calm,T3_BOSS.img.angry,...T3_STAGES.map(s=>s.floor),...patterns];
 for(const k of used)assert.match(assets,new RegExp(`\\b${k}:`),k);
 const main=fs.readFileSync(new URL('../game/src/main.js',import.meta.url),'utf8');
 for(const k of new Set([...main.matchAll(/["'](t3_\w+)["']/g)].map(m=>m[1])))assert.match(assets,new RegExp(`\\b${k}:`),k);
 for(const f of ['card_polluted.jpg','card_clean.jpg'])assert.ok(fs.existsSync(new URL(`../game/assets/sprites/t3/${f}`,import.meta.url)),f);
});

test('3-5 boss keeps the 2-5 base values so the stage multiplier makes it exactly 1.5x the 2-5 boss', async()=>{
 const {BOSSES,CHAPTERS,SKILLS,PASSIVES,EVOLUTIONS}=await import('../game/src/content.js');
 const {installReworkContent}=await import('../game/src/rework-content.js');
 installReworkContent({SKILLS,PASSIVES,EVOLUTIONS,CHAPTERS,BOSSES});
 assert.equal(BOSSES.T3_BOSS.hpMult,BOSSES.T2_BOSS.hpMult);assert.equal(BOSSES.T3_BOSS.atkMult,BOSSES.T2_BOSS.atkMult);
 assert.deepEqual(BOSSES.T3_BOSS.diffHp,BOSSES.T2_BOSS.diffHp);
});
