// 계정 성장·수집·임무·모드 등 "판 밖" 시스템. 원본은 content.data.js(자동 생성).
import {
  RAW_TALENTS, RAW_PETS, RAW_MISSIONS, RAW_ACHIEVEMENTS, RAW_RULES,
  RAW_CHALLENGES, RAW_COLLECTIBLES, RAW_SETS, RAW_MODES,
} from "./content.data.js";

// ====================== 효과 문장 파서 ======================
// "공격력 +1%", "받는 피해 -3%", "재생 0.2%/s", "판당 부활 +1" → { key: 값 }
// 판정에 반영되는 키만 뽑고, 설명형 문장은 null(표시만)로 둔다.
const EFFECT_RULES = [
  [/봉화 점화 시 최대 체력/, "beaconHealPct"],
  [/봉화 안 회복|봉화 회복/, "beaconRegen"],
  [/봉화 안 받는 피해/, "beaconTakenPct"],
  [/어둠 지대에서 피해/, "darkDmgPct"],
  [/어둠 지대 시야/, null],
  [/모든 캐릭터 ATK|^공격력|날카로운/, "atkPct"],
  [/모든 캐릭터 HP|최대 체력/, "hpPct"],
  [/공격 속도/, "intervalPct"],
  [/쿨다운|cooldown 스킬 간격|소환체 공격 간격/, "cooldownPct"],
  [/모든 피해/, "dmgPct"],
  [/projectile 스킬 투사체/, "projectiles"],
  [/projectile (스킬 )?피해/, "tag_projectile"],
  [/beam·field/, "tag_beamfield"],
  [/melee·orbit|근접·회전|근접 피해/, "tag_melee"],
  [/explosion 스킬 피해|폭발 피해/, "tag_explosion"],
  [/summon 스킬 피해|소환체 피해/, "tag_summon"],
  [/trap·stationary/, "tag_trap"],
  [/상태 이상 피해|독 피해|화상 피해/, "statusDmgPct"],
  [/보스 피해|보스 최종 단계에서 피해/, "bossDmgPct"],
  [/엘리트 피해/, "eliteDmgPct"],
  [/치명타 확률/, "critPct"],
  [/치명타 피해/, "critDmgPct"],
  [/이동 속도|어둠 지대 이동/, "speedPct"],
  [/자석 반경|흡수 반경/, "magnetPct"],
  [/^계정 경험치/, "accXpPct"],
  [/경험치/, "xpPct"],
  [/금화 획득/, "goldPct"],
  [/접촉 피해/, "contactTakenPct"],
  [/받는 피해/, "takenPct"],
  [/^방어/, "def"],
  [/재생/, "regenPct"],
  [/흡혈/, "lifestealPct"],
  [/보호막 재생/, null],
  [/보호막/, "shieldPct"],
  [/회피/, "dodgePct"],
  [/넉백 저항/, null],
  [/넉백/, "knockPct"],
  [/범위|폭발 반경/, "areaPct"],
  [/지속/, "durationPct"],
  [/광휘 획득|광휘/, "lumPct"],
  [/고유 능력 피해/, "abilityDmgPct"],
  [/판당 부활/, "revive"],
  [/판당 새로고침/, "rerolls"],
  [/판당 제외/, "bans"],
  [/판당 잠금/, "locks"],
  [/회복 효과/, "healPct"],
  [/투사체 속도/, "projSpeedPct"],
  [/펫 피해|펫 치명타/, "petDmgPct"],
  [/펫 체력/, "petHpPct"],
];
const FLAT_KEYS = new Set(["projectiles", "revive", "rerolls", "bans", "locks", "def"]);

export function parseEffect(text) {
  if (!text) return null;
  const t = String(text).trim();
  for (const [re, key] of EFFECT_RULES) {
    if (!re.test(t)) continue;
    if (!key) return null;
    const m = t.match(/([+\-]?)\s*(\d+(?:\.\d+)?)\s*(%|u|\/s)?/);
    if (!m) return null;
    let v = parseFloat(m[2]);
    if (m[1] === "-") v = -v;
    // "쿨다운 -8%", "간격 -5%"는 줄어드는 것이 이득 → 감소율(양수)로 저장
    if (key === "cooldownPct" || key === "intervalPct") v = Math.abs(v);
    if (!FLAT_KEYS.has(key)) v = v / 100;     // 퍼센트형은 소수로
    return { key, value: v };
  }
  return null;
}
export function addBonus(acc, eff, mult = 1) {
  if (!eff) return;
  acc[eff.key] = (acc[eff.key] || 0) + eff.value * mult;
}

// ====================== 특성 84 ======================
// 해금: "챕터 N" = 해당 챕터 클리어. 선행: prereq(| = 하나만 있으면 됨). 비용: TP + 금화.
export const TALENTS = RAW_TALENTS.map((r) => ({
  id: r.id, branch: r.branch, tier: +r.tier, name: r.name, type: r.type,
  effect: r.effectPerRank, eff: parseEffect(r.effectPerRank),
  maxRank: +r.maxRank || 1, costTp: +r.costTp || 1, costGold: +r.costGold || 0,
  prereq: r.prereq && r.prereq !== "-" ? r.prereq.split("|").map((s) => s.trim()) : [],
  unlockChapter: +((r.unlockCond || "").match(/\d+/)?.[0] || 1),
}));
export const TALENT_BRANCHES = ["공격", "생존", "편의·규칙"];
export function talentAvailable(t, save, clearedCount) {
  if (clearedCount < t.unlockChapter) return false;
  if (!t.prereq.length) return true;
  return t.prereq.some((p) => (save.talents[p] || 0) > 0);
}

// ====================== 펫 12 ======================
export const PETS = RAW_PETS.map((r) => ({
  id: r.id, name: r.name, ai: r.aiType, role: r.role,
  deploySkill: r.deploySkill, interval: +r.deployIntervalS || 1.5, coef: +r.deployCoef || 0.5,
  assist: r.assistSkill, eff: parseEffect(r.assistSkill), unlock: r.unlock,
  hpPct: (+r.hpPctOfPlayer || 30) / 100,
}));
export const petById = (id) => PETS.find((p) => p.id === id);
// 펫 AI 유형 → 전투 동작 분류(docs/09 §4.2)
export const PET_STYLE = {
  orbit_shooter: "shoot", scout: "shoot", curser: "shoot", turret_pet: "shoot",
  charger: "melee", dive_striker: "melee", tank: "melee", digger: "melee",
  lobber: "lob", breather: "lob", collector: "collect", healer: "heal",
};

// ====================== 수집품 100 / 세트 20 ======================
export const COLLECTIBLES = RAW_COLLECTIBLES.map((r) => ({
  id: r.id, setId: r.setId, name: r.name, rarity: r.rarity, type: r.effectType,
  effect: r.effect, lv5: r.lv5Effect, eff: parseEffect(r.effect), source: r.source,
}));
export const SETS = RAW_SETS.map((r) => ({
  id: r.id, name: r.name, theme: r.theme,
  bonus3: r.bonus3, bonus5: r.bonus5, eff3: parseEffect(r.bonus3), eff5: parseEffect(r.bonus5),
}));
export const RARITY = {
  rare: { name: "희귀", color: "#5aa8ff", w: 70 },
  epic: { name: "영웅", color: "#c07aff", w: 25 },
  legend: { name: "전설", color: "#ffc03a", w: 5 },
};

// ====================== 보상 문장 파서 ======================
// "금화 500; 별가루 30; 특성점수 1" / "medal=21;core=5;enh=1"
export function parseReward(text) {
  const out = {};
  const s = String(text || "");
  const add = (key, n) => { out[key] = (out[key] || 0) + n; };
  const pick = (re, key) => { for (const m of s.matchAll(new RegExp(re, "g"))) add(key, parseInt(m[1].replace(/,/g, ""), 10)); };
  pick(/금화\s*([\d,]+)/, "GOLD");
  pick(/별가루\s*([\d,]+)/, "DUST");
  pick(/특성점수\s*([\d,]+)/, "TP");
  pick(/훈장\s*([\d,]+)/, "MEDAL");
  pick(/파편\s*([\d,]+)/, "SHARD");
  pick(/(?:부품 )?코어\s*([\d,]+)/, "CORE");
  pick(/사료\s*([\d,]+)/, "FOOD");
  pick(/각성석\s*([\d,]+)/, "AWAKEN");
  pick(/강화석\s*([\d,]+)/, "ENHANCE");
  pick(/에너지\s*([\d,]+)/, "ENERGY");
  pick(/medal=(\d+)/, "MEDAL");
  pick(/core=(\d+)/, "CORE");
  pick(/enh=(\d+)/, "ENHANCE");
  // 인장: "C02 인장 30" / "인장 선택 100" / "인장 선택 상자 조각 N"(조각 1 = 인장 선택 2)
  for (const m of s.matchAll(/(C\d\d) 인장 (\d+)/g)) add(`SEAL_${m[1]}`, +m[2]);
  for (const m of s.matchAll(/인장 선택 상자 조각 (\d+)/g)) add("SEALBOX", 2 * +m[1]);
  for (const m of s.matchAll(/인장 선택 (\d+)/g)) add("SEALBOX", +m[1]);
  for (const m of s.matchAll(/장비 상자\((일반|고급|희귀|영웅|전설)\)\s*(\d+)?/g)) {
    add({ 일반: "RW_EQ_CHEST_N", 고급: "RW_EQ_CHEST_F", 희귀: "RW_EQ_CHEST_R", 영웅: "RW_EQ_CHEST_E", 전설: "RW_EQ_CHEST_L" }[m[1]], +m[2] || 1);
  }
  for (const m of s.matchAll(/부품 상자 (\d+)/g)) add("RW_PART_CHEST", +m[1]);
  for (const m of s.matchAll(/\b(CO\d{3})\b/g)) add(`COL_${m[1]}`, 1);
  const t = s.match(/칭호\s*'([^']+)'/);
  if (t) out.TITLE = t[1]; else if (/칭호/.test(s)) out.TITLE = "__ACH__";
  if (/수집품(?! 상자)/.test(s) && !/CO\d{3}/.test(s)) out.COLLECTIBLE = 1;
  return out;
}
export const CURRENCY_ICON = { GOLD: "💰", DUST: "✨", TP: "🔷", MEDAL: "🎖️", SHARD: "🧩", CORE: "⚙️", AWAKEN: "💎", ENHANCE: "🔨", FOOD: "🍖", SEALBOX: "🎫", ENERGY: "⚡" };
// ====================== 미션 · 업적 ======================
// 조건 문장 → 추적 카운터. 판 종료마다 stats를 누적하고 진행도를 계산한다.
export function conditionCounter(cond) {
  const c = String(cond || "");
  let m;
  if ((m = c.match(/CH(\d+)\s*클리어/))) return { type: "chapter", n: +m[1] };
  if (/보스.*처치|보스를/.test(c)) return { type: "stat", key: "bossKills" };
  if (/엘리트/.test(c)) return { type: "stat", key: "eliteKills" };
  if (/처치|잡기|쓰러뜨/.test(c)) return { type: "stat", key: "kills" };
  if (/진화|융합/.test(c)) return { type: "stat", key: "evolutions" };
  if (/부활/.test(c)) return { type: "stat", key: "revives" };
  if (/상자/.test(c)) return { type: "stat", key: "chests" };
  if (/보석|경험치/.test(c)) return { type: "stat", key: "gems" };
  if (/강화|레벨업/.test(c) && /장비|특성|상점/.test(c)) return { type: "stat", key: "upgrades" };
  if (/장비/.test(c)) return { type: "stat", key: "equipOwned" };
  if (/수집품|세트/.test(c)) return { type: "stat", key: "collectOwned" };
  if (/캐릭터/.test(c)) return { type: "stat", key: "charsUnlocked" };
  if (/도전/.test(c)) return { type: "stat", key: "challengeClears" };
  if (/(\d+)\s*분.*생존|생존/.test(c)) return { type: "stat", key: "survivalMin" };
  if (/피해/.test(c)) return { type: "stat", key: "damage" };
  if (/클리어/.test(c)) return { type: "stat", key: "clears" };
  if (/판|출정|완료|플레이|입장/.test(c)) return { type: "stat", key: "runs" };
  return { type: "stat", key: "runs" };
}
export const MISSIONS = RAW_MISSIONS.map((r) => ({
  id: r.id, type: r.type, name: r.name, condition: r.condition,
  target: +r.target || 1, reward: parseReward(r.reward), rewardText: r.reward,
  weight: +r.weight || 10, counter: conditionCounter(r.condition), mode: r.leadsToMode,
}));
export const ACHIEVEMENTS = RAW_ACHIEVEMENTS.map((r) => ({
  id: r.id, category: r.category, name: r.name, condition: r.condition,
  target: +r.target || 1, reward: parseReward(r.reward), rewardText: r.reward,
  hidden: r.hidden === "true", counter: conditionCounter(r.condition),
}));

// ====================== 도전 180 · 규칙 26 ======================
// 규칙 효과 문장 → 판 설정 수정자
export function ruleModifier(rule, paramsText) {
  const e = rule.effect || "";
  const p = parseFloat(rule.paramDefault) || 1;
  const mod = {};
  if (/시야/.test(e)) mod.vision = p < 1 ? p : 0.6;
  if (/어둠/.test(e)) mod.dark = 1;
  if (/적 체력/.test(e)) mod.enemyHpMul = 1 + (parseFloat(e.match(/(\d+)%/)?.[1]) || 50) / 100;
  if (/적 (이동 )?속도|적 이동/.test(e)) mod.enemySpdMul = 1 + (parseFloat(e.match(/(\d+)%/)?.[1]) || 30) / 100;
  if (/접촉 피해|받는 피해/.test(e)) mod.takenMul = 1 + (parseFloat(e.match(/(\d+)%/)?.[1]) || 50) / 100;
  if (/새로고침/.test(e)) mod.noReroll = true;
  if (/쿨다운|간격 감소/.test(e) && /무효|없음/.test(e)) mod.noCooldown = true;
  if (/투사체\s*-/.test(e)) mod.projectileDelta = -1;
  if (/회복/.test(e) && /(없|불가|-)/.test(e)) mod.noHeal = true;
  if (/상태 이상/.test(e)) mod.statusMul = 0.5;
  if (/10:00|10분/.test(e)) mod.timeLimitS = 600;
  if (/엘리트/.test(e)) mod.eliteDouble = true;
  if (/보석/.test(e) && /\+/.test(e)) mod.gemMul = 1.5;
  if (/레벨업|카드/.test(e) && /2장|줄/.test(e)) mod.cards = 2;
  if (/부활/.test(e) && /없|불가/.test(e)) mod.noRevive = true;
  // 도전별 params(k=v;…)가 있으면 덮어쓴다
  for (const kv of String(paramsText || "").split(";")) {
    const [k, v] = kv.split("=");
    if (k === "vision") mod.vision = parseFloat(v);
    if (k === "contact") mod.takenMul = parseFloat(v);
    if (k === "hp") mod.enemyHpMul = parseFloat(v);
    if (k === "spd") mod.enemySpdMul = parseFloat(v);
  }
  return mod;
}
export const RULES = Object.fromEntries(RAW_RULES.map((r) => [r.id, r]));
export const CHALLENGES = RAW_CHALLENGES.map((r) => ({
  id: r.id, chapterId: r.chapterId, tier: +r.tier, name: r.name,
  rules: r.rules.split(";").map((s) => s.trim()).filter(Boolean),
  params: r.params, reward: parseReward(r.reward), rewardText: r.reward, unlock: r.unlock,
}));
export function challengeMods(ch) {
  const out = {};
  for (const rid of ch.rules) {
    const r = RULES[rid];
    if (!r) continue;
    Object.assign(out, ruleModifier(r, ch.params));
  }
  return out;
}

// ====================== 모드 8 ======================
export const MODES = RAW_MODES.map((r) => ({
  id: r.id, name: r.name, unlock: r.unlock, duration: r.duration,
  win: r.winCondition, rules: r.uniqueRules, rewards: r.rewards,
  unlockChapter: +((r.unlock || "").match(/CH(\d+)/)?.[1] || 0),
}));
