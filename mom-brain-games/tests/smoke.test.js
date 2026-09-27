/* 스모크 테스트: 브라우저 없이(jsdom + node-canvas) 네 가지 놀이를 끝까지 한 번씩 진행해 봐요.
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

async function open(levels) {
  const dom = new JSDOM(html, {
    url: BASE,
    runScripts: 'dangerously',
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    beforeParse(w) {
      w.scrollTo = () => {};
      if (levels) w.localStorage.setItem('mbp:levels', JSON.stringify(levels));
    },
  });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  for (let i = 0; i < 50 && !w.document.querySelector('.act'); i++) await sleep(50);
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

async function testHome() {
  console.log('처음 화면');
  const t = await open();
  check(t.d.querySelectorAll('.act').length === 4, '놀이 4개가 보여요');
  check(t.d.querySelectorAll('.lvpill').length === 4, '놀이마다 레벨이 표시돼요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

async function testJigsaw() {
  console.log('그림 조각 맞추기');
  const t = await open();
  t.click('[data-game="jigsaw"]');
  check(/15개/.test(t.text('.lv-info')), '레벨 1은 15조각');
  t.click('[data-action="play"]');
  for (let i = 0; i < 60 && !t.d.querySelector('#jplay canvas'); i++) await sleep(100);
  const n = t.d.querySelectorAll('#jplay canvas.jp').length;
  check(n === 15, `퍼즐 조각이 만들어져요 (${n}개)`);
  for (let i = 0; i < n; i++) {
    if (/(\d+) \/ \1$/.test(t.text('#jprog') || '')) break;
    t.click('[data-action="hint"]');
    await sleep(520);
  }
  await sleep(2000);
  check(t.text('.result-title') === '레벨 1 완성!', '힌트로 끝까지 맞추면 완성 화면이 나와요');
  check(/레벨 2가 열렸어요/.test(t.text('.result-note') || ''), '다음 레벨이 열려요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

async function testMatch() {
  console.log('짝 맞추기');
  const t = await open();
  t.click('[data-game="match"]');
  t.click('[data-action="play"]');
  const names = [...t.d.querySelectorAll('.card .nm')].map((x) => x.textContent);
  check(names.length === 12, `레벨 1은 카드 12장 (${names.length}장)`);
  const done = new Set();
  for (let i = 0; i < names.length; i++) {
    if (done.has(i)) continue;
    const j = names.findIndex((v, k) => k !== i && v === names[i]);
    t.click(`.card[data-i="${i}"]`);
    t.click(`.card[data-i="${j}"]`);
    done.add(i); done.add(j);
  }
  await sleep(1100);
  check(t.text('.result-title') === '다 찾으셨어요!', '모두 찾으면 완성 화면이 나와요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

async function testShop() {
  console.log('장보기 기억');
  const t = await open({ shop: { cur: 3, max: 3 } });
  t.click('[data-game="shop"]');
  t.click('[data-action="play"]');
  const targets = [...t.d.querySelectorAll('.list li span:last-child')].map((s) => s.textContent);
  check(targets.length === 5, `레벨 3은 물건 5개 외우기 (${targets.length}개)`);
  t.click('[data-action="memorized"]');
  check(!!t.d.querySelector('.qbox'), '레벨 3부터는 중간에 계산 문제가 나와요');
  t.click('.choice[data-i="0"]');
  t.click('[data-action="to-pick"]');
  t.d.querySelectorAll('.tile').forEach((x) => {
    if (targets.includes(x.querySelector('.nm').textContent)) x.dispatchEvent(new t.w.MouseEvent('click', { bubbles: true }));
  });
  t.click('[data-action="check-pick"]');
  check(t.text('.result-title') === '모두 기억하셨어요!', '모두 고르면 성공');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

async function testProverb() {
  console.log('속담 잇기');
  const t = await open();
  t.click('[data-game="proverb"]');
  t.click('[data-action="play"]');
  check(t.d.querySelectorAll('.choice').length === 3, '레벨 1은 보기 3개');
  for (let q = 0; q < 5; q++) {
    t.click('.choice[data-i="0"]');
    t.click('[data-action="next-q"]');
  }
  check(/5문제 중/.test(t.text('.result-title') || ''), '5문제를 풀면 결과가 나와요');
  check(t.errors.length === 0, '스크립트 오류 없음');
  t.w.close();
}

(async () => {
  await testHome();
  await testJigsaw();
  await testMatch();
  await testShop();
  await testProverb();
  console.log(failures ? `실패 ${failures}개` : '모두 통과');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
