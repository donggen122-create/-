// 서호팡팡수호대 홍보 영상(PV) 합성. 1920×1080 · 60fps · 약 58초, 배경음 main-theme.mp3 박자(103.5 BPM)에 맞춰 장면이 바뀐다.
// ?preview=5,8.2,12 → 그 시각들을 격자로 그려 확인 / ?render=1 → 전체를 H.264+AAC MP4로 구워 window.__mp4 / ?from=&to= 부분만
import { makeEncoder, openClip } from "./enc.js";

const W = 1920, H = 1080, FPS = 60;
const q = new URLSearchParams(location.search);
const cv = document.getElementById("c"), ctx = cv.getContext("2d");
const BEAT = 0.5797, B0 = 0.11, B = (n) => B0 + n * BEAT;
const END = 58.6;

// ---------- 재료 ----------
const AS = "../../assets/";
const IMG_SRC = {
  land: "ui/title_landscape.jpg", emblem: "ui/title_emblem.png", hoya: "ui/title_hoya.png", minji: "ui/title_minji.png", mascot: "ui/title_mascot.png",
  snack: "sprites/t1/en_snackbag.png", bottle: "sprites/t1/en_bottle.png", baggy: "sprites/t1/en_baggy.png", butt: "sprites/t1/en_buttbug.png", fly: "sprites/t1/en_fly.png", food: "sprites/t1/en_foodwaste.png",
  dust: "sprites/t2/en_dust.png", gas: "sprites/t2/en_gas.png", rain: "sprites/t2/en_raincloud.png", germ: "sprites/t2/en_germ.png", bigdust: "sprites/t2/en_bigdust.png",
  boss1: "sprites/t1/boss_angry.png", boss2: "sprites/t2/boss_angry.png", clean: "sprites/t2/card_clean.jpg", polluted: "sprites/t2/card_polluted.jpg", smog: "sprites/t2/fx_smog.png",
  turtle: "seoho_v1/pets/turtle_idle.png", cat: "seoho_v1/pets/cat_idle.png", otter: "seoho_v1/pets/otter_idle.png", deer: "seoho_v1/pets/deer_idle.png",
  chestC: "sprites/ui/supply_gear_closed.png", chestO: "sprites/ui/supply_gear_open.png",
  g1: "sprites/gear/gear_hoya_ranged_helm.png", g2: "sprites/gear/gear_hoya_ranged_armor.png", g3: "sprites/gear/gear_hoya_ranged_weapon.png",
  g4: "sprites/gear/gear_minji_ranged_weapon.png", g5: "sprites/gear/gear_minji_melee_weapon.png", g6: "sprites/gear/gear_hoya_melee_weapon.png",
  skF: "sprites/skills/fire_volcano.png", skW: "sprites/skills/water_kballoon.png", skV: "sprites/skills/wind_typhoon_1.png", skE: "sprites/skills/earth_boulder_1.png", skL: "sprites/skills/lightning_storm.png",
  purify: "sprites/vfx/purify-v1.png",
};
const IMG = {};
const CLIP_NAMES = ["c1_hoya", "c1_minji", "c2_hoya", "c2_minji", "boss1", "boss2"];
const CLIPS = {};

// ---------- 도구 ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  out3: (x) => 1 - Math.pow(1 - x, 3), in3: (x) => x * x * x, out5: (x) => 1 - Math.pow(1 - x, 5),
  io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), sine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  back: (x, s = 1.8) => (x <= 0 ? 0 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)),
  elastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin(((x * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
};
const hash = (i, s = 0) => { let h = Math.imul((i | 0) * 374761393 + (s | 0) * 668265263 + 1013904223, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = (t, s = 0) => { const i = Math.floor(t), f = t - i, a = hash(i, s) * 2 - 1, b = hash(i + 1, s) * 2 - 1, u = f * f * (3 - 2 * f); return a + (b - a) * u; };
const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
const rrect = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const pop = (t, t0, d = 0.38, s = 2.0) => (t < t0 ? 0 : E.back(P(t, t0, t0 + d), s));
const slam = (t, t0, d = 0.24, from = 2.5) => (t < t0 ? { sc: 0, a: 0 } : { sc: lerp(from, 1, E.out3(P(t, t0, t0 + d))) * (1 + 0.06 * Math.sin(P(t, t0 + d, t0 + d + 0.25) * Math.PI)), a: clamp(P(t, t0, t0 + d) * 4) });

// 글자: 그림자 → 바깥 테두리 → 안쪽 테두리 → 채우기. pass='stroke'|'fill'|'all'(여러 글자를 겹칠 때 테두리를 먼저 모두 그린다)
function txt(s, x, y, o = {}) {
  const { font = "Black Han Sans", size = 80, fill = "#fff", grad = null, stroke = "#24124a", sw = size * 0.13, outer = null, ow = size * 0.07,
    shadow = true, align = "center", rot = 0, sc = 1, sx = 1, sy = 1, alpha = 1, track = 0, pass = "all" } = o;
  if (alpha <= 0.002 || sc <= 0.002) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc * sx, sc * sy); ctx.globalAlpha *= alpha;
  ctx.font = `${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.letterSpacing = track + "px"; ctx.lineJoin = "round"; ctx.miterLimit = 2;
  if (pass !== "fill") {
    if (shadow) { ctx.save(); ctx.translate(size * 0.02, size * 0.08); ctx.strokeStyle = ctx.fillStyle = "rgba(18,6,40,.5)"; ctx.lineWidth = sw + (outer ? ow * 2 : 0); if (ctx.lineWidth > 0) ctx.strokeText(s, 0, 0); ctx.fillText(s, 0, 0); ctx.restore(); }
    if (outer) { ctx.lineWidth = sw + ow * 2; ctx.strokeStyle = outer; ctx.strokeText(s, 0, 0); }
    if (sw > 0) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.strokeText(s, 0, 0); }
  }
  if (pass !== "stroke") {
    if (grad) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.45); grad.forEach((c, i) => g.addColorStop(i / (grad.length - 1), c)); ctx.fillStyle = g; } else ctx.fillStyle = fill;
    ctx.fillText(s, 0, 0);
  }
  ctx.restore();
}
function measure(s, size, font, track = 0) { ctx.save(); ctx.font = `${size}px "${font}"`; ctx.letterSpacing = track + "px"; const w = ctx.measureText(s).width; ctx.restore(); return w; }
// 글자가 하나씩 튀어나오는 제목
function popWord(s, cx, y, t, t0, per, o) {
  const chars = [...s], ws = chars.map((c) => measure(c, o.size, o.font) + (o.gap || 0)), total = ws.reduce((a, b) => a + b, 0);
  const place = []; let x = cx - total / 2;
  chars.forEach((c, i) => { const p = P(t, t0 + i * per, t0 + i * per + 0.4); place.push({ c, x: x + ws[i] / 2, p }); x += ws[i]; });
  for (const pass of ["stroke", "fill"]) for (const k of place) if (k.p > 0) txt(k.c, k.x, y - (1 - E.out3(k.p)) * 70 + (o.wave ? Math.sin(t * 5 + k.x * 0.01) * o.wave : 0), { ...o, sc: E.back(k.p, 2.4), pass, rot: (1 - k.p) * 0.3 });
}
// 그림(가운데 기준, 높이 h)
function im(key, cx, cy, h, o = {}) {
  const I = IMG[key]; if (!I) return; const { rot = 0, sc = 1, sx = 1, sy = 1, alpha = 1, flip = false, bottom = false, glow = null } = o;
  if (alpha <= 0.002 || sc <= 0.002) return;
  const w = (I.width * h) / I.height;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc * sx * (flip ? -1 : 1), sc * sy); ctx.globalAlpha *= alpha;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 40; }
  ctx.drawImage(I, -w / 2, bottom ? -h : -h / 2, w, h); ctx.restore();
}
// 배경 그림으로 화면 채우기(초점 fx,fy)
function cover(key, sc = 1, fx = 0.5, fy = 0.5, filter = null, alpha = 1) {
  const I = IMG[key], s = Math.max(W / I.width, H / I.height) * sc, w = I.width * s, h = I.height * s;
  const x = clamp(W / 2 - fx * w, W - w, 0), y = clamp(H / 2 - fy * h, H - h, 0);
  ctx.save(); ctx.globalAlpha *= alpha; if (filter) ctx.filter = filter; ctx.drawImage(I, x, y, w, h); ctx.restore();
}
function fillBg(c1, c2 = null) { if (c2) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; } else ctx.fillStyle = c1; ctx.fillRect(-60, -60, W + 120, H + 120); }
function radial(cx, cy, r0, r1, c0, c1) { const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120); }
function rays(cx, cy, n, rot, c1, c2, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(cx, cy); ctx.rotate(rot);
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? c1 : c2; const a0 = (i * 2 * Math.PI) / n, a1 = ((i + 1) * 2 * Math.PI) / n; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 2600, a0, a1); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function dots(t, color, gap = 96, r = 9, speed = 36) {
  ctx.save(); ctx.fillStyle = color; const off = (t * speed) % gap;
  for (let j = -2; j < H / gap + 2; j++) for (let i = -2; i < W / gap + 2; i++) { ctx.beginPath(); ctx.arc(i * gap + off + (j % 2 ? gap / 2 : 0), j * gap + off, r, 0, 7); ctx.fill(); }
  ctx.restore();
}
function vignette(a = 0.45, inner = 0.45) { const g = ctx.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, H * 1.05); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120); }
function speedLines(cx, cy, t, n = 80, color = "rgba(255,255,255,.85)", inner = 420) {
  ctx.save(); ctx.fillStyle = color; const fr = Math.floor(t * 24);
  for (let i = 0; i < n; i++) {
    const a = hash(i, 7 + fr) * Math.PI * 2, wd = 0.003 + hash(i, 8 + fr) * 0.01, r0 = inner + hash(i, 9 + fr) * 360;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - wd) * 2600, cy + Math.sin(a - wd) * 2600); ctx.lineTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a + wd) * 2600, cy + Math.sin(a + wd) * 2600); ctx.fill();
  }
  ctx.restore();
}
function star4(x, y, r, rot = 0, color = "#fff") { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = color; ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r, a = (i * Math.PI) / 4; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.restore(); }
function sparkles(t, n, seed, area = [0, 0, W, H], color = "#fff", size = 26) {
  for (let i = 0; i < n; i++) {
    const per = 1.2 + hash(i, seed) * 1.4, ph = (t / per + hash(i, seed + 1)) % 1, k = Math.floor(t / per + hash(i, seed + 1));
    const x = area[0] + hash(i * 31 + k, seed + 2) * area[2], y = area[1] + hash(i * 17 + k, seed + 3) * area[3], s = Math.sin(ph * Math.PI);
    ctx.save(); ctx.globalAlpha *= s; star4(x, y, size * (0.5 + hash(i, seed + 4)) * s, ph * 2, color); ctx.restore();
  }
}
function petals(t, n = 46, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha;
  for (let i = 0; i < n; i++) {
    const sp = 70 + hash(i, 2) * 90, y = ((hash(i, 3) * 1.4 * H + t * sp) % (1.4 * H)) - 0.2 * H, x = ((hash(i, 1) * 1.4 * W - t * sp * 0.7 + Math.sin(t * 1.3 + i) * 50) % (1.4 * W) + 1.4 * W) % (1.4 * W) - 0.2 * W;
    const s = 9 + hash(i, 4) * 14; ctx.save(); ctx.translate(x, y); ctx.rotate(t * (1 + hash(i, 5)) + i); ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 3 + i));
    ctx.fillStyle = i % 3 ? "#ffc9df" : "#ffb0cf"; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.62, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
function smokePuffs(t, n, seed, color = "80,70,60", alpha = 0.5, rise = 40, area = [0, H * 0.5, W, H * 0.6], size = 180) {
  for (let i = 0; i < n; i++) {
    const x = area[0] + hash(i, seed) * area[2] + Math.sin(t * 0.4 + i) * 60, y = area[1] + hash(i, seed + 1) * area[3] - ((t * rise * (0.6 + hash(i, seed + 2))) % 300), r = size * (0.6 + hash(i, seed + 3) * 0.8);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${color},${alpha})`); g.addColorStop(1, `rgba(${color},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function confetti(t, t0, cx, cy, n = 90, seed = 1, power = 1) {
  if (t < t0) return; const dt = t - t0; if (dt > 2.6) return; const cols = ["#FFD83A", "#FF6FA5", "#48B8FF", "#3ED88A", "#FFFFFF", "#B98CFF"];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (hash(i, seed) - 0.5) * 2.6, v = (900 + hash(i, seed + 1) * 1300) * power, x = cx + Math.cos(a) * v * dt * 0.8, y = cy + Math.sin(a) * v * dt + 1500 * dt * dt;
    ctx.save(); ctx.globalAlpha *= clamp(2.6 - dt); ctx.translate(x, y); ctx.rotate(dt * (4 + hash(i, seed + 2) * 8)); ctx.scale(1, Math.cos(dt * 9 + i));
    ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-9, -5, 18, 10); ctx.restore();
  }
}
function burst(t, t0, cx, cy, color = "#fff", r1 = 520, d = 0.45) { // 퍼지는 고리
  if (t < t0 || t > t0 + d) return; const p = P(t, t0, t0 + d);
  ctx.save(); ctx.globalAlpha *= 1 - p; ctx.strokeStyle = color; ctx.lineWidth = 40 * (1 - p) + 2; ctx.beginPath(); ctx.arc(cx, cy, 40 + E.out3(p) * r1, 0, 7); ctx.stroke(); ctx.restore();
}
function pill(x, y, w, h, bg, text, o = {}) { ctx.save(); ctx.fillStyle = bg; rrect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); if (o.border) { ctx.lineWidth = o.border; ctx.strokeStyle = o.borderColor || "#fff"; ctx.stroke(); } ctx.restore(); txt(text, x, y + (o.dy ?? 2), { font: o.font || "Jua", size: o.size || h * 0.55, fill: o.color || "#fff", sw: o.sw ?? 0, stroke: o.stroke || "#24124a", shadow: false }); }
// 흔들림·번쩍임
const SHAKES = [], FLASHES = [];
const shake = (t0, amp, dur = 0.5) => SHAKES.push({ t0, amp, dur });
const flash = (t0, dur = 0.18, color = "255,255,255", a = 1) => FLASHES.push({ t0, dur, color, a });
function shakeOffset(t) { let x = 0, y = 0; for (const s of SHAKES) { if (t < s.t0 || t > s.t0 + s.dur) continue; const k = s.amp * Math.pow(1 - P(t, s.t0, s.t0 + s.dur), 2); x += noise(t * 38, 11) * k; y += noise(t * 38, 23) * k; } return [x, y]; }
function drawFlashes(t) { for (const f of FLASHES) { if (t < f.t0 || t > f.t0 + f.dur) continue; ctx.fillStyle = `rgba(${f.color},${f.a * (1 - P(t, f.t0, f.t0 + f.dur))})`; ctx.fillRect(-60, -60, W + 120, H + 120); } }

// ---------- 게임 장면 ----------
const READERS = new Map();
async function clipFrame(cut, t) {
  let r = READERS.get(cut); if (!r) { r = CLIPS[cut.clip].reader(cut.from); READERS.set(cut, r); }
  return r.frameAt(cut.from + (t - cut.start) * (cut.speed || 1));
}
function closeReaders(t) { for (const [cut, r] of READERS) if (t > cut.end + 0.05) { r.close(); READERS.delete(cut); } }
async function gameplay(t, cut) {
  const f = await clipFrame(cut, t), p = P(t, cut.start, cut.end), punch = 1 + (cut.punch ?? 0.12) * (1 - E.out3(P(t, cut.start, cut.start + 0.32)));
  const z = lerp(cut.z0 ?? 1.02, cut.z1 ?? 1.07, E.sine(p)) * punch;
  // 초점(fx,fy)을 가운데로: 확대해도 영상 밖(검은 곳)이 보이지 않게 가둔다
  const hw = W / (2 * z), hh = H / (2 * z), fx = clamp(cut.fx ?? W / 2, hw, W - hw), fy = clamp(cut.fy ?? H / 2, hh, H - hh);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-fx, -fy);
  ctx.filter = "saturate(1.18) contrast(1.06)"; if (f) ctx.drawImage(f, 0, 0, W, H); ctx.restore();
  vignette(0.42, 0.5);
}
function gameTag(t, t0) { const a = P(t, t0, t0 + 0.2); if (a <= 0) return; ctx.save(); ctx.globalAlpha = a * 0.92; pill(158, 62, 236, 50, "rgba(15,8,30,.62)", "실제 게임 화면", { size: 27 }); ctx.restore(); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#ff4d4d"; ctx.beginPath(); ctx.arc(62, 62, 8, 0, 7); ctx.fill(); ctx.restore(); }
// 아래쪽 자막 띠(비스듬한 띠 + 노란 줄). parts = [["글", "#색"], ...]
function caption(t, t0, parts, o = {}) {
  const p = E.out5(P(t, t0, t0 + 0.3)); if (p <= 0) return; const size = o.size || 78, font = "Black Han Sans", y = o.y || 948;
  const segs = parts.map((s) => (Array.isArray(s) ? s : [s, "#fff"])), ws = segs.map(([s]) => measure(s, size, font)), tw = ws.reduce((a, b) => a + b, 0);
  const h = size * 1.62, sk = 44, bw = tw + 210, x0 = -bw - 80 + p * (bw + 80);
  ctx.save(); ctx.translate(x0, 0);
  ctx.fillStyle = "rgba(24,12,52,.9)"; poly([[0, y - h / 2], [bw, y - h / 2], [bw - sk, y + h / 2], [0, y + h / 2]]);
  ctx.fillStyle = o.accent || "#FFD83A"; poly([[bw + 16, y - h / 2], [bw + 46, y - h / 2], [bw + 46 - sk, y + h / 2], [bw + 16 - sk, y + h / 2]]);
  ctx.fillStyle = o.accent || "#FFD83A"; ctx.fillRect(0, y - h / 2, 18, h);
  let x = 96; segs.forEach(([s, c], i) => { txt(s, x, y + 3, { font, size, fill: c, sw: 0, align: "left", shadow: false }); x += ws[i]; });
  ctx.restore();
}

// ---------- 장면 ----------
// 흔들림·번쩍임 예약(장면 함수 밖에서 한 번)
function schedule() {
  shake(B(8), 26, 0.6); flash(B(8), 0.25, "40,0,0", 0.7);
  shake(B(12), 22, 0.45); shake(B(12.5), 30, 0.5); flash(B(12.5), 0.12);
  flash(B(22), 0.3); shake(B(22), 16, 0.4);
  flash(B(24), 0.2); flash(B(28), 0.12); flash(B(32), 0.12); flash(B(36), 0.12);
  flash(B(40), 0.2); flash(B(50), 0.3, "255,236,160"); flash(B(54), 0.35, "255,230,140"); shake(B(50), 12, 0.3);
  flash(B(56), 0.15); flash(B(64), 0.2); flash(B(68), 0.12);
  flash(B(72), 0.1, "255,40,40", 0.8); shake(B(72), 14, 0.4); shake(B(73), 14, 0.4);
  flash(B(74), 0.22, "255,255,255"); shake(B(74), 34, 0.8); flash(B(76), 0.14); flash(B(80), 0.22); shake(B(80), 34, 0.8); flash(B(82), 0.14);
  for (let k = 0; k < 4; k++) flash(B(85 + k * 0.25), 0.07);
  flash(B(86), 0.6); shake(B(86), 10, 0.35);
}
const CUTS = {
  a1: { clip: "c1_hoya", start: B(24), end: B(28), from: 0.6, z0: 1.0, z1: 1.06 },
  a2: { clip: "c1_minji", start: B(28), end: B(32), from: 0.6, z0: 1.04, z1: 1.0 },
  a3: { clip: "c1_hoya", start: B(32), end: B(36), from: 4.6, z0: 1.1, z1: 1.18, punch: 0.18 },
  a4: { clip: "c1_minji", start: B(36), end: B(40), from: 4.8, z0: 1.02, z1: 1.1 },
  b1: { clip: "c2_hoya", start: B(64), end: B(68), from: 0.8, z0: 1.0, z1: 1.07 },
  b2: { clip: "c2_minji", start: B(68), end: B(72), from: 0.8, z0: 1.06, z1: 1.0 },
  k2: { clip: "boss2", start: B(76), end: B(80), from: 0.0, z0: 1.2, z1: 1.3, fx: 1180, fy: 560 },
  k1: { clip: "boss1", start: B(82), end: B(85), from: 0.4, z0: 1.15, z1: 1.25, fx: 1040, fy: 520 },
  m1: { clip: "c1_hoya", start: B(85), end: B(85.25), from: 7.5, punch: 0.2 },
  m2: { clip: "c2_minji", start: B(85.25), end: B(85.5), from: 6.5, punch: 0.2 },
  m3: { clip: "boss2", start: B(85.5), end: B(85.75), from: 1.35, punch: 0.2, z0: 1.3, z1: 1.3, fx: 1250, fy: 520 },
  m4: { clip: "c1_minji", start: B(85.75), end: B(86), from: 8.2, punch: 0.2 },
};

async function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = "none";
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const [sx, sy] = shakeOffset(t); ctx.translate(sx, sy);
  if (t < B(8)) sIntro(t);
  else if (t < B(16)) sThreat(t);
  else if (t < B(24)) sHeroes(t);
  else if (t < B(40)) await sPlay1(t);
  else if (t < B(48)) sPets(t);
  else if (t < B(56)) sGear(t);
  else if (t < B(64)) sChapter2(t);
  else if (t < B(72)) await sPlay2(t);
  else if (t < B(86)) await sBoss(t);
  else sLogo(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0); drawFlashes(t);
  // 맨 처음·끝 검은 화면
  const blackIn = 1 - P(t, 0, 1.0), blackOut = P(t, END - 0.9, END - 0.05); const k = Math.max(blackIn, blackOut);
  if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
  closeReaders(t);
}

// 1. 평화로운 마을
function sIntro(t) {
  const p = P(t, 0, B(8));
  cover("land", lerp(1.0, 1.12, E.sine(p)), 0.5, 0.42);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(255,170,120,.25)"); g.addColorStop(0.5, "rgba(255,200,160,0)"); g.addColorStop(1, "rgba(60,20,60,.25)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  petals(t, 46);
  sparkles(t, 14, 3, [0, 0, W, H * 0.5], "rgba(255,245,220,.9)", 16);
  vignette(0.35, 0.55);
  // 영화 같은 위아래 띠
  const lb = 92 * E.out3(P(t, 0.2, 1.4)); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, lb); ctx.fillRect(0, H - lb, W, lb);
  const a1 = P(t, B(1.5), B(2.5)) * (1 - P(t, B(6.4), B(7.2)));
  txt("오늘도 평화로운", W / 2, 790 - (1 - E.out3(P(t, B(1.5), B(2.8)))) * 30, { font: "Jua", size: 58, fill: "#fff", sw: 0, alpha: a1, track: 6 });
  const a2 = P(t, B(3), B(4)) * (1 - P(t, B(6.4), B(7.2)));
  txt("서호 마을", W / 2, 880 - (1 - E.out3(P(t, B(3), B(4.3)))) * 30, { font: "Bagel Fat One", size: 104, grad: ["#fff6d8", "#ffd0e4"], stroke: "#5a2a4a", sw: 14, alpha: a2, track: 8 });
  // 끝 무렵 하늘이 어두워짐
  const dark = P(t, B(6.5), B(8)); if (dark > 0) { ctx.fillStyle = `rgba(40,30,20,${dark * 0.55})`; ctx.fillRect(0, 0, W, H); }
}

// 2. 쓰레기 몬스터 등장
const MONS = [
  { k: "snack", x: 330, y: 840, h: 300, b: 9 }, { k: "bottle", x: 1600, y: 850, h: 330, b: 9.5 }, { k: "baggy", x: 700, y: 640, h: 250, b: 10 },
  { k: "butt", x: 1250, y: 700, h: 200, b: 10.5 }, { k: "fly", x: 1450, y: 330, h: 190, b: 11 }, { k: "food", x: 960, y: 900, h: 300, b: 11.5 }, { k: "fly", x: 420, y: 330, h: 150, b: 11.25, flip: true },
];
function sThreat(t) {
  const p = P(t, B(8), B(16));
  cover("land", lerp(1.12, 1.2, p), 0.5, 0.42, "saturate(0.25) brightness(0.62) sepia(0.45) hue-rotate(40deg)");
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(70,80,40,.55)"); g.addColorStop(1, "rgba(30,25,20,.35)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  smokePuffs(t, 14, 40, "70,70,55", 0.55, 50, [-100, H * 0.55, W + 200, H * 0.5], 230);
  smokePuffs(t, 8, 60, "90,95,70", 0.4, 20, [-100, -100, W + 200, H * 0.4], 260);
  for (const m of MONS) {
    const t0 = B(m.b); if (t < t0) continue; const q2 = P(t, t0, t0 + 0.42), sc = E.back(q2, 2.2), bob = Math.sin((t - t0) * 7 + m.x) * 8;
    const sq = 1 + Math.sin(q2 * Math.PI) * 0.18; // 착지 찌그러짐
    ctx.save(); ctx.globalAlpha = 0.35 * sc; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(m.x, m.y + m.h * 0.48, m.h * 0.32, m.h * 0.08, 0, 0, 7); ctx.fill(); ctx.restore();
    im(m.k, m.x, m.y + bob - (1 - E.out3(q2)) * 220, m.h, { sc, sx: sq, sy: 2 - sq, flip: m.flip, rot: Math.sin(t * 3 + m.x) * 0.05 });
    burst(t, t0, m.x, m.y, "rgba(255,255,255,.8)", 180, 0.35);
  }
  // 글자 쾅
  const s1 = slam(t, B(12)), s2 = slam(t, B(12.5), 0.24, 2.8);
  if (t > B(12)) { ctx.save(); ctx.globalAlpha = 0.55 * P(t, B(12), B(12.3)); speedLines(W / 2, 470, t, 70, "rgba(255,255,240,.55)", 520); ctx.restore(); }
  txt("쓰레기 몬스터가", W / 2, 380, { size: 118, fill: "#fff", stroke: "#1b0f33", sw: 20, rot: -0.05, sc: s1.sc, alpha: s1.a });
  txt("나타났다!", W / 2 + 30, 540, { size: 190, grad: ["#FFF27A", "#FFB21E"], stroke: "#1b0f33", sw: 26, outer: "#fff", ow: 10, rot: -0.05, sc: s2.sc, alpha: s2.a });
  // 끝: 파란 대각선 닦기
  wipeDiag(t, B(15.3), B(16), "#48B8FF");
}
function wipeDiag(t, t0, t1, color) { const p = E.io(P(t, t0, t1)); if (p <= 0) return; const x = lerp(-W * 0.4, W * 1.4, p); ctx.fillStyle = color; poly([[x - 900, 0], [x + 300, 0], [x - 100, H], [x - 1300, H]]); ctx.fillStyle = "#fff"; poly([[x + 300, 0], [x + 360, 0], [x - 40, H], [x - 100, H]]); }

// 3. 주인공
function sHeroes(t) {
  const p = P(t, B(16), B(24));
  fillBg("#6fd0ff", "#2f9df0"); rays(W / 2, 600, 28, t * 0.12, "rgba(255,255,255,.14)", "rgba(255,255,255,0)"); dots(t, "rgba(255,255,255,.12)", 90, 8, 30);
  // 오른쪽 분홍 반쪽(민지 등장 때)
  const pk = E.out3(P(t, B(18), B(18.5))); if (pk > 0) { ctx.fillStyle = "#ff8fc4"; poly([[W + 40 - pk * 900, 0], [W + 40, 0], [W + 40, H], [W + 40 - pk * 900 - 260, H]]); ctx.fillStyle = "#fff"; poly([[W + 40 - pk * 900 - 36, 0], [W + 40 - pk * 900, 0], [W + 40 - pk * 900 - 260, H], [W + 40 - pk * 900 - 296, H]]); }
  const zo = 1 + 0.35 * E.in3(P(t, B(23.4), B(24)));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(zo, zo); ctx.translate(-W / 2, -H / 2);
  // 호야
  const hx = lerp(-500, 560, E.back(P(t, B(16), B(16.9)), 1.4)), hb = Math.sin(t * 4) * 8;
  if (t > B(16)) im("hoya", hx, 1110 + hb, 820, { bottom: true, rot: Math.sin(t * 2) * 0.02 });
  const mx = lerp(W + 500, 1370, E.back(P(t, B(18), B(18.9)), 1.4)), mb = Math.sin(t * 4 + 1) * 8;
  if (t > B(18)) im("minji", mx, 1110 + mb, 820, { bottom: true, rot: Math.sin(t * 2 + 1) * 0.02 });
  const n1 = pop(t, B(17), 0.35), n2 = pop(t, B(19), 0.35);
  if (n1 > 0) { ctx.save(); ctx.translate(560, 250); ctx.scale(n1, n1); ctx.rotate(-0.06); pill(0, 0, 230, 92, "#1f5fbf", "호야", { size: 62, border: 7, borderColor: "#fff" }); ctx.restore(); }
  if (n2 > 0) { ctx.save(); ctx.translate(1370, 250); ctx.scale(n2, n2); ctx.rotate(0.06); pill(0, 0, 230, 92, "#d94f93", "민지", { size: 62, border: 7, borderColor: "#fff" }); ctx.restore(); }
  const top = E.out3(P(t, B(20), B(20.6)));
  txt("마을을 지킬 우리들은", W / 2, lerp(-80, 110, top), { font: "Jua", size: 70, fill: "#fff", stroke: "#1b3b7a", sw: 14, alpha: top });
  const s = pop(t, B(22), 0.42, 2.8);
  if (s > 0) { ctx.save(); ctx.globalAlpha = 0.7; rays(W / 2, 900, 20, -t * 0.5, "rgba(255,240,150,.35)", "rgba(255,255,255,0)", clamp(s)); ctx.restore(); }
  txt("서호 수호대!", W / 2, 900, { font: "Bagel Fat One", size: 200, grad: ["#FFF6A0", "#FFC21E", "#FF8A1E"], stroke: "#3a1a5c", sw: 26, outer: "#fff", ow: 12, sc: s, rot: -0.04 + Math.sin(t * 3) * 0.01 });
  confetti(t, B(22), W / 2, 900, 110, 5, 1.2);
  ctx.restore();
}

// 4. 1장 게임 장면
const ELEMENTS = [["skF", "불", "#FF6A2A"], ["skW", "물", "#2AA8FF"], ["skV", "바람", "#3ED88A"], ["skE", "흙", "#C48A3F"], ["skL", "번개", "#FFD83A"]];
async function sPlay1(t) {
  const cut = t < B(28) ? CUTS.a1 : t < B(32) ? CUTS.a2 : t < B(36) ? CUTS.a3 : CUTS.a4;
  await gameplay(t, cut); gameTag(t, B(24));
  if (cut === CUTS.a1) caption(t, B(24.3), ["몰려오는 ", ["쓰레기 몬스터", "#FFD83A"], "를 막아라!"]);
  if (cut === CUTS.a2) {
    caption(t, B(28.3), [["5가지 원소", "#FFD83A"], " 스킬!"]);
    ELEMENTS.forEach(([k, name, c], i) => {
      const s = pop(t, B(28.6 + i * 0.5), 0.36, 2.2); if (s <= 0) return; const x = 1030 + i * 180, y = 780 + Math.sin(t * 4 + i) * 6;
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.beginPath(); ctx.arc(0, 0, 76, 0, 7); ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = c; ctx.stroke(); ctx.restore();
      im(k, x, y - 4, 118, { sc: s }); ctx.save(); ctx.translate(x, y + 104); ctx.scale(s, s); pill(0, 0, 110, 50, c, name, { size: 32, color: "#fff", sw: 5, stroke: "rgba(0,0,0,.35)" }); ctx.restore();
    });
  }
  if (cut === CUTS.a3) caption(t, B(32.3), ["스킬을 모으면 ", ["진화!", "#7CF0FF"]], { accent: "#7CF0FF" });
  if (cut === CUTS.a4) caption(t, B(36.3), ["한 번에 ", ["싹쓸이!", "#FFD83A"]]);
  // 끝: 초록 원 닦기
  const w = E.in3(P(t, B(39.4), B(40))); if (w > 0) { ctx.fillStyle = "#bff0d8"; ctx.beginPath(); ctx.arc(W / 2, H / 2, w * 1200, 0, 7); ctx.fill(); }
}

// 5. 친구 4마리
const PETS = [["turtle", "꼬북이", "튼튼하게 지켜 줘요", "#82b876"], ["cat", "야옹이", "빠르게 달려요", "#efac6a"], ["otter", "수달이", "공격이 세져요", "#70bdd1"], ["deer", "아기사슴", "더 많이 모아요", "#a7be70"]];
function sPets(t) {
  fillBg("#d9f7e8", "#aee8cf"); dots(t, "rgba(255,255,255,.55)", 100, 12, 40); rays(W / 2, 1300, 30, t * 0.08, "rgba(255,255,255,.18)", "rgba(255,255,255,0)");
  const s = pop(t, B(40.2), 0.4, 2.4);
  txt("든든한 친구들", W / 2, 150, { font: "Bagel Fat One", size: 118, grad: ["#ffffff", "#c8ffd9"], stroke: "#1f6b4a", sw: 20, sc: s });
  PETS.forEach(([k, name, ab, c], i) => {
    const x = 330 + i * 420, s2 = pop(t, B(41 + i), 0.42, 2.0); if (s2 <= 0) return; const y = 600 + Math.sin(t * 3 + i * 1.3) * 10, rot = (i % 2 ? 0.035 : -0.035) + Math.sin(t * 2 + i) * 0.01;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s2, s2);
    ctx.fillStyle = "rgba(31,107,74,.25)"; rrect(-172, -222, 352, 468, 40); ctx.fill();
    ctx.fillStyle = "#fff"; rrect(-180, -232, 360, 468, 40); ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = c; ctx.stroke();
    ctx.fillStyle = c; ctx.globalAlpha = 0.28; rrect(-160, -212, 320, 270, 30); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s2, s2);
    im(k, 0, -80 + Math.sin(t * 5 + i) * 6, 290);
    txt(name, 0, 110, { font: "Jua", size: 62, fill: "#34403a", sw: 0, shadow: false });
    ctx.restore();
    const s3 = pop(t, B(41.5 + i), 0.35); if (s3 > 0) { ctx.save(); ctx.translate(x, y + 180); ctx.rotate(rot); ctx.scale(s3, s3); pill(0, 0, 300, 62, c, ab, { size: 32, sw: 5, stroke: "rgba(0,0,0,.25)" }); ctx.restore(); }
    burst(t, B(41 + i), x, y, "rgba(255,255,255,.9)", 260, 0.35);
  });
  const s4 = pop(t, B(45.5), 0.4);
  txt("친구와 함께 더 강하게!", W / 2, 985, { font: "Black Han Sans", size: 76, fill: "#fff", stroke: "#1f6b4a", sw: 16, sc: s4 });
  sparkles(t, 16, 9, [0, 0, W, H], "rgba(255,255,255,.95)", 22);
  const w = E.in3(P(t, B(47.4), B(48))); if (w > 0) { ctx.fillStyle = "#2a1650"; ctx.beginPath(); ctx.arc(W / 2, H / 2, w * 1200, 0, 7); ctx.fill(); }
}

// 6. 장비 보급
const GEAR = ["g1", "g2", "g3", "g4", "g5", "g6"], GRADES = [["노말", "#9aa8b1"], ["레어", "#4f95d6"], ["유니크", "#9a6bd6"], ["에픽", "#ec8a3a"], ["전설", "#e0b53c"]];
function sGear(t) {
  radial(W / 2, 560, 60, 1100, "#5a2f9a", "#1c0d38");
  const lit = t < B(52) ? -1 : Math.min(4, Math.floor((t - B(52)) / (BEAT * 0.5)));
  const gc = lit < 0 ? "#9aa8b1" : GRADES[lit][1];
  rays(W / 2, 560, 24, t * 0.25, "rgba(255,220,120,.10)", "rgba(255,255,255,0)", t > B(50) ? 1 : 0.3);
  sparkles(t, 24, 12, [0, 0, W, H], "rgba(255,230,160,.9)", 20);
  txt("보물 상자에서 장비가 펑!", W / 2, 130, { font: "Black Han Sans", size: 92, grad: ["#ffffff", "#ffe7a0"], stroke: "#1c0d38", sw: 18, sc: pop(t, B(48.3), 0.4) });
  // 상자
  const open = t >= B(50), drop = E.out3(P(t, B(48), B(48.6))), wig = t > B(49) && !open ? Math.sin(t * 60) * 0.06 * P(t, B(49), B(50)) : 0;
  const cy = lerp(-300, 600, drop) + (open ? 0 : 0), csc = open ? 1 + 0.12 * (1 - E.out3(P(t, B(50), B(50.4)))) : 1;
  if (open) { ctx.save(); ctx.globalAlpha = 0.9 * clamp(1 - P(t, B(50), B(51.5)) + 0.4); radial(W / 2, 520, 10, 520, "rgba(255,240,170,.85)", "rgba(255,240,170,0)"); ctx.restore(); }
  im(open ? "chestO" : "chestC", W / 2, cy, 330, { rot: wig, sc: csc });
  burst(t, B(48.6), W / 2, 700, "rgba(255,255,255,.7)", 300, 0.3);
  burst(t, B(50), W / 2, 540, "rgba(255,240,170,.95)", 700, 0.5);
  // 장비가 날아 나와 둥글게
  GEAR.forEach((k, i) => {
    const t0 = B(50 + i * 0.25); if (t < t0) return; const q2 = E.out3(P(t, t0, t0 + 0.45)), a = Math.PI + ((i + 0.5) / 6) * Math.PI;
    const tx = W / 2 + Math.cos(a) * 640, ty = 650 + Math.sin(a) * 390; const ox = W / 2, oy = 540;
    const x = lerp(ox, tx, q2), y = lerp(oy, ty, q2) - Math.sin(q2 * Math.PI) * 220, bob = Math.sin(t * 4 + i) * 8;
    const tile = 150, gl = lit >= 0 ? pop(t, B(52 + lit * 0.5), 0.3, 2) : 1;
    ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(t * 2 + i) * 0.05);
    ctx.shadowColor = gc; ctx.shadowBlur = lit >= 3 ? 50 : 20;
    ctx.fillStyle = "#fff"; rrect(-tile / 2, -tile / 2, tile, tile, 30); ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 12; ctx.strokeStyle = gc; ctx.stroke();
    ctx.restore();
    im(k, x, y + bob, 118, { sc: lerp(0.4, 1, q2) * (lit >= 0 ? lerp(1.15, 1, clamp(gl)) : 1) });
  });
  // 등급 사다리
  if (t > B(51.8)) {
    GRADES.forEach(([n, c], i) => {
      const x = W / 2 + (i - 2) * 230, on = i <= lit, s = pop(t, B(51.8 + i * 0.08), 0.3);
      ctx.save(); ctx.translate(x, 965); ctx.scale(s * (i === lit ? 1.18 : 1), s * (i === lit ? 1.18 : 1)); ctx.globalAlpha = on ? 1 : 0.45;
      pill(0, 0, 200, 76, on ? c : "#3b2a5c", n, { size: 40, border: on ? 6 : 3, borderColor: on ? "#fff" : "#6d5a91", sw: on ? 6 : 0, stroke: "rgba(0,0,0,.3)" }); ctx.restore();
    });
  }
  if (t > B(54)) { const s = pop(t, B(54), 0.4, 2.6); txt("전설 등급!", W / 2, 560, { font: "Bagel Fat One", size: 160, grad: ["#fffbe0", "#ffd84a", "#ff9d1a"], stroke: "#3a1a00", sw: 22, outer: "#fff", ow: 10, sc: s, rot: -0.05 }); confetti(t, B(54), W / 2, 600, 80, 21, 0.9); }
  wipeDiag(t, B(55.3), B(56), "#c9bba0");
}

// 7. 2장 소개
const T2 = [{ k: "dust", x: 190, y: 860, h: 190, b: 60 }, { k: "gas", x: 440, y: 880, h: 220, b: 60.5 }, { k: "rain", x: 700, y: 840, h: 210, b: 61 }, { k: "germ", x: 945, y: 900, h: 190, b: 61.5 }, { k: "bigdust", x: 1790, y: 930, h: 260, b: 62 }];
function sChapter2(t) {
  fillBg("#cdbf9d", "#8a7c63"); smokePuffs(t, 16, 70, "70,65,55", 0.5, 30, [-100, -150, W + 200, H + 200], 280);
  const cin = E.out3(P(t, B(56), B(56.8))), cx = lerp(W + 500, 1420, cin), rot = lerp(0.3, 0.06, cin) + Math.sin(t * 1.5) * 0.01;
  ctx.save(); ctx.translate(cx, 520); ctx.rotate(rot);
  ctx.fillStyle = "rgba(0,0,0,.3)"; rrect(-352, -362, 720, 760, 30); ctx.fill(); ctx.fillStyle = "#fff8e8"; rrect(-370, -380, 740, 776, 30); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(cx, 520); ctx.rotate(rot); im("polluted", 0, 8, 720); ctx.restore();
  smokePuffs(t, 10, 90, "50,45,40", 0.45, 60, [1000, 0, 900, 700], 200);
  const l = pop(t, B(56.6), 0.35); if (l > 0) { ctx.save(); ctx.translate(430, 230); ctx.scale(l, l); pill(0, 0, 360, 88, "#3b3326", "새로운 무대!", { size: 50, color: "#ffe9a8" }); ctx.restore(); }
  txt("2장", 430, 430, { font: "Bagel Fat One", size: 230, grad: ["#fff7cf", "#c9c09a", "#8e8a70"], stroke: "#2a2418", sw: 26, sc: pop(t, B(57), 0.4, 2.4), rot: -0.04 });
  txt("대기오염 공장 지대", 470, 620, { font: "Black Han Sans", size: 100, fill: "#fff", stroke: "#2a2418", sw: 18, sc: pop(t, B(57.8), 0.4, 2.2) });
  for (const m of T2) {
    const t0 = B(m.b); if (t < t0) continue; const q2 = P(t, t0, t0 + 0.42), sc = E.back(q2, 2.2), bob = Math.sin((t - t0) * 6 + m.x) * 8;
    im(m.k, m.x, m.y + bob - (1 - E.out3(q2)) * 200, m.h, { sc, rot: Math.sin(t * 3 + m.x) * 0.06 }); burst(t, t0, m.x, m.y, "rgba(255,255,255,.7)", 160, 0.3);
  }
  // 연기로 덮으며 넘어가기
  const w = P(t, B(62.8), B(64)); if (w > 0) { for (let i = 0; i < 14; i++) { const x = hash(i, 5) * W, y = hash(i, 6) * H, r = E.in3(w) * (500 + hash(i, 7) * 500); const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(90,84,70,1)"); g.addColorStop(0.7, "rgba(90,84,70,.95)"); g.addColorStop(1, "rgba(90,84,70,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }
}

// 8. 2장 게임 장면
async function sPlay2(t) {
  const cut = t < B(68) ? CUTS.b1 : CUTS.b2;
  await gameplay(t, cut); gameTag(t, B(64));
  if (cut === CUTS.b1) caption(t, B(64.3), [["먼지몬", "#FFD83A"], "·", ["가스몬", "#FFD83A"], "을 막아라!"]);
  else caption(t, B(68.3), ["맑은 하늘을 ", ["되찾자!", "#7CF0FF"]], { accent: "#7CF0FF" });
  const r = P(t, B(64), B(64.8)); if (r < 1) { ctx.save(); ctx.globalAlpha = 1 - r; ctx.fillStyle = "rgb(90,84,70)"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

// 9. 대왕
async function sBoss(t) {
  if (t < B(74)) return sWarning(t);
  if (t < B(76)) return sBossReveal(t, "boss2", "굴뚝 가스 대왕", "2장 대왕", B(74), false, "#FF7A2A");
  if (t < B(80)) { await gameplay(t, CUTS.k2); gameTag(t, B(76)); return caption(t, B(76.3), ["거대한 ", ["대왕", "#FF7A5A"], "을 물리쳐라!"], { accent: "#FF7A5A" }); }
  if (t < B(82)) return sBossReveal(t, "boss1", "쓰레기 산 대왕", "1장 대왕", B(80), true, "#A6E05A");
  if (t < B(85)) { await gameplay(t, CUTS.k1); gameTag(t, B(82)); return caption(t, B(82.3), ["힘을 합쳐 ", ["마을을 지켜라!", "#FFD83A"]]); }
  const m = t < B(85.25) ? CUTS.m1 : t < B(85.5) ? CUTS.m2 : t < B(85.75) ? CUTS.m3 : CUTS.m4; await gameplay(t, m);
  const s = E.in3(P(t, B(85.5), B(86))); if (s > 0) { ctx.fillStyle = `rgba(255,255,255,${s * 0.8})`; ctx.fillRect(0, 0, W, H); }
}
function bossBar(t, t0, left, name) { // 대왕 이름과 체력(영상용 장식)
  const a = P(t, t0 + 0.1, t0 + 0.35); if (a <= 0) return; const w = 900, x = W / 2 - w / 2, y = 60, k = lerp(left, left - 0.08, P(t, t0, t0 + BEAT * 4));
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "rgba(20,8,20,.7)"; rrect(x - 8, y - 8, w + 16, 52, 18); ctx.fill(); ctx.fillStyle = "#5a1020"; rrect(x, y, w, 36, 12); ctx.fill();
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, "#ff3b3b"); g.addColorStop(1, "#ff9a3b"); ctx.fillStyle = g; rrect(x, y, w * k, 36, 12); ctx.fill(); ctx.restore();
  txt(name, W / 2, y + 74, { font: "Black Han Sans", size: 40, fill: "#fff", stroke: "#2a0a10", sw: 10, alpha: a });
}
function hazard(y, h, off) { ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip(); ctx.fillStyle = "#ffcc00"; ctx.fillRect(0, y, W, h); ctx.fillStyle = "#111"; for (let x = -200 + (off % 120); x < W + 200; x += 120) poly([[x, y], [x + 60, y], [x + 60 - h, y + h], [x - h, y + h]]); ctx.restore(); }
function sWarning(t) {
  const pulse = 0.5 + 0.5 * Math.cos(((t - B(72)) / (BEAT * 0.5)) * Math.PI * 2);
  fillBg("#140406"); radial(W / 2, H / 2, 50, 900, `rgba(200,0,20,${0.35 + pulse * 0.35})`, "rgba(0,0,0,0)");
  hazard(120, 90, t * 500); hazard(H - 210, 90, -t * 500);
  const on = Math.floor((t - B(72)) / (BEAT * 0.25)) % 2 === 0 || t > B(73);
  txt("경고!", W / 2, 470, { font: "Black Han Sans", size: 280, grad: ["#ff8080", "#ff1a1a", "#b00000"], stroke: "#fff", sw: 18, outer: "#3a0000", ow: 10, sc: pop(t, B(72), 0.3, 2.6) * (1 + pulse * 0.04), alpha: on ? 1 : 0.35 });
  txt("대왕이 나타났다!", W / 2, 700, { font: "Black Han Sans", size: 112, fill: "#fff", stroke: "#3a0000", sw: 18, sc: pop(t, B(73), 0.35, 2.4) });
}
function sBossReveal(t, key, name, tag, t0, mirror, col) {
  const p = P(t, t0, t0 + BEAT * 2);
  fillBg("#1a0610"); radial(mirror ? 1300 : 620, 540, 40, 1000, col + "88", "rgba(0,0,0,0)");
  speedLines(mirror ? 1300 : 620, 540, t, 90, "rgba(255,230,210,.28)", 480);
  const s = lerp(1.7, 1, E.out5(P(t, t0, t0 + 0.35))), bx = mirror ? 1300 : 620;
  im(key, bx + Math.sin(t * 30) * 3 * (1 - p), 560, 900, { sc: s * (1 + p * 0.05), glow: col });
  const nx = mirror ? 560 : 1360, sn = pop(t, t0 + 0.15, 0.35, 2.4);
  if (sn > 0) { ctx.save(); ctx.translate(nx, 430); ctx.scale(sn, sn); pill(0, 0, 220, 70, col, tag, { size: 40, color: "#1a0610" }); ctx.restore(); }
  txt(name, nx, 580, { font: "Black Han Sans", size: 128, grad: ["#ffffff", col], stroke: "#1a0610", sw: 20, outer: "#fff", ow: 6, sc: pop(t, t0 + 0.3, 0.38, 2.4), rot: mirror ? 0.04 : -0.04 });
}

// 10. 로고
function sLogo(t) {
  const t0 = B(86);
  cover("land", lerp(1.2, 1.1, E.out3(P(t, t0, t0 + 3))), 0.5, 0.45, "blur(5px) brightness(1.08) saturate(1.15)");
  ctx.fillStyle = "rgba(255,240,250,.25)"; ctx.fillRect(0, 0, W, H);
  rays(W / 2, 380, 32, t * 0.15, "rgba(255,255,255,.22)", "rgba(255,255,255,0)");
  petals(t, 36, 0.9); sparkles(t, 26, 30, [0, 0, W, H], "rgba(255,255,255,.95)", 24);
  // 주인공 양쪽
  const hy = E.back(P(t, B(89.5), B(90.3)), 1.6), my = E.back(P(t, B(90), B(90.8)), 1.6);
  if (hy > 0) im("hoya", 235, lerp(1600, 1125, hy) + Math.sin(t * 3) * 6, 600, { bottom: true, rot: -0.05 });
  if (my > 0) im("minji", 1685, lerp(1600, 1125, my) + Math.sin(t * 3 + 1) * 6, 600, { bottom: true, rot: 0.05 });
  // 엠블럼
  const e = E.elastic(P(t, t0, t0 + 1.0));
  im("emblem", W / 2, 300 + Math.sin(t * 2) * 6, 330, { sc: e, rot: (1 - clamp(e)) * -0.5 });
  // 제목 글자
  popWord("서호팡팡수호대", W / 2, 640, t, B(87), BEAT * 0.5, { font: "Bagel Fat One", size: 178, grad: ["#FFF7B0", "#FFD23A", "#FF9A1E"], stroke: "#3a1a5c", sw: 28, outer: "#fff", ow: 13, wave: 5 });
  // 빛 줄기 지나가기
  const sw = P(t, B(91), B(92.2)); if (sw > 0 && sw < 1) { ctx.save(); ctx.globalCompositeOperation = "overlay"; const x = lerp(200, 1720, E.io(sw)); const g = ctx.createLinearGradient(x - 160, 0, x + 160, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.translate(x, 640); ctx.transform(1, 0, -0.35, 1, 0, 0); ctx.fillRect(-160 - x + x, -130, 320, 260); ctx.restore(); }
  txt("우리 마을은 우리가 지킨다!", W / 2, 800, { font: "Jua", size: 66, fill: "#fff", stroke: "#3a1a5c", sw: 14, sc: pop(t, B(92), 0.4, 2.0) });
  // 출동 버튼
  const c = pop(t, B(94), 0.4, 2.2), beat = 1 + 0.04 * Math.max(0, Math.cos(((t - B(94)) / BEAT) * Math.PI * 2));
  if (c > 0) { ctx.save(); ctx.translate(W / 2, 925); ctx.scale(c * beat, c * beat); ctx.fillStyle = "rgba(58,26,92,.35)"; rrect(-262, -52, 540, 116, 58); ctx.fill(); ctx.fillStyle = "#FFD83A"; rrect(-270, -62, 540, 116, 58); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.restore(); txt("지금 바로 출동!", W / 2, 922, { font: "Black Han Sans", size: 64, fill: "#3a1a5c", sw: 0, shadow: false, sc: c * beat }); }
  const f = P(t, B(95), B(96));
  txt("서호초등학교 학생 개발팀", W / 2, 1030, { font: "Jua", size: 36, fill: "#fff", stroke: "#3a1a5c", sw: 8, alpha: f });
  confetti(t, B(94), W / 2, 950, 70, 33, 0.9);
}

// ---------- 소리(배경음 + 효과음) ----------
const SFX = [];
const sfx = (beat, name, gain = 0.5) => SFX.push({ t: B(beat), name, gain });
function scheduleSfx() {
  sfx(8, "hit_boss", 0.75);
  [9, 9.5, 10, 10.5, 11, 11.25, 11.5].forEach((b, i) => sfx(b, i % 2 ? "hit_light2" : "hit_light", 0.45));
  sfx(12, "hit_boss", 0.7); sfx(12.5, "hit_boss", 0.85);
  sfx(15.3, "attack_whoosh", 0.6); sfx(16, "attack_whoosh", 0.45); sfx(18, "attack_whoosh", 0.45); sfx(17, "ui_click", 0.4); sfx(19, "ui_click", 0.4);
  sfx(22, "levelup_open", 0.6); sfx(22, "hit_boss", 0.4); sfx(23.4, "attack_whoosh", 0.6);
  [24, 28, 32, 36].forEach((b) => sfx(b, "attack_slice", 0.4));
  [28.6, 29.1, 29.6, 30.1, 30.6].forEach((b) => sfx(b, "gem_pickup", 0.3));
  sfx(39.4, "attack_whoosh", 0.5); sfx(40.2, "card_select", 0.45);
  [41, 42, 43, 44].forEach((b) => sfx(b, "card_select", 0.5));
  sfx(47.4, "attack_whoosh", 0.5); sfx(48.6, "hit_light", 0.6); sfx(49, "ui_click", 0.3); sfx(49.5, "ui_click", 0.3);
  sfx(50, "levelup_open", 0.65); [0, 1, 2, 3, 4, 5].forEach((i) => sfx(50 + i * 0.25, "gem_pickup", 0.3));
  [52, 52.5, 53, 53.5].forEach((b) => sfx(b, "card_select", 0.4)); sfx(54, "gold_reward", 0.75);
  sfx(55.3, "attack_whoosh", 0.55); [60, 60.5, 61, 61.5, 62].forEach((b) => sfx(b, "hit_light", 0.4)); sfx(62.8, "attack_whoosh", 0.55);
  sfx(64, "attack_slice", 0.4); sfx(68, "attack_slice", 0.4);
  sfx(72, "boss_telegraph", 0.85); sfx(73, "boss_telegraph", 0.85);
  sfx(74, "hit_boss", 0.95); sfx(76, "attack_slice", 0.45); sfx(80, "hit_boss", 0.95); sfx(82, "attack_slice", 0.45);
  [85, 85.25, 85.5, 85.75].forEach((b) => sfx(b, "attack_slice", 0.35));
  sfx(86, "levelup_open", 0.7); sfx(86, "hit_boss", 0.45);
  [87, 87.5, 88, 88.5, 89, 89.5, 90].forEach((b) => sfx(b, "ui_click", 0.3));
  sfx(94, "gold_reward", 0.6);
}
async function buildAudio(from, to) {
  const SR = 48000, len = Math.ceil((to - from) * SR), oac = new OfflineAudioContext(2, len, SR);
  const dec = async (u) => oac.decodeAudioData(await (await fetch(u)).arrayBuffer());
  // 소리가 찢어지지 않게 마지막에 눌러 주기(리미터)
  const lim = oac.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 2; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.2; lim.connect(oac.destination);
  const master = oac.createGain(); master.gain.value = 0.95; master.connect(lim);
  const music = await dec(AS + "audio/main-theme.mp3");
  const mg = oac.createGain(); mg.gain.setValueAtTime(0.92, 0); const fo = END - 2.0 - from; if (fo > 0) { mg.gain.setValueAtTime(0.92, fo); mg.gain.linearRampToValueAtTime(0, END - 0.1 - from); }
  mg.connect(master); const ms = oac.createBufferSource(); ms.buffer = music; ms.connect(mg); ms.start(0, from);
  const cache = {};
  for (const s of SFX) {
    if (s.t < from || s.t > to) continue; cache[s.name] ||= await dec(AS + `audio/${s.name}.ogg`);
    const g = oac.createGain(); g.gain.value = s.gain; g.connect(master); const src = oac.createBufferSource(); src.buffer = cache[s.name]; src.connect(g); src.start(s.t - from);
  }
  return oac.startRendering();
}

// ---------- 실행 ----------
async function load() {
  await Promise.all(Object.entries(IMG_SRC).map(([k, p]) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[k] = i; res(); }; i.onerror = () => rej(new Error("그림 없음 " + p)); i.src = AS + p; })));
  const src = await (await fetch("./pv.js")).text(), chars = [...new Set(src.match(/[가-힣0-9!?·.,]/g))].join("");
  for (const f of ["Bagel Fat One", "Black Han Sans", "Jua"]) await document.fonts.load(`80px "${f}"`, chars);
  await Promise.all(CLIP_NAMES.map(async (n) => { try { CLIPS[n] = await openClip(`clips/${n}.bin`); } catch (e) { console.warn("장면 없음", n); } }));
  schedule(); scheduleSfx();
}
(async () => {
  try {
    await load();
    if (q.get("preview")) {
      const times = q.get("preview").split(",").map(Number).sort((a, b) => a - b), n = times.length, cols = n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols);
      const out = document.createElement("canvas"); out.width = W; out.height = H; const o = out.getContext("2d"); o.fillStyle = "#222"; o.fillRect(0, 0, W, H);
      const cw = W / cols, ch = H / rows, sc = Math.min(cw / W, ch / H);
      for (let i = 0; i < n; i++) { await frame(times[i]); const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; o.drawImage(cv, x, y, W * sc, H * sc); o.fillStyle = "rgba(0,0,0,.65)"; o.fillRect(x, y, 96, 30); o.fillStyle = "#fff"; o.font = "20px sans-serif"; o.fillText(times[i].toFixed(2), x + 8, y + 22); }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(out, 0, 0);
      window.__result = { preview: times }; window.__done = true; return;
    }
    if (q.get("render")) {
      const from = +(q.get("from") || 0), to = +(q.get("to") || END), SR = 48000;
      const audio = await buildAudio(from, to);
      let peak = 0, sum = 0; for (let c = 0; c < audio.numberOfChannels; c++) { const d = audio.getChannelData(c); for (let i = 0; i < d.length; i += 4) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; } }
      console.log("audio peak", peak.toFixed(3), "rms", Math.sqrt(sum / (audio.length * audio.numberOfChannels / 4)).toFixed(3));
      const enc = makeEncoder({ width: W, height: H, fps: FPS, bitrate: +(q.get("mbps") || 24) * 1e6, audio: { channels: 2, sampleRate: SR } });
      const n = Math.round((to - from) * FPS), t0 = performance.now();
      for (let i = 0; i < n; i++) { await frame(from + i / FPS); await enc.addFrame(cv); if (i % 300 === 0) console.log(`frame ${i}/${n} ${((performance.now() - t0) / 1000).toFixed(0)}s`); }
      await enc.addAudio(audio);
      const { mp4 } = await enc.finish(); window.__mp4 = mp4; window.__bytes = mp4;
      window.__result = { frames: n, seconds: (to - from).toFixed(2), renderSec: ((performance.now() - t0) / 1000).toFixed(1), bytes: mp4.length }; window.__done = true; return;
    }
    // 그냥 열면 실시간 미리보기(소리 없음)
    const st = performance.now(); const loop = async () => { const t = ((performance.now() - st) / 1000) % END; await frame(t); requestAnimationFrame(loop); }; loop();
  } catch (e) { console.error(e); window.__result = { error: String(e.stack || e) }; window.__done = true; }
})();
