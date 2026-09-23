// 성능 측정(로컬 전용): 헤드리스 Edge를 태블릿 크기·느린 CPU로 띄워 후반 전투의 프레임 시간과 CPU 프로필을 잰다.
// 로컬 서버(http://localhost:8797, 테스트 계정 테스트/1234)에서만. 결과(.png·.cpuprofile)는 game/tools/qa/out(git 제외).
// node game/tools/qa/perf.cjs --url http://localhost:8797/ --stage CH02 --diff normal --mode melee --ff 240 --measure 10 --throttle 4 --w 1180 --h 820 --dsf 2 --gpu 0 --label before --out <dir>
const { spawn, execSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith("--")) continue; const n = process.argv[i + 1]; args[a.slice(2)] = n !== undefined && !n.startsWith("--") ? process.argv[++i] : true; }
const URL = args.url || "http://localhost:8797/", STAGE = args.stage || "CH02", DIFF = args.diff || "normal", MODE = args.mode || "melee";
const FF = +(args.ff ?? 240), MEASURE = +(args.measure ?? 10), THR = +(args.throttle ?? 4), W = +(args.w || 1180), H = +(args.h || 820), DSF = +(args.dsf || 2);
const GPU = String(args.gpu ?? "0") === "1", LABEL = args.label || "run", OUT = args.out || path.join(__dirname, "out");
const SKILLS = args.skills ? String(args.skills).split(",") : null;   // 예: F1,L1,V2,W1 → 만렙 스킬로 강제(최악 상황)
const EXTRA = +(args.extra || 0);                                     // 추가로 주변에 소환할 적 수
const EDGE = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 600);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "edge-perf-"));
const proc = spawn(EDGE, ["--headless=new", ...(GPU ? [] : ["--disable-gpu"]), "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let s = ""; r.on("data", (c) => (s += c)); r.on("end", () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on("error", rej));
function cleanup() {
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -like '*${path.basename(profile)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore", timeout: 20000 }); } catch (e) {}
  try { proc.kill(); } catch (e) {}
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }, 800);
}
const SETUP = `
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await wait(100); } return false; };
await wait(800);
$('#login-id').value = '테스트'; $('#login-pw').value = '1234'; $('#btn-login').click();
if (!await until(() => { const b = $('#btn-title-start'); return b && !b.disabled && b.offsetParent !== null; }, 25000)) throw new Error('title start not ready');
await wait(400);
document.querySelectorAll('dialog[open]').forEach((d) => d.close());
$('#btn-title-start').click();
if (!await until(() => $('.sg-nav [data-tab="adventure"]'), 25000)) throw new Error('lobby not ready');
await wait(600);
const cleanupBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('정리하기'));
if (cleanupBtn) { cleanupBtn.click(); await wait(1500); }
$('.sg-nav [data-tab="adventure"]').click(); await wait(300);
$('[data-stage="${STAGE}"]').click(); await wait(400);
if ($('.sg-stage.selected')?.dataset.stage !== '${STAGE}') throw new Error('stage not selectable');
const pick = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); } };
pick('#sg-difficulty', '${DIFF}'); pick('#sg-weapon-mode', '${MODE}');
await wait(200);
$('#sg-start').click();
if (!await until(() => $('#levelup') && !$('#levelup').classList.contains('hidden'), 25000)) throw new Error('levelup not shown');
window.__pilotAvoid = 2;
${SKILLS ? `window.__sgCombatLoad(${JSON.stringify(SKILLS)});` : ""}
const ff = window.__debugPilot(${FF});
window.__debugGod = true;
${EXTRA ? `window.__debugSpawn(Object.keys(window.__sgSnapshot().enemyTypes)[0] || 'EN01', ${EXTRA}, 420);` : ""}
// 실시간 조종: 레벨업 카드는 첫 장, 원을 그리며 이동
window.__perfDrive = setInterval(() => {
  const lv = document.querySelector('#levelup'); if (lv && !lv.classList.contains('hidden')) { document.querySelector('#card-row .card, #levelup .card')?.click(); }
  const t = performance.now() / 1500; const k = []; const dx = Math.cos(t), dy = Math.sin(t);
  if (dx > .3) k.push('d'); else if (dx < -.3) k.push('a'); if (dy > .3) k.push('s'); else if (dy < -.3) k.push('w');
  window.__debugSetKeys(k);
}, 100);
return JSON.stringify({ ff, snap: (({ runTime, mode, enemies, special, enemyTypes, skills }) => ({ runTime, mode, enemies, special, enemyTypes, skills: Object.fromEntries(Object.entries(skills || {}).map(([k, v]) => [k, v.lv + (v.evolved ? 'E' : '')])) }))(window.__sgSnapshot()) });
`;
const MEASURE_JS = `
const frames = []; let last = performance.now(); const end = last + ${MEASURE * 1000};
const counts = [];
await new Promise((res) => { function f(t) { frames.push(t - last); last = t; if (frames.length % 30 === 0) { const c = window.__debugCounts?.() || {}; const s = window.__sgSnapshot(); counts.push({ e: c.enemies, p: c.projectiles, b: c.blasts, a: c.arcs, run: Math.round(s.runTime), mode: s.mode, el: s.elements ? JSON.stringify(s.elements).length : 0 }); } if (t < end) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
clearInterval(window.__perfDrive); window.__debugSetKeys([]);
frames.shift();
const s = [...frames].sort((a, b) => a - b); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
const sum = frames.reduce((a, b) => a + b, 0);
return JSON.stringify({ n: frames.length, avgMs: +(sum / frames.length).toFixed(1), fps: +(1000 * frames.length / sum).toFixed(1), p50: +q(.5).toFixed(1), p90: +q(.9).toFixed(1), p99: +q(.99).toFixed(1), max: +s[s.length - 1].toFixed(1), over50: frames.filter((x) => x > 50).length, counts });
`;
(async () => {
  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) { try { targets = await getJson(`http://127.0.0.1:${port}/json/list`); } catch (e) { await sleep(250); } }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error("ws error")); });
  let seq = 0; const pending = new Map(); const events = []; const problems = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) { events.push(d.method); if (d.method === "Runtime.exceptionThrown") problems.push((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text); } };
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const evalJs = async (code) => { const r = await send("Runtime.evaluate", { expression: `(async()=>{${code}\n})()`, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error("eval: " + ((r.result.exceptionDetails.exception || {}).description || JSON.stringify(r.result.exceptionDetails))); return r.result.result.value; };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DSF, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.navigate", { url: URL });
  for (let i = 0; i < 100 && !events.includes("Page.loadEventFired"); i++) await sleep(250);
  await sleep(1500);
  const setup = JSON.parse(await evalJs(SETUP));
  await send("Emulation.setCPUThrottlingRate", { rate: THR });
  await sleep(1000);
  await send("Profiler.enable"); await send("Profiler.setSamplingInterval", { interval: 250 }); await send("Profiler.start");
  const m = JSON.parse(await evalJs(MEASURE_JS));
  const prof = (await send("Profiler.stop")).result.profile;
  await send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, `perf_${LABEL}.png`), Buffer.from(shot.result.data, "base64"));
  fs.writeFileSync(path.join(OUT, `perf_${LABEL}.cpuprofile`), JSON.stringify(prof));
  // 함수별 자체 시간·포함 시간
  const byId = new Map(prof.nodes.map((n) => [n.id, n])); const self = new Map();
  for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) || 0) + (prof.timeDeltas[i] || 0));
  const parent = new Map(); for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const key = (n) => `${n.callFrame.functionName || "(anon)"} ${path.basename(n.callFrame.url || "")}:${n.callFrame.lineNumber + 1}`;
  const selfAgg = new Map(), inclAgg = new Map(); let total = 0;
  for (const [id, t] of self) {
    total += t; const n = byId.get(id); selfAgg.set(key(n), (selfAgg.get(key(n)) || 0) + t);
    const seen = new Set(); let cur = id;
    while (cur !== undefined) { const k = key(byId.get(cur)); if (!seen.has(k)) { seen.add(k); inclAgg.set(k, (inclAgg.get(k) || 0) + t); } cur = parent.get(cur); }
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  const report = { label: LABEL, cfg: { STAGE, DIFF, MODE, FF, MEASURE, THR, W, H, DSF, GPU, SKILLS, EXTRA }, setup, frames: m, problems: problems.slice(0, 5) };
  console.log(JSON.stringify(report));
  console.log("--- self time top 30 ---\n" + top(selfAgg, 30).join("\n"));
  console.log("--- inclusive top 40 ---\n" + top(inclAgg, 40).join("\n"));
  cleanup(); setTimeout(() => process.exit(0), 1200);
})().catch((e) => { console.error("ERR", e.message); cleanup(); setTimeout(() => process.exit(1), 1200); });
