// 홍보 영상용 게임 장면 녹화(격리 서버 node game/tools/qa/node-server.mjs 전용, 로컬만).
// 게임 시간을 멈춘 채 1/60초씩 넘기며 한 장씩 그려 H.264로 굽는다 → 컴퓨터가 느려도 끊김 없는 60fps.
// 화면 1280×720을 1.5배 해상도로 그려 캔버스 1920×1080(게임 그림이 PC 화면보다 크게 보임). 화면 위 글자(HUD)는 캔버스 밖이라 안 찍힌다.
// 대왕: --boss 1 [--bossat 6,-1(주인공 옆 칸)] [--bosshp 0.48] [--patterns "불꽃 브레스|증기 폭발" --every 2.4(초마다 기술)] · 움직임 --drive eight|still|sway
// node clip.cjs --stage CH03 --seconds 10 --out clips/a [--hero hoya --mode ranged --pet otter] [--boss 1] [--skills EVO_F1,...] [--spawn 40 --types T1_SNACKBAG,...] [--warm 4]
// 결과: clips/a.mp4(확인용) · clips/a.bin(합성용) · clips/a.jpg(마지막 화면)
const fs = require("fs"), path = require("path");
const { launch, args, sleep, VIRTUAL_TIME } = require("./cdp.cjs");
const A = args();
const PORT = +(A.port || 8799), BASE = `http://localhost:${PORT}`, STAGE = A.stage || "CH03", SEC = +(A.seconds || 10), W = +(A.w || 1280), H = +(A.h || 720), DPR = +(A.dpr || 1.5), FPS = +(A.fps || 60);
const OUT = A.out || "clips/clip", ROOT = path.resolve(__dirname, "../../.."), BOSS = String(A.boss || "0") === "1", SPAWN = +(A.spawn ?? 40), WARM = +(A.warm ?? 4);
const SKILLS = (A.skills || "EVO_F1,EVO_W1,EVO_L1,EVO_V2").split(","), HERO = A.hero || "hoya", MODE = A.mode || "ranged", PET = A.pet || "otter";
const BOSSAT = A.bossat ? A.bossat.split(",").map(Number) : null, BOSSHP = A.bosshp ? +A.bosshp : null, PATTERNS = A.patterns ? A.patterns.split("|") : [], EVERY = +(A.every || 2.4);
const TYPES = (A.types || "").split(",").filter(Boolean), SUP = A.sup ? JSON.parse(A.sup) : { S5: 3, S1: 3 }, DRIVE = A.drive || "eight", SEED = +(A.seed || 1);
(async () => {
  const R = await import("file:///" + path.join(ROOT, "game/src/rework-core.js").replace(/\\/g, "/"));
  const p = JSON.parse(JSON.stringify(R.freshProfile()));
  const parts = ["PART_F1", "PART_W1", "PART_L1"], slots = ["helm", "armor", "shoes", "gloves", "necklace", "weapon"];
  Object.assign(p, { difficulty: "normal", weaponMode: MODE, coins: 0, training: { attack: 60, hp: 60, speed: 40 }, milestones: { firstPart: true, firstPet: true, bossPet: true, firstGear: true },
    pets: R.PET_IDS, petCopies: Object.fromEntries(R.PET_IDS.map((id) => [id, 80])), activePet: PET, stages: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`CH${String(i + 1).padStart(2, "0")}`, { cleared: true, stars: 3 }])),
    parts: Object.fromEntries(parts.map((x) => [x, { copies: 25, level: 5 }])), equippedParts: parts, hero: HERO, heroLocked: true,
    gear: Object.fromEntries(slots.map((x) => [`${HERO}_${MODE}_${x}`, { copies: 80, grade: 3 }])), equippedGear: Object.fromEntries(slots.map((x) => [x, `${HERO}_${MODE}_${x}`])) });
  const b = await launch({ w: W, h: H, dpr: DPR });
  try {
    await b.send("Page.addScriptToEvaluateOnNewDocument", { source: VIRTUAL_TIME });
    await b.send("Page.navigate", { url: BASE + "/" }); await sleep(2500);
    const uid = "qapv" + Math.floor(Math.random() * 1e6);
    await b.ev(`const $=s=>document.querySelector(s),w=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=20000)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(f())return true;}catch(e){}await w(100);}return false;};
      await fetch('/_qa/reset-attempts',{method:'POST'});$('#login-id').value='${uid}';$('#login-pw').value='qa_local_1234';$('#btn-register').click();
      if(!await until(()=>{const b=$('#btn-title-start');return b&&b.offsetParent!==null;}))throw new Error('no title');
      const r=await fetch('/_qa/profile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'${uid}',profile:${JSON.stringify(p)}})});if(!r.ok)throw new Error('profile');return 1;`);
    await b.send("Page.reload"); await sleep(3000);
    await b.ev(`const $=s=>document.querySelector(s),w=ms=>new Promise(r=>setTimeout(r,ms));const until=async(f,ms=25000)=>{const t0=Date.now();while(Date.now()-t0<ms){try{if(f())return true;}catch(e){}await w(100);}return false;};
      if(!await until(()=>{const b=$('#btn-title-start');return b&&!b.disabled&&b.offsetParent!==null;}))throw new Error('title');$('#btn-title-start').click();
      if(!await until(()=>$('#guardian-lobby .sg-nav')))throw new Error('lobby');for(let i=0;i<6;i++){await w(300);document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
      $('.sg-nav [data-tab="adventure"]')?.click();await w(300);$('.sg-chapter-chip[data-chapter="${Math.floor((+STAGE.slice(2) - 1) / 5) + 1}"]')?.click();await w(300);
      $('[data-stage="${STAGE}"]').click();await w(300);$('#sg-start').click();
      if(!await until(()=>$('#levelup')&&!$('#levelup').classList.contains('hidden')))throw new Error('no levelup');
      window.__sgCombatLoad(${JSON.stringify(SKILLS)},{},${JSON.stringify(SUP)});window.__debugGod=true;window.__debugBench(0,1,false,${DPR});window.__debugQuality(0);
      ${BOSS ? "window.__debugForceBoss();" : ""}
      document.querySelectorAll('#hud,#btn-pause,#btn-mute,#sg-run-tools,#sg-objective').forEach(e=>e&&(e.style.visibility='hidden'));
      return 1;`);
    const info = await b.ev(`
      const {makeEncoder}=await import('/tools/pv/enc.js');const c=document.getElementById('game');
      const TY=${JSON.stringify(TYPES)};let ti=0;const nextType=()=>TY.length?TY[(ti++)%TY.length]:null;
      const spawnSome=(n,r)=>{const k=Math.max(1,TY.length);for(let j=0;j<k;j++){const t=nextType();if(t)window.__debugSpawn(t,Math.ceil(n/k),r*(0.85+j*0.12));}};
      let fi=0;const drive=()=>{const lv=document.querySelector('#levelup');if(lv&&!lv.classList.contains('hidden'))document.querySelector('#card-row .card')?.click();
        document.querySelectorAll('dialog[open]').forEach(d=>d.close());
        const a=fi/60/2.6+${SEED},k=[];const dx=${DRIVE === "still" ? 0 : DRIVE === "sway" ? "(Math.sin(a*2.2)>.75?1:Math.sin(a*2.2)<-.75?-1:0)" : "Math.cos(a)"},dy=${DRIVE === "still" || DRIVE === "sway" ? 0 : "Math.sin(2*a)*.8"};
        if(dx>.35)k.push('d');else if(dx<-.35)k.push('a');if(dy>.35)k.push('s');else if(dy<-.35)k.push('w');window.__debugSetKeys(k);
        ${SPAWN ? `if(fi%10===0){const s=window.__sgSnapshot();if(s.enemies<${SPAWN})spawnSome(6,560);}` : ""}fi++;};
      ${SPAWN ? `spawnSome(${SPAWN},430);` : ""}
      ${BOSSAT ? `window.__debugBossAt(${BOSSAT[0]},${BOSSAT[1]});` : ""}${BOSSHP ? `window.__debugBossHp(${BOSSHP});` : ""}
      const PAT=${JSON.stringify(PATTERNS)};
      await window.__pvVirt();
      const step=1000/${FPS};
      for(let i=0;i<${WARM * FPS};i++){drive();window.__pvStep(step);}      // 준비 시간(녹화 안 함)
      const enc=makeEncoder({width:c.width,height:c.height,fps:${FPS},bitrate:24e6});const t0=Date.now();
      for(let i=0;i<${SEC * FPS};i++){if(PAT.length&&i%Math.round(${EVERY}*${FPS})===18)window.__debugBossPattern(PAT[Math.floor(i/Math.round(${EVERY}*${FPS}))%PAT.length]);drive();window.__pvStep(step);await enc.addFrame(c);}
      const {mp4,bin}=await enc.finish();window.__mp4=mp4;window.__bin=bin;
      return {frames:enc.frames,canvas:c.width+'x'+c.height,renderSec:(Date.now()-t0)/1000,enemies:window.__sgSnapshot().enemies,boss:${BOSS}};`);
    const n1 = await b.pull("__mp4", OUT + ".mp4"), n2 = await b.pull("__bin", OUT + ".bin");
    const shot = await b.send("Page.captureScreenshot", { format: "jpeg", quality: 80 }); fs.writeFileSync(OUT + ".jpg", Buffer.from(shot.result.data, "base64"));
    console.log(JSON.stringify({ out: OUT, mp4: n1, bin: n2, ...info, logs: b.logs.filter((l) => /EXC|error/i.test(l)).slice(0, 3) }));
  } catch (e) { console.error("ERR", e.message, b.logs.slice(-5)); } finally { b.close(); setTimeout(() => process.exit(0), 600); }
})();
