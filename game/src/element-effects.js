// 원소 스킬 그림 v3 — 사용자 Gemini 시트를 자른 스프라이트(assets/sprites/skills/*.png)로 그린다. 규칙(docs/22 §5):
// 투사체는 적 크기만큼, 폭발·장판은 지름 2~4칸, 원소 색 빛 번짐 + 그림. 코드 도형은 보조(궤적·빛)만.
const COLORS = { fire: '#FF6A2A', water: '#2AA8FF', wind: '#3ED88A', earth: '#C48A3F', lightning: '#FFD83A' };
const cache = new Map();
export const skillSpriteURL = name => `./assets/sprites/skills/${name}.png`;
export function sprite(name) {
  if (typeof Image === 'undefined') return null;
  if (!cache.has(name)) { const im = new Image(); im.src = skillSpriteURL(name); cache.set(name, im); }
  const im = cache.get(name); return im.complete && im.naturalWidth ? im : null;
}
const TAU = Math.PI * 2;
// 그림을 폭 w(픽셀)로 가운데 정렬해 그린다. h를 주면 그 높이로 늘린다. anchorY: 0.5=가운데, 1=아래 끝이 기준점
function img(ctx, name, x, y, w, { angle = 0, alpha = 1, h = null, flip = false, anchorY = .5 } = {}) {
  const im = sprite(name); if (!im) return false;
  const hh = h ?? w * im.naturalHeight / im.naturalWidth;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); if (flip) ctx.scale(-1, 1); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(im, -w / 2, -hh * anchorY, w, hh); ctx.restore(); return true;
}
const glowCache = new Map();
function glow(ctx, x, y, r, color, alpha = .35) {
  if(r<=0)return;
  let image=glowCache.get(color);
  if(!image){
    image=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(128,128):document.createElement('canvas');
    image.width=image.height=128;const c=image.getContext('2d'),g=c.createRadialGradient(64,64,6.4,64,64,64);
    g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,128,128);
    if(glowCache.size>=24)glowCache.delete(glowCache.keys().next().value);glowCache.set(color,image);
  }
  ctx.save();ctx.globalAlpha*=alpha;ctx.globalCompositeOperation='lighter';ctx.imageSmoothingEnabled=true;ctx.drawImage(image,x-r,y-r,r*2,r*2);ctx.restore();
}
const frame = (list, t) => list[Math.max(0, Math.min(list.length - 1, Math.floor(t * list.length)))];
const cycle = (list, t) => list[Math.floor(t) % list.length];
function trail(ctx, s, toScreen, color, width) {
  if (s.trail.length < 2) return; ctx.save(); ctx.globalAlpha *= .35; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath();
  s.trail.forEach((t, i) => { const q = toScreen(t.x, t.y); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); const e = toScreen(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore();
}

// layer: 'ground' = 바닥에 깔리는 것(웅덩이·용암·천둥 장판·지뢰·팽이 그림자) → 적·주인공보다 먼저 그린다, 'air' = 나머지, 'all' = 한 번에(옛 호출)
// 2026-09-23: 불 웅덩이·용암은 반투명(0.5)·작게(반지름 1.4·1.7칸, 범위 보너스 절반) — 주인공과 바닥이 가려지지 않게(사용자 지적). 큰 폭발 그림도 ×2.8~3 → ×2.4~2.6
export function drawElementScene(ctx, { shots, fields, effects, orbits, mines, bees, beams, clock, U, player }, toScreen, layer = 'all') {
  const ground = layer !== 'air', air = layer !== 'ground';
  // 주인공 몸(발에서 0.8칸 위가 몸 가운데)과 겹치는지: 겹치는 투사체·이펙트는 반투명으로 그려 주인공이 늘 보이게
  const nearHero = (x, y, r) => !!player && Math.hypot(x - player.x, y - (player.y - .8 * U)) < r + .7 * U;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 장판(바닥)
  for (const f of fields) {
    const s = toScreen(f.x, f.y), c = COLORS[f.element], fade = Math.min(1, f.life * 2, f.age * 4 + .2);
    if (f.kind === 'puddle' || f.kind === 'lava') {
      if (!ground) continue;
      glow(ctx, s.x, s.y, f.r, c, .16 * fade);
      const name = f.kind === 'lava' ? cycle(['fire_lava_1', 'fire_lava_2', 'fire_lava_3'], clock * 5) : cycle(['fire_puddle_1', 'fire_puddle_2', 'fire_puddle_3'], clock * 8);
      img(ctx, name, s.x, s.y, f.r * 2, { alpha: .5 * fade, h: f.r * (f.kind === 'lava' ? 1.35 : 1.45), anchorY: f.kind === 'lava' ? .5 : .62 });
    } else if (f.kind === 'trail') {   // 금 기능 물길·흙길: 가벼운 반투명 타원(그라데이션 없음 — 태블릿 부담 최소)
      if (!ground) continue;
      ctx.save(); ctx.globalAlpha = .24 * fade; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(s.x, s.y, f.r, f.r * .55, 0, 0, TAU); ctx.fill(); ctx.restore();
    } else if (f.kind === 'storm') {
      if (ground) { glow(ctx, s.x, s.y, f.r, c, .25 * fade); ctx.save(); ctx.globalAlpha = .18 * fade; ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(s.x, s.y, f.r, f.r * .6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      if (air) img(ctx, 'lightning_storm', s.x, s.y - 2.6 * U + Math.sin(clock * 3) * 4, f.r * 2, { alpha: fade * (nearHero(f.x, f.y - 2.6 * U, f.r * .8) ? .4 : 1) });
    }
  }
  // 지뢰
  if (ground) for (const m of mines) {
    const s = toScreen(m.x, m.y);
    if (m.moving) img(ctx, 'earth_dust_1', s.x, s.y + .1 * U, 1.1 * U, { alpha: .8 });   // 땅속으로 파고드는 중: 흙먼지
    if (m.kind === 'molemine') img(ctx, 'earth_molefield', s.x, s.y, 1.7 * U, { anchorY: .7 });
    else img(ctx, m.moving ? 'earth_mole_2' : ((m.age % 2) < 1.4 ? 'earth_mole_1' : 'earth_mole_2'), s.x, s.y, 1.2 * U, { anchorY: .7 });
  }
  // 회오리·태풍 그림자(바닥)
  if (ground) for (const o of orbits) { const s = toScreen(o.x, o.y); img(ctx, 'wind_shadow', s.x, s.y + o.r * .8, o.r * 2.2, { alpha: .5 }); }
  if (!air) { ctx.restore(); return; }
  // 물대포
  for (const b of beams) {
    const s = toScreen(b.x, b.y), big = b.kind === 'rbeam', seg = sprite(big ? 'water_rbeam' : 'water_beam'), tip = sprite(big ? 'water_rbeam_tip' : 'water_beam_tip');
    const fade = Math.min(1, b.life * 4, b.age * 8);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(b.angle); ctx.globalAlpha = fade; ctx.imageSmoothingEnabled = true;
    const w = b.width * (1 + .06 * Math.sin(clock * 30)), tipLen = w * 1.6, bodyLen = Math.max(0, b.len - tipLen * .6);
    if (seg) ctx.drawImage(seg, .3 * U, -w / 2, bodyLen, w); else { ctx.fillStyle = COLORS.water; ctx.fillRect(.3 * U, -w / 2, bodyLen, w); }
    if (tip) ctx.drawImage(tip, .3 * U + bodyLen - tipLen * .4, -w / 2, tipLen, w);
    ctx.restore();
    glow(ctx, s.x + Math.cos(b.angle) * b.len, s.y + Math.sin(b.angle) * b.len, w, COLORS.water, .4 * fade);
  }
  // 투사체
  for (const s of shots) {
    const q = toScreen(s.x, s.y), c = COLORS[s.element] || '#fff';
    let y = q.y; if (s.lob) y -= Math.sin(Math.PI * Math.min(1, s.age / s.flight)) * 1.6 * U;
    ctx.save(); if (nearHero(s.x, s.y, s.r)) ctx.globalAlpha = .6;   // 막 던진 병·바위가 주인공을 덮지 않게
    switch (s.kind) {
      case 'bottle': trail(ctx, s, toScreen, c, 3); img(ctx, 'fire_bottle', q.x, y, .9 * U, { angle: s.age * 9 }); break;
      case 'volcano': trail(ctx, s, toScreen, c, 4); img(ctx, 'fire_volcano', q.x, y, 1.2 * U, { angle: s.age * 6 }); break;
      case 'rocket': trail(ctx, s, toScreen, '#ffd9a0', 6); glow(ctx, q.x, q.y, .7 * U, c, .5); img(ctx, 'fire_rocket', q.x, q.y, 1.3 * U, { angle: s.angle + Math.PI / 4 }); break;
      case 'frocket': trail(ctx, s, toScreen, '#ffe08a', 8); glow(ctx, q.x, q.y, .9 * U, '#ffd54a', .5); img(ctx, 'fire_frocket', q.x, q.y, 1.6 * U, { angle: s.angle + Math.PI / 4 }); break;
      case 'sparkshot': glow(ctx, q.x, q.y, .5 * U, '#ffd54a', .6); img(ctx, 'fire_fwork_1', q.x, q.y, .7 * U, { angle: s.angle }); break;
      case 'balloon': img(ctx, 'water_balloon', q.x, q.y + Math.sin(clock * 12) * 3, 1.1 * U); break;
      case 'kballoon': glow(ctx, q.x, q.y, U, c, .3); img(ctx, 'water_kballoon', q.x, q.y + Math.sin(clock * 10) * 4, 1.8 * U); break;
      case 'boomerang': trail(ctx, s, toScreen, c, 5); img(ctx, cycle(['wind_boomerang_1', 'wind_boomerang_2'], clock * 14), q.x, q.y, 1.2 * U); break;
      case 'mboomerang': trail(ctx, s, toScreen, c, 7); glow(ctx, q.x, q.y, .8 * U, c, .35); img(ctx, cycle(['wind_mboomerang_1', 'wind_mboomerang_2'], clock * 14), q.x, q.y, 1.5 * U); break;
      case 'swirl': img(ctx, 'wind_swirl', q.x, q.y, .8 * U, { angle: clock * 10 }); break;
      case 'stone': img(ctx, cycle(['earth_stone_1', 'earth_stone_2'], clock * 8), q.x, q.y, (s.small ? .5 : .85) * U, { angle: s.age * 7 }); break;
      case 'boulder': { const back = toScreen(s.x - Math.cos(s.angle) * .9 * U, s.y - Math.sin(s.angle) * .9 * U); img(ctx, 'earth_dust_trail', back.x, back.y + .2 * U, 1.8 * U, { angle: s.angle, alpha: .8 }); img(ctx, cycle(['earth_boulder_1', 'earth_boulder_2'], clock * 6), q.x, q.y, 2 * U, { angle: s.age * 4 }); break; }
      case 'stinger': trail(ctx, s, toScreen, '#ffe98a', 3); img(ctx, 'lightning_stinger', q.x, q.y, .8 * U, { angle: s.angle }); break;
      case 'hstinger': trail(ctx, s, toScreen, '#ffe98a', 4); img(ctx, 'lightning_hstinger', q.x, q.y, 1 * U, { angle: s.angle }); break;
      default: ctx.save(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(q.x, q.y, s.r, 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  // 회오리·태풍
  for (const o of orbits) {
    const s = toScreen(o.x, o.y), big = o.kind === 'typhoon';
    img(ctx, big ? cycle(['wind_typhoon_1', 'wind_typhoon_2', 'wind_typhoon_3'], clock * 12) : cycle(['wind_top_1', 'wind_top_2', 'wind_top_3'], clock * 14), s.x, s.y, o.r * (big ? 2.4 : 2.3), { anchorY: .75 });
  }
  // 벌
  for (const b of bees) {
    const s = toScreen(b.x, b.y), flip = player && b.x < player.x - 4;
    img(ctx, cycle(['lightning_bee_1', 'lightning_bee_2'], b.wing * 16), s.x, s.y + Math.sin(b.wing * 6) * 3, .95 * U, { flip, alpha: nearHero(b.x, b.y, .45 * U) ? .5 : 1 });   // 주인공 몸 위를 지나는 벌은 반투명(2026-09-24 효과 점검)
  }
  // 이펙트(폭발·튀김·번개…). 2026-09-23: 크기 ×1.3, 충격파 고리 + 불꽃 파편(sparks)으로 "펑펑" 느낌
  // 2026-09-23 저녁: 주인공 몸과 겹치는 이펙트는 반투명(A=0.5) — "이펙트가 캐릭터를 가린다"(사용자)
  // 2026-09-24 효과 점검(사용자 "과하거나 화면을 가리는 경우", tools/qa/fx-audit.py): 그림이 실제 맞는 범위보다 최대 2배까지 커지던 것을
  //  맞는 범위 정도로(커지기 .85→1.4배 → .8→1.15배), 빛 번짐은 반지름 1.5~1.9배 → 1.1~1.2배·더 옅게, 흰 번쩍임은 작고 옅게, 하늘 구름은 주인공 위면 옅게.
  // 2026-09-24 둘째(사용자 "두더지 폭발이 무식하게 크다"): 그림 배율도 2.4~3배 → 2~2.2배(가장 클 때 지름 ≈ 맞는 범위 지름 × 1.15). 크기 보너스 상한은 element-combat.js SIZE_BONUS_CAP.
  for (const e of effects) {
    const s = toScreen(e.x, e.y), c = COLORS[e.element] || '#fff', p = 1 - e.life / e.maxLife, fade = 1 - p * p, grow = .8 + .35 * p;
    const A = nearHero(e.x, e.y, e.r * 1.2) ? .5 : 1, skyA = (dy) => nearHero(e.x, e.y + dy, 1.2 * U) ? .4 : 1;
    ctx.save(); ctx.globalAlpha = A;
    switch (e.kind) {
      case 'sparks': {   // 사방으로 튀는 밝은 파편 + 바깥으로 퍼지는 충격파 고리
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = c; ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + (e.x * .01), r0 = e.r * (.3 + p * .8), r1 = r0 + e.r * .3 * (1 - p); ctx.globalAlpha = A * fade * .9; ctx.lineWidth = 3 * (1 - p) + 1; ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0 * .7); ctx.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1 * .7); ctx.stroke(); }
        // 충격파 고리: 맞는 범위(반지름 e.r)까지만 퍼진다(2026-09-24 효과 점검 — 전에는 1.6배까지)
        ctx.globalAlpha = A * fade * .45; ctx.lineWidth = 3.5 * (1 - p) + 1; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(s.x, s.y, e.r * (.35 + p * .7), e.r * (.35 + p * .7) * .7, 0, 0, TAU); ctx.stroke();
        ctx.restore(); break;
      }
      case 'boom': glow(ctx, s.x, s.y, e.r * 1.15, '#ffb347', .5 * fade); if (p < .12) { ctx.save(); ctx.globalAlpha = A * (1 - p / .12) * .5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, e.r * .55, 0, TAU); ctx.fill(); ctx.restore(); } img(ctx, frame(['fire_boom_1', 'fire_boom_2', 'fire_boom_3'], p), s.x, s.y, e.r * 2 * grow, { alpha: .9 * fade }); break;
      case 'fwork': glow(ctx, s.x, s.y, e.r * 1.2, '#ffe36a', .5 * fade); img(ctx, frame(['fire_fwork_1', 'fire_fwork_2', 'fire_fwork_3'], p), s.x, s.y, e.r * 2 * grow, { alpha: .9 * fade }); break;
      case 'splashfire': glow(ctx, s.x, s.y, e.r * 1.1, '#ffb347', .4 * fade); img(ctx, frame(['fire_puddle_2', 'fire_puddle_3'], p), s.x, s.y, e.r * 1.9 * grow, { alpha: .85 * fade, anchorY: .7 }); break;
      case 'splash': glow(ctx, s.x, s.y, e.r * 1.05, c, .3 * fade); img(ctx, frame(['water_splash_1', 'water_splash_2', 'water_splash_3'], p), s.x, s.y, e.r * 2 * grow, { alpha: fade, anchorY: .7 }); break;
      case 'ksplash': glow(ctx, s.x, s.y, e.r * 1.1, c, .35 * fade); img(ctx, frame(['water_ksplash_1', 'water_ksplash_2', 'water_ksplash_3'], p), s.x, s.y, e.r * 2 * grow, { alpha: .9 * fade, anchorY: .7 }); break;
      case 'spray': glow(ctx, s.x, s.y, e.r, c, .4 * fade); img(ctx, frame(['water_spray_1', 'water_spray_2'], p), s.x, s.y, e.r * 2.2 * grow, { alpha: fade }); break;
      case 'rspray': glow(ctx, s.x, s.y, e.r, c, .5 * fade); img(ctx, frame(['water_rspray_1', 'water_rspray_2'], p), s.x, s.y, e.r * 2.2 * grow, { alpha: fade }); break;
      case 'dust': img(ctx, frame(['earth_dust_1', 'earth_dust_2'], p), s.x, s.y, e.r * 2.2 * grow, { alpha: fade }); break;
      case 'dirt': glow(ctx, s.x, s.y, e.r * 1.05, '#e2b06a', .35 * fade); img(ctx, frame(['earth_dirt_1', 'earth_dirt_2'], p), s.x, s.y, e.r * 2 * grow, { alpha: fade, anchorY: .7 }); break;
      case 'bigdirt': glow(ctx, s.x, s.y, e.r * 1.1, '#e2b06a', .4 * fade); img(ctx, frame(['earth_bigdirt_1', 'earth_bigdirt_2'], p), s.x, s.y, e.r * 2 * grow, { alpha: .9 * fade, anchorY: .7 }); break;
      case 'crack': img(ctx, 'earth_crack', s.x, s.y, e.r * 2.2, { alpha: fade }); break;
      case 'chainring': img(ctx, 'earth_chain_ring', s.x, s.y, e.r * 2 * (.6 + .5 * p), { alpha: fade }); break;
      case 'cloudmark': ctx.save(); ctx.globalAlpha = A * .3 * Math.min(1, p * 2); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(s.x, s.y, e.r * 1.1, e.r * .67, 0, 0, TAU); ctx.fill(); ctx.restore(); img(ctx, 'lightning_cloud', s.x, s.y - 2.4 * U + p * .3 * U, 2.4 * U, { alpha: Math.min(1, p * 3) * skyA(-2.4 * U) / A }); break;
      case 'bolt': glow(ctx, s.x, s.y, e.r * 1.2, '#fff1a0', .55 * fade); if (p < .15) { ctx.save(); ctx.globalAlpha = A * (1 - p / .15) * .45; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, e.r * .55, 0, TAU); ctx.fill(); ctx.restore(); } img(ctx, frame(['lightning_bolt_1', 'lightning_bolt_2'], p), s.x, s.y - 1.5 * U, 1.8 * U, { h: 3.6 * U, alpha: fade }); img(ctx, 'lightning_flash', s.x, s.y, e.r * 2 * grow, { alpha: fade, anchorY: .7 }); img(ctx, 'lightning_cloud', s.x, s.y - 3 * U, 2.4 * U, { alpha: fade * .9 * skyA(-3 * U) / A }); break;
      case 'tbolt': glow(ctx, s.x, s.y, e.r * 1.2, '#fff1a0', .55 * fade); img(ctx, frame(['lightning_tbolt_1', 'lightning_tbolt_2'], p), s.x, s.y - 1.4 * U, 2.6 * U, { h: 3.4 * U, alpha: fade }); img(ctx, 'lightning_bigflash', s.x, s.y, e.r * 2 * grow, { alpha: fade }); break;
      case 'spark': img(ctx, 'lightning_spark', s.x, s.y, e.r * 2 * grow, { alpha: fade, angle: p * 2 }); break;
      case 'bigburst': glow(ctx, s.x, s.y, e.r * 1.2, '#ffe36a', .5 * fade); img(ctx, 'lightning_bigburst', s.x, s.y, e.r * 2 * grow, { alpha: fade, angle: p }); break;
      case 'swirl': img(ctx, 'wind_swirl', s.x, s.y, e.r * 2 * grow, { alpha: fade, angle: p * 4 }); break;
      case 'windring': img(ctx, 'wind_ring', s.x, s.y, e.r * 2 * (.5 + .6 * p), { alpha: fade, h: e.r * 1.3 * (.5 + .6 * p) }); break;
      case 'pull': { const a = toScreen(e.x0, e.y0); ctx.save(); ctx.globalAlpha = A * fade; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.restore(); break; }
      default: ctx.save(); ctx.globalAlpha = A * fade * .8; ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, e.r * (.5 + p), 0, TAU); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}
