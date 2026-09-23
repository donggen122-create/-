// 화면 캡처용 조작(shot.cjs --evalfile). capture.ps1이 __자리표시__를 채운다.
// KIND: lobby(모험 화면) | book(도감 맨 아래: 특별한 적) | start(출동 → 첫 카드 화면) | battle(스킬 넣고 전투) | special(어려움 특별한 적)
// battle·special은 디버그 훅(__sgCombatLoad 등)이 localhost에서만 있으므로 로컬 서버에서만 된다.
const KIND = "__KIND__", DIFF = "__DIFF__", SKILLS = __SKILLS__, SUPPORTS = __SUPPORTS__, PLAY = __PLAY__, STAGE = "__STAGE__", MODE = "__MODE__";
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await wait(100); } return false; };
await wait(800);
$('#login-id').value = '__UID__'; $('#login-pw').value = '__UPW__';
$('#btn-login').click();
if (!await until(() => { const b = $('#btn-title-start'); return b && !b.disabled && b.offsetParent !== null; }, 25000)) throw new Error('title start not ready (로그인 실패?)');
$('#btn-title-start').click();
if (!await until(() => $('.sg-nav [data-tab="adventure"]'), 25000)) throw new Error('lobby not ready');
await wait(600);
const cleanup = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('정리하기'));
if (cleanup) { cleanup.click(); await wait(1500); }
if (KIND === 'book') { $('.sg-nav [data-tab="book"]').click(); await wait(800); const h = [...document.querySelectorAll('.sg-section-title')].find((x) => x.textContent.includes('특별한 적')); if (h) h.scrollIntoView({ block: 'start' }); await wait(400); return; }
$('.sg-nav [data-tab="adventure"]').click(); await wait(300);
$(`[data-stage="${STAGE}"]`).click(); await wait(400);
if ($('.sg-stage.selected')?.dataset.stage !== STAGE) throw new Error('stage not selectable: ' + STAGE + ' (앞 단계를 먼저 성공해야 열림)');
const pick = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
pick('#sg-difficulty', DIFF); pick('#sg-weapon-mode', MODE);
await wait(300);
if (KIND === 'lobby') { const b = $('.sg-brief'); if (b) b.scrollIntoView({ block: 'start' }); await wait(300); return; }
$('#sg-start').click();
if (!await until(() => $('#levelup') && !$('#levelup').classList.contains('hidden'), 25000)) throw new Error('levelup not shown (서버가 설정·출동을 거절?)');
if (KIND === 'start') { await wait(600); return; }
const card = $('#card-row .card'); if (card) card.click();
await wait(300);
window.__debugGod = true;
window.__sgCombatLoad(SKILLS, { hero: 'hoya', weaponMode: MODE }, SUPPORTS);
if (KIND === 'special') {
  window.__debugAutoPlay(12);   // 10초가 지나야 적이 나오고 이름표가 뜬다
  for (const [t, n] of [['resist', 3], ['armor', 1], ['fast', 1], ['regen', 1], ['split', 1]]) window.__debugSpawnTrait('T1_SNACKBAG', t, n, 150);
  window.__debugSpawnTrait('T1_BOTTLE', 'resist', 1, 120);
} else {
  window.__debugSpawn('T1_SNACKBAG', 18, 150);
}
window.__debugAutoPlay(PLAY);
window.__debugFreeze(6);
