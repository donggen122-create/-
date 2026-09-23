// 캡처 뒤 정리(shot.cjs --postevalfile): 진행 중인 판을 나가서 결과 화면을 닫는다 → 서버에 "진행 중인 도전"이 남지 않게.
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await wait(100); } return false; };
try { window.__debugFreeze(0); } catch (e) {}
if ($('#btn-pause')) { $('#btn-pause').click(); await wait(400); }
if ($('#btn-quit-lobby')) { $('#btn-quit-lobby').click(); }
await until(() => { const b = $('#btn-continue'); return b && !b.disabled && b.offsetParent !== null; }, 15000);
if ($('#btn-continue')) { $('#btn-continue').click(); await wait(800); }
