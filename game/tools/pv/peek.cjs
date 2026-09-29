// 홍보 영상 도구: 페이지를 헤드리스 Edge로 열고 window.__done이 될 때까지 기다린 뒤 결과(JSON)와 화면 캡처를 남긴다.
// node peek.cjs --url "http://localhost:8799/tools/pv/sheet.html?clip=clips/a.mp4" --out sheet.jpg [--w 1920 --h 1080] [--timeout 120]
const { spawn, execSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const A = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (!a.startsWith("--")) continue; const n = process.argv[i + 1]; A[a.slice(2)] = n !== undefined && !n.startsWith("--") ? process.argv[++i] : true; }
const W = +(A.w || 1920), H = +(A.h || 1080), TIMEOUT = +(A.timeout || 120) * 1000;
const EDGE = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let s = ""; r.on("data", (c) => (s += c)); r.on("end", () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on("error", rej));
(async () => {
  const port = 9300 + Math.floor(Math.random() * 600), prof = fs.mkdtempSync(path.join(os.tmpdir(), "edge-peek-"));
  spawn(EDGE, ["--headless=new", "--hide-scrollbars", "--no-first-run", "--disable-extensions", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
  const cleanup = () => { try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe'\\" | Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore", timeout: 20000 }); } catch (e) {} };
  try {
    let t = null; for (let i = 0; i < 60 && !t; i++) { try { t = await getJson(`http://127.0.0.1:${port}/json/list`); } catch (e) { await sleep(250); } }
    const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
    let seq = 0; const pend = new Map(), logs = []; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") logs.push("EXC " + ((d.params.exceptionDetails.exception || {}).description || d.params.exceptionDetails.text)); else if (d.method === "Runtime.consoleAPICalled") logs.push(d.params.type + " " + d.params.args.map((a) => a.value ?? a.description).join(" ")); };
    const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    await send("Page.enable"); await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: A.url });
    const t0 = Date.now(); let v = null;
    while (Date.now() - t0 < TIMEOUT) { await sleep(500); const r = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result ?? null) : null", returnByValue: true }); v = r.result.result.value; if (v) break; }
    if (A.out) { const shot = await send("Page.captureScreenshot", { format: A.out.endsWith(".png") ? "png" : "jpeg", quality: 85 }); fs.writeFileSync(A.out, Buffer.from(shot.result.data, "base64")); }
    if (A.save) { // window.__bytes(Uint8Array)를 파일로
      const n = (await send("Runtime.evaluate", { expression: "window.__bytes ? window.__bytes.length : 0", returnByValue: true })).result.result.value; const CH = 2 * 1024 * 1024, bufs = [];
      for (let off = 0; off < n; off += CH) { const r = await send("Runtime.evaluate", { expression: `(()=>{const u=window.__bytes.subarray(${off},${off + CH});let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s);})()`, returnByValue: true }); bufs.push(Buffer.from(r.result.result.value, "base64")); }
      fs.writeFileSync(A.save, Buffer.concat(bufs)); logs.push(`saved ${A.save} ${n} bytes`);
    }
    console.log(v || "(timeout)"); if (logs.length) console.log(logs.slice(-15).join("\n"));
  } catch (e) { console.error("ERR", e.message); } finally { cleanup(); setTimeout(() => process.exit(0), 600); }
})();
