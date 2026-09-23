// 기획서 데이터(data/*.csv, *.json) → 게임이 쓰는 형태로 변환하는 매핑 레이어.
// 원본 수치는 content.data.js(자동 생성)에 그대로 있고, 여기서는 "어떻게 동작시킬지"만 정한다.
import { RAW_ENEMIES, RAW_BOSSES, RAW_SKILLS, RAW_PASSIVES, RAW_EVOLUTIONS, RAW_CHAPTERS, RAW_CHARACTERS, RAW_EQUIPMENT } from "./content.data.js";

import { T1_ENEMIES, T1_BOSS, T1_STAGES } from "./themes.js";
export const U = 32; // 1u = 32px

export const XP_CURVE = (n) => 20 + 6 * n + 0.25 * n * n;                 // docs/06 §4.1
export const ACCOUNT_XP_PER_RUN = ({ chapter, survivalMinutes }) =>
  Math.round(50 + chapter * 10 + survivalMinutes * 5);                     // docs/11 §1
export const ACCOUNT_LEVEL_COST = (lv) => Math.round(200 * Math.pow(lv, 1.4));
export const GOLD_SHARD_VALUE = (chapter) => 1 + 0.5 * chapter;            // docs/11 §1.1
export const STANDARD_MODE_XP_MULT = 1.4;                                  // docs/06 §4.3
export const gemValue = (enemyXp, elapsedMinutes) =>
  enemyXp * (1 + 0.08 * elapsedMinutes) * STANDARD_MODE_XP_MULT;           // docs/12 §7

// ====================== 스킬 ======================
// tags 열로 구현 종류를 결정한다.
function kindFromTags(tags, aim) {
  const t = tags || "";
  if (t.includes("clone")) return "clone";
  if (t.includes("trap")) return "trap";
  if (t.includes("beam")) return "beam";
  if (t.includes("orbit")) return "orbit";
  if (t.includes("chain")) return "chain";
  if (t.includes("strike")) return "strike";
  if (t.includes("field")) return "field";
  if (t.includes("summon")) return "summon";
  if (t.includes("melee")) return "melee";
  if (t.includes("return")) return "boomerang";
  if (t.includes("bounce")) return "bounce";
  if (t.includes("explosion")) return "lob";
  if (t.includes("spread")) return "spread";
  if (t.includes("pierce") || (t.includes("line") && aim === "FACING")) return "pierce";
  return "projectile";
}

// "투사체 +1", "피해 +25%", "간격 -15%", "반경 +30%", "지속 +2s" 같은 레벨 문구를 실제 수치로 해석
const COUNT_WORDS = /(투사체|파편|창|낫|드론|포탑|항아리|지점|구슬|빛덩이|낙뢰|늑대|부메랑|주사위|분신|지뢰|연쇄|갈래|늑대|채찍)\s*\+(\d+)/;
function parseLevelText(text) {
  const out = { count: 0, dmg: 0, interval: 0, area: 0, duration: 0 };
  if (!text) return out;
  const c = text.match(COUNT_WORDS);
  if (c) out.count += parseInt(c[2], 10);
  const d = text.match(/피해\s*\+(\d+)%/);
  if (d) out.dmg += parseInt(d[1], 10) / 100;
  const i = text.match(/(간격|쿨다운|사격 간격|설치 간격|회전)\s*-(\d+)%/);
  if (i) out.interval += parseInt(i[2], 10) / 100;
  const a = text.match(/(반경|범위|폭|크기|길이|확산)\s*\+(\d+)(%|u)/);
  if (a) out.area += parseInt(a[2], 10) / (a[3] === "u" ? 10 : 100);
  const du = text.match(/(지속|조사)\s*\+?(\d+(?:\.\d+)?)s?/);
  if (du) out.duration += parseFloat(du[2]) / 10;
  return out;
}

const SKILL_COLORS = {
  S01: "#ffe9a8", S02: "#a8d8ff", S03: "#ffb070", S04: "#c8a8ff", S05: "#ff9a9a", S06: "#a8ffd0",
  S07: "#9ad8ff", S08: "#d0c090", S09: "#ff9040", S10: "#8ab4ff", S11: "#ffffff", S12: "#fff0a0",
  S13: "#9ae06a", S14: "#ff6a6a", S15: "#d8e8ff", S16: "#a8e8ff", S17: "#ff8a40", S18: "#ffcf5a",
  S19: "#b0d0ff", S20: "#c090ff", S21: "#ffe070", S22: "#b0e0ff", S23: "#ffd76a", S24: "#9a8ac0",
};

export const SKILLS = {};
for (const id in RAW_SKILLS) {
  const r = RAW_SKILLS[id];
  const kind = kindFromTags(r.tags, r.aim);
  const steps = r.lv.map(parseLevelText);
  SKILLS[id] = {
    id, name: r.name, kind, aim: r.aim, tags: r.tags,
    dmgCoef: r.dmgCoef, interval: Math.max(0.1, r.intervalS || 1),
    projectiles: r.projectiles || 1, pierceInf: r.pierce >= 999,
    rangeU: r.rangeU || 8, durationS: r.durationS || 0,
    radiusU: kind === "orbit" ? (r.rangeU || 2.2) : undefined,
    blastU: kind === "lob" || kind === "trap" || kind === "strike" ? 1.5 : undefined,
    delayS: 0.45,                 // strike(지연 낙뢰) 예고 시간
    chainRangeU: 3.5,             // chain(연쇄) 도약 거리
    widthU: 0.5, tickS: 0.2, speedU: kind === "pierce" ? 16 : kind === "lob" ? 7 : 13,
    color: SKILL_COLORS[id] || "#ffe9a8",
    knockback: (r.tags || "").includes("knockback") ? 0.7 : 0.15,
    maxLevel: 5, perfCost: r.perfCost,
    levelText: [`${r.role} · 기본`, ...r.lv],
    evoPassive: r.evoPassive, evoId: r.evoId,
    strength: r.strength, weakness: r.weakness,
    apply(lv) {
      let projectiles = this.projectiles, dmgMul = 1, intervalMul = 1, areaMul = 1, durMul = 1;
      for (let i = 1; i < lv; i++) {
        const s = steps[i - 1]; if (!s) continue;
        projectiles += s.count;
        dmgMul *= 1 + s.dmg;
        intervalMul *= 1 - s.interval;
        areaMul *= 1 + s.area;
        durMul *= 1 + s.duration;
      }
      return {
        projectiles, dmgMul, intervalMul: Math.max(0.3, intervalMul), areaMul, durMul,
        blades: projectiles, chains: projectiles + 3, bolts: Math.max(1, Math.floor(projectiles / 6)),
        blastMul: areaMul, lenMul: areaMul, widthMul: areaMul, knockMul: 1 + (lv >= 4 ? 0.5 : 0),
      };
    },
  };
}

// ====================== 패시브 ======================
// lv1~lv5 열에서 숫자만 뽑아 누적 수치로 쓴다(단위는 stat에 따라 % 또는 개수).
function parsePassiveLevels(raw) {
  return raw.lv.map((v) => {
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? Math.abs(parseFloat(m[0])) : 0;
  });
}
const PASSIVE_FLAT = new Set(["projectiles", "pierce_flat", "def_flat"]); // 개수형(퍼센트 아님)

export const PASSIVES = {};
for (const id in RAW_PASSIVES) {
  const r = RAW_PASSIVES[id];
  const nums = parsePassiveLevels(r);
  const flat = PASSIVE_FLAT.has(r.stat);
  PASSIVES[id] = {
    id, name: r.name, stat: r.stat, maxLevel: 5,
    values: [0, ...nums.map((n) => (flat ? n : n / 100))],
    desc: `${r.appliesTo} — ${flat ? `+${nums[0]}` : `${nums[0]}%`}/Lv (상한 ${r.cap})`,
  };
}

// ====================== 적 ======================
// 보유 스프라이트 4종을 behavior/type에 따라 나눠 쓰고 색조로 구분한다(ASSET_CREDITS.md 참조).
const BEHAVIOR_SPRITE = {
  chase: "enemy_wraith", surround: "enemy_spider", dash: "enemy_imp", kite: "enemy_elite",
  blink: "enemy_wraith", explode: "enemy_imp", summon: "enemy_wraith", ranged: "enemy_spider",
  stationary: "enemy_imp", shield: "enemy_imp", buff: "enemy_wraith", trail: "enemy_spider",
  split: "enemy_imp",
};
// 환경별 색조 — 같은 스프라이트라도 챕터가 바뀌면 색이 달라진다
const ENV_TINT = {
  ENV01: [120, 70, 200], ENV02: [70, 110, 220], ENV03: [90, 160, 210], ENV04: [90, 190, 70],
  ENV05: [180, 130, 60], ENV06: [210, 90, 60], ENV07: [140, 200, 230], ENV08: [190, 70, 150],
  ENV09: [230, 160, 60], ENV10: [180, 60, 220],
};
function enemyTint(r) {
  const base = ENV_TINT[r.env] || [140, 120, 180];
  const shift = r.behavior === "dash" ? -40 : r.behavior === "ranged" ? 30 : 0;
  const c = base.map((v) => Math.max(20, Math.min(255, v + shift)));
  return `rgba(${c[0]},${c[1]},${c[2]},${r.type === "elite" ? 0.5 : 0.55})`;
}

export const ENEMIES = {};
for (const id in RAW_ENEMIES) {
  const r = RAW_ENEMIES[id];
  const elite = r.type === "elite";
  ENEMIES[id] = {
    id, name: r.name, behavior: r.behavior, elite,
    hpMult: r.hpMult, atkMult: r.atkMult, spdU: r.spdU, radiusU: r.radiusU,
    mass: r.mass, xp: r.xp, ability: r.ability,
    sprite: BEHAVIOR_SPRITE[r.behavior] || "enemy_wraith",
    tint: enemyTint(r),
    drawScale: (elite ? 2.4 : 1.5) * (0.8 + r.radiusU),
    bobAmp: r.behavior === "kite" ? 3.2 : elite ? 2.4 : 1.8,
    extraDr: r.behavior === "shield" ? 0.35 : 0,
    summon: r.behavior === "summon" ? { id: "EN01", n: 2, everyS: 4 } : null,
    onDeathSpawn: elite ? { id: "EN01", n: 5 } : (r.behavior === "split" ? { id: "EN01", n: 2 } : null),
  };
}
// 소환·분열 대상은 같은 환경의 일반 적으로 교체(더 자연스럽게)
for (const id in ENEMIES) {
  const r = RAW_ENEMIES[id];
  const sameEnv = Object.values(RAW_ENEMIES).filter((x) => x.env === r.env && x.type === "normal" && x.id !== id);
  if (sameEnv.length) {
    const pick = sameEnv[0].id;
    if (ENEMIES[id].summon) ENEMIES[id].summon.id = pick;
    if (ENEMIES[id].onDeathSpawn) ENEMIES[id].onDeathSpawn.id = pick;
  }
}

export const enemyHp = (def, mult, minutes) =>
  Math.round(60 * def.hpMult * mult * (1 + (def.elite ? 0.04 : 0.06) * minutes));
export const enemyAtk = (def, mult, minutes) =>
  Math.round(20 * def.atkMult * Math.pow(mult, 0.6) * (1 + 0.03 * minutes));
export const bossHp = (def, mult) => Math.round(60 * def.hpMult * Math.pow(mult, 0.9));
export const bossAtk = (def, mult) => Math.round(20 * def.atkMult * Math.pow(mult, 0.6));

// ====================== 보스 ======================
// 코드로 그리는 실루엣 5종을 20 보스에 배분하고, 환경 색으로 팔레트를 만든다.
const SHAPES = ["tree", "bell", "beast", "golem", "blob"];
function paletteFor(rgb, dark) {
  const [r, g, b] = rgb;
  const mix = (v, t) => Math.round(v + (255 - v) * t);
  const dim = (v, t) => Math.round(v * t);
  return {
    body: `rgb(${mix(r, 0.25)},${mix(g, 0.25)},${mix(b, 0.25)})`,
    bodyDark: `rgb(${dim(r, 0.4)},${dim(g, 0.4)},${dim(b, 0.4)})`,
    accent: `rgb(${mix(r, 0.6)},${mix(g, 0.6)},${mix(b, 0.55)})`,
    canopy: `rgb(${dim(r, 0.55)},${dim(g, 0.55)},${dim(b, 0.55)})`,
  };
}
// 패턴 설명문 → 구현된 판정 종류
function patternKind(p) {
  const tel = (p.telegraph || "") + (p.name || "");
  if (p.name && /소환|호출|산란|부화/.test(p.name)) return "summonOnly";
  if (/링|파동|주변 원|확장/.test(tel)) return "ringOut";
  if (/부채꼴|원뿔|전방/.test(tel)) return "cone";
  if (/직선|돌진|레일|관통/.test(tel)) return "dashLine";
  if (/무작위 원|여러|\d+곳|낙석|우박/.test(tel)) return "scatter";
  if (/8방향|방사|사방|균열/.test(tel)) return "radial";
  return "groundCircle";
}

export const BOSSES = {};
Object.values(RAW_BOSSES).forEach((r, idx) => {
  const rgb = ENV_TINT[r.env] || [150, 120, 90];
  const alt = [Math.min(255, rgb[0] + 70), Math.max(30, rgb[1] - 30), Math.max(30, rgb[2] - 20)];
  BOSSES[r.id] = {
    id: r.id, name: r.name, shape: SHAPES[idx % SHAPES.length],
    hpMult: r.hpMult, atkMult: r.atkMult, radiusU: r.radiusU, spdU: r.spdU, restS: r.restS,
    drawScale: 1.25,
    palette: paletteFor(rgb), palette2: paletteFor(alt),
    phase2At: (r.phase2Pct || 50) / 100,
    patterns: r.patterns.slice(0, 4).map((p) => ({
      name: p.name, kind: patternKind(p), telegraphS: Math.max(0.4, p.telegraphS),
      dmg: p.dmg || 1, cooldownS: p.cooldownS || 7,
      summon: /소환|호출|산란/.test(p.name) ? { id: "EN01", n: 5 } : null,
      count: 10, knockback: /넉백/.test(p.telegraph || "") ? 2 : 0,
    })),
  };
});

// ====================== 챕터 ======================
export const CHAPTERS = RAW_CHAPTERS.map((c, i) => {
  const mix = c.mix.filter((id) => ENEMIES[id]);
  const elites = c.midBosses.filter((m) => ENEMIES[m.id]);
  const bossId = BOSSES[c.boss] ? c.boss : "BS01";
  const tint = ENV_TINT[c.env] || [120, 90, 70];
  return {
    id: c.id, name: c.name, env: c.env, index: i,
    timeLimitS: c.timeLimitS, enemyMult: c.enemyMult,
    mix: mix.length ? mix : ["EN01"],
    elites: elites.length ? elites : [{ id: "EL01", atS: 180 }],
    boss: bossId,
    // 보스 등장 시각: mid_bosses의 마지막 시각 뒤, 시간 제한 안쪽
    bossAtS: Math.min(c.timeLimitS - 60, Math.max(...c.midBosses.map((m) => m.atS), 240) + 60),
    density: c.density,
    dark: c.dark,
    gimmick: c.gimmick,
    groundTint: i === 0 ? null : `rgba(${tint[0]},${tint[1]},${tint[2]},${0.10 + Math.min(0.22, c.dark * 0.3)})`,
    firstClear: { gold: c.firstGold, dust: c.firstDust },
    repeat: { gold: c.repeatGold },
    firstRaw: c.firstRaw, repeatRaw: c.repeatRaw,
    unlocks: c.unlocks,
    desc: (c.gimmick || "").split(";")[0].trim(),
  };
});
export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) || CHAPTERS[0];

// ====================== 환경 테마 1 「쓰레기 마을」 덮어쓰기 (themes.js) ======================
// chapters.csv·enemies.csv·bosses.json은 그대로 두고, CH01~CH05의 적·엘리트·보스·바닥·악취 구역 비율만 테마 표로 바꾼다.
for (const id in T1_ENEMIES) {
  const r = T1_ENEMIES[id];
  ENEMIES[id] = {
    id, name: r.name, behavior: r.behavior, elite: r.type === "elite",
    hpMult: r.hpMult, atkMult: r.atkMult, spdU: r.spdU, radiusU: r.radiusU, mass: r.mass, xp: r.xp, ability: "",
    sprite: r.sprite, tint: null, hiRes: true, drawH: r.drawH,          // 고해상도 그림: 색조 없이 부드럽게 축소
    drawScale: (r.type === "elite" ? 2.4 : 1.5) * (0.8 + r.radiusU), bobAmp: r.type === "elite" ? 2.4 : 1.8, extraDr: 0,
    summon: r.summon || null, onDeathSpawn: r.onDeathSpawn || null,
  };
}
BOSSES[T1_BOSS.id] = { ...T1_BOSS, shape: "tree", palette: paletteFor([130, 150, 60]), palette2: paletteFor([200, 90, 60]) };
T1_STAGES.forEach((s, i) => {
  const ch = CHAPTERS[i];
  if (!ch) return;
  ch.theme = 1; ch.mix = s.mix; ch.elites = s.elites; ch.dark = s.dark; ch.floor = s.floor; ch.hint = s.hint;
  ch.groundTint = null; ch.desc = s.hint;
  if (s.boss) ch.boss = s.boss;
});

// ====================== 진화 · 융합 ======================
// docs/06 §6: 진화 = 공격 Lv5 + 짝 패시브 Lv≥2 / 융합 = 지정 공격 2종 모두 Lv5.
// 진화 후에는 Lv3까지만 강화되고(docs/07 §3.1), 계수·간격은 evolutions.csv 값을 쓴다.
export const EVOLUTIONS = {};
for (const id in RAW_EVOLUTIONS) {
  const r = RAW_EVOLUTIONS[id];
  const base = SKILLS[r.sourceA];
  if (!base) continue;
  EVOLUTIONS[id] = {
    id, name: r.name, type: r.type,             // evolution | fusion
    sourceA: r.sourceA, sourceB: r.sourceB,
    requiresPassiveLv: 2,
    dmgCoef: r.dmgCoef || base.dmgCoef,
    interval: Math.max(0.05, r.intervalS || base.interval),
    behaviorChange: r.behaviorChange,
    upgrades: r.upgrades,
    kind: base.kind,                             // 판정 방식은 원본 계열을 유지
    color: "#fff2b0",                            // 진화체는 금빛으로 구분
    maxLevel: 3,
  };
}
export const EVO_BY_SOURCE = {};
for (const id in EVOLUTIONS) {
  const e = EVOLUTIONS[id];
  (EVO_BY_SOURCE[e.sourceA] ||= []).push(e);
}

// ====================== 캐릭터 12종 ======================
// 해금 조건은 원본의 서술형이라, 실제로 판정 가능한 "챕터 N 클리어"로 정규화한다.
const CHAR_UNLOCK_CH = {
  C01: 0, C02: 2, C03: 6, C04: 4, C05: 8, C06: 12,
  C07: 18, C08: 6, C09: 20, C10: 20, C11: 15, C12: 40,
};
export const CHARACTERS = RAW_CHARACTERS.map((c) => ({
  id: c.id, name: c.name, title: c.title, role: c.role,
  baseWeapon: SKILLS[c.baseWeapon] ? c.baseWeapon : "S01",
  // 원본 HP는 1000 단위(장비 포함 설계치)라, 시제품 기준(120)에 맞춰 축소 환산
  atk: c.atk, hp: Math.round(c.hp * 0.12), spd: c.spd,
  passive: c.passive, abilityName: c.abilityName, abilityEffect: c.abilityEffect,
  affinity: c.affinity, locked: c.locked, note: c.note,
  unlockChapter: CHAR_UNLOCK_CH[c.id] ?? 10,
  unlockText: c.unlock,
}));
export const characterById = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

// ====================== 장비 48종 ======================
// 등급 배수·최대 레벨은 docs/09 §2.1, 주스탯 = base × 등급배수 × (1 + 0.03×Lv)
export const EQUIP_GRADES = [
  { id: 0, name: "일반", color: "#9a9a9a", mult: 1.0, maxLv: 20 },
  { id: 1, name: "고급", color: "#6ad06a", mult: 1.5, maxLv: 30 },
  { id: 2, name: "희귀", color: "#5aa8ff", mult: 2.3, maxLv: 40 },
  { id: 3, name: "영웅", color: "#c07aff", mult: 3.5, maxLv: 50 },
  { id: 4, name: "전설", color: "#ffc03a", mult: 5.5, maxLv: 60 },
  { id: 5, name: "신화", color: "#ff5a4a", mult: 8.5, maxLv: 80 },
];
// 슬롯 코드는 data/equipment.csv 그대로(WPN/NCK/GLV/ARM/BLT/BTS)
export const SLOT_NAMES = { WPN: "무기", NCK: "목걸이", GLV: "장갑", ARM: "갑옷", BLT: "벨트", BTS: "신발" };
export const SLOT_ORDER = ["WPN", "NCK", "GLV", "ARM", "BLT", "BTS"];

export const EQUIPMENT = {};
for (const e of RAW_EQUIPMENT) {
  EQUIPMENT[e.id] = {
    id: e.id, slot: e.slot, name: e.name, setId: e.setId,
    mainStat: e.mainStat, baseValue: e.baseValue,
    optRare: e.optRare, optEpic: e.optEpic, legendEffect: e.legendEffect, source: e.source,
  };
}
// 주스탯 값 (docs/09 §2.1)
export const equipMainStat = (def, grade, lv) =>
  Math.round(def.baseValue * EQUIP_GRADES[grade].mult * (1 + 0.03 * lv));
// 레벨업 비용 `8 × g × (L+1)^1.2`
export const equipLevelCost = (grade, lv) =>
  Math.round(8 * (grade + 1) * Math.pow(lv + 1, 1.2));

// ====================== 시간 모드 (docs/06 §4.3, §10) ======================
// 판 길이 · 보석 값 계수 · 보상 계수 · 최종 보스 · 봉화 · 에너지(modes.csv M01)
export const TIME_MODES = {
  fast: { id: "fast", name: "속공", dur: 300, gemMul: 2.2, rewardMul: 0.45, bossAtS: 240, beaconAtS: 210, energy: 5, rank: 0 },
  std:  { id: "std",  name: "표준", dur: 600, gemMul: 1.4, rewardMul: 0.75, bossAtS: 510, beaconAtS: 480, energy: 8, rank: 1 },
  full: { id: "full", name: "완전", dur: 900, gemMul: 1.0, rewardMul: 1.00, bossAtS: 840, beaconAtS: 780, energy: 10, rank: 2 },
};

// ====================== 에너지 · 티켓 (docs/11 §1) ======================
export const ENERGY_CAP = 120;               // 자연 회복 상한(보상으로는 200까지)
export const ENERGY_REGEN_S = 360;           // 6분당 1
export const MODE_ENERGY = { M02: 8, M05: 6, M07: 6 };
export const MODE_TICKET = { M03: "dungeon", M06: "hazard", M08: "exped" };
export const TICKET_CAP = { dungeon: 3, hazard: 5, exped: 2 };   // 일 3 / 주 5 / 주 2
export const QUICK_BATTLE_PER_DAY = 10;

// ====================== 슬롯/시작 ======================
export const START_SKILL = "S01";
export const ATTACK_SLOTS = 6;
export const PASSIVE_SLOTS = 6;

// ====================== 영구 강화(상점) ======================
export const UPGRADES = {
  UP_ATK: {
    id: "UP_ATK", name: "공격력 단련", icon: "⚔️", currency: "GOLD", maxLv: 60,
    desc: "레벨당 공격력 +2%",
    cost: (lv) => Math.round(25 * Math.pow(lv + 1, 1.5)),
    value: (lv) => lv * 0.02, valueText: (lv) => `+${(lv * 2).toFixed(0)}%`,
  },
  UP_HP: {
    id: "UP_HP", name: "체력 단련", icon: "🛡️", currency: "GOLD", maxLv: 60,
    desc: "레벨당 최대 체력 +2%",
    cost: (lv) => Math.round(25 * Math.pow(lv + 1, 1.5)),
    value: (lv) => lv * 0.02, valueText: (lv) => `+${(lv * 2).toFixed(0)}%`,
  },
  UP_SPD: {
    id: "UP_SPD", name: "경보 훈련", icon: "👟", currency: "DUST", maxLv: 20,
    desc: "레벨당 이동 속도 +1.5% (상한 +30%)",
    cost: (lv) => Math.round(40 * Math.pow(lv + 1, 1.3)),
    value: (lv) => Math.min(0.30, lv * 0.015),
    valueText: (lv) => `+${(Math.min(0.30, lv * 0.015) * 100).toFixed(1)}%`,
  },
  UP_MAG: {
    id: "UP_MAG", name: "등불의 인력", icon: "🧲", currency: "DUST", maxLv: 20,
    desc: "레벨당 보석 흡수 반경 +8% (상한 4.0u)",
    cost: (lv) => Math.round(35 * Math.pow(lv + 1, 1.3)),
    value: (lv) => lv * 0.08, valueText: (lv) => `+${(lv * 8).toFixed(0)}%`,
  },
  UP_REV: {
    id: "UP_REV", name: "불굴의 맹세", icon: "💗", currency: "DUST", maxLv: 2,
    desc: "쓰러져도 체력 50%로 부활 (판당 최대 2회)",
    cost: (lv) => [600, 1800][lv] ?? 0,
    value: (lv) => lv, valueText: (lv) => `부활 ${lv}회`,
  },
};

export const combatPower = (up) => {
  const a = UPGRADES.UP_ATK.value(up.UP_ATK || 0);
  const h = UPGRADES.UP_HP.value(up.UP_HP || 0);
  const s = UPGRADES.UP_SPD.value(up.UP_SPD || 0);
  const m = UPGRADES.UP_MAG.value(up.UP_MAG || 0);
  const r = UPGRADES.UP_REV.value(up.UP_REV || 0);
  return Math.round(100 * (1 + a) + 50 * (1 + h) + 120 * s + 60 * m + 80 * r);
};
