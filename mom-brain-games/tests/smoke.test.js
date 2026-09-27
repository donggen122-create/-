/* 스모크 테스트: 브라우저 없이(jsdom + node-canvas) 그림 목록을 점검하고 퍼즐을 처음부터 끝까지 진행해 봐요.
   실행: npm install && npm test */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM, ResourceLoader } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost/';

// localhost 주소는 프로젝트 폴더(또는 dist/)의 파일로 연결하고, 외부 주소는 불러오지 않아요.
class LocalLoader extends ResourceLoader {
  constructor(root) { super(); this.root = root; }
  fetch(url, options) {
    if (!url.startsWith(BASE)) return null;
    const p = fs.promises.readFile(path.join(this.root, decodeURIComponent(url.slice(BASE.length))));
    p.abort = () => {};
    return p;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function check(cond, label) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label);
  if (!cond) failures++;
}

// opts.storage: 미리 넣어 둘 localStorage 값, opts.before(w): 스크립트가 돌기 전에 할 일, opts.dist: dist/ 를 열기
async function open(opts = {}) {
  const root = opts.dist ? path.join(ROOT, 'dist') : ROOT;
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: BASE,
    runScripts: 'dangerously',
    resources: new LocalLoader(root),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.scrollTo = () => {};
      for (const [k, v] of Object.entries(opts.storage || {})) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      if (opts.before) opts.before(w);
    },
  });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  for (let i = 0; i < 100 && !w.document.querySelector('[data-action="play"]'); i++) await sleep(50);
  const d = w.document;
  return {
    w, d, errors,
    click(sel) {
      const el = d.querySelector(sel);
      if (!el) throw new Error('없는 요소: ' + sel);
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    },
    text(sel) { const el = d.querySelector(sel); return el ? el.textContent.trim() : null; },
  };
}

// 퍼즐 그림 목록: 200점 넘게, 파일이 모두 있고, 규칙(4:3 이내, 필수 항목, 저작권)을 지켜요
function testPictures() {
  console.log('퍼즐 그림 목록');
  const sandbox = { window: {} };
  require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'js/paintings.js'), 'utf8'), sandbox);
  const list = sandbox.window.PAINTINGS;
  check(list.length >= 200, `그림이 200점 넘게 있어요 (${list.length}점)`);
  check(new Set(list.map((p) => p.id)).size === list.length, 'id가 겹치지 않아요');
  const need = ['id', 'cat', 't', 'a', 'src', 'w', 'h', 'enTitle', 'enArtist', 'source'];
  const bad = list.filter((p) => need.some((k) => p[k] === undefined || p[k] === '') || !('artistDied' in p));
  check(bad.length === 0, '필수 항목이 모두 채워져 있어요' + (bad.length ? ` (${bad.map((p) => p.id).join(', ')})` : ''));
  const missing = list.filter((p) => !fs.existsSync(path.join(ROOT, p.src)));
  check(missing.length === 0, '그림 파일이 모두 있어요' + (missing.length ? ` (${missing.map((p) => p.id).join(', ')})` : ''));
  const wide = list.filter((p) => p.w / p.h > 4 / 3 + 0.01 || p.w / p.h < 3 / 4 - 0.01 || Math.max(p.w, p.h) > 800);
  check(wide.length === 0, '모두 4:3(세로 3:4) 이내, 긴 변 800px 이하예요' + (wide.length ? ` (${wide.map((p) => p.id).join(', ')})` : ''));
  const recent = list.filter((p) => p.artistDied !== null && p.artistDied > new Date().getFullYear() - 70);
  check(recent.length === 0, '작가 사망 후 70년이 지난 작품만 있어요');
}

async function testHome() {
  console.log('처음 화면');
  const t = await open();
  const buttons = [...t.d.querySelectorAll('#app button')];
  check(t.text('.stage') === '스테이지 1', '스테이지 1부터 시작해요');
  check(!!t.d.querySelector('.home-pic'), '그림이 보여요');
  check(buttons.length === 1 && buttons[0].textContent === '시작하기', '버튼은 시작하기 하나뿐이에요');
  check(!!t.d.getElementById('soundBtn'), '소리 버튼이 따로 있어요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

async function testSound() {
  console.log('소리 버튼');
  const t = await open();
  t.click('#soundBtn');
  check(t.text('#soundBtn') === '🔇 소리 끔', '누르면 소리가 꺼져요');
  check(JSON.parse(t.w.localStorage.getItem('mbp:save')).sound === false, '꺼진 상태가 저장돼요');
  t.click('[data-action="play"]');
  check(!!t.d.getElementById('soundBtn'), '퍼즐 화면에도 소리 버튼이 있어요');
  t.click('#soundBtn');
  check(t.text('#soundBtn') === '🔊 소리', '다시 누르면 소리가 켜져요');
  await waitPieces(t);
  t.w.close();
}

async function waitPieces(t) {
  for (let i = 0; i < 80 && !t.d.querySelector('#jplay canvas'); i++) await sleep(100);
  return [...t.d.querySelectorAll('#jplay canvas.jp')];
}

async function testPuzzle() {
  console.log('퍼즐 한 판');
  const t = await open();
  const first = t.d.querySelector('.home-pic').getAttribute('src');
  t.click('[data-action="play"]');
  const pieces = await waitPieces(t);
  check(pieces.length >= 20 && pieces.length <= 25, `조각은 20~25개 (${pieces.length}개)`);
  check(!pieces.some((el) => el.style.transform), '조각이 돌아가 있지 않아요');
  for (let i = 0; i < pieces.length; i++) {
    if (/(\d+) \/ \1$/.test(t.text('#jprog') || '')) break;
    t.click('[data-action="hint"]');
    await sleep(520);
  }
  await sleep(2000);
  check(t.text('.result-title') === '스테이지 1 완성!', '다 맞추면 완성 화면이 나와요');
  check(t.d.querySelector('.result-img').getAttribute('src') === first, '완성 화면에 맞춘 그림이 보여요');
  check(t.text('[data-action="home"]') === '다음 스테이지', "'다음 스테이지' 버튼이 있어요");
  t.click('[data-action="home"]');
  check(t.text('.stage') === '스테이지 2', '다음은 스테이지 2예요');
  check(t.d.querySelector('.home-pic').getAttribute('src') !== first, '다음 스테이지는 다른 그림이에요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

async function testStages() {
  console.log('스테이지 순서');
  const t = await open();
  const order = JSON.parse(t.w.localStorage.getItem('mbp:save')).order;
  const n = t.w.PAINTINGS.length;
  check(Array.isArray(order) && order.length === n && new Set(order).size === n, '그림 순서를 섞어서 저장해요 (겹치는 그림 없음)');
  const sorted = order.every((v, i) => v === i);
  check(!sorted, '목록 순서 그대로가 아니라 무작위예요');
  t.w.close();
  const u = await open({ storage: { 'mbp:save': { v: 1, stage: 200, order, sound: true, puzzle: null } } });
  check(u.text('.stage') === '스테이지 200', '마지막은 스테이지 200이에요');
  u.click('[data-action="play"]');
  const pieces = await waitPieces(u);
  for (let i = 0; i < pieces.length; i++) { u.click('[data-action="hint"]'); await sleep(520); }
  await sleep(2000);
  check(/모두 마치셨어요/.test(u.text('.result-detail') || ''), '200스테이지를 다 마치면 축하해요');
  u.click('[data-action="home"]');
  check(u.text('.stage') === '스테이지 1', '그다음은 스테이지 1부터 새 순서로 다시 해요');
  check(u.errors.length === 0, '스크립트 오류 없음');
  u.w.close();
}

async function hintTimes(t, n) {
  for (let i = 0; i < n; i++) { t.click('[data-action="hint"]'); await sleep(560); }
}

async function testResume() {
  console.log('하다 만 퍼즐 이어서 하기');
  const t = await open();
  t.click('[data-action="play"]');
  const n = (await waitPieces(t)).length;
  await hintTimes(t, 3);
  check(t.text('#jprog') === `맞춘 조각 3 / ${n}`, '조각 3개를 맞췄어요');
  const saved = t.w.localStorage.getItem('mbp:save');
  check(JSON.parse(saved).puzzle.placed.length === 3, '맞춘 조각이 바로 저장돼요');
  t.w.close();

  const u = await open({ storage: { 'mbp:save': saved } });
  check(u.text('[data-action="play"]') === '이어서 하기', '다시 열면 버튼이 이어서 하기로 바뀌어요');
  check(u.text('.stage') === '스테이지 1', '같은 스테이지예요');
  u.click('[data-action="play"]');
  await waitPieces(u);
  check(u.text('#jprog') === `맞춘 조각 3 / ${n}` && u.d.querySelectorAll('#jplay canvas.placed').length === 3, '맞춰 둔 조각 3개가 제자리에 있어요');
  check(u.text('#msg') === '하던 퍼즐을 이어서 해요', '이어서 한다고 알려 줘요');
  await hintTimes(u, n - 3);
  await sleep(1900);
  check(u.text('.result-title') === '스테이지 1 완성!', '끝까지 맞추면 완성돼요');
  const after = JSON.parse(u.w.localStorage.getItem('mbp:save'));
  check(after.puzzle === null && after.stage === 2, '완성하면 하던 퍼즐 기록을 지우고 스테이지 2로 저장해요');
  check(u.errors.length === 0, '스크립트 오류 없음');
  u.w.close();
}

async function testLegacySave(list) {
  console.log('예전 저장값 이어받기');
  const order = list.map((_, i) => list.length - 1 - i);
  const t = await open({ storage: { 'mbp:stage': 7, 'mbp:order': order, 'mbp:settings': { sound: false } } });
  check(t.text('.stage') === '스테이지 7', '예전에 저장한 스테이지를 이어받아요');
  check(t.text('#soundBtn') === '🔇 소리 끔', '예전 소리 설정도 이어받아요');
  const saved = JSON.parse(t.w.localStorage.getItem('mbp:save'));
  check(saved.stage === 7 && saved.order.join() === order.join(), '새 저장 형식(mbp:save)으로 옮겨 적어요');
  t.w.close();
}

async function testBrowserBack() {
  console.log('브라우저 뒤로가기');
  const t = await open();
  t.click('[data-action="play"]');
  await waitPieces(t);
  t.w.history.back();
  await sleep(200);
  check(!!t.d.querySelector('.home') && !t.d.getElementById('jplay'), '퍼즐 중에 뒤로가기를 누르면 처음 화면으로 와요');
  t.click('[data-action="play"]');
  await waitPieces(t);
  t.click('[data-action="home"]');
  await sleep(200);
  check(!!t.d.querySelector('.home'), "'처음으로' 버튼도 처음 화면으로 와요");
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

// 토스 앱 흉내: window.TossBridge 를 가짜로 만들어서 토스 저장소·뒤로가기·화면 켜짐·진동을 확인해요
function fakeBridge(initial) {
  const mem = Object.assign({}, initial);
  const calls = { set: 0, awake: [], haptic: [], close: 0 };
  let back = null;
  return {
    mem, calls,
    pressBack: () => back && back(),
    bridge: {
      getItem: (k) => Promise.resolve(k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = v; calls.set++; return Promise.resolve(); },
      onBack: (h) => { back = h; return true; },
      close: () => { calls.close++; return Promise.resolve(); },
      keepAwake: (on) => { calls.awake.push(on); return Promise.resolve(); },
      haptic: (type) => { calls.haptic.push(type); return Promise.resolve(); },
    },
  };
}

async function testTossBridge(list) {
  console.log('토스 앱 안에서');
  const order = list.map((_, i) => i);
  const fb = fakeBridge({ 'mbp:save': JSON.stringify({ v: 1, stage: 5, order, sound: false, puzzle: null }) });
  const t = await open({ before: (w) => { w.TossBridge = fb.bridge; } });
  check(t.text('.stage') === '스테이지 5', '토스 저장소에 있던 스테이지로 시작해요');
  check(t.text('#soundBtn') === '🔇 소리 끔', '토스 저장소의 소리 설정을 따라요');
  t.click('[data-action="play"]');
  await waitPieces(t);
  check(fb.calls.awake[fb.calls.awake.length - 1] === true, '퍼즐을 하는 동안 화면이 꺼지지 않게 해요');
  await hintTimes(t, 1);
  check(JSON.parse(fb.mem['mbp:save']).puzzle.placed.length === 1, '맞춘 조각을 토스 저장소에 저장해요');
  check(fb.calls.haptic.includes('tickMedium'), '조각이 맞으면 살짝 진동해요');
  fb.pressBack();
  check(!!t.d.querySelector('.home') && t.text('[data-action="play"]') === '이어서 하기', '뒤로가기를 누르면 처음 화면으로 와요');
  check(fb.calls.awake[fb.calls.awake.length - 1] === false, '처음 화면에서는 화면 켜짐을 풀어요');
  fb.pressBack();
  check(fb.calls.close === 1, '처음 화면에서 뒤로가기를 누르면 앱을 닫아요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

// 토스 저장소가 3초 넘게 늦게 대답해도 토스 쪽 기록을 덮어쓰지 않고, 대답이 오면 그 기록으로 다시 그려요
async function testTossSlowStorage(list) {
  console.log('토스 저장소가 늦게 대답할 때');
  const order = list.map((_, i) => i);
  const fb = fakeBridge({ 'mbp:save': JSON.stringify({ v: 1, stage: 9, order, sound: true, puzzle: null }) });
  const slowGet = fb.bridge.getItem;
  fb.bridge.getItem = (k) => new Promise((resolve) => setTimeout(() => resolve(slowGet(k)), 4000));
  const t = await open({ before: (w) => { w.TossBridge = fb.bridge; } });
  for (let i = 0; i < 80 && !t.d.querySelector('.stage'); i++) await sleep(50);
  check(t.text('.stage') === '스테이지 1' && fb.calls.set === 0, '먼저 시작하되 토스 저장소는 덮어쓰지 않아요');
  await sleep(1500);
  check(t.text('.stage') === '스테이지 9', '늦게 온 토스 기록으로 다시 그려요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

// 실제로 토스에 올릴 dist/ 를 만들어서, 토스 웹뷰 흉내(ReactNativeWebView)와 일반 브라우저에서 모두 뜨는지 봐요
async function testDistBundle() {
  console.log('토스용 빌드(dist)');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-web.mjs')], { stdio: 'ignore' });
  check(fs.existsSync(path.join(ROOT, 'dist', 'js', 'toss-bridge.js')), 'dist/js/toss-bridge.js 가 만들어져요');
  const inToss = await open({ dist: true, before: (w) => { w.ReactNativeWebView = { postMessage() {} }; } });
  check(!!inToss.w.TossBridge && typeof inToss.w.TossBridge.getItem === 'function', '토스 웹뷰에서는 연결부가 생겨요');
  check(!!inToss.d.querySelector('[data-action="play"]'), '토스 저장소가 대답하지 않아도 처음 화면이 떠요');
  check(inToss.errors.length === 0, '스크립트 오류 없음');
  inToss.w.close();
  const web = await open({ dist: true });
  check(web.w.TossBridge === undefined && !!web.d.querySelector('[data-action="play"]'), '일반 브라우저에서는 연결부 없이 그냥 동작해요');
  check(web.errors.length === 0, '스크립트 오류 없음');
  web.w.close();
}

(async () => {
  const list = (() => { const sb = { window: {} }; require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'js/paintings.js'), 'utf8'), sb); return sb.window.PAINTINGS; })();
  testPictures();
  await testHome();
  await testSound();
  await testPuzzle();
  await testStages();
  await testResume();
  await testLegacySave(list);
  await testBrowserBack();
  await testTossBridge(list);
  await testTossSlowStorage(list);
  await testDistBundle();
  console.log(failures ? `실패 ${failures}개` : '모두 통과');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
