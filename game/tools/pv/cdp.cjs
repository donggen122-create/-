// 홍보 영상 도구 공통: 헤드리스 Edge를 띄우고 CDP로 조종한다(로컬 전용).
const { spawn, execSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const EDGE = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let s = ""; r.on("data", (c) => (s += c)); r.on("end", () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on("error", rej));
function args() { const A = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith("--")) continue; const n = process.argv[i + 1]; A[a.slice(2)] = n !== undefined && !n.startsWith("--") ? process.argv[++i] : true; } return A; }
async function launch({ w = 1920, h = 1080, dpr = 1 } = {}) {
  const port = 9300 + Math.floor(Math.random() * 600), prof = fs.mkdtempSync(path.join(os.tmpdir(), "edge-pv-"));
  spawn(EDGE, ["--headless=new", "--hide-scrollbars", "--no-first-run", "--disable-extensions", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${w},${h}`, "about:blank"], { stdio: "ignore" });
  const close = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore", timeout: 20000 }); } catch (e) {} };
  let t = null; for (let i = 0; i < 80 && !t; i++) { try { t = await getJson(`http://127.0.0.1:${port}/json/list`); } catch (e) { await sleep(250); } }
  const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let seq = 0; const pend = new Map(), logs = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") logs.push("EXC " + ((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text)); else if (d.method === "Runtime.consoleAPICalled") logs.push(d.params.type + " " + d.params.args.map((a) => a.value ?? a.description).join(" ")); };
  const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (code) => { const r = await send("Runtime.evaluate", { expression: `(async()=>{${code}\n})()`, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(((r.result.exceptionDetails.exception || {}).description || JSON.stringify(r.result.exceptionDetails)).slice(0, 600)); return r.result.result.value; };
  // 페이지의 Uint8Array(window[name])를 파일로
  const pull = async (name, out) => {
    const n = await ev(`return window[${JSON.stringify(name)}]?.length||0`); const CH = 4 * 1024 * 1024, bufs = [];
    for (let off = 0; off < n; off += CH) bufs.push(Buffer.from(await ev(`const u=window[${JSON.stringify(name)}].subarray(${off},${off + CH});let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s);`), "base64"));
    fs.writeFileSync(out, Buffer.concat(bufs)); return n;
  };
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  return { send, ev, pull, close, logs };
}
// 페이지에 넣는 시간 멈춤 장치: __pvVirt(true) 뒤에는 requestAnimationFrame·performance.now가 __pvStep(ms)로만 흐른다.
const VIRTUAL_TIME = `(()=>{const realNow=performance.now.bind(performance),realRAF=window.requestAnimationFrame.bind(window);let virt=false,vt=0,cbs=[];
performance.now=()=>virt?vt:realNow();
window.requestAnimationFrame=(cb)=>{if(virt){cbs.push(cb);return cbs.length;}return realRAF(cb);};
window.__pvVirt=async()=>{virt=true;await new Promise(r=>setTimeout(r,120));vt=realNow();};
window.__pvStep=(ms)=>{vt+=ms;const list=cbs;cbs=[];for(const cb of list){try{cb(vt);}catch(e){console.error(e);}}};
window.__pvTime=()=>vt;})();`;
module.exports = { launch, args, sleep, VIRTUAL_TIME };
