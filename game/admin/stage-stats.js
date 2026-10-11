import {STAGES,stageLabel} from '../src/rework-core.js';
import {T1_ENEMIES,T2_ENEMIES,T3_ENEMIES,T4_ENEMIES,T1_BOSS,T2_BOSS,T3_BOSS,T4_BOSS,THEMES} from '../src/themes.js';
import {BOSS_PATTERNS,BOSS_PATTERNS_T2,BOSS_PATTERNS_T3,BOSS_PATTERNS_T4} from '../src/boss-patterns.js';
const enemies={...T1_ENEMIES,...T2_ENEMIES,...T3_ENEMIES,...T4_ENEMIES};
const bosses=[T1_BOSS,T2_BOSS,T3_BOSS,T4_BOSS],patterns=[BOSS_PATTERNS,BOSS_PATTERNS_T2,BOSS_PATTERNS_T3,BOSS_PATTERNS_T4];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function causeName(c,stage){
 const ch=Math.floor((Number(stage.slice(2))-1)/5),m=c.id.match(/:p(\d+)(:follow)?$/);
 if(c.kind==='boss'){const p=m&&patterns[ch]?.[+m[1]];return (m?.[2]?p?.follow?.name:p?.name)||bosses[ch]?.name||'대왕';}
 return enemies[c.id]?.name||({zone:['악취 구역','매연 구역','구정물 웅덩이','번지는 불길'][ch],fire:'불길',stink:'악취 구름',acid:'산성비',oil:'기름 웅덩이',explosion:'폭발'})[c.id]||c.id;
}
const value=n=>n===null||n===undefined?'—':n.toFixed(2).replace(/\.00$/,'');
const quality=a=>a.map((n,i)=>n?`Q${i}: ${n}`:'').filter(Boolean).join(' · ');
export function installStageStats(api){
 const $=id=>document.getElementById(id);let generation=0;
 $('perf-stage').innerHTML='<option value="">전체 단계</option>'+STAGES.map(s=>`<option value="${s.id}">${stageLabel(s.id)}</option>`).join('');
 async function refresh(){
  const seq=++generation;$('stage-stats-note').textContent='기록을 읽는 중…';
  try{
   const d=await api(`stage-stats?days=${encodeURIComponent($('stats-days').value)}&stage=${encodeURIComponent($('perf-stage').value)}`);if(seq!==generation)return;
   const max=Math.max(1,...d.stages.map(s=>s.stopped));
   $('stage-stats-body').innerHTML=d.stages.map(s=>`<tr class="${s.stopped>0&&s.stopped===max?'stats-stopped':''}"><td>${s.label}</td><td>${s.attempts}</td><td>${s.wins}</td><td><div class="stats-rate"><i style="width:${s.winRate||0}%"></i><span>${s.winRate===null?'—':s.winRate+'%'}</span></div></td><td>${s.students}</td><td><b>${s.stopped}</b></td><td>${Object.entries(s.difficulty).map(([k,v])=>`${({easy:'쉬움',normal:'보통',hard:'어려움',unknown:'모름'})[k]} ${v[1]}/${v[0]}`).join(' · ')}</td><td class="stats-causes">${s.causes.map(c=>esc(causeName(c,s.stage))+` ${c.n}판`).join(' · ')||'—'}</td><td>${value(s.perf.fps)} / ${value(s.perf.p1)}</td></tr>`).join('');
   $('device-stats-body').innerHTML=d.devices.map(g=>`<tr><td>${({tablet:'태블릿',phone:'폰',pc:'PC'})[g.dev]}</td><td>${g.w} × ${g.h}</td><td>${g.stage==='all'?'전체':stageLabel(g.stage)}</td><td>${g.n}</td><td>${value(g.fps)}</td><td>${value(g.p1)}</td><td>${value(g.long50*100)}%</td><td>${quality(g.quality)}</td></tr>`).join('')||'<tr><td colspan="8">선택한 기간에 성능 기록이 없어요. 새 버전에서 한 판을 마치면 여기에 보여요.</td></tr>';
   $('stage-stats-note').textContent='시험 계정 제외 · 도전은 출동 기준 · 멈춘 학생은 현재 최고 정화 단계 바로 다음 단계에 도전한 학생 · 난이도는 성공/도전 · FPS는 중앙값';
  }catch(e){if(seq!==generation)return;$('stage-stats-body').replaceChildren();$('device-stats-body').replaceChildren();$('stage-stats-note').textContent=`기록을 읽지 못했어요: ${e.message}`;}
 }
 $('stats-days').onchange=refresh;$('perf-stage').onchange=refresh;$('stats-retry').onclick=refresh;
 return refresh;
}
