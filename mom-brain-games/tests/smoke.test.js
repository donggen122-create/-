/* 스모크 테스트: 브라우저 없이(jsdom + node-canvas) 그림 목록을 점검하고 퍼즐을 처음부터 끝까지 진행해 봐요.
   실행: npm install && npm test */
const fs = require('fs');
const path = require('path');
const { JSDOM, ResourceLoader } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost/';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// localhost 주소는 프로젝트 폴더의 파일로 연결하고, 외부 주소(웹 폰트 등)는 불러오지 않아요.
class LocalLoader extends ResourceLoader {
  fetch(url, options) {
    if (!url.startsWith(BASE)) return null;
    const p = fs.promises.readFile(path.join(ROOT, decodeURIComponent(url.slice(BASE.length))));
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

async function open(storage) {
  const dom = new JSDOM(html, {
    url: BASE,
    runScripts: 'dangerously',
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.scrollTo = () => {};
      for (const [k, v] of Object.entries(storage || {})) w.localStorage.setItem(k, JSON.stringify(v));
    },
  });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  for (let i = 0; i < 50 && !w.document.querySelector('[data-action="play"]'); i++) await sleep(50);
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
  check(JSON.parse(t.w.localStorage.getItem('mbp:settings')).sound === false, '꺼진 상태가 저장돼요');
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
  const order = JSON.parse(t.w.localStorage.getItem('mbp:order'));
  const n = t.w.PAINTINGS.length;
  check(Array.isArray(order) && order.length === n && new Set(order).size === n, '그림 순서를 섞어서 저장해요 (겹치는 그림 없음)');
  const sorted = order.every((v, i) => v === i);
  check(!sorted, '목록 순서 그대로가 아니라 무작위예요');
  t.w.close();
  const u = await open({ 'mbp:stage': 200, 'mbp:order': order });
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

(async () => {
  testPictures();
  await testHome();
  await testSound();
  await testPuzzle();
  await testStages();
  console.log(failures ? `실패 ${failures}개` : '모두 통과');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
