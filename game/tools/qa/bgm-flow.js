// 메인 테마곡 흐름 확인(로컬 전용, shot.cjs --evalfile --autoplay): 시작 화면 → 로비 → 출동 → 복귀 → 🏠 → 음소거.
// 각 단계의 재생 상태(window.__bgm)를 모아 "BGM {...}" 오류 메시지로 돌려준다(shot.cjs가 eval 오류를 출력하므로).
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await wait(100); } return false; };
const log = [];
const snap = (step) => { const s = window.__bgm(); log.push({ step, playing: !s.paused, time: s.time, wanted: s.wanted, sound: s.sound, hud: s.hudMute, stored: s.stored, mode: s.mode }); };
await wait(1500); snap('1 시작 화면');
await wait(1500); snap('1b 시작 화면 1.5초 뒤');
$('#login-id').value = '__UID__'; $('#login-pw').value = '__UPW__'; $('#btn-login').click();
if (!await until(() => { const b = $('#btn-title-start'); return b && !b.disabled && b.offsetParent !== null; })) throw new Error('title start not ready');
$('#btn-title-start').click();
if (!await until(() => $('.sg-nav [data-tab="adventure"]'))) throw new Error('lobby not ready');
await wait(800); snap('2 로비(이어서 재생)');
const cleanup = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('정리하기')); if (cleanup) { cleanup.click(); await wait(1500); }
$('.sg-nav [data-tab="adventure"]').click(); await wait(300);
$('[data-stage="CH01"]').click(); await wait(300);
$('#sg-start').click();
if (!await until(() => $('#levelup') && !$('#levelup').classList.contains('hidden'))) throw new Error('levelup not shown');
await wait(800); snap('3 출동(정지)');
const card = $('#card-row .card'); if (card) card.click();
await wait(600);
$('#btn-pause').click(); await wait(300); $('#btn-quit-lobby').click();
if (!await until(() => { const b = $('#btn-continue'); return b && !b.disabled && b.offsetParent !== null; })) throw new Error('result not ready');
snap('4 결과 화면(정지 유지)');
$('#btn-continue').click(); await wait(500); snap('5 로비 복귀(처음부터)');
await wait(1500); snap('5b 로비 1.5초 뒤');
$('#btn-to-title').click(); await wait(800); snap('6 🏠 시작 화면(이어서)');
$('#btn-sound').click(); await wait(400); snap('7 소리 끔');
$('#btn-sound').click(); await wait(800); snap('8 소리 켬');
$('#btn-title-start').click(); await wait(600);
throw new Error('BGM ' + JSON.stringify(log));
