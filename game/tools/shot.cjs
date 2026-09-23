// 화면 캡처 도구(헤드리스 Edge를 CDP로 조종). 로그인처럼 페이지 안에서 뭔가 한 뒤에 찍을 수 있다.
// 사용: node game/tools/shot.js --url <주소> --out <파일.png> [--w 1280 --h 800] [--phone] [--full]
//        [--eval "<페이지에서 실행할 JS(await 가능)>" | --evalfile <JS 파일>] [--wait 1200(뜬 뒤 대기 ms)] [--after 1500(eval 뒤 대기 ms)]
// --phone : 375×812, 2배율, 아이폰 UA(폰 화면 확인용). --full : 화면 밖까지 페이지 전체.
// 예) 관리 페이지 로그인 뒤 캡처:
//   node game/tools/shot.js --url https://.../admin/ --out admin.png --evalfile login.js   (login.js 안에서 입력칸 채우고 requestSubmit)
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const k = a.slice(2);
  const next = process.argv[i + 1];
  args[k] = next !== undefined && !next.startsWith("--") ? process.argv[++i] : true;
}
if (!args.url || !args.out) { console.error("--url 과 --out 이 필요해요"); process.exit(2); }
const EDGE = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
if (!EDGE) { console.error("Edge를 찾지 못했어요"); process.exit(2); }
const phone = !!args.phone;
const W = +args.w || (phone ? 375 : 1280), H = +args.h || (phone ? 812 : 800);
const port = 9300 + Math.floor(Math.random() * 600);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "edge-shot-"));
const proc = spawn(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let s = ""; r.on("data", (c) => (s += c)); r.on("end", () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on("error", rej));
// Edge는 자식 프로세스를 여럿 띄우므로 트리째 끝낸다(proc.kill()만 하면 자식이 남아 수백 개가 쌓인다)
function cleanup() {
  // 이 캡처의 프로필 폴더를 쓰는 msedge.exe 를 전부 끝낸다(taskkill /T 는 headless=new 의 자식을 못 잡는다)
  const tag = profile.replace(/\\/g, "\\\\").replace(/'/g, "''");
  try { require("child_process").execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -like '*${path.basename(profile)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore", timeout: 20000 }); } catch (e) {}
  try { proc.kill(); } catch (e) {}
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }, 800);
}

(async () => {
  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) { try { targets = await getJson(`http://127.0.0.1:${port}/json/list`); } catch (e) { await sleep(250); } }
  if (!targets) throw new Error("Edge 디버그 포트에 연결하지 못했어요");
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error("ws error")); });
  let seq = 0; const pending = new Map(); const events = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) events.push(d); };
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const waitEvent = async (name, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (events.some((e) => e.method === name)) return true; await sleep(50); } return false; };

  await send("Page.enable"); await send("Runtime.enable");
  // 페이지의 오류·console.error 를 모아 끝에 보여 준다(화면만 봐서는 모르는 스크립트 오류 확인용)
  const problems = [];
  const origOnMessage = ws.onmessage;
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === "Runtime.exceptionThrown") problems.push("exception: " + ((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text || "").split("\n")[0]);
    else if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) problems.push(d.params.type + ": " + d.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(" ").slice(0, 300));
    origOnMessage(m);
  };
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
  if (phone) {
    await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  }
  await send("Page.navigate", { url: args.url });
  await waitEvent("Page.loadEventFired", 25000);
  await sleep(+args.wait || 1200);
  const code = args.evalfile ? fs.readFileSync(args.evalfile, "utf8") : (typeof args.eval === "string" ? args.eval : "");
  if (code) {
    const r = await send("Runtime.evaluate", { expression: `(async()=>{${code}\n})()`, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) console.error("eval 오류:", (r.result.exceptionDetails.exception || {}).description || JSON.stringify(r.result.exceptionDetails));
    await sleep(+args.after || 1500);
  }
  let clip;
  if (args.full) {
    const m = await send("Page.getLayoutMetrics");
    const cs = m.result.cssContentSize || m.result.contentSize;
    clip = { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.ceil(cs.height), scale: 1 };
  }
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!args.full, ...(clip ? { clip } : {}) });
  if (!shot.result || !shot.result.data) throw new Error("캡처 실패: " + JSON.stringify(shot.error || shot));
  fs.writeFileSync(args.out, Buffer.from(shot.result.data, "base64"));
  console.log(`saved ${args.out} (${W}x${H}${phone ? " @2x" : ""}${args.full ? " full" : ""})`);
  // --postevalfile: 캡처 뒤 정리용 JS(예: 전투를 로비로 마무리해 서버에 진행 중인 판을 남기지 않기)
  if (args.postevalfile) {
    const post = fs.readFileSync(args.postevalfile, "utf8");
    const r2 = await send("Runtime.evaluate", { expression: `(async()=>{${post}\n})()`, awaitPromise: true, returnByValue: true });
    if (r2.result && r2.result.exceptionDetails) console.error("posteval 오류:", (r2.result.exceptionDetails.exception || {}).description || JSON.stringify(r2.result.exceptionDetails));
    await sleep(+args.postwait || 800);
  }
  console.log(problems.length ? `page problems (${problems.length}):\n  ` + problems.slice(0, 15).join("\n  ") : "page problems: none");
  ws.close(); cleanup();
  setTimeout(() => process.exit(0), 500);
})().catch((e) => { console.error(e && e.message || e); cleanup(); setTimeout(() => process.exit(1), 500); });
