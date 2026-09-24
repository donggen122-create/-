// 2장 「대기오염 공장 지대」(CH06~CH10, docs/30): 단계·해금·대왕 단계·보상, 적·대왕 데이터, 기술표, 그림 파일.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../game/src/rework-core.js';
import {T2_ENEMIES,T2_BOSS,T2_STAGES,THEMES} from '../game/src/themes.js';
import {BOSS_PATTERNS_T2,pickBossPattern} from '../game/src/boss-patterns.js';

test('ten stages: chapter 2 opens after 1-5, 2-5 is a boss stage with the same first-clear bonus',()=>{
 assert.equal(R.STAGES.length,10);assert.deepEqual(R.STAGES.slice(5).map(s=>s.id),['CH06','CH07','CH08','CH09','CH10']);
 const p=R.freshProfile();for(let i=1;i<=4;i++)p.stages[`CH0${i}`]={cleared:true,stars:1};
 assert.equal(R.stageUnlocked(p,'CH06'),false);p.stages.CH05={cleared:true,stars:1};assert.equal(R.stageUnlocked(p,'CH06'),true);assert.equal(R.stageUnlocked(p,'CH07'),false);
 assert.ok(R.isBossStage('CH10')&&R.isBossStage('CH05')&&!R.isBossStage('CH09'));assert.equal(R.durationFor(p,'CH10'),240);assert.equal(R.durationFor(p,'CH06'),300);
 for(let i=6;i<=9;i++)p.stages[`CH${String(i).padStart(2,'0')}`]={cleared:true,stars:1};
 const r=R.completeRun(p,{stage:'CH10',cleared:true,seconds:300,litter:5,difficulty:'normal'});
 assert.equal(r.reward.gifts,2);assert.ok(r.reward.coins>=210+120+60+30);   // 보급권 1 + 첫 대왕 1, 코인 기본+첫 성공+대왕+목표
 for(const s of R.STAGES.slice(5)){assert.match(s.goal,/밸브/);assert.ok(s.tip&&s.unlock&&s.story,s.id);}
});

test('chapter-2 enemies, boss and stage mixes line up',()=>{
 assert.equal(THEMES[1].name,'대기오염 공장 지대');assert.equal(T2_BOSS.name,'굴뚝 가스 대왕');
 assert.deepEqual(Object.values(T2_ENEMIES).map(e=>e.behavior).sort(),['breather','mine','raincloud','summon','surround']);
 for(const s of T2_STAGES)for(const id of [...s.mix,...s.elites.map(e=>e.id)])assert.ok(T2_ENEMIES[id],id);
 assert.equal(T2_STAGES[4].boss,'T2_BOSS');
});

test('2-5 boss has close/mid/far skills and valves every third skill',()=>{
 for(const band of ['close','mid','far'])assert.ok(BOSS_PATTERNS_T2.filter(p=>!p.phase&&p.ranges.includes(band)).length>=2,band);
 const pick=d=>new Set(Array.from({length:300},()=>pickBossPattern(BOSS_PATTERNS_T2,{distU:d,phase:1,sinceLitter:0}).name));
 assert.ok(pick(2).has('불꽃 브레스')&&pick(2).has('증기 폭발'));assert.ok(pick(5).has('파이프 휘두르기'));assert.ok(pick(10).has('굴뚝 매연탄'));
 assert.equal(pickBossPattern(BOSS_PATTERNS_T2,{distU:5,phase:1,sinceLitter:3,litterOnGround:false}).name,'밸브 터뜨리기');
 assert.ok(BOSS_PATTERNS_T2.find(p=>p.name==='파이프 휘두르기').stay);
});

test('every chapter-2 sprite referenced by the game exists',()=>{
 const assets=fs.readFileSync(new URL('../game/src/assets.js',import.meta.url),'utf8');
 const keys=[...assets.matchAll(/t2_(\w+): IMG_BASE \+ "t2\/(\w+)\.png"/g)];assert.ok(keys.length>=26);
 for(const [,,f] of keys)assert.ok(fs.existsSync(new URL(`../game/assets/sprites/t2/${f}.png`,import.meta.url)),f);
 const used=[...Object.values(T2_ENEMIES).flatMap(e=>[e.sprite,...Object.values(e.frames||{}).flat()]),T2_BOSS.img.calm,T2_BOSS.img.angry,...T2_STAGES.map(s=>s.floor)];
 for(const k of used)assert.match(assets,new RegExp(`\\b${k}:`),k);
 for(const f of ['card_polluted.jpg','card_clean.jpg'])assert.ok(fs.existsSync(new URL(`../game/assets/sprites/t2/${f}`,import.meta.url)),f);
});
