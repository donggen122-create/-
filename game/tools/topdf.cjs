// 활동지 HTML → A4 PDF(헤드리스 Edge). 쪽마다 넘침(scrollHeight > 높이)을 알려 주고, 미리보기 PNG도 만든다.
// node game/tools/topdf.cjs <in.html> <out.pdf> [미리보기 앞이름]   예) node game/tools/topdf.cjs docs/활동지/a.html docs/활동지/a.pdf out/a
const fs = require("fs"), path = require("path");
const { launch, sleep } = require("./pv/cdp.cjs");
const [, , HTML, PDF, PREV] = process.argv;
(async () => {
  const b = await launch({ w: 794, h: 1123, dpr: 1.4 });
  try {
    await b.send("Page.navigate", { url: "file:///" + path.resolve(HTML).split(path.sep).join("/") }); await sleep(1500);
    const info = await b.ev(`await document.fonts.ready;await new Promise(r=>setTimeout(r,800));return {fonts:[...new Set([...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family))],pages:[...document.querySelectorAll('.page')].map(p=>({h:p.clientHeight,sh:p.scrollHeight,last:Math.round(Math.max(...[...p.children].map(c=>c.getBoundingClientRect().bottom))-p.getBoundingClientRect().top)}))}`);
    const n = info.pages.length || 1;
    console.log(JSON.stringify(info), info.pages.some((p) => p.sh > p.h) ? "⚠ 넘치는 쪽이 있어요" : "넘침 없음");
    if (PREV) { await b.send("Emulation.setDeviceMetricsOverride", { width: 794, height: Math.ceil(1122.6 * n) + 10, deviceScaleFactor: 1.4, mobile: false }); await sleep(300); for (let i = 0; i < n; i++) { const s = await b.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: i * 1122.5, width: 793.7, height: 1122.5, scale: 1 } }); fs.writeFileSync(`${PREV}_${i + 1}.png`, Buffer.from(s.result.data, "base64")); } }
    const pdf = await b.send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    fs.writeFileSync(PDF, Buffer.from(pdf.result.data, "base64"));
    console.log("pdf pages:", (fs.readFileSync(PDF, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, "bytes:", fs.statSync(PDF).size);
  } catch (e) { console.error("ERR", e.message); } finally { b.close(); setTimeout(() => process.exit(0), 500); }
})();
