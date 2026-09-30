// 판 시작 템포·적 수(2026-09-30 사용자 "첫 공격이 3초 안에, 몬스터를 더 많이"): rework-core PACE 규칙.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as R from '../game/src/rework-core.js';
import {T1_ENEMIES,T1_STAGES,T2_ENEMIES,T2_STAGES,T3_ENEMIES,T3_STAGES} from '../game/src/themes.js';
import {WEAPON_RULES} from '../game/src/weapon-effects.js';

const ENEMIES={...T1_ENEMIES,...T2_ENEMIES,...T3_ENEMIES},MIXES=[...T1_STAGES,...T2_STAGES,...T3_STAGES].map(s=>s.mix);

test('more monsters, each one weaker so overall strength and level pace stay about the same as before',()=>{
 const P=R.PACE;assert.ok(P.density>1);
 for(const k of ['hp','xp'])assert.ok(Math.abs(P[k]*P.density-1)<.01,k);   // 체력·새싹은 마릿수만큼 낮춤
 assert.ok(P.atk<1&&P.atk>1/P.density,'attack is lowered less (hit invulnerability), tuned by simulation');
 const [g0,gs]=P.grace;assert.ok(g0>0&&g0<1&&gs>=60,'enemy attack starts weak and reaches 100% after a while');
});

test('the first wave appears on screen and reaches even a close-range weapon within 3 seconds on every stage (easy speed)',()=>{
 const P=R.PACE,[d0,d1]=P.firstWaveDist,easy=R.DIFFICULTIES.easy.enemySpd;
 assert.ok(P.firstWave>=6&&P.firstWaveAt<1);
 assert.ok(d1<8,'phone screen shows 8 tiles each side');assert.ok(d1<WEAPON_RULES.ranged.reach,'ranged weapon reaches the whole first wave');
 assert.equal(MIXES.length,15);
 for(const mix of MIXES){
  const pool=mix.filter(id=>ENEMIES[id].spdU>0&&ENEMIES[id].behavior!=='mine').slice(0,2);assert.ok(pool.length,mix.join());
  for(const id of pool){const t=P.firstWaveAt+(d0-WEAPON_RULES.melee.reach)/(ENEMIES[id].spdU*easy);assert.ok(t<=3,`${id} ${t.toFixed(2)}s`);}
 }
});

test('main.js spawns right away in guardian runs and uses every PACE value',()=>{
 const main=fs.readFileSync(new URL('../game/src/main.js',import.meta.url),'utf8');
 assert.match(main,/runCfg\.rework \? 0 : 8/);
 for(const k of ['firstWaveAt','firstWave','firstWaveDist','density','hp','atk','xp','grace'])assert.match(main,new RegExp(`R\\.PACE\\.${k}\\b`),k);
});
