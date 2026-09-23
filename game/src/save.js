// 단순화한 저장 모듈. 실제 설계(docs/14_tech_architecture.md §8)는 IndexedDB + schema_version +
// migrations + 백업 슬롯 3을 요구하지만, 이 시제품은 localStorage 단일 슬롯만 구현한다(미구현 항목으로 보고).
const KEY = "lumen_save_v0";

const DEFAULT_SAVE = {
  schemaVersion: 1,
  account: { level: 1, xp: 0 },
  currencies: { GOLD: 0, DUST: 0, TP: 0, MEDAL: 0, SHARD: 0 },
  talents: {},                 // { TA01: rank }
  pets: {},                    // { PT01: { lv } }
  activePet: null,
  collectibles: {},            // { CO001: count }
  challenges: {},              // { CL001: true }
  modeRecords: {},             // { M04: bestScore, M07: bestSec, M05: floor }
  stats: {                     // 미션·업적 누적 카운터
    runs: 0, clears: 0, kills: 0, bossKills: 0, eliteKills: 0, evolutions: 0,
    revives: 0, chests: 0, gems: 0, upgrades: 0, challengeClears: 0, survivalMin: 0, damage: 0,
  },
  missions: { day: "", daily: [], week: "", weekly: [], progress: {}, claimed: {} },
  energy: { value: 120, last: 0 },
  tickets: { day: "", week: "", dungeon: 3, hazard: 5, exped: 2 },
  quick: { day: "", count: 0 },
  offline: { last: 0 },
  achievements: { claimed: {} },
  progress: { chapters: { CH01: { cleared: false, bestClearS: null } } },
  upgrades: { UP_ATK: 0, UP_HP: 0, UP_SPD: 0, UP_MAG: 0, UP_REV: 0 },
  character: "C01",
  hero: null,                  // 주인공 외형: "hoya" | "minji" (null이면 첫 실행 → 선택 화면)
  // 장비: { EQ01: {grade, lv} } / 착용: { WPN: "EQ01", ... }
  equipment: {},
  equipped: {},
  claimedRuns: [],
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return normalizeSave(JSON.parse(raw));
  } catch (e) {
    console.warn("save load failed, using default", e);
    return structuredClone(DEFAULT_SAVE);
  }
}

// 서버에서 내려받은 저장본도 같은 경로로 정규화한다(누락 필드 채움 + 옛 스키마 보정)
export function normalizeSave(parsed) {
  const base = structuredClone(DEFAULT_SAVE);
  // v0 → v1: upgrades 필드가 없던 저장본도 그대로 이어서 쓸 수 있게 채워 넣는다.
  return {
      ...base, ...parsed,
      currencies: { ...base.currencies, ...(parsed.currencies || {}) },
      upgrades: { ...base.upgrades, ...(parsed.upgrades || {}) },
      progress: { ...base.progress, ...(parsed.progress || {}) },
      equipment: { ...(parsed.equipment || {}) },
      equipped: { ...(parsed.equipped || {}) },
      character: parsed.character || "C01",
      talents: { ...(parsed.talents || {}) },
      pets: { ...(parsed.pets || {}) },
      collectibles: { ...(parsed.collectibles || {}) },
      challenges: { ...(parsed.challenges || {}) },
      modeRecords: { ...(parsed.modeRecords || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
      missions: { ...base.missions, ...(parsed.missions || {}) },
      achievements: { ...base.achievements, ...(parsed.achievements || {}) },
      energy: { ...base.energy, ...(parsed.energy || {}) },
      tickets: { ...base.tickets, ...(parsed.tickets || {}) },
      quick: { ...base.quick, ...(parsed.quick || {}) },
      offline: { ...base.offline, ...(parsed.offline || {}) },
      schemaVersion: 3,
  };
}

// 저장이 일어날 때 알림을 받을 구독자(서버 동기화 등)
const writeListeners = [];
export function onSaveWritten(fn) { writeListeners.push(fn); }

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {
    console.warn("save write failed", e);
  }
  for (const fn of writeListeners) { try { fn(save); } catch (e) { console.warn("save listener failed", e); } }
}

// run_id 멱등 지급(docs/14 §6 축소판): 같은 runId로 두 번 보상 적용 방지
export function applyRunReward(save, runId, { accountXpGain, goldGain, dustGain, chapterId, cleared, survivalS }) {
  if (save.claimedRuns.includes(runId)) return save;
  save.claimedRuns.push(runId);
  if (save.claimedRuns.length > 500) save.claimedRuns.shift();

  save.currencies.GOLD += goldGain;
  save.currencies.DUST += dustGain || 0;

  save.account.xp += accountXpGain;
  while (true) {
    const need = accountLevelCost(save.account.level);
    if (save.account.xp >= need) {
      save.account.xp -= need;
      save.account.level += 1;
      // 계정 레벨업마다 특성점수(docs/11 §7: Lv50부터 2/Lv)
      save.currencies.TP = (save.currencies.TP || 0) + (save.account.level >= 50 ? 2 : 1);
    } else break;
  }

  const chProg = save.progress.chapters[chapterId] || { cleared: false, bestClearS: null };
  if (cleared) {
    chProg.cleared = true;
    if (chProg.bestClearS == null || survivalS < chProg.bestClearS) chProg.bestClearS = survivalS;
  }
  save.progress.chapters[chapterId] = chProg;
  return save;
}

function accountLevelCost(lv) {
  return Math.round(200 * Math.pow(lv, 1.4));
}

// 클리어 시 장비 드롭 — 챕터가 높을수록 좋은 등급이 나온다(docs/11 §2 축소판)
export function rollEquipDrop(save, chapterIndex, allEquipIds) {
  const r = Math.random();
  const tier = chapterIndex < 5 ? (r < 0.75 ? 0 : 1)
    : chapterIndex < 15 ? (r < 0.5 ? 1 : r < 0.9 ? 2 : 3)
    : chapterIndex < 30 ? (r < 0.45 ? 2 : r < 0.88 ? 3 : 4)
    : (r < 0.5 ? 3 : r < 0.92 ? 4 : 5);
  const id = allEquipIds[Math.floor(Math.random() * allEquipIds.length)];
  const cur = save.equipment[id];
  if (!cur) save.equipment[id] = { grade: tier, lv: 0 };
  else if (tier > cur.grade) save.equipment[id] = { grade: tier, lv: cur.lv };
  else return { id, tier, dup: true };
  return { id, tier, dup: false };
}

export function equipItem(save, id, slot) {
  save.equipped[slot] = id;
  writeSave(save);
}
export function levelUpEquip(save, id, price) {
  if ((save.currencies.GOLD || 0) < price) return false;
  save.currencies.GOLD -= price;
  save.equipment[id].lv += 1;
  writeSave(save);
  return true;
}
export function selectCharacter(save, id) { save.character = id; writeSave(save); }

// 상점 구매: 재화가 충분하고 최대 레벨이 아니면 1레벨 올린다. 결과를 즉시 저장한다.
export function buyUpgrade(save, def) {
  const lv = save.upgrades[def.id] || 0;
  if (lv >= def.maxLv) return { ok: false, reason: "max" };
  const price = def.cost(lv);
  if ((save.currencies[def.currency] || 0) < price) return { ok: false, reason: "funds", price };
  save.currencies[def.currency] -= price;
  save.upgrades[def.id] = lv + 1;
  writeSave(save);
  return { ok: true, price, newLv: lv + 1 };
}
