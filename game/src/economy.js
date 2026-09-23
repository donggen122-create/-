// 판 밖 경제·성장 시스템(docs/09, 10, 11 + data/rewards.csv, parts.csv, events.json).
// 장비 인벤토리·합성·분해·각인, 상자 확률/천장, 부품, 캐릭터 레벨·승급·각성·결속, 펫 등급·사료·진화·각성,
// 수집품 레벨, 실제 상점(rewards.csv), 프리셋, 칭호, 이벤트 6종 로직을 모은다. UI는 ecoui.js.
import { RAW_REWARDS, RAW_PARTS, RAW_EVENTS, RAW_BUILDS } from "./content.data.js";
import {
  EQUIPMENT, EQUIP_GRADES, SLOT_ORDER, equipLevelCost, CHARACTERS, SKILLS, BOSSES, CHAPTERS,
} from "./content.js";
import { PETS, COLLECTIBLES, SETS, RARITY, parseEffect, addBonus, TALENTS, RULES } from "./meta.js";

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
export function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function weekIndex(t = Date.now()) { return Math.floor((t - Date.UTC(2026, 0, 5)) / (7 * 86400000)); } // 월요일 기준
function monthKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; }

// ====================== 재화 ======================
export const CUR = {
  GOLD: ["금화", "💰"], DUST: ["별가루", "✨"], TP: ["특성점수", "🔷"], MEDAL: ["훈장", "🎖️"], SHARD: ["수집 파편", "🧩"],
  CORE: ["부품 코어", "⚙️"], AWAKEN: ["각성석", "💎"], ENHANCE: ["강화석", "🔨"], FOOD: ["사료", "🍖"],
  BLUEPRINT: ["전설 설계도 조각", "📜"], INF_TOKEN: ["무한 토큰", "♾️"], EXP_TOKEN: ["원정 토큰", "🧭"],
  SEALBOX: ["인장 선택", "🎫"], ENERGY: ["에너지", "⚡"],
  EVT_BOARD: ["탐사 주사위", "🎲"], EVT_MAP: ["탐험 지도 조각", "🗺️"], EVT_HUNT: ["사냥 표식", "🎯"],
  EVT_FORT: ["보급품", "📦"], EVT_INGR: ["축제 상자", "🎁"], EVT_TALLY: ["기여도", "🤝"],
};
export const curName = (k) => CUR[k]?.[0] || k;
export const curIcon = (k) => CUR[k]?.[1] || "";

// ====================== 상자 테이블 (rewards.csv kind=drop) ======================
const GRADE_IDX = { 일반: 0, 고급: 1, 희귀: 2, 영웅: 3, 전설: 4, 신화: 5 };
export const CHESTS = {};
for (const r of RAW_REWARDS) {
  if (r.kind !== "drop" || !/^RW_(EQ|PART|PET|COL)/.test(r.tableId)) continue;
  const t = (CHESTS[r.tableId] ||= { id: r.tableId, name: r.entry.replace(/\(.*\)/, "").trim(), full: r.entry, rows: [], pity: [] });
  const g = r.itemRef.match(/grade=(\S+)/)?.[1];
  const rar = r.itemRef.match(/rarity=(\w+)/)?.[1];
  t.kind = r.itemRef.split(":")[0];
  t.rows.push({ grade: g != null ? GRADE_IDX[g] : null, rarity: rar || null, w: +r.weightOrPrice || 0 });
  for (const m of String(r.pityOrLimit).matchAll(/(\d+)회마다 (\S+?) 확정/g)) {
    t.pity.push({ every: +m[1], grade: GRADE_IDX[m[2]], rarity: m[2] === "전설" ? "legend" : null, missing: m[2] === "미보유" });
  }
}
// 챕터 구간별 장비 상자(rewards.csv RW_CH_REPEAT 주석): 1~10 일반, 11~25 고급, 26~40 희귀, 41~55 영웅, 56~60 영웅+전설 5%
export function chapterChest(chIndex) {
  const n = chIndex + 1;
  if (n <= 10) return "RW_EQ_CHEST_N";
  if (n <= 25) return "RW_EQ_CHEST_F";
  if (n <= 40) return "RW_EQ_CHEST_R";
  if (n <= 55) return "RW_EQ_CHEST_E";
  return Math.random() < 0.05 ? "RW_EQ_CHEST_L" : "RW_EQ_CHEST_E";
}
const CHEST_BY_NAME = { 일반: "RW_EQ_CHEST_N", 고급: "RW_EQ_CHEST_F", 희귀: "RW_EQ_CHEST_R", 영웅: "RW_EQ_CHEST_E", 전설: "RW_EQ_CHEST_L" };

function rollRow(rows) {
  const total = rows.reduce((s, r) => s + r.w, 0);
  let x = Math.random() * total;
  for (const r of rows) { x -= r.w; if (x <= 0) return r; }
  return rows[rows.length - 1];
}

// ====================== 저장 마이그레이션 ======================
export function migrateSave(save) {
  save.currencies ||= {};
  for (const k of ["CORE", "AWAKEN", "ENHANCE", "FOOD", "BLUEPRINT", "INF_TOKEN", "EXP_TOKEN", "SEALBOX"]) save.currencies[k] ||= 0;
  save.seals ||= {};
  save.chars ||= {};
  save.chests ||= {};
  save.pity ||= {};
  save.parts ||= {};
  save.partSlots ||= { atk: [null, null, null], sup: [null, null] };
  save.resonance ||= {};
  save.partFav ||= [];
  save.petAssist ||= [null, null];
  save.shopBuys ||= {};
  save.presets ||= [];
  save.titles ||= [];
  save.title ||= "";
  save.events ||= {};
  save.nextRunBuffs ||= [];
  save.talentReset ||= { day: "", n: 0 };
  save.engrave ||= {};
  save.counters ||= {};
  save.blueprint ??= null;
  save.buildClears ||= [];
  // v3 장비 {EQ01:{grade,lv}} → v4 인벤토리 [{uid,id,grade,lv,locked}]
  if (!Array.isArray(save.inv)) {
    save.inv = []; save.nextUid = 1;
    const old = save.equipment || {};
    const map = {};
    for (const id in old) {
      if (!EQUIPMENT[id]) continue;
      const it = { uid: save.nextUid++, id, grade: old[id].grade || 0, lv: old[id].lv || 0, locked: false };
      save.inv.push(it); map[id] = it.uid;
    }
    for (const slot in save.equipped || {}) {
      const v = save.equipped[slot];
      save.equipped[slot] = typeof v === "string" ? (map[v] || null) : v;
    }
  }
  save.equipped ||= {};
  for (const k of ["NECK", "GLOVE", "ARMOR", "BELT", "BOOTS"]) delete save.equipped[k];   // 옛 슬롯 코드 정리
  // 빈 슬롯은 보유 중 최고 등급으로 자동 착용
  for (const slot of SLOT_ORDER) {
    if (save.equipped[slot] && invItem(save, save.equipped[slot])) continue;
    const best = save.inv.filter((i) => EQUIPMENT[i.id].slot === slot).sort((a, b) => b.grade - a.grade || b.lv - a.lv)[0];
    save.equipped[slot] = best ? best.uid : null;
  }
  // 펫 {lv} → {lv, grade, dup, evo, awk}
  for (const id in save.pets || {}) {
    const p = save.pets[id];
    p.lv ||= 1; p.grade ??= 0; p.dup ??= 0; p.evo ??= false; p.awk ??= false;
  }
  save.schemaVersion = 4;
  return save;
}

// ====================== 장비 ======================
export const invItem = (save, uid) => save.inv.find((i) => i.uid === uid) || null;
export function equippedItem(save, slot) { const u = save.equipped[slot]; return u ? invItem(save, u) : null; }
export const isEquipped = (save, uid) => SLOT_ORDER.some((s) => save.equipped[s] === uid);
export function addEquip(save, id, grade) {
  const it = { uid: save.nextUid++, id, grade, lv: 0, locked: false };
  save.inv.push(it);
  // 빈 슬롯이면 자동 착용
  const slot = EQUIPMENT[id].slot;
  if (!save.equipped[slot]) save.equipped[slot] = it.uid;
  return it;
}
export function levelGoldSum(grade, lv) { let s = 0; for (let L = 0; L < lv; L++) s += equipLevelCost(grade, L); return s; }
const srcChapter = (def) => +(String(def.source).match(/챕터\s*(\d+)/)?.[1] || 99);
export function equipPool(maxChapter, slot) {
  let pool = Object.values(EQUIPMENT).filter((d) => srcChapter(d) <= maxChapter && (!slot || d.slot === slot));
  if (!pool.length) pool = Object.values(EQUIPMENT).filter((d) => !slot || d.slot === slot);
  return pool;
}

// 합성 재료 계획(docs/09 §2.2). base는 장착 중이어도 되고, 재료는 잠금·장착 제외.
export function synthPlan(save, base) {
  if (!base || base.grade >= 5) return null;
  const free = (f) => save.inv.filter((i) => i !== base && !i.locked && !isEquipped(save, i.uid) && f(i))
    .sort((a, b) => a.lv - b.lv);
  const def = EQUIPMENT[base.id];
  if (base.grade <= 2) {
    const m = free((i) => i.id === base.id && i.grade === base.grade);
    return m.length >= 2 ? { mats: m.slice(0, 2), enhance: 0 } : { need: `같은 ${EQUIP_GRADES[base.grade].name} ${def.name} 2개 더` };
  }
  if (base.grade === 3) {
    const same = free((i) => i.id === base.id && i.grade === 3);
    if (!same.length) return { need: `같은 영웅 ${def.name} 1개 + 같은 부위 영웅 1개` };
    const other = free((i) => i !== same[0] && i.grade === 3 && EQUIPMENT[i.id].slot === def.slot);
    return other.length ? { mats: [same[0], other[0]], enhance: 0 } : { need: "같은 부위 영웅 1개 더" };
  }
  const same = free((i) => i.id === base.id && i.grade === 4);
  if (!same.length) return { need: `같은 전설 ${def.name} 1개 + 강화석 20` };
  return (save.currencies.ENHANCE || 0) >= 20 ? { mats: [same[0]], enhance: 20 } : { need: "강화석 20 필요" };
}
export function synthesize(save, uid) {
  const base = invItem(save, uid);
  const plan = synthPlan(save, base);
  if (!plan?.mats) return null;
  // 재료·본체의 레벨 투자 금화 90% 환급, 결과는 Lv1
  let refund = levelGoldSum(base.grade, base.lv);
  for (const m of plan.mats) refund += levelGoldSum(m.grade, m.lv);
  refund = Math.round(refund * 0.9);
  save.inv = save.inv.filter((i) => !plan.mats.includes(i));
  save.currencies.ENHANCE -= plan.enhance;
  save.currencies.GOLD += refund;
  base.grade += 1; base.lv = 1;
  bump(save, "synth", 1);
  return { item: base, refund };
}
// 일괄 합성: 잠금·장착 제외 모든 합성을 반복(docs/09 §2.5). 미리보기용 dry-run 지원
export function batchSynth(save, dry = false) {
  const work = dry ? structuredClone(save) : save;
  const results = [];
  for (let guard = 0; guard < 500; guard++) {
    const cand = work.inv
      .filter((i) => !i.locked && i.grade < 4)                 // 신화 합성은 강화석이 드니 수동
      .sort((a, b) => (isEquipped(work, b.uid) - isEquipped(work, a.uid)) || b.lv - a.lv)
      .find((i) => synthPlan(work, i)?.mats);
    if (!cand) break;
    const r = synthesize(work, cand.uid);
    results.push({ id: r.item.id, grade: r.item.grade });
  }
  return results;
}
// 분해: 하위 등급 재료로 100% 환급, 레벨 금화 90%(docs/09 §2.5)
export function dismantle(save, uid) {
  const it = invItem(save, uid);
  if (!it || it.locked || isEquipped(save, uid)) return null;
  save.inv = save.inv.filter((i) => i !== it);
  const gold = Math.round(levelGoldSum(it.grade, it.lv) * 0.9);
  save.currencies.GOLD += gold;
  const out = [];
  if (it.grade === 0) { save.currencies.GOLD += 150; out.push("금화 150"); }
  else if (it.grade === 5) { for (let k = 0; k < 2; k++) out.push(addEquip(save, it.id, 4)); save.currencies.ENHANCE += 20; }
  else for (let k = 0; k < (it.grade === 4 ? 3 : 3); k++) out.push(addEquip(save, it.id, it.grade - 1));
  return { gold, out };
}
// 각인(docs/09 §2.3): 신화만, 강화석 50 + 금화 100,000 / 재부여 강화석 25
export const ENGRAVES = [
  { id: "tag", name: "태그 피해 +10%", eff: { dmgPct: 0.10 } },
  { id: "status", name: "상태 이상 피해 +20%", eff: { statusDmgPct: 0.20 } },
  { id: "lum", name: "광휘 획득 +15%", eff: { lumPct: 0.15 } },
];
export function engrave(save, uid, kind) {
  const it = invItem(save, uid);
  if (!it || it.grade < 5) return false;
  const re = !!save.engrave[uid];
  const cost = re ? { ENHANCE: 25, GOLD: 0 } : { ENHANCE: 50, GOLD: 100000 };
  if (save.currencies.ENHANCE < cost.ENHANCE || save.currencies.GOLD < cost.GOLD) return false;
  save.currencies.ENHANCE -= cost.ENHANCE; save.currencies.GOLD -= cost.GOLD;
  save.engrave[uid] = kind;
  return true;
}
// 장비 세트 ESET01~08 (docs/09 §2.4, 등급 무관)
export const EQUIP_SETS = {
  ESET01: { name: "파수단 표준", b: ["공격력 +5%", "최대 체력 +8%", "광휘 획득 +15%"] },
  ESET02: { name: "바람 사수", b: ["투사체 속도 +15%", "projectile 스킬 투사체 +1", "projectile 피해 +15%"] },
  ESET03: { name: "등불 사제", b: ["beam·field 피해 +8%", "지속 +15%", "beam·field 피해 +15%"] },
  ESET04: { name: "폭파공", b: ["폭발 반경 +10%", "폭발 피해 +12%", "치명타 확률 +10%"] },
  ESET05: { name: "거인", b: ["근접 피해 +8%", "접촉 피해 -15%", "넉백 +50%"] },
  ESET06: { name: "조련사", b: ["소환체 피해 +10%", "펫 체력 +30%", "소환체 피해 +15%"] },
  ESET07: { name: "역병", b: ["상태 이상 피해 +10%", "상태 이상 피해 +10%", "상태 이상 피해 +20%"] },
  ESET08: { name: "도박사", b: ["치명타 확률 +5%", "치명타 피해 +25%", "치명타 확률 +10%"] },
};
export function equipSetCounts(save) {
  const n = {};
  for (const s of SLOT_ORDER) { const it = equippedItem(save, s); if (it) { const k = EQUIPMENT[it.id].setId; n[k] = (n[k] || 0) + 1; } }
  return n;
}

// ====================== 상자 개봉 ======================
// opt: { slot, sets:[SETxx], maxChapter }
export function openChest(save, tableId, opt = {}) {
  const t = CHESTS[tableId];
  if (!t) return null;
  const n = (save.pity[tableId] = (save.pity[tableId] || 0) + 1);
  let row = rollRow(t.rows);
  let forcedMissing = false;
  for (const p of t.pity) {
    if (n % p.every !== 0) continue;
    if (p.missing) forcedMissing = true;
    else if (p.grade != null && (row.grade == null || row.grade < p.grade)) row = t.rows.find((r) => r.grade === p.grade) || row;
    else if (p.rarity) row = t.rows.find((r) => r.rarity === p.rarity) || row;
  }
  bump(save, "chestOpen", 1);
  if (t.kind === "EQ") {
    const def = pick(equipPool(opt.maxChapter ?? 99, opt.slot));
    const it = addEquip(save, def.id, row.grade);
    return { kind: "EQ", text: `${EQUIP_GRADES[row.grade].name} ${def.name}`, color: EQUIP_GRADES[row.grade].color, item: it };
  }
  if (t.kind === "PART") {
    const w = PARTS.map((p) => (save.partFav.includes(p.skill) ? 2 : 1));
    let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < PARTS.length; i++) { x -= w[i]; if (x <= 0) break; }
    const p = PARTS[Math.min(i, PARTS.length - 1)];
    addPart(save, p.id, row.grade);
    return { kind: "PART", text: `${EQUIP_GRADES[row.grade].name} ${p.name}`, color: EQUIP_GRADES[row.grade].color };
  }
  if (t.kind === "PET") {
    // 상자 획득 가능 8종(PT05/07/11/12 제외), 10회마다 미보유 확정
    const pool = PETS.filter((p) => !["PT05", "PT07", "PT11", "PT12"].includes(p.id));
    const missing = pool.filter((p) => !save.pets[p.id]);
    const pet = forcedMissing && missing.length ? pick(missing) : pick(pool);
    const r = addPet(save, pet.id, row.grade);
    return { kind: "PET", text: `${EQUIP_GRADES[row.grade].name} ${pet.name}${r.dup ? " (중복→합성 재료)" : ""}`, color: EQUIP_GRADES[row.grade].color };
  }
  if (t.kind === "COL") {
    let pool = COLLECTIBLES.filter((c) => c.rarity === row.rarity && c.setId !== "SET20");
    if (opt.sets?.length) pool = COLLECTIBLES.filter((c) => opt.sets.includes(c.setId) && c.rarity === row.rarity);
    if (!pool.length) pool = COLLECTIBLES.filter((c) => (opt.sets?.length ? opt.sets.includes(c.setId) : c.setId !== "SET20"));
    const c = pick(pool);
    const r = addCollectible(save, c.id);
    return { kind: "COL", text: `${RARITY[c.rarity].name} ${c.name}${r.lvUp ? ` (Lv${r.lv})` : ""}${r.shard ? ` → 파편 ${r.shard}` : ""}`, color: RARITY[c.rarity].color };
  }
  return null;
}
export function openStoredChest(save, tableId, opt) {
  if (!(save.chests[tableId] > 0)) return null;
  save.chests[tableId]--;
  return openChest(save, tableId, opt);
}

// ====================== 수집품 레벨(docs/09 §5) ======================
// 보유 수 = 1 + 중복. Lv2:+1, Lv3:+2, Lv4:+3, Lv5:+4 (총 10개). Lv5 이후 중복은 파편으로 분해.
const COL_LV_AT = [1, 2, 4, 7, 11];
export function colLevel(n) { let lv = 0; for (let i = 0; i < 5; i++) if (n >= COL_LV_AT[i]) lv = i + 1; return lv; }
export const colMult = (lv) => [0, 1, 1.25, 1.5, 2, 3][lv] || 0;
const COL_DISMANTLE = { rare: 30, epic: 80, legend: 300 };
export function addCollectible(save, id) {
  const c = COLLECTIBLES.find((x) => x.id === id);
  const n = save.collectibles[id] || 0;
  if (n >= 11) {
    const shard = Math.round(COL_DISMANTLE[c.rarity] * (1 + (save.talents?.TC19 ? 0.2 : 0)));
    save.currencies.SHARD += shard;
    return { dup: true, lv: 5, shard };
  }
  const before = colLevel(n);
  save.collectibles[id] = n + 1;
  const lv = colLevel(n + 1);
  bump(save, "colGain", 1);
  return { dup: n > 0, lv, lvUp: lv > before && n > 0 };
}

// ====================== 부품 24 (docs/09 §3, parts.csv) ======================
export const PARTS = RAW_PARTS.map((r) => ({
  id: r.id, name: r.name, skill: r.skillId, stat: r.statType,
  vals: [r.statCommon, r.statFine, r.statRare, r.statEpic, r.statLegend, r.statMyth].map(Number),
  epic: r.behaviorEpic, legend: r.behaviorLegend, myth: r.behaviorMyth, res: r.resonanceLv30,
}));
export const partById = (id) => PARTS.find((p) => p.id === id);
// 동작 변경 문장을 판정 가능한 수정자로 근사(영웅=epic, 전설=+진화 후 legend, 신화=myth가 epic을 대체, 공명=진화 후)
const PART_MODS = {
  T01: [{ dmgMul: 1.12 }, { blastMul: 1.2 }, { dmgMul: 1.25 }, { projectiles: 2 }],
  T02: [{ dmgMul: 1.2 }, { durMul: 1.2 }, { dmgMul: 1.3 }, { durMul: 1.4 }],
  T03: [{ knockMul: 1.3, dmgMul: 1.1 }, { projectiles: 1 }, { dmgMul: 1.2, knockMul: 1.3 }, { projectiles: 2 }],
  T04: [{ chains: 1 }, { dmgMul: 1.15 }, { chains: 2 }, { bolts: 1 }],
  T05: [{ dmgMul: 1.25 }, { areaMul: 1.15 }, { dmgMul: 1.4 }, { areaMul: 1.25 }],
  T06: [{ areaMul: 1.1 }, { dmgMul: 1.2 }, { areaMul: 1.2 }, { durMul: 1.3 }],
  T07: [{ dmgMul: 1.15 }, { dmgMul: 1.1 }, { dmgMul: 1.3 }, { blastMul: 1.3 }],
  T08: [{ durMul: 1.2 }, { blastMul: 1.3 }, { durMul: 1.4 }, { projectiles: 1 }],
  T09: [{ blastMul: 1.3 }, { dmgMul: 1.15 }, { blastMul: 1.45 }, { projectiles: 2 }],
  T10: [{ dmgMul: 1.2 }, { areaMul: 1.2 }, { dmgMul: 1.3 }, { bolts: 4 }],
  T11: [{ projectiles: 1 }, { durMul: 2 }, { projectiles: 2 }, { projectiles: 3 }],
  T12: [{ widthMul: 1.2, dmgMul: 1.1 }, { dmgMul: 1.3 }, { widthMul: 1.4, dmgMul: 1.1 }, { projectiles: 2 }],
  T13: [{ dmgMul: 1.15 }, { areaMul: 1.1 }, { dmgMul: 1.3 }, { areaMul: 1.3 }],
  T14: [{ dmgMul: 1.15 }, { dmgMul: 1.2 }, { dmgMul: 1.3 }, { widthMul: 1.5 }],
  T15: [{ dmgMul: 1.25 }, { areaMul: 1.3 }, { dmgMul: 1.5 }, { intervalMul: 0.8 }],
  T16: [{ dmgMul: 1.1 }, { blastMul: 1.2 }, { dmgMul: 1.2 }, { projectiles: 2 }],
  T17: [{ lenMul: 1.4 }, { dmgMul: 1.15 }, { lenMul: 1.6 }, { intervalMul: 0.75 }],
  T18: [{ areaMul: 1.5 }, { dmgMul: 1.15 }, { areaMul: 1.5, dmgMul: 1.2 }, { projectiles: 4 }],
  T19: [{ intervalMul: 0.8 }, { dmgMul: 1.15 }, { intervalMul: 0.7 }, { projectiles: 1 }],
  T20: [{ areaMul: 1.15 }, { dmgMul: 1.2 }, { areaMul: 1.3 }, { intervalMul: 0.8 }],
  T21: [{ dmgMul: 1.15 }, { projectiles: 1 }, { dmgMul: 1.3 }, { dmgMul: 1.2 }],
  T22: [{ dmgMul: 1.1 }, { areaMul: 1.2 }, { areaMul: 1.3 }, { bolts: 3 }],
  T23: [{ dmgMul: 1.15 }, { dmgMul: 1.1 }, { dmgMul: 1.3 }, { projectiles: 2 }],
  T24: [{ dmgMul: 1.15 }, { durMul: 1.2 }, { dmgMul: 1.3 }, { projectiles: 1 }],
};
export function partGrade(save, id) {
  const c = save.parts[id]; if (!c) return -1;
  for (let g = 5; g >= 0; g--) if (c[g] > 0) return g;
  return -1;
}
export function addPart(save, id, g) {
  save.parts[id] ||= [0, 0, 0, 0, 0, 0];
  save.parts[id][g]++;
  bump(save, "partGain", 1);
}
export function partSynth(save, id, g) {
  const c = save.parts[id];
  if (!c || g >= 5) return false;
  if (g === 4) {                                        // 신화 = 전설 2 + 코어 100
    if (c[4] < 2 || save.currencies.CORE < 100) return false;
    c[4] -= 2; save.currencies.CORE -= 100; c[5]++;
  } else {
    if (c[g] < 3) return false;
    c[g] -= 3; c[g + 1]++;
  }
  bump(save, "partSynth", 1);
  return true;
}
export function partDismantle(save, id, g) {
  const c = save.parts[id];
  if (!c || c[g] <= 0) return false;
  if (partGrade(save, id) === g && c[g] === 1 && [...save.partSlots.atk, ...save.partSlots.sup].includes(id)) return false;
  c[g]--;
  if (g === 0) save.currencies.CORE += 10;
  else if (g === 5) { c[4] += 2; save.currencies.CORE += 100; }
  else c[g - 1] += 3;
  return true;
}
export function resonate(save, id) {
  if (partGrade(save, id) < 5 || save.resonance[id]) return false;
  if (Object.keys(save.resonance).length >= 3 || save.currencies.CORE < 200) return false;
  save.currencies.CORE -= 200; save.resonance[id] = true;
  bump(save, "partSynth", 1);
  return true;
}
export function equipPart(save, kind, idx, id) {
  for (const k of ["atk", "sup"]) save.partSlots[k] = save.partSlots[k].map((x) => (x === id ? null : x));
  save.partSlots[kind][idx] = id;
}
// 판 안 스킬 수정자: 공격 슬롯 부품만 동작 변경 적용
export function partSkillMods(save, skillId, evolved) {
  const out = [];
  for (const id of save.partSlots.atk) {
    if (!id) continue;
    const p = partById(id); if (p.skill !== skillId) continue;
    const g = partGrade(save, id); const m = PART_MODS[id];
    if (g >= 3) out.push(g >= 5 ? m[2] : m[0]);
    if (g >= 4 && evolved) out.push(m[1]);
    if (evolved && save.resonance[id]) out.push(m[3]);
  }
  return out;
}
export function partSkillSet(save) { return new Set(save.partSlots.atk.filter(Boolean).map((id) => partById(id).skill)); }

// ====================== 캐릭터 레벨·승급·각성·결속 (docs/09 §1.2, characters.json) ======================
export const PROMO_COST = [20, 40, 80, 120, 200];
export const AWAKEN_COST = [10, 25, 50];
export const charLvCost = (L) => Math.round(25 * Math.pow(L, 1.5));
export function charState(save, id) { return (save.chars[id] ||= { lv: 1, promo: 0, awk: 0, unlocked: false }); }
export function bondLevel(save, unlockedFn) {
  let s = 0;
  for (const c of CHARACTERS) {
    if (!unlockedFn(c)) continue;
    const st = charState(save, c.id);
    s += st.lv + st.promo * 5 + st.awk * 10;
  }
  return Math.min(50, Math.floor(s / 20));
}
export function charLevelUp(save, id, accountLv) {
  const st = charState(save, id);
  if (st.lv >= 60 || st.lv >= accountLv + 5) return { ok: false, reason: "계정 Lv+5 상한" };
  const cost = charLvCost(st.lv);
  if (save.currencies.GOLD < cost) return { ok: false, reason: "금화 부족" };
  save.currencies.GOLD -= cost; st.lv++;
  return { ok: true };
}
export function charPromote(save, id) {
  const st = charState(save, id);
  if (st.promo >= 5) return false;
  const cost = PROMO_COST[st.promo];
  if ((save.seals[id] || 0) < cost) return false;
  save.seals[id] -= cost; st.promo++;
  return true;
}
export function charAwaken(save, id) {
  const st = charState(save, id);
  if (st.awk >= 3) return false;
  const cost = AWAKEN_COST[st.awk];
  if (save.currencies.AWAKEN < cost) return false;
  save.currencies.AWAKEN -= cost; st.awk++;
  return true;
}
export function charUnlockBySeal(save, id) {
  if ((save.seals[id] || 0) < 30) return false;
  save.seals[id] -= 30; charState(save, id).unlocked = true;
  return true;
}
// 해금된 캐릭터가 인장을 또 받으면 그대로 승급 재료가 된다(중복 해금 → 인장).
export function useSealBox(save, id, n) {
  n = Math.min(n, save.currencies.SEALBOX || 0);
  if (n <= 0) return 0;
  save.currencies.SEALBOX -= n; save.seals[id] = (save.seals[id] || 0) + n;
  return n;
}

// ====================== 펫 (docs/09 §4) ======================
export function addPet(save, id, grade) {
  const p = save.pets[id];
  if (!p) { save.pets[id] = { lv: 1, grade, dup: 0, evo: false, awk: false }; return { dup: false }; }
  if (grade > p.grade) { p.dup += 1; p.grade = grade; } else p.dup += 1;
  return { dup: true };
}
export const petFoodCost = (lv) => 10 * lv;
export function petPower(save, id) {
  const p = save.pets[id]; if (!p) return 1;
  return (1 + 0.03 * (p.lv - 1)) * Math.pow(1.25, p.grade) * (p.evo ? 1.3 : 1) * (p.awk ? 1.3 : 1);
}
export function petLevelUp(save, id) {
  const p = save.pets[id];
  if (!p || p.lv >= 50 || save.currencies.FOOD < petFoodCost(p.lv)) return false;
  save.currencies.FOOD -= petFoodCost(p.lv); p.lv++;
  bump(save, "petLv", 1);
  return true;
}
export function petGradeUp(save, id) {       // 같은 펫 3 = 본체 + 중복 2
  const p = save.pets[id];
  if (!p || p.grade >= 4 || p.dup < 2) return false;
  p.dup -= 2; p.grade++;
  return true;
}
export function petEvolve(save, id) {
  const p = save.pets[id];
  if (!p || p.evo || p.grade < 3 || save.currencies.AWAKEN < 5) return false;
  save.currencies.AWAKEN -= 5; p.evo = true; return true;
}
export function petAwaken(save, id) {
  const p = save.pets[id];
  if (!p || p.awk || p.grade < 4 || save.currencies.AWAKEN < 15) return false;
  save.currencies.AWAKEN -= 15; p.awk = true; return true;
}

// ====================== 판 밖 보너스 합산(경제 쪽) ======================
export function economyBonus(save, charUnlockedFn) {
  const acc = {};
  const add = (k, v) => { acc[k] = (acc[k] || 0) + v; };
  // 캐릭터: 레벨 +2%/Lv, 승급 +6%/단계, 결속 +1%/Lv
  const c = CHARACTERS.find((x) => x.id === save.character) || CHARACTERS[0];
  const st = charState(save, c.id);
  const bond = bondLevel(save, charUnlockedFn);
  const statPct = 0.02 * (st.lv - 1) + 0.06 * st.promo + 0.01 * bond;
  add("atkPct", statPct); add("hpPct", statPct);
  const raw = CHAR_BONUS[c.id] || {};
  if (st.promo >= 3) addBonus(acc, bonusEff(raw.promo3, { abilityDmgPct: 0.3 }));
  if (st.promo >= 5) addBonus(acc, bonusEff(raw.promo5, { abilityDmgPct: 0.5 }));
  if (st.awk >= 1) add("revive", 1);
  if (st.awk >= 2) addBonus(acc, bonusEff(raw.awaken2, { abilityDmgPct: 0.25 }));
  if (st.awk >= 3) addBonus(acc, bonusEff(raw.awaken3, { dmgPct: 0.1 }));
  // 장비 세트
  const sc = equipSetCounts(save);
  for (const k in sc) {
    const s = EQUIP_SETS[k]; if (!s) continue;
    [2, 4, 6].forEach((need, i) => { if (sc[k] >= need) addBonus(acc, parseEffect(s.b[i])); });
  }
  // 각인
  for (const s of SLOT_ORDER) {
    const it = equippedItem(save, s);
    const e = it && save.engrave[it.uid] && ENGRAVES.find((x) => x.id === save.engrave[it.uid]);
    if (e) addBonus(acc, e.eff);
  }
  // 부품 능력치(공격·보조 슬롯 공통): stat_type atk → 공격력 %, hp → 체력 %
  for (const id of [...save.partSlots.atk, ...save.partSlots.sup]) {
    if (!id) continue;
    const p = partById(id); const g = partGrade(save, id); if (g < 0) continue;
    add(p.stat === "hp" ? "hpPct" : "atkPct", p.vals[g] / 100);
  }
  // 지원 펫 2(같은 지원 스킬 중복 불가, 출전 펫의 지원 스킬은 미적용)
  const seen = new Set();
  for (const id of save.petAssist) {
    if (!id || id === save.activePet || seen.has(id)) continue;
    seen.add(id);
    const p = PETS.find((x) => x.id === id);
    if (p?.eff) addBonus(acc, p.eff, 1 + 0.1 * ((save.pets[id]?.lv || 1) - 1));
  }
  // 펫 도감 12종: 펫 체력 +10%
  if (Object.keys(save.pets).length >= 12) add("petHpPct", 0.1);
  // 이벤트 소비형 버프(다음 판 1회)
  for (const b of save.nextRunBuffs) addBonus(acc, b.eff);
  return acc;
}
const CHAR_BONUS = {};
export function setCharBonusTable(rows) { for (const r of rows) CHAR_BONUS[r.id] = r; }
function bonusEff(text, fallback) {
  const e = parseEffect(text || "");
  return e && Object.keys(e).length ? e : fallback;
}

// ====================== 카운터(미션·업적용) ======================
export function bump(save, key, n = 1) {
  save.counters ||= {};
  save.counters[key] = (save.counters[key] || 0) + n;
  save._pendingBumps = save._pendingBumps || {};
  save._pendingBumps[key] = (save._pendingBumps[key] || 0) + n;
}

// ====================== 보상 지급 ======================
// reward: parseReward 결과. 재화 키 + RW_* 상자 + SEAL_Cxx + COL_COxxx + PET_PTxx + TITLE + ENERGY + COLLECTIBLE
export function grant(save, reward, opt = {}) {
  const out = [];
  for (const k in reward) {
    const v = reward[k];
    if (k === "TITLE") { if (!save.titles.includes(v)) save.titles.push(v); out.push(`칭호 「${v}」`); continue; }
    if (k === "COLLECTIBLE") {
      for (let i = 0; i < v; i++) {
        const pool = COLLECTIBLES.filter((c) => c.setId !== "SET20");
        const c = pick(pool); addCollectible(save, c.id); out.push(`수집품 ${c.name}`);
      }
      continue;
    }
    if (k === "PET") {
      const pool = PETS.filter((p) => !save.pets[p.id]); const p = pool.length ? pick(pool) : pick(PETS);
      addPet(save, p.id, 2); out.push(`펫 ${p.name}`); continue;
    }
    if (k === "ENERGY") { save.energy.value = Math.min(200, save.energy.value + v); out.push(`⚡${v}`); continue; }
    if (k.startsWith("SEAL_")) { const id = k.slice(5); save.seals[id] = (save.seals[id] || 0) + v; out.push(`${charName(id)} 인장 ${v}`); continue; }
    if (k.startsWith("COL_")) { const id = k.slice(4); for (let i = 0; i < v; i++) addCollectible(save, id); out.push(COLLECTIBLES.find((c) => c.id === id)?.name || id); continue; }
    if (k.startsWith("PET_")) { const id = k.slice(4); addPet(save, id, 0); out.push(PETS.find((p) => p.id === id)?.name || id); continue; }
    if (k.startsWith("RW_")) {
      if (opt.openNow) for (let i = 0; i < v; i++) { const r = openChest(save, k, opt); if (r) out.push(r.text); }
      else { save.chests[k] = (save.chests[k] || 0) + v; out.push(`${CHESTS[k]?.name || k} ×${v}`); }
      continue;
    }
    if (k.startsWith("CHESTSET_")) {           // 세트 지정 수집품 상자(SET07/16 등)
      const sets = k.slice(9).split("_");
      for (let i = 0; i < v; i++) { const r = openChest(save, "RW_COL_SET_CHEST", { sets }); if (r) out.push(r.text); }
      continue;
    }
    save.currencies[k] = (save.currencies[k] || 0) + v;
    if (k.startsWith("EVT_")) bump(save, "eventTokens", v);
    out.push(`${curIcon(k)}${curName(k)} ${v.toLocaleString()}`);
  }
  // 설계도 30조각 = 전설 장비 상자 1
  while ((save.currencies.BLUEPRINT || 0) >= 30) {
    save.currencies.BLUEPRINT -= 30; save.chests.RW_EQ_CHEST_L = (save.chests.RW_EQ_CHEST_L || 0) + 1;
    out.push("설계도 30조각 → 전설 장비 상자");
  }
  return out;
}
const charName = (id) => CHARACTERS.find((c) => c.id === id)?.name || id;
export function rewardText(reward) {
  return Object.entries(reward).map(([k, v]) => {
    if (k === "TITLE") return `칭호 「${v}」`;
    if (k === "COLLECTIBLE") return "수집품";
    if (k === "ENERGY") return `⚡${v}`;
    if (k.startsWith("SEAL_")) return `${charName(k.slice(5))} 인장 ${v}`;
    if (k.startsWith("COL_")) return COLLECTIBLES.find((c) => c.id === k.slice(4))?.name || k;
    if (k.startsWith("PET_")) return PETS.find((p) => p.id === k.slice(4))?.name || k;
    if (k.startsWith("RW_")) return `${CHESTS[k]?.name || k}${v > 1 ? ` ×${v}` : ""}`;
    if (k.startsWith("CHESTSET_")) return `${k.slice(9).replace("_", "/")} 지정 상자`;
    return `${curIcon(k)}${v.toLocaleString()}`;
  }).join(" ");
}
// 문장형 첫 클리어 보상에서 장비 상자·인장 등 추가 항목 추출
export function chestReward(text) {
  const out = {};
  for (const m of String(text).matchAll(/장비 상자\((\S+?)\)\s*(\d+)?/g)) {
    const id = CHEST_BY_NAME[m[1]]; if (id) out[id] = (out[id] || 0) + (+m[2] || 1);
  }
  return out;
}

// ====================== 상점 (rewards.csv kind=shop) ======================
const SHOP_CUR = {
  RW_SHOP_MEDAL: "MEDAL", RW_SHOP_INFINITE: "INF_TOKEN", RW_SHOP_HAZARD: "SHARD", RW_SHOP_BOSS: "MEDAL",
  RW_SHOP_EXPED: "EXP_TOKEN", RW_SHOP_DUST: "DUST",
  RW_EV_BOARD: "EVT_BOARD", RW_EV_EXPED: "EVT_MAP", RW_EV_HUNT: "EVT_HUNT", RW_EV_FORT: "EVT_FORT", RW_EV_INGR: "EVT_INGR",
};
export const SHOP_MODE = { RW_SHOP_INFINITE: "M07", RW_SHOP_HAZARD: "M06", RW_SHOP_BOSS: "M04", RW_SHOP_EXPED: "M08" };
export const SHOPS = {};
for (const r of RAW_REWARDS) {
  if (r.kind !== "shop" || !SHOP_CUR[r.tableId]) continue;
  const s = (SHOPS[r.tableId] ||= { id: r.tableId, name: r.entry.replace(/\(.*\)$/, "").trim(), cur: SHOP_CUR[r.tableId], items: [] });
  if (!s.fullName) s.fullName = r.entry;
  const lim = String(r.pityOrLimit);
  const m = lim.match(/(일|주|월|시즌)?\s*(\d+)회/);
  s.items.push({
    key: `${r.tableId}#${s.items.length}`, name: r.itemRef, price: +r.weightOrPrice || 0, qty: +r.qty || 1,
    period: /무제한|무료 소진/.test(lim) ? "none" : m ? ({ 일: "day", 주: "week", 월: "month", 시즌: "season" }[m[1]] || "once") : "none",
    limit: m ? +m[2] : Infinity, limitText: lim, note: r.notes,
    after: lim.match(/1회 후 주 1회 (\d+)인장/) ? +lim.match(/1회 후 주 1회 (\d+)인장/)[1] : null,
    priceUp: ((pm) => (pm ? { from: +pm[1], price: +pm[2] } : null))(String(r.notes).match(/(\d+)회부터 (\d+)/)),
  });
}
function periodKey(p) {
  return p === "day" ? todayKey() : p === "week" ? `W${weekIndex()}` : p === "month" ? monthKey() : p === "season" ? `S${Math.floor(weekIndex() / 8)}` : "all";
}
export function shopBought(save, item) {
  const b = save.shopBuys[item.key];
  if (!b) return 0;
  if (item.after != null) return b.total ? (b.pk === periodKey("week") ? b.n : 0) : 0;
  return b.pk === periodKey(item.period) ? b.n : 0;
}
export function shopPrice(save, item) {
  if (item.priceUp && shopBought(save, item) + 1 >= item.priceUp.from) return item.priceUp.price;
  return item.price;
}
export function shopCanBuy(save, shop, item) {
  const bought = shopBought(save, item);
  const b = save.shopBuys[item.key];
  if (item.after != null) { if (b?.total && bought >= 1) return false; }
  else if (item.period === "once" && (b?.n || 0) >= item.limit) return false;
  else if (bought >= item.limit) return false;
  return (save.currencies[shop.cur] || 0) >= shopPrice(save, item);
}
export function shopBuy(save, shop, item, ctx = {}) {
  if (!shopCanBuy(save, shop, item)) return null;
  const price = shopPrice(save, item);
  save.currencies[shop.cur] -= price;
  const b = (save.shopBuys[item.key] ||= { pk: "", n: 0, total: 0 });
  const pk = item.after != null ? periodKey("week") : periodKey(item.period);
  if (b.pk !== pk) { b.pk = pk; b.n = 0; }
  const qty = item.after != null && b.total > 0 ? item.after : item.qty;
  b.n++; b.total++;
  return applyItem(save, item.name, qty, ctx);
}
// 상점·이벤트 항목 문장 → 실제 지급
export function applyItem(save, name, qty = 1, ctx = {}) {
  let m;
  const maxCh = ctx.maxChapter ?? 60;
  if ((m = name.match(/^(C\d\d) 인장/))) return grant(save, { [`SEAL_${m[1]}`]: qty });
  if (/인장 선택/.test(name)) return grant(save, { SEALBOX: qty });
  if (/부품 상자/.test(name)) return times(qty, () => openChest(save, "RW_PART_CHEST"));
  if (/강화석/.test(name)) return grant(save, { ENHANCE: qty });
  if ((m = name.match(/(SET[\d/]+) 지정 상자/)) || (m = name.match(/(SET[\d/]+)/))) {
    const nums = m[1].replace("SET", "").split("/");
    const sets = nums.map((n) => `SET${n.padStart(2, "0")}`);
    return times(qty, () => openChest(save, "RW_COL_SET_CHEST", { sets }));
  }
  if ((m = name.match(/에너지 (\d+)/))) return grant(save, { ENERGY: +m[1] * qty });
  if ((m = name.match(/코어 (\d+)/))) return grant(save, { CORE: +m[1] * qty });
  if ((m = name.match(/^(PT\d\d)/))) return grant(save, { [`PET_${m[1]}`]: 1 });
  if (/설계도 조각/.test(name)) return grant(save, { BLUEPRINT: qty });
  if (/각성석/.test(name)) return grant(save, { AWAKEN: qty });
  if ((m = name.match(/^(CO\d{3})/))) return grant(save, { [`COL_${m[1]}`]: 1 });
  if (/전설 장비 상자/.test(name)) return times(qty, () => openChest(save, "RW_EQ_CHEST_L", { slot: ctx.slot, maxChapter: 99 }));
  if (/영웅 장비 상자/.test(name)) return times(qty, () => openChest(save, "RW_EQ_CHEST_E", { maxChapter: maxCh }));
  if (/희귀 장비 상자/.test(name)) return times(qty, () => openChest(save, "RW_EQ_CHEST_R", { maxChapter: maxCh }));
  if (/펫 상자/.test(name)) return times(qty, () => openChest(save, "RW_PET_CHEST"));
  if ((m = name.match(/수집 파편 (\d+)/))) return grant(save, { SHARD: +m[1] * qty });
  if (/자원 던전 티켓/.test(name)) { save.tickets.dungeon = (save.tickets.dungeon || 0) + qty; return ["자원 던전권 +1"]; }
  if (/특성 초기화/.test(name)) { const r = resetTalents(save); return [`특성 초기화 (🔷${r.tp} · 💰${r.gold} 환급)`]; }
  if (/한정 수집품|보스 전용 수집품/.test(name)) {
    const pool = COLLECTIBLES.filter((c) => c.rarity === "legend" && c.setId !== "SET20");
    const c = pick(pool); addCollectible(save, c.id); return [`한정 수집품 ${c.name}`];
  }
  if (/한정 펫/.test(name)) {
    const pool = PETS.filter((p) => !save.pets[p.id]);
    const p = pool.length ? pick(pool) : pick(PETS); addPet(save, p.id, 3); return [`한정 펫 ${p.name}(영웅)`];
  }
  if (/금화 (\d+)/.test(name)) return grant(save, { GOLD: +name.match(/금화 (\d+)/)[1] * qty });
  return [`${name} ×${qty}`];
}
function times(n, fn) { const out = []; for (let i = 0; i < n; i++) { const r = fn(); if (r) out.push(r.text); } return out; }

// 특성 초기화: 하루 1회 무료(TC18로 2회), 이후 별가루 상점. TP 100%·금화 50% 환급(docs/09 §6)
export function resetTalents(save) {
  let tp = 0, gold = 0;
  for (const t of TALENTS) {
    const r = save.talents[t.id] || 0;
    tp += r * t.costTp; gold += Math.round(r * t.costGold * 0.5);
  }
  save.talents = {};
  save.currencies.TP += tp; save.currencies.GOLD += gold;
  return { tp, gold };
}
export function freeResetLeft(save) {
  if (save.talentReset.day !== todayKey()) { save.talentReset.day = todayKey(); save.talentReset.n = 0; }
  return (save.talents?.TC18 ? 2 : 1) - save.talentReset.n;
}

// ====================== 프리셋 (장비 6 + 부품 5 + 펫 3 + 캐릭터 1) ======================
export const PRESET_MAX = 5;
export function savePreset(save, idx, name) {
  save.presets[idx] = {
    name: name || `프리셋 ${idx + 1}`, character: save.character, equipped: { ...save.equipped },
    partSlots: structuredClone(save.partSlots), activePet: save.activePet, petAssist: [...save.petAssist],
    blueprint: save.blueprint ? structuredClone(save.blueprint) : null,
  };
}
export function loadPreset(save, idx) {
  const p = save.presets[idx]; if (!p) return false;
  save.character = p.character;
  const eq = {};
  for (const s in p.equipped) if (invItem(save, p.equipped[s])) eq[s] = p.equipped[s];
  save.equipped = eq;
  save.partSlots = structuredClone(p.partSlots);
  save.activePet = save.pets[p.activePet] ? p.activePet : save.activePet;
  save.petAssist = p.petAssist.map((id) => (save.pets[id] ? id : null));
  save.blueprint = p.blueprint ? structuredClone(p.blueprint) : save.blueprint;
  save.presetLoadedAt = Date.now();
  return true;
}

// ====================== 이벤트 6 (events.json) ======================
export const EVENTS = RAW_EVENTS.map((e) => ({
  ...e, name: e.name.replace(/\(.*\)/, "").trim(), unlockCh: +(String(e.unlock).match(/CH(\d+)/)?.[1] || 5),
}));
const ROT_MAIN = ["EV_T1", "EV_T5", "EV_T2", "EV_T4"];     // 장기형(2주 단위)
const ROT_SHORT = ["EV_T3", "EV_T6"];                      // 단기형(1주 단위) — 동시 최대 2개
const LEFTOVER_RATE = { EVT_BOARD: 200, EVT_MAP: 300, EVT_HUNT: 50, EVT_FORT: 100, EVT_INGR: 80 };
let weekOffset = 0;                                        // QA용: 다른 주차 이벤트 미리보기
export function __setWeekOffset(n) { weekOffset = n; }
export function activeEvents() {
  const w = weekIndex() + weekOffset;
  return [
    { tpl: ROT_MAIN[Math.floor(w / 2) % 4], inst: `${ROT_MAIN[Math.floor(w / 2) % 4]}_${Math.floor(w / 2)}`, endsWeek: Math.floor(w / 2) * 2 + 2 },
    { tpl: ROT_SHORT[w % 2], inst: `${ROT_SHORT[w % 2]}_${w}`, endsWeek: w + 1 },
  ].map((a) => ({ ...a, def: EVENTS.find((e) => e.id === a.tpl) }));
}
export function eventUnlocked(ev, accountLv, clearedCount) { return accountLv >= 15 && clearedCount >= ev.def.unlockCh; }
export function eventState(save, a) {
  const s = (save.events[a.inst] ||= { tpl: a.tpl, day: "", gainedToday: 0, pos: 0, laps: 0, path: [], done: 0,
    bars: 0, huntDay: "", huntN: 0, fortLv: 1, ingr: [0, 0, 0, 0], recipes: [], tally: 0, claimed: [], lapClaimed: 0 });
  if (s.day !== todayKey()) { s.day = todayKey(); s.gainedToday = 0; }
  return s;
}
// 끝난 이벤트의 남은 토큰 → 금화 환전(leftover_policy), 방어 거점 레벨 50% 이월
export function settleOldEvents(save) {
  const live = new Set(activeEvents().map((a) => a.inst));
  const msgs = [];
  for (const inst in save.events) {
    if (live.has(inst) || save.events[inst].settled) continue;
    const ev = EVENTS.find((e) => e.id === save.events[inst].tpl);
    const tok = ev?.tokenId;
    if (tok && LEFTOVER_RATE[tok] && save.currencies[tok] > 0) {
      const g = save.currencies[tok] * LEFTOVER_RATE[tok];
      save.currencies.GOLD += g; msgs.push(`${ev.name} 종료: ${curName(tok)} ${save.currencies[tok]} → 금화 ${g}`);
      save.currencies[tok] = 0;
    }
    if (ev?.id === "EV_T4") save.fortCarry = Math.max(1, Math.floor(save.events[inst].fortLv * 0.5));
    save.events[inst].settled = true;
  }
  return msgs;
}
export function addEventTokens(save, a, n) {
  const s = eventState(save, a);
  const room = Math.max(0, a.def.dailyCap - s.gainedToday);
  const g = Math.min(room, Math.round(n));
  if (g <= 0) return 0;
  s.gainedToday += g;
  if (a.def.tokenId === "EVT_TALLY") { s.tally += g; bump(save, "eventTokens", g); return g; }
  if (a.def.tokenId === "EVT_INGR") {           // 재료 4종: 잎·돌·물·불꽃 — 환경별로 분배
    s.ingr[a.ingrKind ?? rnd(4)] += g; bump(save, "eventTokens", g); return g;
  }
  save.currencies[a.def.tokenId] = (save.currencies[a.def.tokenId] || 0) + g;
  bump(save, "eventTokens", g);
  return g;
}
// 판 종료 시 참여 토큰(events.json token.sources)
export function eventOnRunEnd(save, info, accountLv, clearedCount) {
  const out = [];
  for (const a of activeEvents()) {
    if (!eventUnlocked(a, accountLv, clearedCount)) continue;
    let n = 0;
    switch (a.tpl) {
      case "EV_T1": n = (info.mode === "M01" && info.cleared ? 1 : 0) + (info.mode === "M03" ? 1 : 0) + (info.challengeFirst ? 3 : 0); break;
      case "EV_T2": n = info.cleared ? 1 : 0; break;
      case "EV_T3": n = info.hunt ? Math.min(50, info.huntTokens || 0) : 0; break;
      case "EV_T4": n = (info.fort ? info.fortTokens : 0) + (info.mode === "M01" && info.cleared ? 5 : 0); break;
      case "EV_T5": {
        const env = { ENV01: 0, ENV04: 1, ENV05: 2, ENV06: 3 }[info.env];    // 초원·늪·강·사막 → 잎·돌·물·불꽃
        n = (info.mode === "M01" && info.cleared ? 3 + rnd(4) : 0) + (info.mode === "M03" ? 2 : 0) + (info.mode === "M07" ? Math.floor(info.runTime / 300) : 0);
        a.ingrKind = env ?? rnd(4);
        break;
      }
      case "EV_T6": n = Math.floor(info.kills / 100) + info.bossKills * 5 + (info.cleared ? 3 : 0); break;
    }
    const g = n > 0 ? addEventTokens(save, a, n) : 0;
    if (g > 0) out.push(`${a.def.name}: ${a.tpl === "EV_T5" ? ["잎", "돌", "물", "불꽃"][a.ingrKind] : a.def.tokenName} +${g}`);
  }
  return out;
}

// --- T1 탐사 보드: 6×6(36칸) 보상 60 / 전투 20 / 할인 10 / 워프 10 ---
export function boardCells(inst) {
  const cells = [];
  for (let i = 0; i < 36; i++) {
    const h = ((i * 2654435761) ^ inst.length * 97 ^ (inst.charCodeAt(inst.length - 1) * 131)) >>> 0;
    const r = (h % 100);
    cells.push(i === 0 ? "start" : r < 60 ? "reward" : r < 80 ? "battle" : r < 90 ? "shop" : "warp");
  }
  return cells;
}
const BOARD_REWARDS = [{ GOLD: 1500 }, { DUST: 40 }, { CORE: 15 }, { SHARD: 30 }, { FOOD: 30 }, { ENHANCE: 2 }, { AWAKEN: 1 }];
export function boardRoll(save, a) {
  if ((save.currencies.EVT_BOARD || 0) < 1) return null;
  save.currencies.EVT_BOARD--;
  const s = eventState(save, a);
  const d = 1 + rnd(6);
  const cells = boardCells(a.inst);
  const msgs = [`🎲 ${d}`];
  let pos = s.pos + d;
  const lap = () => { s.laps++; msgs.push(...grant(save, { SEALBOX: 20 })); msgs.push(`${s.laps}바퀴 완주! 완주 상자`);
    if (s.laps === 3) msgs.push(...applyItem(save, "한정 수집품", 1)); };
  if (pos >= 36) { pos -= 36; lap(); }
  let cell = cells[pos];
  if (cell === "warp") { const w = 3 + rnd(6); msgs.push(`워프 +${w}`); pos += w; if (pos >= 36) { pos -= 36; lap(); } cell = cells[pos] === "warp" ? "reward" : cells[pos]; }
  s.pos = pos;
  if (cell === "reward" || cell === "start") msgs.push(...grant(save, pick(BOARD_REWARDS)));
  else if (cell === "shop") { s.discount = true; msgs.push("교환소 할인권(다음 교환 50%)"); }
  else if (cell === "battle") { s.pendingBattle = { rule: pick(Object.keys(RULES)) }; msgs.push("전투 칸! 특수 규칙 1판 — 승리 시 보상 2배"); }
  return { d, pos, cell, msgs };
}
// --- T2 분기형 원정: 깊이 5 이진 트리(15노드 중 경로 5), 노드 입장 지도 조각 3 ---
export const BRANCH_ENDINGS = [
  { name: "인장의 길", reward: { SEALBOX: 30 } }, { name: "야수의 길", reward: { PET: 1 } },
  { name: "기록의 길", reward: { COLLECTIBLE: 1 } }, { name: "각성의 길", reward: { AWAKEN: 10 } },
];
export function branchNodeRule(inst, depth, choice) {
  const ids = Object.keys(RULES);
  return ids[(depth * 7 + choice * 3 + inst.length) % ids.length];
}
// --- T3 표적 보스: 20종 중 1, 하루 3회, 난이도 ×1/×3/×10 → 보상 ×1/×2/×4, 100바 ---
export function huntBoss(inst) { const ids = Object.keys(BOSSES); return ids[(inst.length * 13 + +inst.split("_").pop()) % ids.length]; }
export const HUNT_DIFF = [{ mult: 1, rew: 1, name: "보통" }, { mult: 3, rew: 2, name: "어려움" }, { mult: 10, rew: 4, name: "지옥" }];
export const HUNT_BAR_REWARD = [{ GOLD: 3000 }, { CORE: 30 }, { DUST: 80 }, { ENHANCE: 5 }, { AWAKEN: 3 }, { RW_PART_CHEST: 1 }, { SHARD: 100 }, { RW_EQ_CHEST_E: 1 }, { SEALBOX: 30 }, { TP: 3 }];
// --- T4 방어 거점: 거점 Lv1~10, 봉화 체력·포탑 수 ---
export const fortUpCost = (lv) => 30 * lv;
export const fortHp = (lv) => 600 * (1 + 0.25 * (lv - 1));
export const fortTurrets = (lv) => Math.floor(lv / 3);
// --- T5 재료 조합: 레시피 25(공개 20 + 숨김 5) ---
const BUFFS = [
  { name: "광휘 +30", eff: { lumStart: 30 } }, { name: "공격력 +10%", eff: { atkPct: 0.10 } },
  { name: "경험치 +20%", eff: { xpPct: 0.20 } }, { name: "금화 획득 +30%", eff: { goldPct: 0.30 } },
  { name: "자석 반경 +50%", eff: { magnetPct: 0.5 } }, { name: "최대 체력 +15%", eff: { hpPct: 0.15 } },
];
export const INGR_NAMES = ["잎", "돌", "물", "불꽃"];
export const RECIPES = (() => {
  const out = [];
  const combos = [];
  for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) for (let c = 0; c <= 3; c++) for (let d = 0; d <= 3; d++) {
    const s = a + b + c + d; if (s >= 2 && s <= 4) combos.push([a, b, c, d]);
  }
  for (let i = 0; i < 25; i++) {
    const inp = combos[(i * 11 + 3) % combos.length];
    const hidden = i >= 20;
    const out1 = i % 3 === 2 ? { box: 1 } : { buff: BUFFS[i % BUFFS.length] };
    out.push({ id: `RC${String(i + 1).padStart(2, "0")}`, inp, hidden, out: out1,
      hint: hidden ? `${INGR_NAMES[inp.indexOf(Math.max(...inp))]} 위주로 ${inp.reduce((x, y) => x + y, 0)}개` : null });
  }
  return out;
})();
export function combine(save, a, inp) {
  const s = eventState(save, a);
  if (inp.some((n, i) => s.ingr[i] < n) || inp.reduce((x, y) => x + y, 0) < 2) return null;
  inp.forEach((n, i) => (s.ingr[i] -= n));
  const r = RECIPES.find((x) => x.inp.every((n, i) => n === inp[i]));
  if (!r) return { fail: true, msgs: ["조합 실패 — 재료가 흩어졌습니다"] };
  const first = !s.recipes.includes(r.id);
  if (first) s.recipes.push(r.id);
  const msgs = [`${r.hidden ? "숨김 " : ""}레시피 ${r.id}${first ? " 발견!" : ""}`];
  if (r.out.box) { save.currencies.EVT_INGR = (save.currencies.EVT_INGR || 0) + 1; msgs.push("축제 상자 +1"); }
  else { save.nextRunBuffs.push({ name: r.out.buff.name, eff: r.out.buff.eff }); msgs.push(`다음 판 버프: ${r.out.buff.name}`); }
  if (first && s.recipes.length === 20) msgs.push(...applyItem(save, "한정 수집품", 1));
  return { r, msgs };
}
// --- T6 누적 목표 5단계 ---
export const TALLY_STEPS = [
  { need: 100, reward: { GOLD: 5000 } }, { need: 300, reward: { RW_PART_CHEST: 2 } }, { need: 600, reward: { SEALBOX: 30 } },
  { need: 1000, reward: { RW_EQ_CHEST_E: 1 } }, { need: 1500, reward: { COLLECTIBLE: 1 } },
];

// ====================== 빌드 청사진 (builds.json 추천 빌드 12, docs/01 #1 · 06 §5.1) ======================
export const BUILDS = RAW_BUILDS;
export function setBlueprint(save, b) { save.blueprint = b ? { name: b.name, id: b.id || null, attack: [...b.attack], passive: [...b.passive] } : null; }
// 추천 빌드 복사: 청사진 + 보유 중인 부품·펫을 그대로 편성(캐릭터는 해금돼 있을 때만)
export function applyRecommended(save, b, charOk) {
  setBlueprint(save, b);
  const out = [`청사진: ${b.name}`];
  if (charOk) { save.character = b.character; out.push(`캐릭터 ${CHARACTERS.find((c) => c.id === b.character)?.name}`); }
  b.parts.forEach((id, i) => { if (partGrade(save, id) >= 0) { equipPart(save, "atk", i, id); out.push(`공격 부품 ${partById(id).name}`); } });
  b.supportParts.forEach((id, i) => { if (partGrade(save, id) >= 0) { equipPart(save, "sup", i, id); out.push(`보조 부품 ${partById(id).name}`); } });
  if (save.pets[b.deployPet]) { save.activePet = b.deployPet; out.push("출전 펫 편성"); }
  b.assistPets.forEach((id, i) => { if (save.pets[id] && id !== save.activePet) save.petAssist[i] = id; });
  b.equipment.forEach((id) => {
    const best = save.inv.filter((it) => it.id === id).sort((x, y) => y.grade - x.grade || y.lv - x.lv)[0];
    if (best) save.equipped[EQUIPMENT[id].slot] = best.uid;
  });
  return out;
}