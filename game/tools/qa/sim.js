// 난이도 밸런스 자동 조종(shot.cjs --evalfile, 로컬 전용): 5분 판을 30초씩 돌리며 체력·처치·진화·받은 피해·특별한 적 수를 기록한다.
// 결과는 오류 메시지 "SIM {...}" 로 나온다(shot.cjs가 eval 오류를 출력하므로). sim.ps1이 __자리표시__를 채운다.
const STAGE = "__STAGE__", MODE = "__MODE__", DIFF = "__DIFF__", AVOID = __AVOID__;
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await wait(100); } return false; };
await wait(800);
$('#login-id').value = '__UID__'; $('#login-pw').value = '__UPW__';
$('#btn-login').click();
if (!await until(() => { const b = $('#btn-title-start'); return b && !b.disabled && b.offsetParent !== null; }, 25000)) throw new Error('title start not ready');
$('#btn-title-start').click();
if (!await until(() => $('.sg-nav [data-tab="adventure"]'), 25000)) throw new Error('lobby not ready');
await wait(600);
const cleanup = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('정리하기'));
if (cleanup) { cleanup.click(); await wait(1500); }
$('.sg-nav [data-tab="adventure"]').click(); await wait(300);
$(`[data-stage="${STAGE}"]`).click(); await wait(400);
if ($('.sg-stage.selected')?.dataset.stage !== STAGE) throw new Error('stage not selectable: ' + STAGE + ' (테스트 계정의 앞 단계를 먼저 성공 처리)');
const pick = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
pick('#sg-difficulty', DIFF); pick('#sg-weapon-mode', MODE);
await wait(200);
$('#sg-start').click();
if (!await until(() => $('#levelup') && !$('#levelup').classList.contains('hidden'), 25000)) throw new Error('levelup not shown');
window.__pilotAvoid = AVOID;   // 2 = 적을 피하는 플레이, 0 = 안 피하는 서툰 플레이
const log = [];
for (let i = 0; i < 12; i++) {
  const r = window.__debugPilot(30);
  const s = window.__sgSnapshot();
  log.push({ t: Math.round(r.runTime), mode: r.mode, hp: Math.round(r.hp) + '/' + Math.round(r.maxHp), kills: r.kills, evo: s.run?.fusionCount, hurt: s.hurt, special: s.special });
  if (r.mode === 'result') break;
  await wait(50);
}
throw new Error('SIM ' + JSON.stringify({ stage: STAGE, mode: MODE, diff: DIFF, avoid: AVOID, log }));
