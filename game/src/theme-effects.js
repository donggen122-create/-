// Theme 1 presentation only. No damage, random gameplay calls, saves or timers here.
// All positions/radii use the same world pixels as main.js. Warnings never shrink the hit area.
const FX_TAU = Math.PI * 2;
const fxClamp = (n) => Math.max(0, Math.min(1, n));
const fxEase = (n) => 1 - Math.pow(1 - fxClamp(n), 3);

export function createThemeEffects(sprites) {
  const events = [];
  const textures = new Map();
  const motion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let sequence = 0;
  const quiet = () => !!motion?.matches;
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, FX_TAU); }
  function ring(c, x, y, r, color, width = 2) {
    c.strokeStyle = color; c.lineWidth = width; circle(c, x, y, r); c.stroke();
  }
  function stamp(c, key, x, y, size, alpha = 1, angle = 0) {
    const img = sprites[key];
    if (!img?.complete || !img.naturalWidth || size <= 0 || alpha <= 0) return false;
    // Decode each original once; render a small cached texture on phones.
    let texture = textures.get(key);
    if (!texture) {
      texture = document.createElement("canvas");
      texture.width = 256; texture.height = Math.max(1, Math.round(256 * img.naturalHeight / img.naturalWidth));
      const tc = texture.getContext("2d");
      tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = "high";
      tc.drawImage(img, 0, 0, texture.width, texture.height); textures.set(key, texture);
    }
    c.save(); c.translate(x, y); c.rotate(angle); c.globalAlpha *= fxClamp(alpha);
    c.imageSmoothingEnabled = true;
    const h = size * texture.height / texture.width;
    c.drawImage(texture, -size / 2, -h / 2, size, h); c.restore(); return true;
  }
  function sparkle(c, x, y, size, color = "#fff7bb") {
    c.fillStyle = color; c.beginPath();
    c.moveTo(x, y - size); c.quadraticCurveTo(x + size * .2, y - size * .2, x + size, y);
    c.quadraticCurveTo(x + size * .2, y + size * .2, x, y + size);
    c.quadraticCurveTo(x - size * .2, y + size * .2, x - size, y);
    c.quadraticCurveTo(x - size * .2, y - size * .2, x, y - size); c.fill();
  }
  function label(c, text, x, y, color = "#624729") {
    c.save(); c.font = "bold 12px sans-serif"; c.textAlign = "center";
    c.lineWidth = 4; c.strokeStyle = "#fffef1"; c.strokeText(text, x, y);
    c.fillStyle = color; c.fillText(text, x, y); c.restore();
  }
  function warning(c, x, y, r, progress, color = "#d64d35", icon = "!") {
    c.save(); c.fillStyle = "rgba(228,94,52,.12)"; circle(c, x, y, r); c.fill();
    ring(c, x, y, r, "#fff7d7", 5); ring(c, x, y, r, color, 2.5);
    // Inner arc shows time left; outer circle is always the full collision radius.
    c.strokeStyle = color; c.lineWidth = 4; c.beginPath();
    c.arc(x, y, Math.max(1, r - 6), -Math.PI / 2, -Math.PI / 2 + FX_TAU * fxClamp(progress)); c.stroke();
    label(c, icon, x, y + 5, color); c.restore();
  }
  function emit(kind, x, y, opts = {}) {
    const maxLife = opts.life || (kind === "link" ? .6 : kind === "phase" ? 1.1 : .65);
    if (events.length >= 96) events.shift();
    events.push({ kind, x, y, radius: 40, ...opts, life: maxLife, maxLife, seed: sequence++ });
  }
  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (let i = events.length - 1; i >= 0; i--) {
      events[i].life -= dt;
      if (events[i].life <= 0) events.splice(i, 1);
    }
  }
  function purify(c, x, y, progress, size = 62) {
    const t = fxClamp(progress), ease = quiet() ? .8 : fxEase(t);
    c.save(); c.globalAlpha *= 1 - t;
    ring(c, x, y, 5 + size * .4 * ease, "#8ccf9b", 2);
    stamp(c, "vfx_purify", x, y - 7 * ease, size * (.55 + .55 * ease), 1);
    for (let i = 0; i < (quiet() ? 3 : 6); i++) {
      const a = i * FX_TAU / 6, r = size * (.18 + .3 * ease);
      sparkle(c, x + Math.cos(a) * r, y + Math.sin(a) * r - 8 * t, 2 + 2 * (1 - t));
    }
    c.restore();
  }
  function hit(c, x, y, progress, kind = "water", dir = null) {
    if (kind === "clean" || kind === "pickup") { purify(c, x, y, progress, kind === "clean" ? 72 : 35); return; }
    const t = fxClamp(progress), a = dir ? Math.atan2(dir.y, dir.x) : 0;
    c.save(); c.globalAlpha *= 1 - t;
    if (kind === "bump") {
      ring(c, x, y, 5 + 25 * fxEase(t), "#e7ad43", 3);
      for (let i = 0; i < 5; i++) sparkle(c, x + Math.cos(i * 1.26) * 20 * t, y + Math.sin(i * 1.26) * 20 * t, 4);
    } else {
      stamp(c, "vfx_splash", x, y, 26 + 28 * fxEase(t), 1, a);
      ring(c, x, y, 4 + 17 * t, "#80d6e2", 1.5);
    }
    c.restore();
  }
  function smog(c, x, y, r, time, remaining = 1, danger = true) {
    c.save(); const alpha = fxClamp(remaining * 3);
    c.globalAlpha *= alpha;
    circle(c, x, y, r); c.save(); c.clip();
    c.fillStyle = "rgba(145,134,37,.12)"; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    for (let i = 0; i < 5; i++) {
      const a = i * FX_TAU / 5 + (quiet() ? 0 : time * .12);
      const d = r * .27, wobble = quiet() ? 0 : Math.sin(time * 1.4 + i) * r * .035;
      stamp(c, "vfx_smog", x + Math.cos(a) * (d + wobble), y + Math.sin(a) * d, r * 1.55, .27, a * .1);
    }
    c.restore();
    ring(c, x, y, r, danger ? "#b17a32" : "#87984e", 2);
    if (danger) label(c, "!", x, y - r + 15, "#80591e");
    c.restore();
  }
  function beacon(c, x, y, r, time, inside) {
    c.save();
    const pulse = quiet() ? .5 : (time * .45) % 1;
    ring(c, x, y, r, "#468b64", 2.5);
    c.globalAlpha = .45 * (1 - pulse); ring(c, x, y, r * (.3 + .7 * pulse), "#a5eac0", 3);
    c.globalAlpha = .85;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + (quiet() ? 0 : time * .22);
      const px = x + Math.cos(a) * r * .8, py = y + Math.sin(a) * r * .8;
      c.fillStyle = "#e6ffe9"; c.fillRect(px - 4, py - 1, 8, 2); c.fillRect(px - 1, py - 4, 2, 8);
    }
    if (inside) label(c, "회복 중", x, y + r + 16, "#297047"); c.restore();
  }
  function projectile(c, p, toScreen) {
    if (!["arrow", "pellet", "jar"].includes(p.shape)) return false;
    const s = toScreen(p.x, p.y), a = p.angle ?? Math.atan2(p.vy, p.vx);
    c.save();
    for (let i = 0; i < p.trail.length; i++) {
      const q = toScreen(p.trail[i].x, p.trail[i].y);
      c.globalAlpha = .3 * i / Math.max(1, p.trail.length); c.fillStyle = p.shape === "jar" ? "#afd686" : "#7fd7e8";
      circle(c, q.x, q.y, 2.5); c.fill();
    }
    c.globalAlpha = 1; c.translate(s.x, s.y); c.rotate(a);
    if (p.shape === "jar") {
      c.rotate(p.spin || 0); c.fillStyle = "#99c563"; c.strokeStyle = "#547647"; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(0, 0, 8, 6, 0, 0, FX_TAU); c.fill(); c.stroke();
      c.fillStyle = "#eef4bf"; c.beginPath(); c.ellipse(-1, -5, 5, 2.5, -.6, 0, FX_TAU); c.fill();
    } else {
      const r = p.shape === "pellet" ? 4 : 7;
      c.fillStyle = "#75d4eb"; c.strokeStyle = "#368da6"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-r * 1.6, 0); c.bezierCurveTo(-r, -r, r, -r, r, 0);
      c.bezierCurveTo(r, r, -r, r, -r * 1.6, 0); c.fill(); c.stroke();
      c.fillStyle = "#eeffff"; c.beginPath(); c.ellipse(1, -2, 2.4, 1.1, 0, 0, FX_TAU); c.fill();
    }
    c.restore(); return true;
  }
  function telegraph(c, pat, boss, remaining, time, U, toScreen) {
    const s = toScreen(boss.x, boss.y), t = fxClamp(1 - remaining / pat.telegraphS);
    c.save();
    if (pat.kind === "scatter" || pat.kind === "litter") {
      const r = (pat.kind === "litter" ? .9 : 1.2) * U;
      for (const spot of pat.spots || []) {
        const q = toScreen(spot.x, spot.y); warning(c, q.x, q.y, r, t);
        // Flights land exactly when resolveBossPattern applies damage. Shadows stay at target.
        const fall = quiet() ? 20 : 110 * (1 - t);
        stamp(c, "t1_prop_litter", q.x, q.y - fall, 26 + 10 * t, .7, quiet() ? 0 : t * 2);
      }
    } else if (pat.kind === "cone") {
      const r = 4 * U;
      c.beginPath(); c.moveTo(s.x, s.y); c.arc(s.x, s.y, r, pat.aimAngle - Math.PI / 2, pat.aimAngle + Math.PI / 2); c.closePath();
      c.fillStyle = "rgba(203,113,40,.16)"; c.fill(); c.strokeStyle = "#fff6d2"; c.lineWidth = 5; c.stroke();
      c.strokeStyle = "#c77832"; c.lineWidth = 2; c.stroke();
      // The lasting stink pool is offset from the cone. Its future boundary is shown separately.
      const x = s.x + Math.cos(pat.aimAngle) * 2.2 * U, y = s.y + Math.sin(pat.aimAngle) * 2.2 * U;
      c.setLineDash([5, 5]); ring(c, x, y, 2.4 * U, "#927535", 2); c.setLineDash([]);
      label(c, "!", x, y + 4, "#945525");
      stamp(c, "vfx_smog", s.x, s.y - 25, 38 + 15 * t, .4);
    } else if (pat.kind === "vacuum") {
      warning(c, s.x, s.y, 2.5 * U, t);
      for (let i = 0; i < 8; i++) {
        const a = i * FX_TAU / 8 + .3;
        const f = quiet() ? .5 : ((time * .8 + i * .137) % 1);
        const r = (7 - 4.5 * f) * U, px = s.x + Math.cos(a) * r, py = s.y + Math.sin(a) * r;
        c.save(); c.translate(px, py); c.rotate(a + Math.PI); c.strokeStyle = "#eee4b0"; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-10, -4); c.lineTo(0, 0); c.lineTo(-10, 4); c.stroke(); c.restore();
      }
    } else if (pat.kind === "ringOut") {
      warning(c, s.x, s.y, 4 * U, t);
      for (let i = 0; i < 8; i++) {
        const a = i * FX_TAU / 8;
        stamp(c, "t1_prop_litter", s.x + Math.cos(a) * 4 * U, s.y + Math.sin(a) * 4 * U, 20, .8);
      }
    } else if (pat.kind === "summonOnly") {
      for (let i = 0; i < (pat.summon?.n || 4); i++) {
        const a = i * FX_TAU / (pat.summon?.n || 4), x = s.x + Math.cos(a) * 60, y = s.y + Math.sin(a) * 60;
        c.setLineDash([4, 4]); ring(c, x, y, 21, "#8d729f", 2); c.setLineDash([]);
        stamp(c, "t1_en_baggy", x, y - 15, 34, .25 + .5 * t);
      }
    }
    c.restore();
  }
  function blast(c, b, x, y) {
    const t = fxClamp(1 - b.life / b.maxLife), r = b.radius;
    if (!b.vfxKind) { purify(c, x, y, t, Math.min(180, r * 1.4)); return; }
    c.save(); c.globalAlpha = 1 - t;
    ring(c, x, y, r, "#b99d6e", 2 * (1 - t) + 1);
    stamp(c, "vfx_smog", x, y, r * 1.8, .24);
    const n = quiet() ? 3 : b.vfxKind === "avalanche" ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const a = i * FX_TAU / n, d = r * (.2 + .65 * fxEase(t));
      stamp(c, "t1_prop_litter", x + Math.cos(a) * d, y + Math.sin(a) * d - 15 * Math.sin(t * Math.PI), 17 + r * .07, .9, a + t);
    }
    c.restore();
  }
  function draw(c, toScreen) {
    for (const e of events) {
      const s = toScreen(e.x, e.y), t = fxClamp(1 - e.life / e.maxLife);
      if (e.kind === "clean" || e.kind === "ability") { purify(c, s.x, s.y, t, e.radius * 2); continue; }
      c.save(); c.globalAlpha = 1 - t;
      if (e.kind === "link") {
        const dest = toScreen(e.toX, e.toY), p = quiet() ? .65 : fxEase(t);
        c.strokeStyle = "#74c1a0"; c.lineWidth = 2; c.setLineDash([3, 5]);
        c.beginPath(); c.moveTo(s.x, s.y); c.quadraticCurveTo((s.x + dest.x) / 2, Math.min(s.y, dest.y) - 40, dest.x, dest.y); c.stroke();
        stamp(c, "vfx_purify", s.x + (dest.x - s.x) * p, s.y + (dest.y - s.y) * p - 20 * Math.sin(p * Math.PI), 30);
      } else if (e.kind === "blink" || e.kind === "summon") {
        ring(c, s.x, s.y, 8 + e.radius * fxEase(t), "#a194bd", 2);
        stamp(c, "vfx_smog", s.x, s.y - 15 * t, e.radius * 2, .35);
      } else if (e.kind === "phase" || e.kind === "arrival") {
        stamp(c, "vfx_smog", s.x, s.y - 30, 180 + 45 * t, .5);
        ring(c, s.x, s.y, 40 + 70 * fxEase(t), "#d5a45d", 3);
        label(c, e.kind === "phase" ? "오염 폭주!" : "쓰레기 산 대왕 등장!", s.x, s.y - 120 - 8 * t);
      }
      c.restore();
    }
  }
  return { emit, update, draw, hit, purify, smog, beacon, projectile, telegraph, blast, stamp,
    reset() { events.length = 0; sequence = 0; }, get count() { return events.length; }, get reducedMotion() { return quiet(); } };
}
