import { U, XP_CURVE, ACCOUNT_XP_PER_RUN, ACCOUNT_LEVEL_COST, GOLD_SHARD_VALUE, gemValue, SKILLS, PASSIVES, ENEMIES, BOSSES, CHAPTERS, chapterById, enemyHp, enemyAtk, bossHp, bossAtk, START_SKILL, ATTACK_SLOTS, PASSIVE_SLOTS } from "./content.js";
import { loadSave, writeSave, applyRunReward, buyUpgrade, normalizeSave, onSaveWritten } from "./save.js";
import { cloud } from "./cloud.js";
import {
  UPGRADES, combatPower, EVOLUTIONS, CHARACTERS, characterById,
  EQUIPMENT, EQUIP_GRADES, SLOT_NAMES, SLOT_ORDER, equipMainStat, equipLevelCost,
} from "./content.js";
import { rollEquipDrop, equipItem, levelUpEquip, selectCharacter } from "./save.js";
import {
  TIME_MODES, ENERGY_CAP, ENERGY_REGEN_S, MODE_ENERGY, MODE_TICKET, TICKET_CAP, QUICK_BATTLE_PER_DAY,
} from "./content.js";
import {
  parseEffect, addBonus, TALENTS, TALENT_BRANCHES, talentAvailable, PETS, petById, PET_STYLE,
  COLLECTIBLES, SETS, RARITY, parseReward, CURRENCY_ICON, MISSIONS, ACHIEVEMENTS,
  CHALLENGES, RULES, challengeMods, MODES,
} from "./meta.js";
import { SPRITES, UI_IMAGES, HEROES, tintedSprite, playSfx, isMuted, toggleMuted } from "./assets.js";
import { music } from "./music.js";
import { createFrameClock, createRenderQuality, setText, setWidth } from "./runtime-performance.js";
import { createThemeEffects } from "./theme-effects.js";
const themeFx = createThemeEffects(SPRITES);
import { RAW_CHARACTERS } from "./content.data.js";
import * as ECO from "./economy.js";
import * as ECOUI from "./ecoui.js";
import { STAGES_PER_THEME, stageInfo } from "./themes.js";
import * as R from "./rework-core.js";
import { GuardianUI, icon as sgIcon } from "./rework-ui.js";
import { createElementCombat } from "./element-combat.js";
import { createWeaponCombat } from "./weapon-effects.js";
import { ELEMENT_WEAPONS } from "./assets.js";
import { installReworkContent } from "./rework-content.js";
installReworkContent({SKILLS,PASSIVES,EVOLUTIONS,CHAPTERS,BOSSES});
ECO.setCharBonusTable(RAW_CHARACTERS);

// ---------- DOM ----------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const elMenu = document.getElementById("menu");
const elLevelup = document.getElementById("levelup");
const elResult = document.getElementById("result");
const elCardRow = document.getElementById("card-row");
const elHpbar = document.getElementById("hpbar");
const elXpbar = document.getElementById("xpbar");
const elLvl = document.getElementById("lvl");
const elTimer = document.getElementById("timer");
const elKillcount = document.getElementById("killcount");
const elBossLabel = document.getElementById("boss-telegraph-label");
const elLog = document.getElementById("log");
const elControlsHint = document.getElementById("controls-hint");
const elResultTitle = document.getElementById("result-title");
const elResultTable = document.getElementById("result-table");
const elMute = document.getElementById("btn-mute");
const elSound = document.getElementById("btn-sound");   // 시작 화면·로비용 음소거 버튼(오른쪽 위). 전투 HUD의 #btn-mute와 같은 상태

function refreshMuteBtn() {
  const icon = isMuted() ? "🔇" : "🔊";
  elMute.textContent = icon;
  if (elSound) { elSound.textContent = icon; elSound.title = isMuted() ? "소리 켜기" : "소리 끄기"; }
}
function onMuteToggle() { toggleMuted(); refreshMuteBtn(); music.syncMute(); }
elMute.addEventListener("click", onMuteToggle);
elSound?.addEventListener("click", onMuteToggle);
refreshMuteBtn();
// 메인 테마곡(2026-09-23): 시작 화면·로비에서 반복 재생, 전투 시작하면 멈춤(bgmOff), 전투 뒤 로비로 오면 처음부터(bgmOn(true))
function bgmOn(restart = false) { if (elSound) elSound.hidden = false; music.play({ restart }); }
function bgmOff() { if (elSound) elSound.hidden = true; music.stop(); }
bgmOn();   // 처음 화면(시작 화면)부터. 자동 재생이 막히면 첫 클릭·키 입력 때 시작

// 그리기 좌표는 항상 CSS 픽셀(viewW/viewH)을 쓰고, 백버퍼만 devicePixelRatio로 키운다.
// (이렇게 해야 레티나 폰에서 픽셀아트가 흐려지지 않는다)
let viewW = 0, viewH = 0;
const renderQuality = createRenderQuality(window.devicePixelRatio || 1);
let vignetteCache = null;
function resize() {
  const dpr = renderQuality.ratio;
  viewW = document.documentElement.clientWidth || window.innerWidth;
  viewH = document.documentElement.clientHeight || window.innerHeight;
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 100));
if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
resize();

// ---------- 챕터 상태 (로비·시뮬 양쪽에서 쓰므로 먼저 선언) ----------
let chapter = CHAPTERS[0];                 // 현재 진행 중인 챕터
let selectedChapterId = "CH01";            // 로비에서 고른 챕터
let bossDef = BOSSES.BS01;

// ---------- Save / meta ----------
let save = ECO.migrateSave(loadSave());
let sgState={profile:null,passes:null,user:null,active:null,error:null}, sgUI=null;
let sgRunToken=null,sgServerDuration=0,sgSettling=false,sgRunProfile=null,sgRunSets={};
let sgHostileShots=[];
// source = 스킬 원소('fire'…) 또는 기본 무기('weapon'). 어려움의 특별한 적: 원소 방패는 그 원소 피해 25%만, 단단 갑옷은 원소 스킬 피해 50%(기본 무기는 그대로)
const sgDamage=(target,raw,dir={x:0,y:0},knock=0,source=null)=>{
  if(target.hp<=0)return;
  const mul=target.sgTrait==='resist'&&source===target.sgResist?.25:target.sgTrait==='armor'&&source&&source!=='weapon'?.5:1;
  target.sgHurtAt=runTime;
  dealDamageToTarget(target,raw*mul,target===boss,dir,knock,mul<1);
};
// 지원품(판 안 카드) 효과: 통합 스탯 키로 합산(stat()에서 더함). 스킬 엔진·기본 무기에는 mods로 전달
function sgSupportStat(key){let v=0;const sup=player?.sgRun?.supports;if(sup)for(const id in sup){const d=R.SUPPORTS[id];if(d&&d.stat===key)v+=R.supportValue(id,sup[id].lv);}if(sgRunProfile)v+=R.petBuff(sgRunProfile,key);return v;}   // 지원품 + 동물 친구 버프
function sgMods(){return {dmgMul:1+sgSupportStat("dmgPct"),areaMul:1+sgSupportStat("areaPct"),intervalMul:Math.max(.5,1-sgSupportStat("intervalPct"))};}
const sgSkillImg=(d,cls='')=>d&&d.sprite?`<img class="sg-icon ${cls}" src="./assets/sprites/skills/${d.sprite}.png" alt="" />`:'';
const sgElements=createElementCombat({U,getPlayer:()=>player,getEnemies:()=>enemies,getBoss:()=>boss,getProfile:()=>sgRunProfile,damage:sgDamage,projectiles:()=>sgHostileShots,getMods:sgMods,
  onBlast:(at,r,big)=>{addShake(Math.min(big?9:6,2+r/U*1.6),big?.22:.14);if(big)addHitStop(.04);}});   // 펑펑 터지는 느낌: 폭발마다 화면 흔들림, 큰 폭발은 잠깐 멈춤
const sgWeapon=createWeaponCombat({U,getPlayer:()=>player,getEnemies:()=>enemies,getBoss:()=>boss,getProfile:()=>sgRunProfile,damage:sgDamage,images:ELEMENT_WEAPONS,sound:()=>playSfx('attack',.12),getMods:sgMods});
const SG_LOCAL=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const sgPetImages=Object.fromEntries(Object.keys(R.PETS).map(id=>{const img=new Image();img.src=`./assets/seoho_v1/pets/${id}_idle.png`;return [id,img];}));

function upLv(id) { return save.upgrades[id] || 0; }
function upValue(id) { return 0; }

// ---------- 주인공 외형(호야·민지) ----------
// 겉모습만 바꾼다. 능력치·기본 무기는 기존 캐릭터(C01~C12) 선택이 그대로 담당한다.
const elHeroPick = document.getElementById("hero-pick");
function heroDef() { return HEROES[sgRunProfile?.hero || save.hero] || HEROES.hoya; }
function openHeroPick() {
  for (const card of elHeroPick.querySelectorAll(".hero-card")) {
    const cur = card.dataset.hero === save.hero;
    card.classList.toggle("sel", cur);
    card.querySelector(".hc-cur").textContent = cur ? "현재 주인공" : "";
  }
  elHeroPick.classList.remove("hidden");
}
elHeroPick.querySelectorAll(".hero-card").forEach((card) => card.addEventListener("click", () => {
  save.hero = card.dataset.hero;
  writeSave(save);
  playSfx("cardSelect", 0.5);
  elHeroPick.classList.add("hidden");
  log(`주인공: ${heroDef().name}`);
  refreshMenuMeta();
}));
// 주인공은 처음 시작할 때 한 번만 고른다(로비·시작 화면에 변경 버튼 없음)

// 판 밖 보너스 합산: 특성 + 수집품(+세트 3/5) + 출전 펫 보조 + 장비 옵션(희귀↑ opt1, 영웅↑ opt2, 전설↑ 전설 효과)
function computeRunBonus() {
  return sgState.profile ? R.bonuses(sgRunProfile||sgState.profile) : {};

  const acc = {};
  for (const t of TALENTS) {
    const r = save.talents[t.id] || 0;
    if (r && t.eff) addBonus(acc, t.eff, r);
  }
  const setCount = {};
  for (const c of COLLECTIBLES) {
    const n = save.collectibles[c.id] || 0;
    if (!n) continue;
    // 중복 획득은 강화 재료(Lv2:1, Lv3:2, Lv4:3, Lv5:4 — docs/09 §5). Lv5 = 효과 ×3
    const mult = ECO.colMult(ECO.colLevel(n));
    if (c.eff) addBonus(acc, c.eff, mult);
    setCount[c.setId] = (setCount[c.setId] || 0) + 1;
  }
  for (const s of SETS) {
    const n = setCount[s.id] || 0;
    if (n >= 3) addBonus(acc, s.eff3);
    if (n >= 5) addBonus(acc, s.eff5);
  }
  // 펫 지원 스킬은 지원 슬롯 2개에서만(출전 펫의 지원 스킬은 미적용 — docs/09 §4.1) → economyBonus
  for (const slot of SLOT_ORDER) {
    const o = ECO.equippedItem(save, slot);
    if (!o) continue;
    const def = EQUIPMENT[o.id];
    const legendMul = o.grade >= 5 ? 1.5 : 1;          // 신화: 전설 효과 ×1.5
    if (o.grade >= 2) addBonus(acc, parseEffect(def.optRare));
    if (o.grade >= 3) addBonus(acc, parseEffect(def.optEpic));
    if (o.grade >= 4) addBonus(acc, parseEffect(def.legendEffect), legendMul);
  }
  // 캐릭터 레벨·승급·각성·결속, 장비 세트·각인, 부품 능력치, 지원 펫, 이벤트 버프
  const eco = ECO.economyBonus(save, charUnlocked);
  for (const k in eco) acc[k] = (acc[k] || 0) + eco[k];
  return acc;
}

// 착용 장비의 주스탯 합 (docs/12 §1: 무기·목걸이·장갑 = ATK / 갑옷·벨트·신발 = HP)
function equippedStats() {
  return {atk:0,hp:0};

  let atk = 0, hp = 0;
  for (const slot of SLOT_ORDER) {
    const owned = ECO.equippedItem(save, slot);
    if (!owned) continue;
    const def = EQUIPMENT[owned.id];
    const v = equipMainStat(def, owned.grade, owned.lv);
    if (def.mainStat === "atk") atk += v; else hp += v;
  }
  // 원본 HP 스케일(1000단위)을 시제품 기준으로 축소 환산
  return { atk, hp: Math.round(hp * 0.12) };
}

function refreshMenuMeta() {
  sgUI?.render(); return;

  document.getElementById("m-acclv").textContent = save.account.level;
  document.getElementById("m-gold").textContent = save.currencies.GOLD.toLocaleString();
  document.getElementById("m-dust").textContent = (save.currencies.DUST || 0).toLocaleString();
  document.getElementById("m-cp").textContent = combatPower(save.upgrades).toLocaleString();
  renderStageStrip();
  renderModeStrip();
  renderTimeRow();
  renderCharTab();               // 대원 탭(대원 고르기·능력 키우기·친구 동물)
  ECOUI.renderGearTab();         // 가방 탭(장비·선물 상자·도감)
  renderQuestTab();
  document.getElementById("m-shard").textContent = (save.currencies.SHARD || 0).toLocaleString();
  document.getElementById("m-medal").textContent = (save.currencies.MEDAL || 0).toLocaleString();
  document.getElementById("m-core").textContent = (save.currencies.CORE || 0).toLocaleString();
  document.getElementById("m-title").textContent = save.title ? `「${save.title}」` : "";
  const hero = heroDef();
  document.getElementById("hero-img").src = hero.frames.idle[0].src;
  document.getElementById("m-hero-name").textContent = hero.name;
  // 전투력 = (캐릭터+장비 ATK) × 공격 보너스 × 2 + (HP) × 체력 보너스 + 상점 강화 요약
  const chr = characterById(save.character);
  const eq = equippedStats();
  const rb = computeRunBonus();
  document.getElementById("m-cp").textContent = Math.round(
    combatPower(save.upgrades) - 150 + (chr.atk + eq.atk) * 2 * (1 + (rb.atkPct || 0)) + (chr.hp + eq.hp) * (1 + (rb.hpPct || 0)),
  ).toLocaleString();
  const giftN = Object.values(save.chests).reduce((a, b) => a + b, 0);
  document.querySelector('.nav[data-tab="gear"] span').textContent = giftN ? `가방 (${giftN})` : "가방";

  // 캐릭터 아래 강화 요약 칩
  document.getElementById("m-chips").innerHTML = Object.values(UPGRADES).map((d) => {
    const lv = upLv(d.id);
    return `<span class="chip ${lv ? "" : "zero"}">${d.icon}<b>${lv ? d.valueText(lv) : "-"}</b></span>`;
  }).join("");

  ECOUI.renderShopTab(renderShop);
}

// 챕터 해금 여부: CH01은 항상, 나머지는 직전 챕터를 클리어해야 열린다.
function isUnlocked(chId) {
  const i = CHAPTERS.findIndex((c) => c.id === chId);
  if (i <= 0) return true;
  if (save.progress.chapters[chId]?.unlocked) return true;
  return !!save.progress.chapters[CHAPTERS[i - 1].id]?.cleared;
}

// 단계 표시 이름 "1-1 학교 운동장"(themes.js). 표에 없는 단계는 원래 챕터 이름을 쓴다.
function stageLabel(ch) { const s = stageInfo(ch.index); return `${s.label} ${s.name || ch.name}`; }
function chLabel(n) { return stageInfo(n - 1).label; }      // 챕터 번호(1부터) → "1-3"

function renderStageStrip() {
  if (!isUnlocked(selectedChapterId)) selectedChapterId = "CH01";
  const sel = chapterById(selectedChapterId);
  const prog = save.progress.chapters[sel.id];
  const info = stageInfo(sel.index);
  const stars = (prog?.stars || []).filter(Boolean).length;

  // 장(테마) 머리글: 고른 단계가 속한 장의 5단계만 보여 준다
  const first = info.themeIndex * STAGES_PER_THEME;
  const group = CHAPTERS.slice(first, first + STAGES_PER_THEME);
  const clearedN = group.filter((c) => save.progress.chapters[c.id]?.cleared).length;
  document.getElementById("m-theme-no").textContent = `${info.themeIndex + 1}장`;
  document.getElementById("m-theme-name").textContent = info.themeName;
  document.getElementById("m-theme-prog").textContent = `${clearedN} / ${group.length} 성공`;
  document.getElementById("m-theme-bar").style.width = `${Math.round((clearedN / group.length) * 100)}%`;

  document.getElementById("m-stage-name").textContent = stageLabel(sel);
  const bossNm = info.bossName || BOSSES[sel.boss]?.name || "보스";
  const goal = !isSurvival(sel) ? `보스 ${bossNm}을(를) 물리치면 성공!`
    : isBossStage(sel) ? `5분을 버티면 보스 ${bossNm} 등장! 정화하면 성공` : "5분 동안 버티면 성공!";
  document.getElementById("m-stage-desc").textContent = goal + (sel.hint ? ` · ${sel.hint}` : "");
  document.getElementById("m-best").textContent =
    prog?.cleared ? `최고 기록 ${formatTime(prog.bestClearS)} · ${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "";
  document.getElementById("m-tip").textContent = info.tip;

  document.getElementById("stage-strip").innerHTML = group.map((c) => {
    const unlocked = isUnlocked(c.id);
    const p = save.progress.chapters[c.id];
    const st = (p?.stars || []).filter(Boolean).length;
    const si = stageInfo(c.index);
    const state = !unlocked ? "🔒" : p?.cleared ? `${"★".repeat(st)}${"☆".repeat(3 - st)}` : "도전 전";
    return `<div class="stage ${c.id === selectedChapterId ? "sel" : ""} ${unlocked ? "" : "locked"} ${p?.cleared ? "done" : ""}" data-ch="${c.id}">
        <div class="s-id">${si.label}</div>
        <div class="s-nm">${si.name || c.name}${si.isBoss ? "<br>👾 보스" : ""}</div>
        <div class="s-st">${state}</div>
      </div>`;
  }).join("");

  // 이전·다음 장으로 이동(다음 장은 첫 단계가 열렸을 때만)
  const prev = first - STAGES_PER_THEME, next = first + STAGES_PER_THEME;
  const navHtml = [];
  if (prev >= 0) navHtml.push(`<button class="chip-btn" data-theme-go="${CHAPTERS[prev].id}">◀ ${stageInfo(prev).themeName}</button>`);
  if (next < CHAPTERS.length && isUnlocked(CHAPTERS[next].id)) navHtml.push(`<button class="chip-btn" data-theme-go="${CHAPTERS[next].id}">${stageInfo(next).themeName} ▶</button>`);
  document.getElementById("mh-nav").innerHTML = navHtml.join("");
  document.querySelectorAll("[data-theme-go]").forEach((b) => b.addEventListener("click", () => {
    selectedChapterId = b.dataset.themeGo; playSfx("cardSelect", 0.4); refreshMenuMeta();
  }));

  document.querySelectorAll(".stage[data-ch]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.ch;
      if (!isUnlocked(id)) { playSfx("uiClick", 0.3); return; }
      selectedChapterId = id;
      playSfx("cardSelect", 0.4);
      refreshMenuMeta();
    });
  });
}

// ---------- 캐릭터 탭 ----------
function highestClearedIndex() {
  let hi = -1;
  CHAPTERS.forEach((c, i) => { if (save.progress.chapters[c.id]?.cleared) hi = i; });
  return hi;
}
// 챕터 조건(정규화) 또는 인장 30으로 해금(characters.json unlock, docs/11 SEAL)
function charUnlocked(c) { return c.unlockChapter === 0 || highestClearedIndex() + 1 >= c.unlockChapter || !!save.chars?.[c.id]?.unlocked; }

let viewingChar = null;
let charSub = "pick";      // 대원 탭 하위: pick(대원 고르기) / talent(능력 키우기) / pet(친구 동물)
function renderCharTab() {
  document.querySelectorAll("[data-csub]").forEach((b) => b.classList.toggle("on", b.dataset.csub === charSub));
  document.getElementById("char-pick").classList.toggle("hidden", charSub !== "pick");
  document.getElementById("grow-body").classList.toggle("hidden", charSub === "pick");
  if (charSub !== "pick") { growSub = charSub; renderGrowTab(); return; }
  const grid = document.getElementById("char-grid");
  const cur = save.character;
  viewingChar = viewingChar || cur;
  grid.innerHTML = CHARACTERS.map((c) => {
    const ok = charUnlocked(c);
    return `<div class="char-cell ${c.id === cur ? "sel" : ""} ${c.id === viewingChar ? "view" : ""} ${ok ? "" : "locked"}" data-char="${c.id}">
      <div class="cc-name">${c.name}</div>
      <div class="cc-role">${c.role}</div>
      <div class="cc-st">${ok ? (c.id === cur ? "지금 내 대원" : "") : `🔒 ${chLabel(c.unlockChapter)}`}</div>
    </div>`;
  }).join("");
  grid.querySelectorAll("[data-char]").forEach((el) => el.addEventListener("click", () => {
    viewingChar = el.dataset.char; playSfx("uiClick", 0.35); renderCharTab();
  }));

  const c = characterById(viewingChar);
  const ok = charUnlocked(c);
  const w = SKILLS[c.baseWeapon];
  document.getElementById("char-detail").innerHTML = `
    <div class="cd-head">${c.name} <span>${c.title} · ${c.role}</span></div>
    <div class="cd-stats">공격 <b>${c.atk}</b> · 체력 <b>${c.hp}</b> · 이동 <b>${c.spd}</b></div>
    <div class="cd-row"><em>기본 무기</em> <span style="color:${w.color}">${w.name}</span></div>
    <div class="cd-row"><em>패시브</em> ${c.passive}</div>
    <div class="cd-row"><em>고유 능력</em> <b>${c.abilityName}</b> — ${c.abilityEffect}</div>
    ${c.locked?.length ? `<div class="cd-row"><em>사용 불가</em> ${c.locked.map((id) => SKILLS[id]?.name).join(", ")}</div>` : ""}
    <button class="buy wide" id="btn-pick-char" ${!ok || c.id === save.character ? "disabled" : ""}>
      ${!ok ? `${chLabel(c.unlockChapter)} 성공 후 열려요 (인장 30개로도 가능)` : c.id === save.character ? "지금 내 대원" : "이 대원으로 가기"}
    </button>
    ${ECOUI.charGrowthHtml(c, ok)}`;
  ECOUI.bindCharGrowth(document.getElementById("char-detail"), c);
  const btn = document.getElementById("btn-pick-char");
  if (btn && !btn.disabled) btn.addEventListener("click", () => {
    selectCharacter(save, c.id); playSfx("cardSelect", 0.5); refreshMenuMeta();
  });
}

// ====================== 수집품 ======================
// 희귀 70 / 영웅 25 / 전설 5 (docs/09 §5). 업적 세트 SET20은 상자에서 나오지 않음.
function rollCollectible() {
  const r = Math.random() * 100;
  const rarity = r < 5 ? "legend" : r < 30 ? "epic" : "rare";
  const pool = COLLECTIBLES.filter((c) => c.rarity === rarity && c.setId !== "SET20");
  const c = pool[Math.floor(Math.random() * pool.length)] || COLLECTIBLES[0];
  const got = ECO.addCollectible(save, c.id);
  return { ...c, dup: got.dup };
}

// ====================== 미션 ======================
function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function weekKey() {
  const d = new Date(); const onejan = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}-W${Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)}`;
}
function weightedPick(list, n) {
  const pool = [...list]; const out = [];
  while (pool.length && out.length < n) {
    const total = pool.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * total, i = 0;
    for (; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0].id);
  }
  return out;
}
// 일일 6개 / 주간 8개 (docs/10 §2), 날짜가 바뀌면 새로 뽑는다
// 숨긴 놀이 모드(도전·자원 던전·보스 점수·등반탑·위험 구역·무한·원정)·빠른 전투·프리셋·부품·이벤트가 필요한 임무는 뽑지 않는다
const HIDDEN_MISSIONS = new Set(["MS_D06", "MS_D08", "MS_D09", "MS_D10", "MS_D17", "MS_D21", "MS_D22", "MS_D23", "MS_D24",
  "MS_W03", "MS_W04", "MS_W05", "MS_W06", "MS_W07", "MS_W08", "MS_W09", "MS_W15", "MS_W16", "MS_W19"]);
function refreshMissions() {
  const ms = save.missions;
  if ((ms.daily || []).some((id) => HIDDEN_MISSIONS.has(id))) ms.day = null;      // 예전에 뽑힌 숨김 임무는 다시 뽑는다
  if ((ms.weekly || []).some((id) => HIDDEN_MISSIONS.has(id))) ms.week = null;
  if (ms.day !== todayKey()) {
    ms.day = todayKey();
    ms.daily = weightedPick(MISSIONS.filter((m) => m.type === "daily" && !HIDDEN_MISSIONS.has(m.id)), 6);
    for (const id of Object.keys(ms.progress)) if (id.startsWith("MS_D")) { delete ms.progress[id]; delete ms.claimed[id]; }
  }
  if (ms.week !== weekKey()) {
    ms.week = weekKey();
    ms.weekly = weightedPick(MISSIONS.filter((m) => m.type === "weekly" && !HIDDEN_MISSIONS.has(m.id)), 8);
    for (const id of Object.keys(ms.progress)) if (id.startsWith("MS_W")) { delete ms.progress[id]; delete ms.claimed[id]; }
  }
}
// 미션 → 카운터(missions.csv 조건 문장 + leads_to_mode 기준). 값이 배열이면 "서로 다른 N종" 집합 카운터.
const MISSION_KEY = {
  MS_D01: "mainRuns", MS_D02: "mainClears", MS_D03: "mainKills", MS_D04: "mainGems", MS_D05: "evolutions",
  MS_D06: "dungeonRuns", MS_D07: "equipOps", MS_D08: "challengeRuns", MS_D09: "bossScoreRuns", MS_D10: "towerClears",
  MS_D11: "mainElites", MS_D12: "petClears", MS_D13: "altCharRuns", MS_D14: "abilityUses", MS_D15: "darkGems",
  MS_D16: "fastClears", MS_D17: "quick", MS_D18: "statusDmg", MS_D19: "midBossNoHit", MS_D20: "colBox",
  MS_D21: "presetRuns", MS_D22: "endless5", MS_D23: "hazardEscape", MS_D24: "expedRuns",
  MS_W01: "mainClears", MS_W02: "mainKills", MS_W03: "challengeFirst", MS_W04: "bossScoreRuns", MS_W05: "towerClears",
  MS_W06: "dungeonRuns", MS_W07: "hazardEscape", MS_W08: "endless15", MS_W09: "expedComplete", MS_W10: "set:evoKinds",
  MS_W11: "set:clearChars", MS_W12: "setBonusClears", MS_W13: "synth", MS_W14: "stars", MS_W15: "partSynth",
  MS_W16: "eventTokens", MS_W17: "petLv", MS_W18: "mainElites", MS_W19: "set:modes", MS_W20: "fullNoHitBoss",
};
function advanceMissions(delta) {
  refreshMissions();
  const ms = save.missions;
  ms.sets ||= {};
  // 로비 행동 카운터(합성·레벨업·상자·펫·토큰 등)는 economy.bump가 쌓아 둔 것을 합친다
  const pend = save._pendingBumps || {};
  delete save._pendingBumps;
  const d = { ...delta };
  d.synth = (d.synth || 0) + (pend.synth || 0);
  d.equipOps = (d.equipOps || 0) + (pend.synth || 0) + (pend.equipLv || 0);
  for (const k of ["partSynth", "petLv", "eventTokens", "colBox", "quick"]) d[k] = (d[k] || 0) + (pend[k] || 0);
  for (const id of [...ms.daily, ...ms.weekly]) {
    const m = MISSIONS.find((x) => x.id === id);
    const key = MISSION_KEY[id];
    if (!m || !key) continue;
    if (key.startsWith("set:")) {
      const k = key.slice(4);
      const s = new Set(ms.sets[id] || []);
      for (const v of d[k] || []) s.add(v);
      ms.sets[id] = [...s];
      ms.progress[id] = Math.min(m.target, s.size);
      continue;
    }
    ms.progress[id] = Math.min(m.target, (ms.progress[id] || 0) + (d[key] || 0));
  }
}
function flushLobbyCounters() {
  return; // Legacy economy is archived in the guardian release.
 if (save._pendingBumps) advanceMissions({}); }
function missionProgress(id) { return save.missions.progress[id] || 0; }

// ====================== 업적 ======================
function achievementProgress(a) {
  if (a.counter.type === "chapter") {
    return save.progress.chapters[`CH${String(a.counter.n).padStart(2, "0")}`]?.cleared ? a.target : 0;
  }
  const k = a.counter.key;
  if (k === "equipOwned") return save.inv.length;
  if (a.id === "AC045") return save.buildClears.length;
  if (k === "collectOwned") return Object.keys(save.collectibles).length;
  if (k === "charsUnlocked") return CHARACTERS.filter(charUnlocked).length;
  if (k === "upgrades") return Object.values(save.upgrades).reduce((s, v) => s + v, 0) + Object.values(save.talents).reduce((s, v) => s + v, 0);
  return save.stats[k] || 0;
}
// 칭호 이름이 없는 업적 보상("칭호")은 업적 이름을 칭호로 쓴다.
function grantReward(reward, titleName) {
  const r = { ...reward };
  if (r.TITLE === "__ACH__") r.TITLE = titleName || "파수꾼";
  return ECO.grant(save, r);
}
function rewardText(reward) { return ECO.rewardText(reward).replace("「__ACH__」", ""); }

// ====================== 성장 탭: 특성 · 펫 · 수집품 ======================
let growSub = "talent";
let talentBranch = "공격";
function renderGrowTab() {
  const el = document.getElementById("grow-body");            // 대원 탭 안: 능력 키우기(특성) / 친구 동물(펫). 도감은 가방 탭
  if (growSub === "pet") return ECOUI.renderPets(el);
  return renderTalents(el);
}

function renderTalents(el) {
  const cleared = highestClearedIndex() + 1;
  const list = TALENTS.filter((t) => t.branch === talentBranch).sort((a, b) => a.tier - b.tier);
  el.innerHTML = `
    <div class="sub-tabs">${TALENT_BRANCHES.map((b) =>
      `<button class="chip-btn ${b === talentBranch ? "on" : ""}" data-branch="${b}">${b}</button>`).join("")}
      <span class="tp">🔷 특성점수 <b>${save.currencies.TP || 0}</b></span>
      <button class="buy" id="btn-treset" ${ECO.freeResetLeft(save) > 0 && Object.keys(save.talents).length ? "" : "disabled"}>초기화<small>무료 ${ECO.freeResetLeft(save)}회 · 이후 별가루 상점</small></button></div>
    <div class="shop-list">${list.map((t) => {
      const r = save.talents[t.id] || 0;
      const ok = talentAvailable(t, save, cleared);
      const maxed = r >= t.maxRank;
      const can = ok && !maxed && (save.currencies.TP || 0) >= t.costTp && save.currencies.GOLD >= t.costGold;
      return `<div class="shop-item ${ok ? "" : "dim"}">
        <div class="si-icon tier">T${t.tier}</div>
        <div class="si-main">
          <div class="si-name">${t.name}<em>${r}/${t.maxRank}</em></div>
          <div class="si-desc">${t.effect}${t.eff ? "" : " <i class='util'>(편의·규칙)</i>"}</div>
          ${ok ? "" : `<div class="si-lock">🔒 ${chLabel(t.unlockChapter)} 성공 후${t.prereq.length ? ` · 먼저 ${t.prereq.join("/")}` : ""}</div>`}
        </div>
        <button class="buy" data-talent="${t.id}" ${can ? "" : "disabled"}>${maxed ? "최대" : "배우기"}${maxed ? "" : `<small>🔷${t.costTp} 💰${t.costGold}</small>`}</button>
      </div>`;
    }).join("")}</div>`;
  el.querySelectorAll("[data-branch]").forEach((b) => b.addEventListener("click", () => { talentBranch = b.dataset.branch; renderGrowTab(); }));
  const rs = document.getElementById("btn-treset");
  if (rs) rs.addEventListener("click", () => {
    if (ECO.freeResetLeft(save) <= 0) return;
    save.talentReset.n++;
    const r = ECO.resetTalents(save);
    ECOUI.toast("특성 초기화", [`특성점수 ${r.tp} 전액 환급`, `금화 ${r.gold.toLocaleString()} (50%) 환급`]);
    writeSave(save); refreshMenuMeta();
  });
  el.querySelectorAll("[data-talent]").forEach((b) => b.addEventListener("click", () => {
    const t = TALENTS.find((x) => x.id === b.dataset.talent);
    save.currencies.TP -= t.costTp; save.currencies.GOLD -= t.costGold;
    save.talents[t.id] = (save.talents[t.id] || 0) + 1;
    writeSave(save); playSfx("goldReward", 0.45); refreshMenuMeta();
  }));
}

const COL_BOX_COST = 100;       // 수집품 상자: 파편 100 (rewards.csv RW_COL_CHEST), 세트 지정 120
let colSetPick = null;
function renderCollectibles(el) {
  const ownedN = Object.keys(save.collectibles).length;
  const pity = 40 - ((save.pity.RW_COL_CHEST || 0) % 40);
  el.innerHTML = `
    <div class="sub-tabs"><span class="tp">🧩 파편 <b>${save.currencies.SHARD || 0}</b> · 보유 ${ownedN}/${COLLECTIBLES.length} · 전설 확정까지 ${pity}회</span>
      <button class="buy" id="btn-colbox" ${(save.currencies.SHARD || 0) >= COL_BOX_COST ? "" : "disabled"}>수집품 상자<small>🧩 ${COL_BOX_COST} · 희귀70/영웅25/전설5</small></button>
      <button class="buy" id="btn-colset" ${colSetPick && (save.currencies.SHARD || 0) >= 120 ? "" : "disabled"}>세트 지정 상자<small>🧩 120 · ${colSetPick ? SETS.find((s) => s.id === colSetPick).name : "세트를 고르세요"}</small></button></div>
    <div class="note">중복은 강화 재료: Lv2 +1개, Lv3 +2, Lv4 +3, Lv5 +4 (효과 ×1 / 1.25 / 1.5 / 2 / 3). Lv5 이후 중복은 자동 분해(희귀 30·영웅 80·전설 300 파편)</div>
    <div class="set-list">${SETS.map((s) => {
      const items = COLLECTIBLES.filter((c) => c.setId === s.id);
      const have = items.filter((c) => save.collectibles[c.id]).length;
      return `<div class="set-card ${colSetPick === s.id ? "pick" : ""}" data-setpick="${s.id}">
        <div class="set-head">${s.name} <span>${have}/${items.length}${s.id === "SET20" ? " · 업적 전용" : ""}</span></div>
        <div class="set-items">${items.map((c) => {
          const n = save.collectibles[c.id] || 0;
          const lv = ECO.colLevel(n);
          return `<span class="col ${n ? "" : "none"}" style="border-color:${RARITY[c.rarity].color}" title="${c.effect}${c.lv5 ? ` / Lv5: ${c.lv5}` : ""}">${n ? c.name : "?"}${n ? ` Lv${lv}` : ""}</span>`;
        }).join("")}</div>
        <div class="set-bonus ${have >= 3 ? "on" : ""}">3세트: ${s.bonus3}</div>
        <div class="set-bonus ${have >= 5 ? "on" : ""}">5세트: ${s.bonus5}</div>
      </div>`;
    }).join("")}</div>`;
  el.querySelectorAll("[data-setpick]").forEach((d) => d.addEventListener("click", () => {
    if (d.dataset.setpick === "SET20") return;
    colSetPick = d.dataset.setpick; renderCollectibles(el);
  }));
  const b = document.getElementById("btn-colbox");
  if (b) b.addEventListener("click", () => {
    save.currencies.SHARD -= COL_BOX_COST;
    const r = ECO.openChest(save, "RW_COL_CHEST");
    ECO.bump(save, "colBox", 1);
    ECOUI.toast("수집품 상자", [{ text: r.text, color: r.color }]);
    writeSave(save); playSfx("levelupOpen", 0.5); refreshMenuMeta();
  });
  const bs = document.getElementById("btn-colset");
  if (bs) bs.addEventListener("click", () => {
    save.currencies.SHARD -= 120;
    const r = ECO.openChest(save, "RW_COL_SET_CHEST", { sets: [colSetPick] });
    ECO.bump(save, "colBox", 1);
    ECOUI.toast("세트 지정 상자", [{ text: r.text, color: r.color }]);
    writeSave(save); playSfx("levelupOpen", 0.5); refreshMenuMeta();
  });
}
// ====================== 임무 탭: 일일·주간 미션 · 업적 ======================
let questSub = "daily";
function renderQuestTab() {
  refreshMissions();
  flushLobbyCounters();
  const el = document.getElementById("quest-body");
  document.querySelectorAll("[data-quest]").forEach((b) => b.classList.toggle("on", b.dataset.quest === questSub));
  if (questSub === "event") return ECOUI.renderEvents(el);
  if (questSub === "title") return ECOUI.renderTitles(el);
  let rows = [];
  if (questSub === "ach") {
    rows = ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.hidden && !achievementProgress(a) ? "???" : a.name,
      cond: a.hidden && !achievementProgress(a) ? "비밀 업적" : a.condition,
      target: a.target, prog: Math.min(a.target, achievementProgress(a)), reward: a.reward,
      claimed: !!save.achievements.claimed[a.id], kind: "ach" }));
  } else {
    const ids = questSub === "daily" ? save.missions.daily : save.missions.weekly;
    rows = ids.map((id) => MISSIONS.find((m) => m.id === id)).filter(Boolean).map((m) => ({
      id: m.id, name: m.name, cond: m.condition, target: m.target, prog: missionProgress(m.id),
      reward: m.reward, claimed: !!save.missions.claimed[m.id], kind: "mission" }));
  }
  rows.sort((a, b) => (a.claimed - b.claimed) || ((b.prog >= b.target) - (a.prog >= a.target)));
  const doneN = rows.filter((r) => r.claimed).length;
  // 임무 탭 배지: 지금 받을 수 있는 보상 수(오늘·이번 주)
  const claimable = [...(save.missions.daily || []), ...(save.missions.weekly || [])].filter((id) => {
    const m = MISSIONS.find((x) => x.id === id); return m && !save.missions.claimed[id] && missionProgress(id) >= m.target;
  }).length;
  const dot = document.getElementById("nav-quest-dot");
  dot.textContent = claimable; dot.classList.toggle("hidden", !claimable);
  el.innerHTML = `<div class="sub-tabs"><span class="tp">완료 ${doneN}/${rows.length}</span></div>
    <div class="shop-list">${rows.map((r) => {
      const done = r.prog >= r.target;
      return `<div class="shop-item ${r.claimed ? "dim" : ""}">
        <div class="si-main">
          <div class="si-name">${r.name}</div>
          <div class="si-desc">${r.cond}</div>
          <div class="bar"><i style="width:${Math.round((r.prog / r.target) * 100)}%"></i></div>
          <div class="si-val">${r.prog.toLocaleString()}/${r.target.toLocaleString()} · 보상 ${rewardText(r.reward)}</div>
        </div>
        <button class="buy" data-claim="${r.kind}:${r.id}" ${done && !r.claimed ? "" : "disabled"}>${r.claimed ? "완료" : "받기"}</button>
      </div>`;
    }).join("")}</div>`;
  el.querySelectorAll("[data-claim]").forEach((b) => b.addEventListener("click", () => {
    const [kind, id] = b.dataset.claim.split(":");
    if (kind === "ach") { const a = ACHIEVEMENTS.find((x) => x.id === id); ECOUI.toast(`업적: ${a.name}`, grantReward(a.reward, a.name)); save.achievements.claimed[id] = true; }
    else { grantReward(MISSIONS.find((m) => m.id === id).reward); save.missions.claimed[id] = true; }
    writeSave(save); playSfx("goldReward", 0.5); refreshMenuMeta();
  }));
}

// ====================== 시간 모드 · 빠른 전투 · 오프라인 봉화 · 입장 비용 ======================
function renderTimeRow() {
  tickEnergy(); tickTickets();
  const el = document.getElementById("time-row");
  const prog = save.progress.chapters[selectedChapterId] || {};
  const stars = (prog.stars || []).filter(Boolean).length;
  const selCh = chapterById(selectedChapterId);
  const surv = isSurvival(selCh);
  const off = offlineGold();
  if (save.quick.day !== todayKey()) { save.quick.day = todayKey(); save.quick.count = 0; }
  const qLeft = QUICK_BATTLE_PER_DAY - save.quick.count;
  const energyN = entryCost("M01").n;
  const timesHtml = surv
    ? `<span class="chip-btn on">⏱ 5분 서바이벌 · ${isBossStage(selCh) ? "시간이 끝나면 보스전!" : "끝까지 버티면 클리어"} <small>⚡${energyN}</small></span>`
    : Object.values(TIME_MODES).map((t) => `
      <button class="chip-btn ${selectedTime === t.id ? "on" : ""}" data-time="${t.id}">
        ${t.name} ${t.dur / 60}분 <small>⚡${t.energy}</small></button>`).join("");
  el.innerHTML = selectedMode !== "M01" ? "" : `
    <div class="times">${timesHtml}</div>
    <div class="times">
      <button class="chip-btn" id="btn-quick" ${stars >= 3 && qLeft > 0 && save.energy.value >= energyN ? "" : "disabled"}>
        빠른 전투 (★3 필요 · 남은 ${qLeft})</button>
      <button class="chip-btn" id="btn-offline" ${off.gold > 0 ? "" : "disabled"}>
        🏮 봉화 수익 ${off.gold.toLocaleString()} (${off.hours.toFixed(1)}h)</button>
    </div>`;
  el.querySelectorAll("[data-time]").forEach((b) => b.addEventListener("click", () => {
    selectedTime = b.dataset.time; playSfx("uiClick", 0.35); refreshMenuMeta();
  }));
  const q = document.getElementById("btn-quick");
  if (q) q.addEventListener("click", quickBattle);
  const o = document.getElementById("btn-offline");
  if (o) o.addEventListener("click", () => {
    const g = offlineGold();
    save.currencies.GOLD += g.gold; save.offline.last = Date.now();
    writeSave(save); playSfx("goldReward", 0.6); log(`봉화 수익 ${g.gold} 금화 수령`); refreshMenuMeta();
  });
  // 시작 버튼에 입장 비용 표시
  const cost = entryCost(selectedMode);
  const btn = document.getElementById("btn-start");
  const tName = { dungeon: "자원 던전권", hazard: "위험 구역권", exped: "원정권" };
  btn.innerHTML = cost.kind === "energy" ? `출동! <small>⚡ ${cost.n}</small>`
    : cost.kind === "ticket" ? `출동! <small>🎟️ ${tName[cost.key]} ${save.tickets[cost.key]}</small>` : "출동!";
  document.getElementById("m-energy").textContent = `${save.energy.value}/${ENERGY_CAP}`;
  if (!save.offline.last) { save.offline.last = Date.now(); writeSave(save); }
}

// 빠른 전투(docs/11 §6): 별점 3 챕터, 에너지 동일 소모, 즉시 결산, 반복 보상 70%, 하루 10회
function quickBattle() {
  const ch = chapterById(selectedChapterId);
  const cost = entryCost("M01");
  if (!canPay(cost)) return;
  pay(cost);
  save.quick.count++;
  const gold = Math.round(ch.repeat.gold * 0.7 * (1 + (computeRunBonus().goldPct || 0)));
  save.currencies.GOLD += gold;
  // 반복 드롭: 챕터 구간 장비 상자 확률(rewards.csv RW_CH_REPEAT @chapters.repeat_reward)
  const pct = +(ch.repeatRaw?.match(/장비 상자\D*(\d+)%/)?.[1] || 20);
  const got = [];
  if (Math.random() * 100 < pct) { const r = ECO.openChest(save, ECO.chapterChest(ch.index), { maxChapter: ch.index + 1 }); if (r) got.push(r); }
  save.stats.runs++; save.stats.clears++;
  advanceMissions({ quick: 1 });
  writeSave(save);
  playSfx("goldReward", 0.6);
  ECOUI.toast("빠른 전투 완료", [`금화 +${gold.toLocaleString()}`, ...got.map((r) => ({ text: r.text, color: r.color }))]);
  log(`빠른 전투 완료: 금화 +${gold}`);
  refreshMenuMeta();
}

// ====================== 모드 선택(전투 탭) ======================
function modeUnlocked(m) { return m.unlockChapter === 0 || highestClearedIndex() + 1 >= m.unlockChapter; }
function renderModeStrip() {
  const el = document.getElementById("mode-strip");
  el.innerHTML = MODES.map((m) => {
    const ok = modeUnlocked(m);
    return `<button class="mode ${m.id === selectedMode ? "on" : ""} ${ok ? "" : "locked"}" data-mode="${m.id}">
      ${m.name}${ok ? "" : ` 🔒CH${String(m.unlockChapter).padStart(2, "0")}`}</button>`;
  }).join("");
  el.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    const m = MODES.find((x) => x.id === b.dataset.mode);
    if (!modeUnlocked(m)) { playSfx("uiClick", 0.3); return; }
    selectedMode = m.id; selectedChallenge = null; playSfx("cardSelect", 0.4); refreshMenuMeta();
  }));

  // 모드 설명 + 도전 목록
  const m = MODES.find((x) => x.id === selectedMode);
  const info = document.getElementById("mode-info");
  const rec = selectedMode === "M04" ? `최고 점수 ${(save.modeRecords.M04 || 0).toLocaleString()}`
    : selectedMode === "M05" ? `최고 ${save.modeRecords.M05 || 0}층 · 다음 ${(save.modeRecords.M05 || 0) + 1}층`
    : selectedMode === "M07" ? `최고 생존 ${formatTime(save.modeRecords.M07 || 0)}` : "";
  info.innerHTML = selectedMode === "M01" ? "" :
    `<div class="mi-name">${m.name} <span>${m.duration}</span></div><div class="mi-desc">${m.win}${rec ? ` · <b>${rec}</b>` : ""}</div>`;

  const clEl = document.getElementById("challenge-list");
  if (selectedMode !== "M02") { clEl.innerHTML = ""; return; }
  const avail = CHALLENGES.filter((c) => save.progress.chapters[c.chapterId]?.cleared);
  if (!avail.length) { clEl.innerHTML = `<div class="empty">챕터를 클리어하면 해당 챕터의 도전이 열립니다.</div>`; return; }
  clEl.innerHTML = avail.slice(-30).reverse().map((c) => {
    const prevOk = c.tier === 1 || save.challenges[CHALLENGES.find((x) => x.chapterId === c.chapterId && x.tier === c.tier - 1)?.id];
    const done = save.challenges[c.id];
    return `<div class="challenge ${c.id === selectedChallenge ? "sel" : ""} ${prevOk ? "" : "locked"}" data-cl="${c.id}">
      <div class="cl-name">${c.chapterId} · ${"★".repeat(c.tier)} ${c.name}${done ? " ✅" : ""}</div>
      <div class="cl-rules">${c.rules.map((r) => RULES[r]?.name).filter(Boolean).join(" + ")} — 보상 ${rewardText(c.reward)}</div>
    </div>`;
  }).join("");
  clEl.querySelectorAll("[data-cl]").forEach((b) => b.addEventListener("click", () => {
    if (b.classList.contains("locked")) { playSfx("uiClick", 0.3); return; }
    selectedChallenge = b.dataset.cl; playSfx("cardSelect", 0.4); refreshMenuMeta();
  }));
}

function renderShop(list = document.getElementById("shop-list")) {
  list.innerHTML = Object.values(UPGRADES).map((d) => {
    const lv = upLv(d.id);
    const maxed = lv >= d.maxLv;
    const price = maxed ? 0 : d.cost(lv);
    const have = save.currencies[d.currency] || 0;
    const afford = have >= price;
    const cIcon = d.currency === "GOLD" ? "💰" : "✨";
    return `
      <div class="shop-item">
        <div class="si-icon">${d.icon}</div>
        <div class="si-main">
          <div class="si-name">${d.name}<em>Lv ${lv}/${d.maxLv}</em></div>
          <div class="si-desc">${d.desc}</div>
          <div class="si-val">현재 ${lv ? d.valueText(lv) : "없음"}${maxed ? "" : ` → ${d.valueText(lv + 1)}`}</div>
        </div>
        <button class="buy" data-up="${d.id}" ${maxed || !afford ? "disabled" : ""}>
          ${maxed ? "최대" : "강화"}${maxed ? "" : `<small>${cIcon} ${price.toLocaleString()}</small>`}
        </button>
      </div>`;
  }).join("");

  list.querySelectorAll(".buy[data-up]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const def = UPGRADES[btn.dataset.up];
      const res = buyUpgrade(save, def);
      if (res.ok) {
        playSfx("goldReward", 0.5);
        log(`${def.name} Lv${res.newLv} 강화 완료 (-${res.price})`);
      } else {
        playSfx("uiClick", 0.4);
      }
      refreshMenuMeta();
    });
  });
}

// 성장·임무 하위 탭(정의는 아래 함수 선언부에서 호이스팅됨)
document.querySelectorAll("[data-grow]").forEach((b) => b.addEventListener("click", () => {
  growSub = b.dataset.grow; playSfx("uiClick", 0.35); renderGrowTab();
}));
document.querySelectorAll("[data-quest]").forEach((b) => b.addEventListener("click", () => {
  questSub = b.dataset.quest; playSfx("uiClick", 0.35); renderQuestTab();
}));
document.querySelectorAll("[data-csub]").forEach((b) => b.addEventListener("click", () => {
  charSub = b.dataset.csub; playSfx("uiClick", 0.35); renderCharTab();
}));

// 로비 탭 전환
document.querySelectorAll(".nav[data-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    playSfx("uiClick", 0.4);
    document.querySelectorAll(".nav[data-tab]").forEach((b) => b.classList.toggle("on", b === btn));
    const tab = btn.dataset.tab;
    for (const t of ["battle", "char", "gear", "grow", "quest", "shop"]) {
      document.getElementById("tab-" + t).classList.toggle("hidden", tab !== t);
    }
  });
});

function log(msg) {
  const t = new Date().toLocaleTimeString();
  elLog.textContent = `[${t}] ${msg}`;
  console.log("[LUMEN]", msg);
}

// ---------- Input ----------
const keys = new Set();
let debugFast = false;
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { togglePause(); return; }
  keys.add(e.key.toLowerCase());
  if (SG_LOCAL && e.key.toLowerCase() === "f") {
    debugFast = !debugFast;
    log(`디버그 가속 ${debugFast ? "ON (x8)" : "OFF"}`);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ---------- 터치 조작 (docs/06 §1: 터치 위치에서 생성되는 플로팅 조이스틱, 데드존 8%, 최대 반경 60px) ----------
const JOY_RADIUS = 60, JOY_DEADZONE = 0.08;
const touchJoy = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, mag: 0 };

function joyStart(e) {
  if (mode !== "playing") return;
  const t = e.changedTouches[0];
  touchJoy.active = true; touchJoy.id = t.identifier;
  touchJoy.ox = t.clientX; touchJoy.oy = t.clientY;
  touchJoy.dx = 0; touchJoy.dy = 0; touchJoy.mag = 0;
  e.preventDefault();
}
function joyMove(e) {
  if (!touchJoy.active) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== touchJoy.id) continue;
    let dx = t.clientX - touchJoy.ox, dy = t.clientY - touchJoy.oy;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, JOY_RADIUS);
    if (len > 0) { dx = (dx / len) * clamped; dy = (dy / len) * clamped; }
    touchJoy.dx = dx; touchJoy.dy = dy;
    touchJoy.mag = clamped / JOY_RADIUS;
    e.preventDefault();
  }
}
function joyEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === touchJoy.id) {
      touchJoy.active = false; touchJoy.id = null; touchJoy.mag = 0;
      touchJoy.dx = 0; touchJoy.dy = 0;
    }
  }
}
canvas.addEventListener("touchstart", joyStart, { passive: false });
canvas.addEventListener("touchmove", joyMove, { passive: false });
canvas.addEventListener("touchend", joyEnd);
canvas.addEventListener("touchcancel", joyEnd);

// ---------- Game state ----------
const RANGE_ELITE_DR = 0.10, BOSS_DR = 0.20;
let mode = "menu"; // menu | playing | levelup | result
let cam = { x: 0, y: 0 };
let player, enemies, projectiles, gems, floatingTexts, boss, runTime, spawnAcc, killCount, damageDealt, chapterCleared;
let hitFx, deathFx, decor, chestGold;
let beams, strikes, blasts, arcs;          // 광선 / 지연 낙뢰 / 폭발 / 연쇄 번개 시각+판정
let fields, minions, traps, swings;        // 장판 / 소환체 / 지뢰 / 근접 휘두르기
let shake = { t: 0, mag: 0 };              // 화면 흔들림
let hitStopT = 0;                          // 큰 타격 시 짧은 정지(타격감)
let runId = null;

function addShake(mag, t = 0.18) {
  shake.mag = Math.max(shake.mag, mag);
  shake.t = Math.max(shake.t, t);
}
function addHitStop(t) { hitStopT = Math.max(hitStopT, t); }

// 배경 장식(횃불·바위·상자) — 판마다 새로 배치되는 월드 고정 좌표.
// 횃불·바위는 순수 연출(충돌 없음). 상자는 다가가면 여는 보상 오브젝트(아래 updateDecor).
function buildDecor() {
  const items = [];
  const rng = mulberry32(Math.floor(Math.random()*0xFFFFFFFF));
  // 환경 테마 1 소품. h = 화면 높이(px), solid = 장애물 반경(px, 플레이어·적이 지나갈 수 없음), bumper = 부딪힌 적을 튕겨 냄,
  // bin = 곁에 서면 정리(새싹·금화), litter = 밟아서 줍기(새싹), chest = 재활용 봉투(금화)
  const t1 = chapter?.theme === 1;
  const kinds = t1 ? [
    { sprite: "t1_prop_bin_fallen", h: 46, solid: 16, bin: true }, { sprite: "t1_prop_bags", h: 42, solid: 18 }, { sprite: "item_recycle", h: 28, chest: true },
    { sprite: "t1_prop_tire", h: 28, solid: 15, bumper: true }, { sprite: "t1_prop_bench", h: 40, solid: 22 }, { sprite: "t1_prop_litter", h: 30, litter: true },
    { sprite: "item_recycle", h: 28, chest: true }, { sprite: "t1_prop_litter", h: 30, litter: true },
  ] : [
    { sprite: "prop_torch", scale: 2.2, glow: true },
    { sprite: "prop_rock", scale: 1.8, glow: false },
    { sprite: "prop_chest", scale: 1.8, glow: false, chest: true },
  ];
  for (let i = 0; i < (t1 ? 36 : 26); i++) {
    const angle = rng() * Math.PI * 2;
    const r = 120 + rng() * 1800;
    const kind = kinds[i % kinds.length];
    items.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r, ...kind, flicker: rng() * 10, opened: false });
  }
  return items;
}

// 상자 상호작용: 근접하면 자동으로 열려 골드 보너스를 지급한다(결과 화면에서 정산).
function dropSprouts(x, y, n) {                 // 새싹(경험치) n개를 주변에 흩뿌린다
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random();
    gems.push({ x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, value: gemValue(1, runTime / 60) * (runCfg.gemMul || 1), vx: 0, vy: 0, spawnT: 0, bob: Math.random() * 10 });
  }
}
function updateDecor(dt) {
  for (const d of decor) {
    if (d.opened) continue;
    if (d.expire && runTime > d.expire) { d.opened = true; continue; }        // 보스가 뿌린 쓰레기는 시간이 지나면 사라진다
    const dd = dist(d.x, d.y, player.x, player.y);
    if (d.chest) {
      if (dd <= 0.7 * U) {
        d.opened = true;
        runStats.chests++;
        const reward = 25 + Math.floor(Math.random() * 35);
        dropSprouts(d.x,d.y,4);
        floatingTexts.push({ x: d.x, y: d.y - 16, text: "재활용! 새싹 +4", life: 0.9, vy: -35, color: "#ffe27a", scale: 0 });
        hitFx.push({ x: d.x, y: d.y, life: 0.3, maxLife: 0.3, color: "#ffe27a", vfxKind: "clean" });
        playSfx("goldReward", 0.5);
      }
      continue;
    }
    if (d.litter) {                              // 쓰레기 줍기: 밟으면 새싹 3개. 보스가 뿌린 것이면 보스가 약해진다
      if (dd <= 0.6 * U) {
        d.opened = true;
        runStats.litter=(runStats.litter||0)+1;
        dropSprouts(d.x, d.y, 3);
        hitFx.push({ x: d.x, y: d.y, life: 0.3, maxLife: 0.3, color: "#9fe07a", vfxKind: "clean" });
        playSfx("gemPickup", 0.5);
        if (d.bossLitter && boss && boss.hp > 0 && ++player.sgBossLitter%5===0) {
          boss.hp -= boss.hpMax * 0.03; boss.stunT = Math.max(boss.stunT || 0, 1.0); boss.flashT = 0.2;
          healPlayer(player.hpMax * 0.05);
          if (chapter?.theme === 1) {
            themeFx.emit("link", d.x, d.y, { toX: boss.x, toY: boss.y });
            themeFx.emit("clean", player.x, player.y, { radius: 35 });
          }
          floatingTexts.push({ x: player.x, y: player.y - 30, text: "정화! 대왕이 약해졌어요", life: 1.1, vy: -28, color: "#7ee08a", scale: 0, big: true });
          addShake(3, 0.15);
        } else {
          floatingTexts.push({ x: d.x, y: d.y - 16, text: "쓰레기 줍기 🌱+3", life: 0.9, vy: -35, color: "#8ee07a", scale: 0 });
        }
      }
      continue;
    }
    if (d.bin) {                                 // 넘어진 쓰레기통: 곁(장애물 반경 + 0.9u)에 1.2초 서 있으면 정리 완료
      if (dd <= d.solid + 0.9 * U) {
        d.cleanT = (d.cleanT || 0) + dt;
        if (d.cleanT >= 1.2) {
          d.opened = true; d.solid = 0;
          dropSprouts(d.x, d.y, 6);
          const reward = 30;
          runStats.chests++; runStats.litter=(runStats.litter||0)+1;
          floatingTexts.push({ x: d.x, y: d.y - 20, text: "쓰레기통 정리! 새싹 +6", life: 1.1, vy: -32, color: "#ffe27a", scale: 0, big: true });
          hitFx.push({ x: d.x, y: d.y, life: 0.35, maxLife: 0.35, color: "#9fe07a", vfxKind: "clean" });
          playSfx("levelupOpen", 0.5);
        }
      } else if (d.cleanT) d.cleanT = Math.max(0, d.cleanT - dt * 2);
    }
  }
}
// 장애물(solid) 밀어내기: 플레이어·적이 소품 안으로 못 들어간다. 타이어(bumper)는 적을 튕겨 내고 조금 다치게 한다(0.5초에 한 번).
function resolveObstacles(ent, r, enemy) {
  for (const d of decor) {
    if (!d.solid || d.opened) continue;
    const dx = ent.x - d.x, dy = ent.y - d.y;
    const min = d.solid + r;
    const dd = Math.hypot(dx, dy);
    if (dd >= min || dd === 0) continue;
    const nx = dx / dd, ny = dy / dd;
    ent.x = d.x + nx * min; ent.y = d.y + ny * min;
    if (enemy && d.bumper && (!enemy.bumpT || runTime - enemy.bumpT > 0.5)) {
      enemy.bumpT = runTime;
      enemy.kbVx = nx * 420; enemy.kbVy = ny * 420;
      enemy.hp -= enemy.hpMax * 0.08; enemy.flashT = 0.15;
      hitFx.push({ x: enemy.x, y: enemy.y, life: 0.25, maxLife: 0.25, color: "#ffd06a", vfxKind: "bump" });
      floatingTexts.push({ x: enemy.x, y: enemy.y - 14, text: "튕!", life: 0.5, vy: -30, color: "#ffd06a", scale: 0 });
    }
  }
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 판 설정(모드별) ----------
// M01 메인 / M02 도전 / M03 자원 던전 / M04 보스 점수 / M05 등반탑 / M06 위험 구역 / M07 무한 생존 / M08 원정
let runCfg = { mode: "M01" };
let selectedMode = "M01";
let selectedChallenge = null;
let selectedTime = "std";

// ---------- 에너지 · 티켓 · 오프라인 ----------
function tickEnergy() {
  return; // Legacy economy is archived in the guardian release.

  const now = Date.now();
  const e = save.energy;
  if (!e.last) e.last = now;
  const gained = Math.floor((now - e.last) / (ENERGY_REGEN_S * 1000));
  if (gained > 0) {
    if (e.value < ENERGY_CAP) e.value = Math.min(ENERGY_CAP, e.value + gained);
    e.last += gained * ENERGY_REGEN_S * 1000;
  }
  if (e.value >= ENERGY_CAP) e.last = now;
}
function tickTickets() {
  return; // Legacy economy is archived in the guardian release.

  const t = save.tickets;
  // 특성 "일일 자원 던전 입장 +N"을 반영
  const extraDungeon = TALENTS.filter((x) => /자원 던전 입장/.test(x.effect))
    .reduce((s, x) => s + (save.talents[x.id] || 0), 0);
  if (t.day !== todayKey()) { t.day = todayKey(); t.dungeon = TICKET_CAP.dungeon + extraDungeon; }
  if (t.week !== weekKey()) { t.week = weekKey(); t.hazard = TICKET_CAP.hazard; t.exped = TICKET_CAP.exped; }
}
function entryCost(modeId) {
  if (MODE_TICKET[modeId]) return { kind: "ticket", key: MODE_TICKET[modeId], n: 1 };
  if (modeId === "M01") return { kind: "energy", n: isSurvival(chapterById(selectedChapterId)) ? SURVIVAL_TM.energy : TIME_MODES[selectedTime].energy };
  if (MODE_ENERGY[modeId]) return { kind: "energy", n: MODE_ENERGY[modeId] };
  return { kind: "free", n: 0 };                    // M04 보스 점수: 무료(하루 2회 기록)
}
function canPay(cost) {
  if (cost.kind === "energy") return save.energy.value >= cost.n;
  if (cost.kind === "ticket") return (save.tickets[cost.key] || 0) >= cost.n;
  return true;
}
function pay(cost) {
  if (cost.kind === "energy") {
    if (save.energy.value >= ENERGY_CAP) save.energy.last = Date.now();
    save.energy.value -= cost.n;
  }
  if (cost.kind === "ticket") save.tickets[cost.key] -= cost.n;
  writeSave(save);
}
// 오프라인 봉화: 시간당 (최고 클리어 챕터 반복 금화 × 0.4), 상한 8h (docs/11 §1.1)
function offlineGold() {
  const hi = highestClearedIndex();
  if (hi < 0 || !save.offline.last) return { gold: 0, hours: 0 };
  const capH = 8 + Math.min(4, (save.talents.TC11 || 0));
  const hours = Math.min(capH, Math.max(0, (Date.now() - save.offline.last) / 3600000));
  return { gold: Math.floor(CHAPTERS[hi].repeat.gold * 0.4 * hours), hours };
}
// 로비에 들어올 때 자동 수령(버튼 없음) — 예전 「봉화 수익」 버튼을 초등학생용으로 단순화
function collectOfflineGold() {
  return; // Legacy economy is archived in the guardian release.

  const g = offlineGold();
  if (g.gold <= 0 || g.hours < 0.5) return;          // 30분 이상 쌓였을 때만(자잘한 알림 방지, 그 전까지는 계속 쌓임)
  save.currencies.GOLD += g.gold; save.offline.last = Date.now();
  writeSave(save); playSfx("goldReward", 0.6);
  ECOUI.toast("정화 장치가 모아 둔 금화", [`💰 +${g.gold.toLocaleString()} (${g.hours.toFixed(1)}시간 동안)`]);
  refreshMenuMeta();
}

function ruleMods(ruleId) { return challengeMods({ rules: [ruleId], params: "" }); }
// 이벤트 화면에서 전투 시작(입장 비용 없음 — 토큰으로 이미 지불)
function startEventBattle(spec) {
  const s = ECO.eventState(save, ECO.activeEvents().find((a) => a.inst === spec.inst));
  pendingEvent = { ...spec, depth: s.path?.length || 0 };
  newRun(selectedChapterId, "EV");
  mode = "playing";
  elMenu.classList.add("hidden");
  log(`이벤트 전투 시작: ${{ board: "탐사 보드 전투 칸", branch: "분기 원정 노드", hunt: "표적 보스 사냥", fort: "방어 거점" }[spec.kind]}`);
}
// ---------- 서바이벌 챕터(CH01~CH30 = 환경 테마 6장 × 5단계) ----------
// 5분 카운트다운을 끝까지 버티면 클리어. 5의 배수 챕터(각 장의 5단계)는 시간이 끝나면 보스가 나타나고 보스를 쓰러뜨려야 클리어.
// 그 뒤 챕터(CH31~)는 기존 방식(시간 모드 선택·보스 처치) 그대로. 로비에서 시간 모드 선택이 숨겨졌으므로 30단계까지는 전부 5분 서바이벌.
const SURVIVAL_CHAPTERS = 30;
const SURVIVAL_TM = { id: "surv", name: "서바이벌", dur: 300, gemMul: 2.2, rewardMul: 1.0, beaconAtS: 210, energy: 8, rank: 2 };
function isSurvival(ch) { return ch.index < SURVIVAL_CHAPTERS; }
function isBossStage(ch) { return (ch.index + 1) % 5 === 0; }

function buildRunConfig(modeId, chapterId) {
  return sgRunConfig(chapterId);

  const ch = chapterById(chapterId);
  const cfg = { mode: modeId, chapterId: ch.id, multMul: 1, mods: {} };
  // 시간 모드(메인 챕터만 선택 가능, CH01은 표준 고정 — docs/06 §10.1). 서바이벌 챕터는 5분 고정.
  const surv = modeId === "M01" && isSurvival(ch);
  const tm = surv ? SURVIVAL_TM : TIME_MODES[modeId === "M01" && ch.id !== "CH01" ? selectedTime : "std"];
  cfg.time = tm;
  cfg.gemMul = modeId === "M01" ? tm.gemMul / 1.4 : 1;   // gemValue()가 표준 1.4를 이미 곱하므로 비율만
  switch (modeId) {
    case "M01": {
      if (surv) {
        cfg.survival = true; cfg.bossStage = isBossStage(ch);
        cfg.timeLimitS = SURVIVAL_TM.dur; cfg.noBoss = true;      // 보스는 시간 종료 시 simTick이 직접 소환
        cfg.timeScale = SURVIVAL_TM.dur / 900;                   // 엘리트 시각표를 5분에 맞춰 축소
        cfg.beaconAtS = SURVIVAL_TM.beaconAtS;
        cfg.enrageAtS = SURVIVAL_TM.dur + 120;                   // 보스전이 2분 넘게 끌리면 광폭
        break;
      }
      // 챕터 시각표(완전 15분 기준)를 선택한 판 길이에 맞춰 축소
      cfg.timeScale = tm.dur / 900;
      cfg.bossAtS = tm.bossAtS;
      cfg.beaconAtS = tm.beaconAtS;
      cfg.enrageAtS = tm.dur;
      break;
    }
    case "M02": {                                    // 규칙 변형 도전 (docs/10 §1)
      const cl = CHALLENGES.find((c) => c.id === selectedChallenge);
      cfg.chapterId = cl.chapterId; cfg.challenge = cl.id;
      cfg.mods = challengeMods(cl);
      cfg.timeLimitS = cfg.mods.timeLimitS;
      break;
    }
    case "M03":                                      // 일일 자원 던전: 3분 목표 달성
      cfg.timeLimitS = 180; cfg.winOnTime = true; cfg.noBoss = true;
      cfg.startLevel = 15; cfg.startRandom = 3; cfg.densityMul = 1.6;
      break;
    case "M04":                                      // 보스 점수: 무적 보스, 3분 피해량
      cfg.timeLimitS = 180; cfg.winOnTime = true; cfg.bossScore = true; cfg.bossAtS = 2;
      cfg.startLevel = 30; cfg.startRandom = 4; cfg.startPassives = 4; cfg.densityMul = 0.25;
      break;
    case "M05": {                                    // 등반탑: 층 배수 = 챕터 ⌈층/2⌉ × 1.15
      const floor = (save.modeRecords.M05 || 0) + 1;
      cfg.floor = floor;
      cfg.chapterId = CHAPTERS[Math.min(CHAPTERS.length - 1, Math.ceil(floor / 2) - 1)].id;
      cfg.multMul = 1.15;
      if (floor % 5 === 0) { cfg.bossAtS = 60; }     // 5층마다 층 보스
      else { cfg.timeLimitS = 300; cfg.winOnTime = true; cfg.noBoss = true; }
      break;
    }
    case "M06":                                      // 위험 구역: 5:00 버티면 탈출, 엘리트 밀도 2배
      cfg.timeLimitS = 300; cfg.winOnTime = true; cfg.noBoss = true; cfg.densityMul = 1.3; cfg.eliteDouble = true;
      break;
    case "M07":                                      // 무한 생존: 5분마다 배수 ×1.35, 7:30마다 보스
      cfg.endless = true; cfg.noBoss = true;
      break;
    case "M08":                                      // 원정: 5연전, 스킬·레벨 유지
      cfg.stages = 5; cfg.stage = 1; cfg.bossAtS = 150;
      break;
    case "EV": {                                     // 이벤트 전투(events.json)
      const ev = pendingEvent;
      cfg.event = ev;
      if (ev.kind === "board" || ev.kind === "branch") {        // 탐사 보드 전투 칸 / 분기 원정 노드: 3:00 특수 규칙
        cfg.timeLimitS = 180; cfg.winOnTime = true; cfg.noBoss = true;
        cfg.mods = ruleMods(ev.rule);
        if (ev.kind === "branch") cfg.multMul = 1 + 0.15 * (ev.depth || 0);
      } else if (ev.kind === "hunt") {                          // 표적 보스: 3:00 무적 보스 피해 누적, 난이도 배수
        cfg.timeLimitS = 180; cfg.winOnTime = true; cfg.bossScore = true; cfg.bossAtS = 2;
        cfg.startLevel = 30; cfg.startRandom = 4; cfg.startPassives = 4; cfg.densityMul = 0.25;
        cfg.multMul = ECO.HUNT_DIFF[ev.diff].mult; cfg.bossId = ev.boss;
      } else if (ev.kind === "fort") {                          // 방어 거점: 5:00 봉화 방어, 시작 Lv20
        cfg.timeLimitS = 300; cfg.winOnTime = true; cfg.noBoss = true; cfg.densityMul = 1.2;
        cfg.startLevel = 20; cfg.startRandom = 3;
        cfg.fort = { hp: ECO.fortHp(ev.lv), turrets: ECO.fortTurrets(ev.lv) };
      }
      break;
    }
    default:
      break;
  }
  if (cfg.timeScale == null) cfg.timeScale = 1;
  return cfg;
}

// ---------- 어둠 지대 (chapters.csv wave_params의 dark 비율) ----------
// 무한 맵을 12u 격자로 나눠, 칸마다 결정적 해시로 어둠 여부를 정한다(반경 5u 원).
const DARK_CELL = 12 * U, DARK_R = 5 * U;
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2654435761) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function darkRatio() { return Math.max(runMods.dark || 0, chapter?.dark || 0); }
function darkCenter(ix, iy) {
  const seed = (chapter?.index || 0) + 7;
  if (hash2(ix, iy, seed) >= darkRatio()) return null;
  return {
    x: (ix + 0.5 + (hash2(ix, iy, seed + 1) - 0.5) * 0.5) * DARK_CELL,
    y: (iy + 0.5 + (hash2(ix, iy, seed + 2) - 0.5) * 0.5) * DARK_CELL,
  };
}
function isInDark(x, y) {
  if (darkRatio() <= 0) return false;
  const ix = Math.floor(x / DARK_CELL), iy = Math.floor(y / DARK_CELL);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const c = darkCenter(ix + dx, iy + dy);
    if (c && dist(x, y, c.x, c.y) < DARK_R) return true;
  }
  return false;
}

// 현재 적 배수 = 챕터 배수 × 모드 배수 × (무한 생존 성장) × (원정 단계)
function curMult() {
  let m = chapter.enemyMult * (runCfg.multMul || 1);
  if (runCfg.endless) m *= Math.pow(1.35, Math.floor(runTime / 300));
  if (runCfg.stages) m *= Math.pow(1.1, (runCfg.stage || 1) - 1);
  return m;
}

function newRun(chapterId, modeId = "M01") {
  if(!sgRunToken || modeId!=='M01' || !R.STAGES.some(s=>s.id===chapterId)) throw new Error('서버에서 도전을 먼저 시작해 주세요.');
  sgRunProfile=structuredClone(sgState.profile);sgRunSets=R.setCounts(sgRunProfile);sgSettling=false;
  runCfg = buildRunConfig(modeId, chapterId || selectedChapterId);
  runMods = runCfg.mods || {};
  chapter = chapterById(runCfg.chapterId);
  document.getElementById("app").classList.toggle("theme-one", chapter.theme === 1);
  bossDef = BOSSES[runCfg.bossId || chapter.boss];
  spawnedElites = new Set();
  runBonus = computeRunBonus();
  // 이벤트 조합 버프(다음 판 1회)는 여기서 소비
  const usedBuffs = save.nextRunBuffs.map((b) => b.name);
  save.nextRunBuffs = [];
  const usedPreset = !!save.presetLoadedAt; save.presetLoadedAt = 0;
  // 캐릭터 기본 스탯 + 장비 주스탯 + 상점 영구 강화 + 판 밖 보너스(docs/12 §1)
  const chr = {atk:30,hp:260,spd:4.5,baseWeapon:null,affinity:[],locked:[]};
  const eq = equippedStats();
  const baseAtk = chr.atk + eq.atk, baseHp = chr.hp + eq.hp, baseSpd = chr.spd;
  const hpMax = Math.round(baseHp * (1 + upValue("UP_HP") + (runBonus.hpPct || 0)));
  player = {
    x: 0, y: 0,
    hp: hpMax, hpMax,
    atk: Math.round(baseAtk * (1 + upValue("UP_ATK") + (runBonus.atkPct || 0))),
    lvl: 1, xp: 0,
    revives: runMods.noRevive ? 0 : Math.min(2, upValue("UP_REV") + (runBonus.revive || 0)),
    speedU: baseSpd * (1 + upValue("UP_SPD")),
    lum: Math.min(99, runBonus.lumStart || 0), lumCd: 0, buffT: 0, buffKind: null, shield: 0, shieldIdle: 0, healWindow: 0, healWindowT: 1,
    rerolls: 2, bans: 0, locks: 0, sgChoices: 0,
    invulnT: 0, hitFlashT: 0,
    facing: 1, aimAngle: 0, animT: 0, moving: false, orbitAngle: 0, muzzleT: 0,
    attackT: 0, jumpT: 0, downed: false,             // 주인공 프레임 애니메이션 상태(공격·점프 연출·쓰러짐)
    skills: {}, sgRun:{consumed:[],fusionCount:0,supports:{},partnerOffers:{}}, sgUsedSkills:[], sgUsedFusions:[], sgUsedSupports:[], sgLastChoice:-10,   // 원소 스킬 4칸 + 지원품 4칸(docs/22)
    passives: {},
    affinity: chr.affinity || [],
    lockedSkills: new Set(chr.locked || []),
    bannedSkills: new Set(),
  };
  enemies = [];
  projectiles = [];
  gems = [];
  floatingTexts = [];
  hitFx = [];
  deathFx = [];
  themeFx.reset();sgElements.reset();sgWeapon.reset();sgHostileShots=[];
  beams = [];
  strikes = [];
  blasts = [];
  arcs = [];
  fields = [];
  minions = [];
  traps = [];
  swings = [];
  shake = { t: 0, mag: 0 };
  hitStopT = 0;
  decor = buildDecor();
  chestGold = 0;
  boss = null;
  runTime = 0;
  spawnAcc = {};
  killCount = 0;
  damageDealt = 0;
  chapterCleared = false;
  window.__eliteSpawned = false;
  elBossLabel.textContent = "";   // 이전 판의 보스 예고 문구가 남지 않도록
  runId = sgRunToken; sgRunToken=null;
  runStats = { kills: 0, bossKills: 0, eliteKills: 0, evolutions: 0, revives: 0, chests: 0, gems: 0, bossDamage: 0,
    abilityUses: 0, darkGems: 0, statusDmg: 0, midBossNoHit: 0, evoKinds: [], presetRun: usedPreset, buffs: usedBuffs };
  fort = null;
  if (runCfg.fort) {
    fort = { x: 0, y: -2 * U, hp: runCfg.fort.hp, hpMax: runCfg.fort.hp, r: 1.3 * U, hitT: 0 };
    for (let i = 0; i < runCfg.fort.turrets; i++) {
      const a = (i / Math.max(1, runCfg.fort.turrets)) * Math.PI * 2;
      minions.push({ skillId: "FORT", x: fort.x + Math.cos(a) * 2.2 * U, y: fort.y + Math.sin(a) * 2.2 * U, cd: 0, idx: i,
        stationary: true, melee: false, dmgCoef: 0.7, dmgMul: 1, color: "#ffcf6a", rangeU: 7, life: Infinity, interval: 0.7 });
    }
  }
  pendingCollectibles = 0;
  nextEndlessBossAt = 450;
  stageTime = 0;
  beacon = null;
  enrageStage = 0;
  // 별점 추적(modes.csv M01: 클리어 / 무피해 최종 보스 / 완전 12:00 이내 Lv40, CH01은 보스 전 Lv30)
  starTrack = { bossNoHit: false, lvGoalAt: null };

  // 모드별 시작 상태(docs/10 §1: 자원 던전 Lv15·스킬 3 / 보스 점수 Lv30·공격 4·패시브 4)
  if (runCfg.startLevel) player.lvl = runCfg.startLevel;
  if (runCfg.startRandom) {
    const pool = Object.keys(SKILLS).filter((id) => !player.skills[id] && !player.lockedSkills.has(id));
    for (let i = 0; i < runCfg.startRandom - 1 && pool.length; i++) {
      const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      player.skills[id] = { lv: runCfg.mode === "M04" ? 5 : 3, cd: 0 };
    }
    if (runCfg.mode === "M04") for (const id in player.skills) player.skills[id].lv = 5;
  }
  if (runCfg.startPassives) {
    const pp = Object.keys(PASSIVES);
    for (let i = 0; i < runCfg.startPassives && pp.length; i++) {
      const id = pp.splice(Math.floor(Math.random() * pp.length), 1)[0];
      player.passives[id] = { lv: 5 };
    }
  }

  // 출전 펫: 전투 보조 소환체로 등장(docs/09 §4)
  const pet = null;
  if (pet) {
    const style = PET_STYLE[pet.ai] || "shoot";
    const petLv = save.pets[pet.id]?.lv || 1;
    minions.push({
      skillId: "PET", pet: pet.id, x: 0, y: 0, cd: 0, idx: 0,
      stationary: false, melee: style === "melee", petStyle: style,
      dmgCoef: pet.coef * ECO.petPower(save, pet.id), dmgMul: 1 + (runBonus.petDmgPct || 0),
      color: "#ffd0a0", rangeU: 6, life: Infinity, interval: pet.interval,
      // 펫 HP = 플레이어 최대 체력 × hp_pct_of_player (docs/09 §4.4)
      hp: Math.round(player.hpMax * pet.hpPct * (1 + (runBonus.petHpPct || 0))), downT: 0, downs: 0,
    });
    minions[minions.length - 1].hpMax = minions[minions.length - 1].hp;
  }
  if(sgRunProfile.activePet){
    minions.push({guardianPet:sgRunProfile.activePet,x:-30,y:20,cd:0,idx:0,life:Infinity});
    // 동물 친구 버프 중 시작 시 한 번 적용되는 것: 최대 체력, 시작 보호막
    const hpAdd=R.petBuff(sgRunProfile,'hpPct');if(hpAdd){const plus=Math.round(player.hpMax*hpAdd);player.hpMax+=plus;player.hp+=plus;}
    const sh=R.petBuff(sgRunProfile,'shieldStart');if(sh)player.shield=Math.max(player.shield,player.hpMax*sh);
  }
  runStats.litter=0;player.sgChoices=0;player.sgBossLitter=0;
  contactDamageThisSecond=0;
  sgTraitSeen={};sgTraitLabelAt=-9;
}
let runStats = {};
let starTrack = {};
let pendingCollectibles = 0;     // 판 중 획득한 수집품(결과 화면에서 확정)

document.getElementById("btn-start").addEventListener("click", () => sgStart(selectedChapterId).catch(e=>log(e.message)));

document.getElementById("btn-continue").addEventListener("click", () => {
  if(sgSettling)return;
  if(sgState.profile&&R.pendingPet(sgState.profile))sgUI.tab='friends';
  playSfx("uiClick", 0.5);
  elResult.classList.add("hidden");
  refreshMenuMeta();
  elMenu.classList.remove("hidden");
  mode = "menu";
  sgRunProfile=null;
  bgmOn(true);   // 전투 뒤 로비로 돌아오면 테마곡을 처음부터
  sgMaybeGuidance();
});

// ---------- 일시정지 (Esc / ⏸) ----------
// mode "paused": 시뮬만 멈추고 화면은 그대로 그린다. 나가기는 endRun(false)로 이번 판을 패배 처리(처치 금화·계정 XP는 지급).
const elPause = document.getElementById("pause");
function togglePause() {
  if (mode === "playing") { mode = "paused"; keys.clear(); elPause.classList.remove("hidden"); playSfx("uiClick", 0.4); }
  else if (mode === "paused") { mode = "playing"; elPause.classList.add("hidden"); playSfx("uiClick", 0.4); }
}
function quitRun(toTitle) {
  if(sgSettling)return;

  if (mode !== "paused" && mode !== "playing") return;
  elPause.classList.add("hidden");
  mode = "playing";                 // endRun은 진행 중인 판을 정리한다
  endRun(false);
  if (false) {
    elResult.classList.add("hidden");
    refreshMenuMeta();
    elMenu.classList.remove("hidden");
    mode = "menu";
    document.getElementById("title").classList.remove("hidden");
    refreshTitle();
  }
}
document.getElementById("btn-pause").addEventListener("click", togglePause);
document.getElementById("btn-resume").addEventListener("click", togglePause);
document.getElementById("btn-quit-lobby").addEventListener("click", () => { playSfx("uiClick", 0.5); quitRun(false); });
document.getElementById("btn-quit-title").addEventListener("click", () => { playSfx("uiClick", 0.5); quitRun(true); });
document.getElementById("btn-to-title").addEventListener("click", () => {
  playSfx("uiClick", 0.4);
  document.getElementById("title").classList.remove("hidden");
  refreshTitle();
  bgmOn();   // 로비 → 시작 화면은 끊지 않고 이어서
});

// ---------- Helpers ----------
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function formatTime(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
function xpNeedFor(lvl) { return 18 + 8 * lvl; }

function passiveValue(id) {
  const p = player.passives[id];
  if (!p) return 0;
  return PASSIVES[id].values[p.lv];
}

// ---------- 통합 스탯 ----------
// 판 안 패시브(18종) + 판 밖 보너스(특성·수집품·세트·펫·장비 옵션)를 같은 키로 합산한다(docs/12 §1~3).
const PASSIVE_KEY = {
  atk_pct: "dmgPct", interval_pct: "intervalPct", projectiles: "projectiles", area_pct: "areaPct",
  cooldown_pct: "cooldownPct", hp_pct: "hpPct", def_flat: "def", move_pct: "speedPct",
  magnet_pct: "magnetPct", crit_pct: "critPct", crit_dmg_pct: "critDmgPct", regen_pct: "regenPct",
  lifesteal_pct: "lifestealPct", duration_pct: "durationPct", pierce_flat: "pierce", xp_pct: "xpPct",
  shield_pct: "shieldPct", status_pct: "statusDmgPct",
};
function stat(key) {
  let v = (runBonus && runBonus[key]) || 0;
  if (player) {
    for (const id in player.passives) {
      if (PASSIVE_KEY[PASSIVES[id].stat] === key) v += passiveValue(id);
    }
    if (key !== "dmgPct" && key !== "areaPct" && key !== "intervalPct") v += sgSupportStat(key);   // 셋은 sgMods로 스킬·무기에 직접 적용
  }
  return v;
}
let runBonus = {};      // 판 시작 시 계산한 판 밖 보너스
let runMods = {};       // 도전 규칙·모드 수정자

function totalAtkPct() { return stat("dmgPct") + stat("atkPct") * 0; } // atkPct는 판 시작 ATK에 이미 반영
function totalIntervalPct() {
  return runMods.noCooldown ? 0 : Math.min(0.5, stat("intervalPct") + stat("cooldownPct")); // 상한 50%
}
function totalProjectileBonus() { return Math.min(6, Math.max(-1, stat("projectiles") + (runMods.projectileDelta || 0))); }
function totalAreaPct() { return Math.min(0.8, stat("areaPct")); }                  // 상한 +80%
// 자석 반경 = 기본 1.5u × (패시브 + 특성·수집품 + 상점), 상한 4.0u (docs/06 §4.2)
function magnetRadiusPx() { return Math.min(4.0, 1.5 * (1 + stat("magnetPct") + upValue("UP_MAG"))) * U; }
function critChance() { return Math.min(0.6, 0.05 + stat("critPct")); }            // 기본 5%, 상한 60%
function critMultiplier() { return Math.min(3.0, 1.5 + stat("critDmgPct")); }       // 기본 150%, 상한 300%
// 받는 피해 감소율 = DEF/(DEF+300) + dr (상한 70%) — docs/12 §1
function damageReduction() {
  const def = stat("def");
  return Math.min(0.7, def / (def + 300) - stat("takenPct"));
}
// 스킬 태그별 추가 피해(특성·수집품·펫 보조)
function tagDamageMul(def) {
  const t = def.tags || "";
  let v = 0;
  if (t.includes("projectile")) v += stat("tag_projectile");
  if (t.includes("beam") || t.includes("field")) v += stat("tag_beamfield");
  if (t.includes("melee") || t.includes("orbit")) v += stat("tag_melee");
  if (t.includes("explosion")) v += stat("tag_explosion");
  if (t.includes("summon")) v += stat("tag_summon");
  if (t.includes("trap") || t.includes("stationary")) v += stat("tag_trap");
  if (/dot|poison|burn|shock|bleed/.test(t)) v += stat("statusDmgPct") * 0.5;
  return 1 + v;
}

// ---------- Spawning (CH01 waves.csv 단순화 재현) ----------
let spawnedElites = new Set();

// 난이도 배수 중 1보다 큰 것(어려움의 체력·속도·받는 피해)은 처음 90초에 걸쳐 1에서 목표값까지 오른다 — 스킬이 아직 없을 때 바로 쓰러지지 않게.
// 1보다 작은 배수(쉬움)는 처음부터 그대로. 개편판이 아니면(diff* 없음) 예전 값(enemyHpMul 등)을 쓴다.
function sgDiffMul(v) { return v > 1 ? 1 + (v - 1) * Math.min(1, runTime / 90) : v; }
function spawnEnemyAt(typeId, x, y) {
  const def = ENEMIES[typeId];
  const minutes = runTime / 60;
  // 난이도별 시간 성장(보통·어려움): 1분마다 새 적의 체력·공격력이 더 오른다
  const hpMul = runMods.diffHp ? runMods.stageHp * sgDiffMul(runMods.diffHp) : (runMods.enemyHpMul || 1);
  const hp = Math.round(enemyHp(def, curMult(), minutes) * hpMul * (1 + (runMods.hpGrowth || 0) * minutes));
  enemies.push({
    typeId, x, y, hp, hpMax: hp,
    atk: enemyAtk(def, curMult(), minutes) * (1 + (runMods.atkGrowth || 0) * minutes),
    spdU: def.spdU * (runMods.diffSpd ? sgDiffMul(runMods.diffSpd) : (runMods.enemySpdMul || 1)), radiusU: def.radiusU, elite: !!def.elite, hitMark: player.hitCount || 0,
    behavior: def.behavior, extraDr: def.extraDr || 0,
    contactT: 0, flashT: 0, facing: 1, animT: Math.random() * 10, spawnT: 0,
    // 행동별 상태
    stateT: 0, phase: "idle", dashVx: 0, dashVy: 0,
    orbitOffset: Math.random() * Math.PI * 2, summonT: 0, blinkT: 2 + Math.random() * 2,
  });
}

function spawnRingAroundCamera(typeId) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.max(viewW, viewH) / 2 + 2 * U;
  spawnEnemyAt(typeId, player.x + Math.cos(angle) * r, player.y + Math.sin(angle) * r);
  sgMaybeTrait(enemies[enemies.length - 1]);
}

// ---------- 어려움: 특별한 적(저항·능력) — 2026-09-23 사용자 요청 ----------
// 데이터(이름·설명·색·비율)는 rework-core.js SPECIAL_TRAITS. 여기서는 붙이기·동작·그리기.
const SG_ELEMENT_IDS = ["fire", "water", "wind", "earth", "lightning"];
let sgTraitSeen = {}, sgTraitLabelAt = -9;
const sgRgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16) || 0; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function sgMaybeTrait(e) {
  if (!e || !runCfg.rework || !(runMods.special > 0)) return;
  const chance = runMods.special * Math.min(1, Math.max(0, (runTime - 10) / 50));   // 10초부터 늘어 60초에 최대
  let trait = null;
  if (e.elite) trait = "resist";                                                     // 큰 적은 늘 원소 방패
  else if (Math.random() < chance) {
    const list = Object.entries(R.SPECIAL_TRAITS), total = list.reduce((n, [, d]) => n + d.weight, 0);
    let roll = Math.random() * total; trait = list[list.length - 1][0];
    for (const [id, d] of list) { if ((roll -= d.weight) <= 0) { trait = id; break; } }
  }
  if (trait) sgApplyTrait(e, trait);
}
function sgApplyTrait(e, trait) {
  const d = R.SPECIAL_TRAITS[trait]; if (!d) return e;
  e.sgTrait = trait;
  if (trait === "resist") {
    // 지금 가진 스킬의 원소를 주로(70%) 막는다 → 여러 원소를 섞어 쓰거나 기본 무기로 공격하게
    const mine = [...new Set(Object.keys(player.skills || {}).map((id) => (R.SKILLS[id] || R.COMBOS[id])?.element).filter(Boolean))];
    e.sgResist = mine.length && Math.random() < 0.7 ? mine[Math.floor(Math.random() * mine.length)] : SG_ELEMENT_IDS[Math.floor(Math.random() * SG_ELEMENT_IDS.length)];
    e.sgColor = R.ELEMENTS[e.sgResist]?.color || d.color;
    e.sgLabel = `${R.ELEMENTS[e.sgResist]?.name || ""} 방패`;
  } else { e.sgColor = d.color; e.sgLabel = d.name; }
  if (trait === "fast") { e.spdU *= 1.6; e.hp = e.hpMax = Math.max(1, Math.round(e.hpMax * 0.8)); }
  e.sgTint = sgRgba(e.sgColor, 0.26);
  return e;
}
// 처음 화면에 들어올 때 이름표(같은 이름은 한 판에 2번까지, 2초 간격)
function sgTraitTick(e, dt) {
  if (e.sgTrait === "regen") {
    e.sgHealing = e.hp < e.hpMax && runTime - (e.sgHurtAt ?? -9) > 1.5;
    if (e.sgHealing) e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.1 * dt);
  }
  if (!e.sgShown && Math.abs(e.x - player.x) < viewW * 0.45 && Math.abs(e.y - player.y) < viewH * 0.45) {
    e.sgShown = true;
    if ((sgTraitSeen[e.sgLabel] || 0) < 2 && runTime - sgTraitLabelAt > 2) {
      sgTraitSeen[e.sgLabel] = (sgTraitSeen[e.sgLabel] || 0) + 1; sgTraitLabelAt = runTime;
      floatingTexts.push({ x: e.x, y: e.y - 44, text: `${e.sgLabel}!`, life: 1.8, vy: -12, scale: 0, color: e.sgColor, big: true });
    }
  }
}
function sgSplit(e) {
  for (const side of [-1, 1]) {
    spawnEnemyAt(e.typeId, e.x + side * 0.5 * U, e.y + (Math.random() - 0.5) * 0.4 * U);
    const c = enemies[enemies.length - 1];
    c.hp = c.hpMax = Math.max(1, Math.round(e.hpMax * 0.4)); c.sgScale = 0.72; c.radiusU *= 0.75; c.spdU = e.spdU * 1.1; c.spawnT = 0.4; c.kbVx = side * 140; c.sgShown = true;
  }
}
// 발밑 고리(+날쌘이 속도선) — 적 그림보다 먼저
function sgDrawTraitRing(e, x, foot, w) {
  ctx.save();
  const rx = Math.max(12, w * 0.46), ry = rx * 0.42, pulse = 0.75 + 0.25 * Math.sin(runTime * 5 + e.animT);
  ctx.globalAlpha = 0.9 * pulse; ctx.strokeStyle = e.sgColor; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, foot + 1, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.18; ctx.fillStyle = e.sgColor; ctx.fill();
  if (e.sgTrait === "fast") {
    ctx.globalAlpha = 0.75; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) { const yy = foot - 8 - i * 9, x0 = x - e.facing * (w * 0.42 + 4 + i * 3); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - e.facing * (12 + i * 4), yy); ctx.stroke(); }
  }
  ctx.restore();
}
// 머리 옆 표시: 방패(원소 색 = 그 원소가 잘 안 통함) · 회색 갑옷 · ≫ 날쌘이 · ＋ 회복이 · ●● 쪼개지기
function sgDrawTraitBadge(e, x, y) {
  let r = 9; if (e.sgHealing) r *= 1 + 0.25 * Math.abs(Math.sin(runTime * 8));
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = e.sgColor; ctx.strokeStyle = "#1d2530"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  if (e.sgTrait === "resist" || e.sgTrait === "armor") {
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, -r * 0.55); ctx.lineTo(r * 0.8, r * 0.35); ctx.quadraticCurveTo(r * 0.45, r * 0.9, 0, r * 1.1); ctx.quadraticCurveTo(-r * 0.45, r * 0.9, -r * 0.8, r * 0.35); ctx.lineTo(-r * 0.95, -r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = e.sgTrait === "armor" ? "#5d6878" : "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.6; ctx.beginPath();
    if (e.sgTrait === "armor") { ctx.moveTo(-r * 0.5, -r * 0.15); ctx.lineTo(r * 0.5, -r * 0.15); ctx.moveTo(-r * 0.4, r * 0.3); ctx.lineTo(r * 0.4, r * 0.3); }
    else { const k = 0.5; ctx.moveTo(0, -r * k); ctx.lineTo(r * 0.95 * k, -r * 0.55 * k); ctx.lineTo(r * 0.8 * k, r * 0.35 * k); ctx.quadraticCurveTo(r * 0.45 * k, r * 0.9 * k, 0, r * 1.1 * k); ctx.quadraticCurveTo(-r * 0.45 * k, r * 0.9 * k, -r * 0.8 * k, r * 0.35 * k); ctx.lineTo(-r * 0.95 * k, -r * 0.55 * k); ctx.closePath(); }   // 안쪽 흰 방패 테두리(느낌표로 안 보이게)
    ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff"; ctx.lineWidth = 2.4; ctx.beginPath();
    if (e.sgTrait === "regen") { ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5); ctx.stroke(); }
    else if (e.sgTrait === "fast") { for (const dx of [-r * 0.3, r * 0.25]) { ctx.moveTo(dx - r * 0.2, -r * 0.45); ctx.lineTo(dx + r * 0.15, 0); ctx.lineTo(dx - r * 0.2, r * 0.45); } ctx.stroke(); }
    else { ctx.arc(-r * 0.36, 0, r * 0.27, 0, Math.PI * 2); ctx.moveTo(r * 0.36 + r * 0.27, 0); ctx.arc(r * 0.36, 0, r * 0.27, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function updateSpawning(dt) {
  // 보스 등장 중엔 일반 웨이브를 멈춘다(보스 점수 모드는 소량 유지 — 광휘·보석용)
  if (boss && !runCfg.bossScore) return;
  if (runTime < (runCfg.startLevel ? 2 : 8)) return; // "8초 전까지 적 없음"

  // 챕터의 enemy_mix를 균등 분배하고, 시간이 지날수록 밀도를 올린다.
  const t = runCfg.stages ? stageTime : runTime;
  // 개편판(5분 판)은 처음부터 촘촘하게, 90초·180초에 더 늘린다(2026-09-23 밀도 조정)
  const ramp = runCfg.rework ? (t < 90 ? 1.1 : t < 180 ? 1.6 : 2.1) : (t < 120 ? 1 : t < 360 ? 1.5 : 2.0);
  const opening = runCfg.rework ? .85+.15*Math.min(1,t/60) : 1;
  const late = 1 + ((runMods.lateDensity || 1) - 1) * Math.min(1, t / 90);   // 난이도별 적 수 배수(보통 ×1.1·어려움 ×1.2)는 90초에 걸쳐 들어온다
  const perType = (chapter.density * ramp * opening * late * (runCfg.densityMul || 1)) / chapter.mix.length;
  for (const id of chapter.mix) {
    spawnAcc[id] = (spawnAcc[id] || 0) + dt * perType;
    while (spawnAcc[id] >= 1) {
      spawnAcc[id] -= 1;
      // 쥐 떼처럼 무리로 나오는 적은 한 번에 여러 마리
      const burst = id === "EN03" ? 4 : id === "T1_BUTTBUG" ? 2 : id === "T1_FLY" ? 2 : 1;
      for (let i = 0; i < burst; i++) spawnRingAroundCamera(id);
    }
  }

  // 엘리트: 챕터 시각표대로(위험 구역·도전 R규칙은 2배), 무한 생존은 90초마다 반복
  const eliteSchedule = runCfg.endless
    ? chapter.elites.map((e, i) => ({ id: e.id, atS: 90 * (Math.floor(t / 90) + 1) - 90 + i * 30 }))
    : chapter.elites.map((e) => ({ id: e.id, atS: Math.round(e.atS * (runCfg.timeScale || 1)) }));
  for (const e of eliteSchedule) {
    const key = e.id + "@" + e.atS + "#" + (runCfg.stage || 0);
    if (!spawnedElites.has(key) && t >= e.atS) {
      spawnedElites.add(key);
      const n = runCfg.eliteDouble || runMods.eliteDouble ? 2 : 1;
      for (let i = 0; i < n; i++) spawnRingAroundCamera(e.id);
      log(`엘리트 등장: ${ENEMIES[e.id].name}`);
      addShake(4, 0.3);
    }
  }

  // 봉화 점화(docs/06 §10: 완전 13:00 / 표준 8:00 / 속공 3:30) — 주변 안전 구역
  if (runCfg.beaconAtS && !beacon && t >= runCfg.beaconAtS) {
    beacon = { x: player.x + 3 * U, y: player.y, r: 3 * U, t: 0 };
    healPlayer(player.hpMax * (runBonus.beaconHealPct || 0));
    log(chapter?.theme ? "정화 장치 등장! 곁에 있으면 체력이 회복돼요" : "봉화 점화! 봉화 곁에서 체력이 회복된다");
    addShake(3, 0.3); playSfx("levelupOpen", 0.5);
  }

  // 보스 등장: 모드별 시각(무한 생존은 7:30마다 순환 보스)
  if (!boss && !runCfg.noBoss) {
    const at = runCfg.bossAtS ?? chapter.bossAtS;
    if (t >= at) spawnBoss();
  }
  if (!boss && runCfg.endless && runTime >= nextEndlessBossAt) {
    nextEndlessBossAt += 450;
    const ids = Object.keys(BOSSES);
    bossDef = BOSSES[ids[Math.floor(runTime / 450) % ids.length]];
    spawnBoss();
  }
}
let nextEndlessBossAt = 450;
let fort = null;            // 방어 거점 이벤트의 봉화 { x, y, hp, hpMax, r }
let pendingEvent = null;    // 이벤트 전투 사양(ecoui → startEventBattle)
let beacon = null;          // 봉화 { x, y, r }
let enrageStage = 0;        // 제한 시간 초과 후 광폭 단계(최대 4)
let stageTime = 0;          // 원정: 현재 단계 경과 시간

function spawnBoss() {
  const angle = Math.random() * Math.PI * 2;
  // 보스 점수형(3분 피해 누적)은 이동에 시간을 버리지 않도록 6u 앞에 등장
  const r = runCfg.bossScore ? 6 * U : Math.max(viewW, viewH) / 2 + 3 * U;
  const hp = Math.round(bossHp(bossDef, curMult()) * (runMods.enemyHpMul || 1));
  boss = {
    x: player.x + Math.cos(angle) * r, y: player.y + Math.sin(angle) * r,
    hp, hpMax: hp, atkBase: bossAtk(bossDef, curMult()),
    spdU: bossDef.spdU, radiusU: bossDef.radiusU,
    phase: 1, restT: 1.5, activePattern: null, telegraphT: 0, flashT: 0, stunT: 0,
  };
  if (chapter?.theme === 1) themeFx.emit("arrival", boss.x, boss.y, { life: 1.4 });
  starTrack.bossNoHit = true;
  log(`보스 등장: ${bossDef.name} (${bossDef.id})`);
  addShake(8, 0.6);
  playSfx("bossTelegraph", 0.7);
}

// ---------- Player movement ----------
function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  // 터치 조이스틱이 활성이면 키보드 대신 사용(데드존 미만은 정지)
  let speedScale = 1;
  if (touchJoy.active && touchJoy.mag > JOY_DEADZONE) {
    dx = touchJoy.dx; dy = touchJoy.dy;
    speedScale = Math.min(1, touchJoy.mag);
  }

  // 악취 안개(보스 방귀 구름) 안: 이동 40% 느려지고 0.5초마다 최대 체력 1.5% 피해
  let stinkSlow = 1;
  for (const f of fields) if (f.hostile && dist(player.x, player.y, f.x, f.y) < f.radius) stinkSlow = 0.6;
  if (stinkSlow < 1) {
    player.stinkT = (player.stinkT || 0) + dt;
    if (player.stinkT >= 0.5) { player.stinkT -= 0.5; applyBossHit(player.hpMax * 0.015); }
  } else player.stinkT = 0;

  player.moving = dx !== 0 || dy !== 0;
  if (player.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    // 이동 속도: 패시브·특성·수집품 합산 상한 +60% (docs/06 §1), 고유 능력 버프 +30%
    const spdMul = (1 + Math.min(0.6, stat("speedPct")) + (player.buffKind === "speed" && player.buffT > 0 ? 0.3 : 0)) * stinkSlow;
    player.x += dx * player.speedU * spdMul * U * dt * speedScale;
    player.y += dy * player.speedU * spdMul * U * dt * speedScale;
    if (dx > 0.01) player.facing = 1; else if (dx < -0.01) player.facing = -1;
  }
  if (chapter?.theme) resolveObstacles(player, 0.35 * U, null);   // 소품 장애물
  player.animT += dt * (player.moving ? 8 : 2.4);
  if (player.invulnT > 0) player.invulnT -= dt;
  if (player.hitFlashT > 0) player.hitFlashT -= dt;
  if (player.buffT > 0) player.buffT -= dt;
  if (player.lumCd > 0) player.lumCd -= dt;
  if (player.attackT > 0) player.attackT -= dt;
  if (player.jumpT > 0) player.jumpT -= dt;

  // 초당 회복 창(흡혈·재생 합산 상한 5%/s — docs/06 §7.6)
  player.healWindowT -= dt;
  if (player.healWindowT <= 0) { player.healWindowT += 1; player.healWindow = 0; }
  const regen = Math.min(0.05, stat("regenPct"));
  if (regen > 0) healPlayer(player.hpMax * regen * dt);

  // 봉화 안: 초당 최대 체력 2% 회복(+특성·수집품 봉화 회복)
  if (beacon && dist(player.x, player.y, beacon.x, beacon.y) < beacon.r) {
    healPlayer(player.hpMax * (0.02 + (runBonus.beaconRegen || 0)) * dt);
  }
  // 별 3 조건: 레벨 목표 달성 시각 기록
  const lvGoal = runCfg.survival ? 20 : chapter?.id === "CH01" ? 30 : 40;
  if (!starTrack.lvGoalAt && player.lvl >= lvGoal) starTrack.lvGoalAt = runTime;

  // 보호막: 최대 체력 × shield%(상한 40%), 6초 미피격 후 초당 10% 재생 (docs/12 §6)
  const shieldMax = player.hpMax * Math.min(0.4, stat("shieldPct"));
  player.shieldIdle += dt;
  if (shieldMax > 0 && player.shieldIdle >= 6) player.shield = Math.min(shieldMax, player.shield + shieldMax * 0.1 * dt);
}

function healPlayer(amount) {
  if (runMods.noHeal || amount <= 0) return;
  const cap = player.hpMax * 0.05 - player.healWindow;          // 초당 상한
  const v = Math.min(amount * (1 + stat("healPct")), Math.max(0, cap));
  if (v <= 0) return;
  player.healWindow += v;
  player.hp = Math.min(player.hpMax, player.hp + v);
}

// ---------- 광휘 게이지 · 고유 능력 (docs/06 §3: 광휘 100 시 자동 발동) ----------
function addLuminance(v) {
  return; // Shared automatic tools replace character burst meters.

  if (!player) return;
  player.lum = Math.min(100, player.lum + v * (1 + stat("lumPct")));
  if (player.lum >= 100 && player.lumCd <= 0) triggerAbility();
}
function triggerAbility() {
  const chr = characterById(save.character);
  runStats.abilityUses = (runStats.abilityUses || 0) + 1;
  player.lum = 0;
  player.lumCd = 12;                 // 최소 재발동 12s (docs/12 §10)
  const fx = chr.abilityEffect || "";
  const coef = parseFloat(fx.match(/계수\s*(\d+(?:\.\d+)?)/)?.[1]) || 3.0;
  const radius = (parseFloat(fx.match(/반경\s*(\d+(?:\.\d+)?)u/)?.[1]) || 4) * U;
  // 공통: 주변 폭발(계수·반경은 캐릭터 설명문에서 읽음)
  explodeAt(player.x, player.y, radius, player.atk * coef * (1 + stat("abilityDmgPct")), 1.0, "#ffe9a8");
  if (chapter?.theme === 1) themeFx.emit("ability", player.x, player.y, { radius: Math.min(radius, 150), life: .85 });
  // 캐릭터별 추가 효과(설명문 키워드)
  if (/간격/.test(fx)) { player.buffKind = "haste"; player.buffT = 5; }
  else if (/이동 속도/.test(fx)) { player.buffKind = "speed"; player.buffT = 5; }
  if (/무적/.test(fx)) player.invulnT = Math.max(player.invulnT, 3);
  if (/회복|부활/.test(fx)) { player.healWindow = 0; healPlayer(player.hpMax * 0.3); }
  if (/보호막/.test(fx)) player.shield = Math.max(player.shield, player.hpMax * 0.2);
  floatingTexts.push({ x: player.x, y: player.y - 34, text: chr.abilityName, life: 1.2, vy: -30, scale: 0, color: "#ffe9a8", big: true });
  addShake(7, 0.35); addHitStop(0.06);
  playSfx("levelupOpen", 0.6);
}

// ---------- Combat: player attacks ----------
function findNearestEnemy(rangePx) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < bestD && d <= rangePx) { bestD = d; best = e; }
  }
  if (boss) {
    const d = dist(player.x, player.y, boss.x, boss.y);
    if (d < bestD && d <= rangePx) { best = boss; bestD = d; }
  }
  return best;
}

function enemiesInRadius(x, y, r, exclude) {
  const out = [];
  for (const e of enemies) {
    if (e.hp <= 0 || e === exclude) continue;
    if (dist(e.x, e.y, x, y) <= r + e.radiusU * U) out.push(e);
  }
  if (boss && boss !== exclude && boss.hp > 0 && dist(boss.x, boss.y, x, y) <= r + boss.radiusU * U) out.push(boss);
  return out;
}
function randomTargets(n, rangePx) {
  const pool = enemiesInRadius(player.x, player.y, rangePx);
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

// 진화한 스킬은 evolutions.csv의 계수·간격을 쓰고, 투사체/범위에 진화 보너스를 얹는다.
function effectiveSkill(skillId) {
  const base = SKILLS[skillId];
  const st = player.skills[skillId];
  if (!st?.evolved) return base;
  const e = EVOLUTIONS[st.evolved];
  return { ...base, dmgCoef: e.dmgCoef, interval: e.interval, color: e.color, evoName: e.name, isEvolved: true };
}
// 공격 슬롯 부품의 동작 변경(영웅↑, 전설은 진화 후, 공명은 진화 후 — docs/09 §3)을 얹는다
function effectiveMods(skillId) {
  const st=player.skills[skillId],m=SKILLS[skillId].apply(st.lv);
  if(st.evolved){m.dmgMul*=1.15;m.areaMul*=1.2;m.blastMul*=1.2;m.lenMul*=1.2;if(skillId==='S01')m.projectiles=2;if(skillId==='S05')m.blades++;}
  return m;

}
function rawEffectiveMods(skillId) {
  const base = SKILLS[skillId];
  const st = player.skills[skillId];
  if (!st.evolved) return base.apply(st.lv);
  // 진화체: 원본 Lv5 기준에 진화 레벨(1~3) 보너스를 더한다
  const m = base.apply(base.maxLevel);
  const bonus = st.lv - 1;
  return {
    ...m,
    projectiles: m.projectiles + 1 + bonus,
    dmgMul: m.dmgMul * (1.15 + 0.15 * bonus),
    areaMul: (m.areaMul || 1) * (1.3 + 0.1 * bonus),
    blastMul: (m.blastMul || 1) * (1.3 + 0.1 * bonus),
    lenMul: (m.lenMul || 1) * (1.3 + 0.1 * bonus),
    widthMul: (m.widthMul || 1) * (1.3 + 0.1 * bonus),
    durMul: (m.durMul || 1) * 1.3,
    blades: m.blades + 1 + bonus,
    chains: m.chains + 2 + bonus,
    bolts: Math.max(1, m.bolts + (bonus > 1 ? 1 : 0)),
  };
}

function fireSkill(skillId) {
  const def = effectiveSkill(skillId);
  const st = player.skills[skillId];
  const mods = effectiveMods(skillId);
  const dmgMul = mods.dmgMul * (1 + totalAtkPct()) * tagDamageMul(def);
  const areaMul = 1 + totalAreaPct();
  const rangePx = (def.rangeU || 8) * U;

  switch (def.kind) {
    case "projectile":
    case "spread": {
      const target = findNearestEnemy(rangePx);
      if (!target) return;
      const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
      const count = mods.projectiles + totalProjectileBonus();
      const spreadRad = def.kind === "spread" ? (45 * Math.PI) / 180 : (10 * Math.PI) / 180;
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const angle = baseAngle + t * spreadRad;
        projectiles.push({
          skillId, x: player.x, y: player.y,
          vx: Math.cos(angle) * def.speedU * U, vy: Math.sin(angle) * def.speedU * U,
          angle, dmgCoef: def.dmgCoef, dmgMul, color: def.color, life: 2.0, trail: [],
          knockback: (def.knockback || 0) * (mods.knockMul || 1), shape: def.kind === "spread" ? "pellet" : "arrow",
          homing: def.kind === "projectile", target: def.kind === "projectile" ? target : null,
        });
      }
      player.aimAngle = baseAngle;
      player.muzzleT = 0.12;
      playSfx("attackFire", def.kind === "spread" ? 0.4 : 0.26);
      if (def.kind === "spread") addShake(2.5, 0.1);
      break;
    }
    case "pierce": {
      const target = findNearestEnemy(rangePx);
      const baseAngle = target ? Math.atan2(target.y - player.y, target.x - player.x)
        : (player.facing > 0 ? 0 : Math.PI);
      const count = mods.projectiles + totalProjectileBonus();
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : (i / (count - 1)) - 0.5;
        const angle = baseAngle + t * ((15 * Math.PI) / 180) * (count - 1);
        projectiles.push({
          skillId, x: player.x, y: player.y,
          vx: Math.cos(angle) * def.speedU * U, vy: Math.sin(angle) * def.speedU * U,
          angle, dmgCoef: def.dmgCoef, dmgMul, color: def.color, life: 1.4, trail: [],
          knockback: def.knockback || 0, shape: "spear", pierce: true, hitSet: new Set(),
        });
      }
      player.aimAngle = baseAngle;
      player.muzzleT = 0.12;
      playSfx("attackFire", 0.3);
      break;
    }
    case "chain": {
      for (let b = 0; b < (mods.bolts || 1); b++) {
        let current = findNearestEnemy(rangePx);
        if (!current) return;
        const hitAlready = new Set();
        const points = [{ x: player.x, y: player.y }];
        for (let c = 0; c < mods.chains && current; c++) {
          hitAlready.add(current);
          points.push({ x: current.x, y: current.y });
          dealDamageToTarget(current, player.atk * def.dmgCoef * dmgMul, current === boss, { x: current.x - player.x, y: current.y - player.y }, 0);
          const next = enemiesInRadius(current.x, current.y, def.chainRangeU * U)
            .filter((e) => !hitAlready.has(e))
            .sort((a, z) => dist(a.x, a.y, current.x, current.y) - dist(z.x, z.y, current.x, current.y))[0];
          current = next || null;
        }
        arcs.push({ points, life: 0.18, maxLife: 0.18, color: def.color });
      }
      playSfx("attackFire", 0.3);
      break;
    }
    case "lob": {
      const targets = randomTargets(mods.projectiles + totalProjectileBonus(), rangePx);
      if (!targets.length) return;
      for (const target of targets) {
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        const travel = dist(player.x, player.y, target.x, target.y);
        projectiles.push({
          skillId, x: player.x, y: player.y,
          vx: Math.cos(angle) * def.speedU * U, vy: Math.sin(angle) * def.speedU * U,
          angle, dmgCoef: def.dmgCoef, dmgMul, color: def.color, trail: [],
          life: Math.min(2.0, travel / (def.speedU * U) + 0.05), shape: "jar", spin: 0,
          explodeOnExpire: true, blastPx: def.blastU * U * (mods.blastMul || 1) * areaMul,
          knockback: def.knockback || 0,
        });
      }
      player.muzzleT = 0.1;
      playSfx("attackFire", 0.3);
      break;
    }
    case "beam": {
      const target = findNearestEnemy(rangePx);
      const angle = target ? Math.atan2(target.y - player.y, target.x - player.x)
        : (player.facing > 0 ? 0 : Math.PI);
      beams.push({
        angle, lenPx: def.rangeU * U * (mods.lenMul || 1) * areaMul,
        widthPx: def.widthU * U * (mods.widthMul || 1) * areaMul,
        life: def.durationS * (mods.durMul || 1), maxLife: def.durationS * (mods.durMul || 1),
        tickT: 0, tickS: def.tickS, dmgCoef: def.dmgCoef, dmgMul, color: def.color,
      });
      player.aimAngle = angle;
      playSfx("attackFire", 0.35);
      break;
    }
    case "strike": {
      const targets = randomTargets(mods.projectiles + totalProjectileBonus(), rangePx);
      if (!targets.length) return;
      for (const target of targets) {
        strikes.push({
          x: target.x, y: target.y, delay: def.delayS, maxDelay: def.delayS,
          radiusPx: def.blastU * U * (mods.blastMul || 1) * areaMul,
          dmgCoef: def.dmgCoef, dmgMul, color: def.color, knockback: def.knockback || 0,
        });
      }
      break;
    }
    case "field": {
      // 설치형 장판 — 일정 시간 동안 범위 안 적에게 주기적 피해(S06/S13/S20)
      const target = findNearestEnemy(rangePx) || player;
      const n = Math.min(3, 1 + Math.floor((mods.projectiles - def.projectiles) / 2));
      for (let i = 0; i < n; i++) {
        const jitter = i === 0 ? 0 : (Math.random() - 0.5) * 2 * U;
        fields.push({
          x: target.x + jitter, y: target.y + jitter,
          radius: (def.rangeU * 0.35) * U * (mods.areaMul || 1) * areaMul,
          life: Math.max(2, (def.durationS || 3) * (mods.durMul || 1)),
          maxLife: Math.max(2, (def.durationS || 3) * (mods.durMul || 1)),
          tickT: 0, tickS: 0.5, dmgCoef: def.dmgCoef, dmgMul, color: def.color,
          pull: (def.tags || "").includes("pull"),
        });
      }
      playSfx("attackFire", 0.25);
      break;
    }
    case "summon": {
      // 소환체 — 플레이어를 따라다니며 자동 사격(S07/S08/S19)
      const want = Math.min(6, mods.projectiles);
      const mine = minions.filter((m) => m.skillId === skillId);
      for (let i = mine.length; i < want; i++) {
        minions.push({
          skillId, x: player.x, y: player.y, cd: 0, idx: i,
          stationary: (def.tags || "").includes("stationary"),
          melee: (def.tags || "").includes("melee"),
          dmgCoef: def.dmgCoef, dmgMul, color: def.color, rangeU: def.rangeU,
          life: (def.tags || "").includes("stationary") ? (def.durationS || 8) * (mods.durMul || 1) : Infinity,
        });
      }
      break;
    }
    case "melee": {
      // 근접 휘두르기 — 전방 부채꼴 즉시 판정(S14/S17)
      const target = findNearestEnemy(rangePx);
      const ang = target ? Math.atan2(target.y - player.y, target.x - player.x)
        : (player.facing > 0 ? 0 : Math.PI);
      const reach = Math.max(2, def.rangeU) * U * areaMul * (mods.areaMul || 1);
      const half = (def.tags || "").includes("cone") ? Math.PI / 3 : Math.PI / 4;
      let hit = 0;
      for (const e of enemiesInRadius(player.x, player.y, reach)) {
        const a = Math.atan2(e.y - player.y, e.x - player.x);
        if (Math.abs(normalizeAngle(a - ang)) > half) continue;
        dealDamageToTarget(e, player.atk * def.dmgCoef * dmgMul, e === boss,
          { x: e.x - player.x, y: e.y - player.y }, def.knockback);
        hit++;
      }
      swings.push({ angle: ang, reach, half, life: 0.18, maxLife: 0.18, color: def.color });
      player.aimAngle = ang;
      if (hit) addShake(2, 0.08);
      playSfx("attackFire", 0.3);
      break;
    }
    case "boomerang": {
      const target = findNearestEnemy(rangePx);
      const baseAngle = target ? Math.atan2(target.y - player.y, target.x - player.x)
        : (player.facing > 0 ? 0 : Math.PI);
      for (let i = 0; i < mods.projectiles + totalProjectileBonus(); i++) {
        const ang = baseAngle + (i - (mods.projectiles - 1) / 2) * 0.35;
        projectiles.push({
          skillId, x: player.x, y: player.y,
          vx: Math.cos(ang) * def.speedU * U, vy: Math.sin(ang) * def.speedU * U,
          angle: ang, dmgCoef: def.dmgCoef, dmgMul, color: def.color, life: 2.2, trail: [],
          knockback: def.knockback, shape: "boomerang", spin: 0,
          pierce: true, hitSet: new Set(), boomerang: true, outT: 0.5,
        });
      }
      playSfx("attackFire", 0.28);
      break;
    }
    case "bounce": {
      const target = findNearestEnemy(rangePx);
      const baseAngle = target ? Math.atan2(target.y - player.y, target.x - player.x)
        : Math.random() * Math.PI * 2;
      for (let i = 0; i < mods.projectiles + totalProjectileBonus(); i++) {
        const ang = baseAngle + (Math.random() - 0.5) * 0.5;
        projectiles.push({
          skillId, x: player.x, y: player.y,
          vx: Math.cos(ang) * def.speedU * U, vy: Math.sin(ang) * def.speedU * U,
          angle: ang, dmgCoef: def.dmgCoef, dmgMul, color: def.color, life: 4.0, trail: [],
          knockback: def.knockback, shape: "orb", bounces: 3 + Math.floor(mods.projectiles / 2),
          hitSet: new Set(), pierce: true,
        });
      }
      playSfx("attackFire", 0.28);
      break;
    }
    case "trap": {
      // 지뢰 — 플레이어 뒤쪽에 설치, 적이 밟으면 폭발(S18)
      const back = (player.aimAngle || 0) + Math.PI;
      traps.push({
        x: player.x + Math.cos(back) * 20, y: player.y + Math.sin(back) * 20,
        radius: (def.blastU || 1.4) * U * (mods.blastMul || 1) * areaMul,
        dmgCoef: def.dmgCoef, dmgMul, color: def.color, life: 60, armT: 0.3,
      });
      // 최대 개수 제한
      const cap = 6 + mods.projectiles;
      while (traps.length > cap) traps.shift();
      break;
    }
    case "clone": {
      // 분신 — 보유 공격 스킬을 일정 비율로 복제 발사(S24)
      const ratio = 0.4 + 0.1 * (mods.projectiles - def.projectiles);
      for (const otherId in player.skills) {
        if (otherId === skillId) continue;
        const odef = SKILLS[otherId];
        if (!odef || odef.kind === "clone" || odef.kind === "summon" || odef.kind === "orbit") continue;
        if (Math.random() < ratio) { fireSkill(otherId); break; }
      }
      break;
    }
    case "orbit":
      break; // 상시 유지형 — updateOrbit에서 처리
  }
}

// 회전 낫: 발사형이 아니라 플레이어 주위를 도는 상시 판정
function updateOrbit(dt) {
  const st = player.skills.S05;
  if (!st) return;
  const def = effectiveSkill("S05");
  const mods = effectiveMods("S05");
  const radius = def.radiusU * U * mods.areaMul * (1 + totalAreaPct());
  player.orbitAngle += dt * 2.2;
  st.hitTimers = st.hitTimers || new Map();

  for (const [e, t] of st.hitTimers) {
    const nt = t - dt;
    if (nt <= 0 || !enemies.includes(e) && e !== boss) st.hitTimers.delete(e);
    else st.hitTimers.set(e, nt);
  }
  for (let i = 0; i < mods.blades; i++) {
    const a = player.orbitAngle + (i / mods.blades) * Math.PI * 2;
    const bx = player.x + Math.cos(a) * radius, by = player.y + Math.sin(a) * radius;
    for (const e of enemiesInRadius(bx, by, 0.45 * U)) {
      if (st.hitTimers.has(e)) continue;
      st.hitTimers.set(e, def.interval); // 같은 적 재타격 간격(docs/12 §4)
      dealDamageToTarget(e, player.atk * def.dmgCoef * mods.dmgMul * (1 + totalAtkPct()) * tagDamageMul(def), e === boss,
        { x: e.x - player.x, y: e.y - player.y }, def.knockback);
    }
  }
}

function updateSkills(dt) { sgWeapon.update(dt); sgElements.update(dt); sgThreatTick(dt); }
const ATTACK_ANIM_S = 0.3, JUMP_ANIM_S = 0.7;

// dir: 넉백 방향(정규화 전 벡터), knock: 넉백 세기(u)
function dealDamageToTarget(target, dmg, isBoss, dir, knock, resisted = false) {   // resisted: 방패·갑옷에 막힌 피해(회색 숫자)
  const dr = (isBoss ? BOSS_DR : target.elite ? RANGE_ELITE_DR : 0) + (target.extraDr || 0);
  const isCrit = Math.random() < critChance();
  // 보스·엘리트 추가 피해(특성·수집품)
  const typeMul = 1 + (isBoss ? stat("bossDmgPct") : 0) + (target.elite ? stat("eliteDmgPct") : 0)
    + (stat("darkDmgPct") && isInDark(player.x, player.y) ? stat("darkDmgPct") : 0);
  const rolled = dmg * typeMul * (isCrit ? critMultiplier() : 1);
  const final = Math.max(1, Math.floor(rolled * (1 - dr)));
  // 보스 점수 모드: 보스는 무적(체력이 줄지 않고 피해량만 기록 — docs/10 §1.2)
  if (isBoss && runCfg.bossScore) runStats.bossDamage += final;
  else target.hp -= final;
  if (isBoss && !runCfg.bossScore) runStats.bossDamage += final;
  target.flashT = isCrit ? 0.14 : 0.08;
  damageDealt += final;
  // 흡혈(초당 상한은 healPlayer에서)
  const ls = stat("lifestealPct");
  if (ls > 0) healPlayer(final * ls);

  floatingTexts.push({
    x: target.x + (Math.random() - 0.5) * 14, y: target.y - 20,
    text: isCrit ? `${final}!` : String(final),
    life: isCrit ? 0.85 : 0.6, vy: isCrit ? -55 : -40, scale: 0,
    color: resisted ? "#9aa6b4" : isCrit ? "#ff9a3a" : "#fff2c0", big: isCrit && !resisted,
  });
  hitFx.push({ x: target.x, y: target.y, life: 0.22, maxLife: 0.22, color: isCrit ? "#ffb44a" : "#ffe9a8", dir });

  // 넉백: 보스는 mass ∞로 밀리지 않음(docs/06 §7.3)
  if (knock && dir && !isBoss) {
    const len = Math.hypot(dir.x, dir.y) || 1;
    const mass = target.elite ? 5 : 1;
    const push = (knock * U * 8) / mass;
    target.kbVx = (target.kbVx || 0) + (dir.x / len) * push;
    target.kbVy = (target.kbVy || 0) + (dir.y / len) * push;
  }
  // 히트스톱은 보스·엘리트 치명타에만(잡몹까지 멈추면 화면이 끊겨 보인다)
  if (isCrit) {
    addShake(isBoss ? 4 : 2.5, 0.12);
    if (isBoss || target.elite) addHitStop(0.045);
  }
  playSfx(isBoss || target.elite ? "hitBoss" : (Math.random() < 0.5 ? "hitLight" : "hitLight2"), isBoss || target.elite ? 0.5 : 0.2);
  return final;
}

// 폭발: 범위 내 전부 타격 + 충격파 연출
function explodeAt(x, y, radiusPx, dmg, knock, color) {
  blasts.push({ x, y, radius: radiusPx, life: 0.35, maxLife: 0.35, color: color || "#ff9040" });
  for (const e of enemiesInRadius(x, y, radiusPx)) {
    dealDamageToTarget(e, dmg, e === boss, { x: e.x - x, y: e.y - y }, knock);
  }
  addShake(4, 0.16);
  addHitStop(0.03);
  playSfx("hitBoss", 0.35);
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    if (p.target && p.homing && p.target.hp > 0) {
      const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      const speed = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      p.angle = angle;
    }
    // 부메랑: 일정 시간 뒤 플레이어에게 되돌아온다(돌아올 때 재타격 가능)
    if (p.boomerang) {
      p.outT -= dt;
      if (p.outT <= 0) {
        const a = Math.atan2(player.y - p.y, player.x - p.x);
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        p.angle = a;
        if (dist(p.x, p.y, player.x, player.y) < 20) { projectiles.splice(i, 1); continue; }
        if (p.hitSet.size) p.hitSet.clear();  // 복귀 시 한 번 더 맞출 수 있게
      }
      p.spin = (p.spin || 0) + dt * 18;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.shape === "jar") p.spin += dt * 12;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();

    if (p.life <= 0) {
      if (p.explodeOnExpire) {
        explodeAt(p.x, p.y, p.blastPx, player.atk * p.dmgCoef * p.dmgMul, p.knockback, p.color);
      }
      projectiles.splice(i, 1);
      continue;
    }

    const targets = enemiesInRadius(p.x, p.y, 6);
    let consumed = false;
    for (const e of targets) {
      if (p.pierce) {
        if (p.hitSet.has(e)) continue;   // 같은 투사체는 적 1마리에 1회(docs/12 §4)
        p.hitSet.add(e);
      }
      dealDamageToTarget(e, player.atk * p.dmgCoef * p.dmgMul, e === boss,
        { x: p.vx, y: p.vy }, p.knockback);
      // 튕기는 구슬: 남은 튕김이 있으면 방향을 바꿔 계속 날아간다
      if (p.bounces > 0) {
        p.bounces -= 1;
        const a = Math.random() * Math.PI * 2;
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.angle = a;
        p.hitSet.clear();
        consumed = false;
        break;
      }
      if (p.explodeOnExpire) {
        explodeAt(p.x, p.y, p.blastPx, player.atk * p.dmgCoef * p.dmgMul, p.knockback, p.color);
        consumed = true;
        break;
      }
      if (!p.pierce) { consumed = true; break; }
    }
    if (consumed) projectiles.splice(i, 1);
  }
}

function updateBeams(dt) {
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i];
    b.life -= dt;
    b.originX = player.x; b.originY = player.y; // 광선은 플레이어를 따라감
    b.tickT -= dt;
    if (b.tickT <= 0) {
      b.tickT += b.tickS;
      // 광선 축을 따라 샘플링해 폭 안의 적을 전부 타격(관통)
      const steps = Math.ceil(b.lenPx / (0.5 * U));
      const hitThisTick = new Set();
      for (let s = 1; s <= steps; s++) {
        const px = player.x + Math.cos(b.angle) * (b.lenPx * s / steps);
        const py = player.y + Math.sin(b.angle) * (b.lenPx * s / steps);
        for (const e of enemiesInRadius(px, py, b.widthPx / 2)) {
          if (hitThisTick.has(e)) continue;
          hitThisTick.add(e);
          dealDamageToTarget(e, player.atk * b.dmgCoef * b.dmgMul, e === boss, null, 0);
        }
      }
    }
    if (b.life <= 0) beams.splice(i, 1);
  }
}

function updateStrikes(dt) {
  for (let i = strikes.length - 1; i >= 0; i--) {
    const s = strikes[i];
    s.delay -= dt;
    if (s.delay <= 0) {
      explodeAt(s.x, s.y, s.radiusPx, player.atk * s.dmgCoef * s.dmgMul, s.knockback, s.color);
      s.struck = true;
      strikes.splice(i, 1);
    }
  }
}

// 장판: 주기적으로 범위 안 적을 타격. pull 태그는 적을 중심으로 끌어당긴다.
function updateFields(dt) {
  for (let i = fields.length - 1; i >= 0; i--) {
    const f = fields[i];
    f.life -= dt;
    f.tickT -= dt;
    if (f.hostile) { if (f.life <= 0) fields.splice(i, 1); continue; }   // 적(보스)의 장판: 플레이어 쪽 판정은 updatePlayer
    if (f.pull) {
      for (const e of enemiesInRadius(f.x, f.y, f.radius * 1.6)) {
        if (e === boss) continue;
        const a = Math.atan2(f.y - e.y, f.x - e.x);
        e.x += Math.cos(a) * 2 * U * dt; e.y += Math.sin(a) * 2 * U * dt;
      }
    }
    if (f.tickT <= 0) {
      f.tickT += f.tickS;
      for (const e of enemiesInRadius(f.x, f.y, f.radius)) {
        const fd = player.atk * f.dmgCoef * f.dmgMul;
        dealDamageToTarget(e, fd, e === boss, null, 0);
        runStats.statusDmg += fd;             // 장판(독·화상·냉기) 지속 피해 = 상태 이상 피해로 집계
      }
    }
    if (f.life <= 0) fields.splice(i, 1);
  }
}

// 소환체: 고정형은 제자리, 아니면 플레이어를 따라다니며 사거리 안 적을 공격
function updateMinions(dt) {
  for (let i = minions.length - 1; i >= 0; i--) {
    const m = minions[i];
    if(m.guardianPet){sgPetTick(m,dt);continue;}
    m.life -= dt;
    if (m.life <= 0) { minions.splice(i, 1); continue; }
    if (!m.stationary) {
      const a = runTime * 1.1 + (m.idx / 3) * Math.PI * 2;
      const tx = player.x + Math.cos(a) * 1.6 * U, ty = player.y + Math.sin(a) * 1.6 * U;
      m.x += (tx - m.x) * Math.min(1, dt * 6);
      m.y += (ty - m.y) * Math.min(1, dt * 6);
    }
    // 펫: 접촉 피해를 받고, 쓰러지면 15s 후 자동 부활(쓰러질 때마다 +5s, 최대 40s)
    if (m.pet) {
      if (m.downT > 0) { m.downT -= dt; if (m.downT <= 0) { m.hp = m.hpMax; log("펫이 다시 일어났다"); } continue; }
      for (const e of enemies) {
        if (e.hp > 0 && dist(e.x, e.y, m.x, m.y) < (e.radiusU + 0.6) * U) m.hp -= (e.atk || 10) * 0.5 * dt;
      }
      if (m.hp <= 0) {
        m.downT = Math.min(40, 15 + 5 * m.downs); m.downs++;
        log(`펫이 쓰러졌다 — ${Math.round(m.downT)}초 후 부활`);
        hitFx.push({ x: m.x, y: m.y, life: 0.5, maxLife: 0.5, color: "#ff8080" });
        continue;
      }
    }
    m.cd -= dt;
    if (m.cd > 0) continue;
    // 펫 보조형: 치유사는 플레이어 회복, 수집가는 주변 보석을 끌어온다
    if (m.petStyle === "heal") {
      m.cd = m.interval || 3;
      healPlayer(player.hpMax * 0.04);
      hitFx.push({ x: player.x, y: player.y, life: 0.3, maxLife: 0.3, color: "#8fff9a" });
      continue;
    }
    if (m.petStyle === "collect") {
      m.cd = m.interval || 2;
      for (const g of gems) if (dist(g.x, g.y, player.x, player.y) < 6 * U) { g.x += (player.x - g.x) * 0.5; g.y += (player.y - g.y) * 0.5; }
      continue;
    }
    const range = m.rangeU * U;
    let best = null, bestD = Infinity;
    for (const e of enemiesInRadius(m.x, m.y, range)) {
      const d = dist(e.x, e.y, m.x, m.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) continue;
    m.cd = m.interval || 0.8;
    if (m.melee) {
      dealDamageToTarget(best, player.atk * m.dmgCoef * m.dmgMul, best === boss,
        { x: best.x - m.x, y: best.y - m.y }, 0.2);
    } else {
      const ang = Math.atan2(best.y - m.y, best.x - m.x);
      projectiles.push({
        x: m.x, y: m.y, vx: Math.cos(ang) * 12 * U, vy: Math.sin(ang) * 12 * U,
        angle: ang, dmgCoef: m.dmgCoef, dmgMul: m.dmgMul, color: m.color,
        life: 1.2, trail: [], knockback: 0.1, shape: "pellet",
      });
    }
  }
}

// 지뢰: 설치 후 적이 밟으면 폭발
function updateTraps(dt) {
  for (let i = traps.length - 1; i >= 0; i--) {
    const t = traps[i];
    t.life -= dt; t.armT -= dt;
    if (t.life <= 0) { traps.splice(i, 1); continue; }
    if (t.armT > 0) continue;
    const near = enemiesInRadius(t.x, t.y, 0.6 * U);
    if (near.length) {
      explodeAt(t.x, t.y, t.radius, player.atk * t.dmgCoef * t.dmgMul, 0.6, t.color);
      traps.splice(i, 1);
    }
  }
}

function updateFxTimers(dt) {
  if (chapter?.theme === 1) themeFx.update(dt);
  for (let i = swings.length - 1; i >= 0; i--) { swings[i].life -= dt; if (swings[i].life <= 0) swings.splice(i, 1); }
  for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].life -= dt; if (blasts[i].life <= 0) blasts.splice(i, 1); }
  for (let i = arcs.length - 1; i >= 0; i--) { arcs[i].life -= dt; if (arcs[i].life <= 0) arcs.splice(i, 1); }
  if (shake.t > 0) { shake.t -= dt; if (shake.t <= 0) shake.mag = 0; }
  if (player && player.muzzleT > 0) player.muzzleT -= dt;
}

// ---------- 적 행동 (data/enemies.csv의 behavior 열) ----------
// chase 추적 / surround 포위 / dash 예고 후 돌진 / kite 거리 유지 /
// blink 순간이동 / explode 자폭 / summon 소환
function moveEnemy(e, dt, contactRange) {
  const dToPlayer = dist(e.x, e.y, player.x, player.y);
  const faceTo = (ang) => { if (Math.cos(ang) > 0.01) e.facing = 1; else if (Math.cos(ang) < -0.01) e.facing = -1; };
  const stepToward = (tx, ty, speedU, stopAt) => {
    const d = dist(e.x, e.y, tx, ty);
    if (d <= (stopAt || 0)) return false;
    const ang = Math.atan2(ty - e.y, tx - e.x);
    const step = Math.min(speedU * U * dt, d - (stopAt || 0));
    e.x += Math.cos(ang) * step; e.y += Math.sin(ang) * step;
    faceTo(ang);
    return step > 0;
  };

  // 방어 거점 이벤트: 적 60%는 봉화를 우선 공격(플레이어가 1.2u 안에 붙으면 플레이어), 나머지도 봉화가 더 가까우면 봉화
  if (e.fortTarget == null) e.fortTarget = Math.random() < 0.6;
  if (fort && fort.hp > 0 && dToPlayer > 1.2 * U && (e.fortTarget || dist(e.x, e.y, fort.x, fort.y) < dToPlayer)) {
    const reach = fort.r + e.radiusU * U;
    if (dist(e.x, e.y, fort.x, fort.y) <= reach + 4) {
      fort.hp -= (e.atk || 10) * 0.6 * dt; fort.hitT = 0.15;
      return false;
    }
    return stepToward(fort.x, fort.y, e.spdU, reach);
  }

  switch (e.behavior) {
    case "dash": {
      // 예고(1s) → 돌진(8u/s, 0.75s) → 경직(1.5s)
      e.stateT -= dt;
      if (e.phase === "idle") {
        if (dToPlayer < 7 * U) { e.phase = "telegraph"; e.stateT = 1.0; }
        return stepToward(player.x, player.y, e.spdU * 0.6, contactRange);
      }
      if (e.phase === "telegraph") {
        if (e.stateT <= 0) {
          const ang = Math.atan2(player.y - e.y, player.x - e.x);
          e.dashVx = Math.cos(ang) * 8 * U; e.dashVy = Math.sin(ang) * 8 * U;
          e.phase = "dash"; e.stateT = 0.75;
          faceTo(ang);
        }
        return false;
      }
      if (e.phase === "dash") {
        e.x += e.dashVx * dt; e.y += e.dashVy * dt;
        if (e.stateT <= 0) { e.phase = "stun"; e.stateT = 1.5; }
        return true;
      }
      if (e.stateT <= 0) e.phase = "idle";  // stun 종료
      return false;
    }
    case "kite": {
      // 3u 거리 유지: 가까우면 후퇴, 멀면 접근
      const want = 3 * U;
      if (dToPlayer < want - 12) {
        const ang = Math.atan2(e.y - player.y, e.x - player.x);
        e.x += Math.cos(ang) * e.spdU * U * dt;
        e.y += Math.sin(ang) * e.spdU * U * dt;
        faceTo(ang + Math.PI);
        return true;
      }
      if (dToPlayer > want + 12) return stepToward(player.x, player.y, e.spdU, want);
      // 제자리에서 좌우로 흔들림
      e.x += Math.cos(runTime * 2 + e.orbitOffset) * 20 * dt;
      return true;
    }
    case "blink": {
      // 4s마다 플레이어 뒤 2u로 순간이동
      e.blinkT -= dt;
      if (e.blinkT <= 0) {
        e.blinkT = 4;
        if (chapter?.theme === 1) themeFx.emit("blink", e.x, e.y, { radius: 24 });
        const ang = Math.atan2(player.y - e.y, player.x - e.x) + Math.PI;
        e.x = player.x + Math.cos(ang) * 2 * U;
        e.y = player.y + Math.sin(ang) * 2 * U;
        if (chapter?.theme === 1) themeFx.emit("blink", e.x, e.y, { radius: 24 });
        else hitFx.push({ x: e.x, y: e.y, life: 0.3, maxLife: 0.3, color: "#a8e8f0" });
        return true;
      }
      return stepToward(player.x, player.y, e.spdU, contactRange);
    }
    case "explode": {
      // 1u 접근 시 1s 점화 후 자폭. 사망 시에도 폭발(onEnemyDeath에서 처리)
      if (e.phase !== "fuse" && dToPlayer < 1.2 * U) { e.phase = "fuse"; e.stateT = 1.0; }
      if (e.phase === "fuse") {
        e.stateT -= dt;
        if (e.stateT <= 0) { e.hp = 0; e.detonate = true; }
        return false;
      }
      return stepToward(player.x, player.y, e.spdU, contactRange);
    }
    case "summon": {
      e.summonT -= dt;
      const def = ENEMIES[e.typeId];
      if (e.summonT <= 0 && def.summon) {
        e.summonT = def.summon.everyS;
        for (let i = 0; i < def.summon.n; i++) {
          const a = Math.random() * Math.PI * 2;
          spawnEnemyAt(def.summon.id, e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
        }
        if (chapter?.theme === 1) themeFx.emit("summon", e.x, e.y, { radius: 36 });
        else hitFx.push({ x: e.x, y: e.y, life: 0.35, maxLife: 0.35, color: "#8ff0e0" });
      }
      return stepToward(player.x, player.y, e.spdU, contactRange);
    }
    case "surround": {
      // 플레이어 옆쪽 지점을 목표로 삼아 둘러싼다(docs/06 §8 포위)
      const ang = Math.atan2(player.y - e.y, player.x - e.x) + Math.sin(runTime + e.orbitOffset) * 0.9;
      const tx = player.x - Math.cos(ang) * contactRange;
      const ty = player.y - Math.sin(ang) * contactRange;
      return stepToward(tx, ty, e.spdU, 0);
    }
    default:
      return stepToward(player.x, player.y, e.spdU, contactRange);
  }
}

// ---------- Enemies AI / contact damage ----------
let contactDamageThisSecond = 0, contactDamageTimer = 1;
function updateEnemies(dt) {
  contactDamageTimer -= dt;
  if (contactDamageTimer <= 0) { contactDamageTimer += 1; contactDamageThisSecond = 0; }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.flashT > 0) e.flashT -= dt;
    if (e.hp <= 0) {
      onEnemyDeath(e);
      enemies.splice(i, 1);
      continue;
    }
    // 넉백 속도 감쇠 적용(docs/06 §7.3 — 0.15s 동안 밀려남)
    if (e.kbVx || e.kbVy) {
      e.x += e.kbVx * dt; e.y += e.kbVy * dt;
      const decay = Math.exp(-dt * 12);
      e.kbVx *= decay; e.kbVy *= decay;
      if (Math.abs(e.kbVx) < 1 && Math.abs(e.kbVy) < 1) { e.kbVx = 0; e.kbVy = 0; }
    }

    if (e.sgTrait) sgTraitTick(e, dt);   // 어려움의 특별한 적: 회복·첫 등장 이름표
    // 적과의 충돌은 통과 불가(docs/06 §1) — 접촉 반경까지만 접근하고 멈춘다.
    const contactRange = e.radiusU * U + 0.4 * U;
    e.v2SlowT=Math.max(0,(e.v2SlowT||0)-dt);
    const moved = moveEnemy(e, dt*(e.v2SlowT>0?(e.v2SlowMul||1):1), contactRange);
    if(!e.v2SlowT)e.v2SlowMul=1;
    if (chapter?.theme) resolveObstacles(e, e.radiusU * U * 0.8, e);   // 소품 장애물(타이어는 튕겨 냄)
    e.animT += dt * (moved ? 7 : 2.5);
    e.spawnT = Math.min(1, e.spawnT + dt * 6);

    e.contactT -= dt;
    if (e.contactT <= 0 && dist(e.x, e.y, player.x, player.y) <= e.radiusU * U + 14) {
      e.contactT = 0.5;
      applyContactDamage(e.atk);
    }
  }

  if (boss) updateBoss(dt);
}

// 플레이어 피해 수신 순서(docs/06 §7.5): 회피 → 피해감소 → 보호막 → 체력
function takeDamage(raw) {
  if (Math.random() < Math.min(0.3, stat("dodgePct"))) {           // 회피 상한 30%
    floatingTexts.push({ x: player.x, y: player.y - 24, text: "회피", life: 0.5, vy: -30, scale: 0, color: "#9ad8ff" });
    return 0;
  }
  const inBeacon = beacon && dist(player.x, player.y, beacon.x, beacon.y) < beacon.r;
  // 개편판: 처음 1분은 적 공격이 55%→100%로 서서히 세진다(스킬이 아직 없을 때 둘러싸여 바로 쓰러지지 않게, 2026-09-23)
  const grace = runCfg.rework ? Math.min(1, 0.55 + 0.45 * runTime / 60) : 1;
  const takenMul = runMods.diffTaken ? runMods.stageAtk * sgDiffMul(runMods.diffTaken) : (runMods.takenMul || 1);
  let d = raw * grace * (1 - damageReduction()) * takenMul * (inBeacon ? 1 + stat("beaconTakenPct") : 1);
  const absorbed = Math.min(d, player.shield);                     // absorbed = min(D, shield)
  player.shield -= absorbed;
  d = Math.max(0, d - absorbed);
  player.shieldIdle = 0;
  player.hp -= d;
  if(d>0)player.sgHurt=true;
  if (d > 0) player.hitCount = (player.hitCount || 0) + 1;
  if (boss && d > 0) starTrack.bossNoHit = false;       // 최종 보스전 무피해 실패
  return d;
}

function applyContactDamage(rawAtk) {
  if (SG_LOCAL && window.__debugGod) return;
  if (player.invulnT > 0) return;
  const cap = player.hpMax * (R.DIFFICULTIES[R.difficultyOf(sgRunProfile)]?.contactCap ?? .40);   // 쉬움 25% · 보통 30% · 어려움 35% / 초
  const room = cap - contactDamageThisSecond;
  if (room <= 0) return;
  const dmg = Math.min(rawAtk * (1 + stat("contactTakenPct")), room);
  contactDamageThisSecond += dmg;
  runStats.hurtContact = (runStats.hurtContact || 0) + takeDamage(dmg);   // 받은 피해 출처 기록(난이도 조정용)
  player.hitFlashT = 0.2;
  if (rawAtk >= player.hpMax * 0.03) { player.invulnT = sgRunProfile?.difficulty==='easy'?.6:.3; playSfx("hitLight", 0.35); }
  if (player.hp <= 0) onPlayerDeath();
}

// 적이 일으키는 폭발 — 플레이어를 다치게 한다(자폭 균류 등)
function enemyExplodeAt(x, y, radiusPx, dmg, color) {
  blasts.push({ x, y, radius: radiusPx, life: 0.35, maxLife: 0.35, color: color || "#8fe06a" });
  if (dist(player.x, player.y, x, y) <= radiusPx + 0.4 * U && player.invulnT <= 0 && !(SG_LOCAL && window.__debugGod)) {
    runStats.hurtBlast = (runStats.hurtBlast || 0) + takeDamage(dmg);
    player.invulnT = 0.3; player.hitFlashT = 0.25;
    floatingTexts.push({ x: player.x, y: player.y - 20, text: `-${Math.round(dmg)}`, life: 0.7, vy: -30, color: "#ff6060", scale: 0 });
    if (player.hp <= 0) onPlayerDeath();
  }
  addShake(3, 0.14);
  playSfx("hitBoss", 0.3);
}

function onEnemyDeath(e) {
  killCount++;
  runStats.kills++;
  if (e.elite) runStats.eliteKills++;
  if (e.elite && (player.hitCount || 0) === e.hitMark) runStats.midBossNoHit++;   // 중간 보스 무피해 처치
  addLuminance(e.elite ? 12 : 0.8);                       // 처치로 광휘 충전
  const def = ENEMIES[e.typeId];
  // 보석 값 = 시간 모드 계수 × 도전 규칙 × 어둠 지대(1.5)
  const inDark = isInDark(e.x, e.y);
  const gv = gemValue(def.xp, runTime / 60) * (runMods.gemMul || 1) * (runCfg.gemMul || 1) * (inDark ? 1.5 : 1);
  if((player.sgChoices||0)<runCfg.cardCap)gems.push({ x: e.x, y: e.y, value: gv, vx: 0, vy: 0, spawnT: 0, bob: Math.random() * 10 });
  const deathLife = chapter?.theme === 1 ? .65 : .35;
  deathFx.push({ x: e.x, y: e.y, life: deathLife, maxLife: deathLife, size: e.elite ? 104 : 62, color: e.elite ? "#ff8a5a" : "#c9a8ff" });

  if (e.sgTrait === "split") sgSplit(e);   // 어려움: 쪼개지기 → 작은 적 2마리
  // 자폭형은 죽을 때도 터진다(enemies.csv EN13) — 적의 폭발이므로 플레이어가 맞는다
  if (e.behavior === "explode") {
    enemyExplodeAt(e.x, e.y, 1.2 * U, e.atk * 1.5, "#8fe06a");
  }
  // 엘리트 처치 시 수집품 드롭 기회(위험 구역은 더 높음)
  if (e.elite && Math.random() < (runCfg.mode === "M06" ? 0.35 : 0.12)) {
    pendingCollectibles++;
    floatingTexts.push({ x: e.x, y: e.y - 30, text: "수집품!", life: 1, vy: -30, scale: 0, color: "#c07aff", big: true });
  }
  // 사망 시 소환(EL01 잔해 6마리, EL02 무리 5마리 등)
  if (def.onDeathSpawn) {
    const { id, n } = def.onDeathSpawn;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      spawnEnemyAt(id, e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24);
    }
  }
  if (e.elite) {
    log(`엘리트 처치: ${def.name}`);
    addShake(5, 0.25);
  }
}

// ---------- Boss patterns (bosses.json BS01 발췌 재현) ----------
function updateBoss(dt) {
  if (boss.flashT > 0) boss.flashT -= dt;
  if (boss.hp <= 0) {
    onBossDefeated();
    return;
  }
  // 보스 점수 모드는 체력 대신 1:00에 형태 변화(docs/10 §1.2)
  const phaseHit = runCfg.bossScore ? runTime >= 60 : boss.hp <= boss.hpMax * bossDef.phase2At;
  if (phaseHit && boss.phase === 1) {
    boss.phase = 2;
    boss.spdU = bossDef.spdU * 1.3;
    if (chapter?.theme === 1) themeFx.emit("phase", boss.x, boss.y);
    log(`${bossDef.name} 2페이즈!`);
    addShake(7, 0.5);
  }

  // 기절(쓰레기 줍기로 약해짐): 움직이지도, 기술을 쓰지도 못한다
  if (boss.stunT > 0) {
    boss.stunT -= dt;
    elBossLabel.textContent = "😵 기절!";
    if (boss.stunT <= 0) elBossLabel.textContent = "";
    return;
  }

  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  if (!boss.activePattern) {
    boss.x += Math.cos(angle) * boss.spdU * U * dt * 0.5;
    boss.y += Math.sin(angle) * boss.spdU * U * dt * 0.5;
  }

  if (boss.activePattern) {
    boss.telegraphT -= dt;
    elBossLabel.textContent = `${boss.activePattern.name} 예고! (${boss.telegraphT.toFixed(1)}s)`;
    if (boss.activePattern.kind === "vacuum") {          // 쓰레기 흡입: 예고 동안 플레이어를 끌어당긴다(걸어서 벗어날 수 있는 속도)
      const d = dist(player.x, player.y, boss.x, boss.y);
      if (d > 1.2 * U) {
        const a = Math.atan2(boss.y - player.y, boss.x - player.x);
        player.x += Math.cos(a) * 2.2 * U * dt; player.y += Math.sin(a) * 2.2 * U * dt;
      }
    }
    if (boss.telegraphT <= 0) {
      resolveBossPattern(boss.activePattern);
      boss.activePattern = null;
      boss.restT = 1.5;
      elBossLabel.textContent = "";
    }
  } else {
    boss.restT -= dt;
    if (boss.restT <= 0) {
      const pats = bossDef.patterns.filter((p) => !p.phase || p.phase <= boss.phase);   // 2페이즈 전용 기술은 화난 뒤에만
      const pat = boss.forcePattern || pats[Math.floor(Math.random() * pats.length)];   // forcePattern: QA 훅(__debugBossPattern)
      boss.forcePattern = null;
      boss.activePattern = {
        ...pat, originX: boss.x, originY: boss.y, aimAngle: angle,
        telegraphOriginX: player.x, telegraphOriginY: player.y,
        // 산개형(낙석·쓰레기 뿌리기)은 예고 시점에 좌표를 뽑아둔다
        spots: pat.kind === "scatter" || pat.kind === "litter"
          ? Array.from({ length: pat.count || 8 }, () => {
              const a = Math.random() * Math.PI * 2, r = (pat.kind === "litter" ? 1.5 * U : 0) + Math.random() * (pat.kind === "litter" ? 2 * U : 7 * U);
              return { x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r };
            })
          : null,
      };
      boss.telegraphT = pat.telegraphS;
      playSfx("bossTelegraph", 0.45);
    }
  }
}

// 보스 패턴 판정 — kind별로 다른 회피 조건(bosses.json의 dodge 설명을 구현)
function resolveBossPattern(pat) {
  const dmg = boss.atkBase * pat.dmg;
  const spawnAdds = () => {
    if (!pat.summon) return;
    for (let i = 0; i < pat.summon.n; i++) {
      const a = (Math.PI * 2 * i) / pat.summon.n;
      spawnEnemyAt(pat.summon.id, boss.x + Math.cos(a) * 60, boss.y + Math.sin(a) * 60);
      if (chapter?.theme === 1) themeFx.emit("summon", boss.x + Math.cos(a) * 60, boss.y + Math.sin(a) * 60, { radius: 28 });
    }
    addShake(4, 0.2);
  };

  switch (pat.kind) {
    case "groundCircle": {
      // 예고 원 밖으로 "한 걸음" 벗어나면 회피
      const r = (pat.radiusU || 1.25) * U;
      const moved = dist(player.x, player.y, pat.telegraphOriginX, pat.telegraphOriginY);
      if (moved < r) applyBossHit(dmg);
      blasts.push({ x: pat.telegraphOriginX, y: pat.telegraphOriginY, radius: r, life: 0.3, maxLife: 0.3, color: "#ff7a4a" });
      addShake(4, 0.18);
      break;
    }
    case "cone": {
      // 전방 부채꼴 — 예고 방향 기준 ±90°, 사거리 4u
      const toPlayer = Math.atan2(player.y - boss.y, player.x - boss.x);
      const diff = Math.abs(normalizeAngle(toPlayer - pat.aimAngle));
      if (diff < Math.PI / 2 && dist(player.x, player.y, boss.x, boss.y) <= 4 * U) applyBossHit(dmg);
      if (pat.stinkField) {                     // 악취 방귀 구름: 5초 동안 남는 냄새 안개(느려짐 + 지속 피해, updatePlayer)
        fields.push({ x: boss.x + Math.cos(pat.aimAngle) * 2.2 * U, y: boss.y + Math.sin(pat.aimAngle) * 2.2 * U,
          radius: 2.4 * U, life: 5, maxLife: 5, tickT: 0.5, tickS: 0.5, hostile: true, color: "#9aa030", dmgCoef: 0, dmgMul: 0 });
      }
      break;
    }
    case "vacuum": {
      // 쓰레기 흡입 — 예고 동안 끌려온 뒤 2.5u 안에 있으면 크게 물린다
      if (dist(player.x, player.y, boss.x, boss.y) <= 2.5 * U) applyBossHit(dmg);
      blasts.push({ x: boss.x, y: boss.y, radius: 2.5 * U, life: 0.35, maxLife: 0.35, color: "#a0c060", vfxKind: "bite" });
      addShake(6, 0.25);
      break;
    }
    case "litter": {
      // 쓰레기 뿌리기 — 떨어지는 자리에 있으면 피격, 떨어진 쓰레기는 8초 안에 주우면 보스가 약해진다(updateDecor)
      for (const s of (pat.spots || [])) {
        blasts.push({ x: s.x, y: s.y, radius: 0.9 * U, life: 0.3, maxLife: 0.3, color: "#c0a080", vfxKind: "debris" });
        if (dist(player.x, player.y, s.x, s.y) < 0.9 * U) applyBossHit(dmg);
        decor.push({ x: s.x, y: s.y, sprite: "t1_prop_litter", h: 30, litter: true, bossLitter: true, expire: runTime + 8, flicker: Math.random() * 10, opened: false });
      }
      floatingTexts.push({ x: boss.x, y: boss.y - 60, text: "쓰레기를 주워서 정화하자!", life: 1.4, vy: -20, color: "#8ee07a", scale: 0, big: true });
      addShake(4, 0.2);
      break;
    }
    case "radial": {
      // 방사형 선 — 근접 범위에서 크게 안 움직였으면 피격
      const moved = dist(player.x, player.y, pat.telegraphOriginX, pat.telegraphOriginY);
      if (dist(player.x, player.y, boss.x, boss.y) <= 6 * U && moved < 1.5 * U) applyBossHit(dmg * 0.6);
      break;
    }
    case "ringOut": {
      // 보스 중심에서 퍼지는 링 — 4u 밖으로 나가면 회피, 맞으면 넉백
      const d = dist(player.x, player.y, boss.x, boss.y);
      if (d <= 4 * U) {
        applyBossHit(dmg);
        if (pat.knockback) {
          const ang = Math.atan2(player.y - boss.y, player.x - boss.x);
          player.x += Math.cos(ang) * pat.knockback * U;
          player.y += Math.sin(ang) * pat.knockback * U;
        }
      }
      blasts.push({ x: boss.x, y: boss.y, radius: 4 * U, life: 0.45, maxLife: 0.45, color: "#ffd06a", vfxKind: "avalanche" });
      addShake(5, 0.25);
      spawnAdds();
      break;
    }
    case "dashLine": {
      // 돌진 — 예고 직선에서 수직으로 비켜야 회피. 보스가 실제로 이동한다.
      const ang = pat.aimAngle;
      const dx = player.x - boss.x, dy = player.y - boss.y;
      const along = dx * Math.cos(ang) + dy * Math.sin(ang);
      const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
      if (along > -U && along < 7 * U && perp < 1.2 * U) applyBossHit(dmg);
      boss.x += Math.cos(ang) * 5 * U;
      boss.y += Math.sin(ang) * 5 * U;
      addShake(6, 0.25);
      break;
    }
    case "scatter": {
      // 무작위 낙석 여러 곳 — 각 원 안에 있으면 피격
      for (const s of (pat.spots || [])) {
        blasts.push({ x: s.x, y: s.y, radius: 1.2 * U, life: 0.3, maxLife: 0.3, color: "#c0a080", vfxKind: "debris" });
        if (dist(player.x, player.y, s.x, s.y) < 1.2 * U) applyBossHit(dmg);
      }
      addShake(5, 0.3);
      break;
    }
    case "summonOnly":
      spawnAdds();
      break;
  }
}
function normalizeAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

function applyBossHit(dmg) {
  if (SG_LOCAL && window.__debugGod) return;
  if (player.invulnT > 0) return;
  const taken = takeDamage(dmg);
  runStats.hurtHit = (runStats.hurtHit || 0) + taken;
  player.invulnT = 0.3;
  player.hitFlashT = 0.25;
  floatingTexts.push({ x: player.x, y: player.y - 20, text: `-${Math.round(taken)}`, life: 0.7, vy: -30, color: "#ff6060", scale: 0 });
  playSfx("hitLight2", 0.55);
  if (player.hp <= 0) onPlayerDeath();
}

function onBossDefeated() {
  runStats.bossKills++;
  elBossLabel.textContent = "";
  if (Math.random() < 0.35) pendingCollectibles++;        // 보스 처치 시 수집품 드롭 기회
  // 무한 생존: 순환 보스를 잡아도 판은 계속된다
  if (runCfg.endless) {
    boss = null;
    log("순환 보스 처치! 생존 계속");
    return;
  }
  // 원정: 5연전 — 스킬·레벨·체력 비율을 유지한 채 다음 단계로(docs/10 §1 M08)
  if (runCfg.stages && runCfg.stage < runCfg.stages) {
    runCfg.stage++;
    boss = null;
    stageTime = 0;
    enemies.length = 0;
    const next = CHAPTERS[Math.min(CHAPTERS.length - 1, chapter.index + 1)];
    chapter = next; bossDef = BOSSES[next.boss];
    decor = buildDecor();
    healPlayer(player.hpMax * 0.2);
    floatingTexts.push({ x: player.x, y: player.y - 40, text: `원정 ${runCfg.stage}/${runCfg.stages}`, life: 1.6, vy: -20, scale: 0, color: "#ffe9a8", big: true });
    log(`원정 ${runCfg.stage}단계: ${next.name}`);
    return;
  }
  chapterCleared = true;
  endRun(true);
}

// ---------- Gems / XP ----------
function updateGems(dt) {
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.spawnT = Math.min(1, (g.spawnT || 0) + dt * 5);
    const d = dist(g.x, g.y, player.x, player.y);
    if (d < magnetRadiusPx()) {
      const angle = Math.atan2(player.y - g.y, player.x - g.x);
      g.x += Math.cos(angle) * 12 * U * dt;
      g.y += Math.sin(angle) * 12 * U * dt;
    }
    if (d < 14) {
      gainXp(g.value * (1 + stat("xpPct")));
      runStats.gems++; addLuminance(0.25);
      if (isInDark(player.x, player.y)) runStats.darkGems++;
      hitFx.push({ x: g.x, y: g.y, life: 0.25, maxLife: 0.25, color: "#8fd8ff", vfxKind: "pickup" });
      playSfx("gemPickup", 0.2);
      gems.splice(i, 1);
    }
  }
}

function gainXp(v) {
  if((player.sgChoices||0)+(player.pendingLevels||0)>=runCfg.cardCap){player.xp=0;return;}

  player.xp += v;
  // 한 번에 여러 레벨이 오르면 레벨마다 선택지를 준다(대기열)
  while (player.xp >= xpNeedFor(player.lvl) && player.lvl <= runCfg.cardCap) {   // 최대 레벨 60 (docs/06 §4.1)
    player.xp -= xpNeedFor(player.lvl);
    player.lvl++;
    player.pendingLevels = (player.pendingLevels || 0) + 1;
  }
  if (player.pendingLevels > 0 && mode === "playing" && runTime-player.sgLastChoice>=5) openLevelUp();
}

// ---------- Level-up cards ----------
// 진화 가능 여부 — docs/06 §6
// 진화: 원본 공격 Lv5 + 짝 패시브 Lv≥2 / 융합: 지정 공격 2종이 모두 Lv5
function evolutionReady(evo) {
  const a = player.skills[evo.sourceA];
  if (!a || a.evolved || a.lv < SKILLS[evo.sourceA].maxLevel) return false;
  if (evo.type === "fusion") {
    const b = player.skills[evo.sourceB];
    return !!b && !b.evolved && b.lv >= (SKILLS[evo.sourceB]?.maxLevel ?? 5);
  }
  const p = player.passives[evo.sourceB];
  return !!p && p.lv >= evo.requiresPassiveLv;
}

function availableEvolutions() {
  const out = [];
  for (const id in EVOLUTIONS) {
    const e = EVOLUTIONS[id];
    if (evolutionReady(e)) out.push(e);
  }
  return out;
}

// docs/06 §5.1 후보 생성: 슬롯에 여유가 있으면 미획득 스킬, 보유 중이면 Lv<max 강화 카드.
function buildCardPool() {
  return R.cardPool(sgRunProfile,player.skills,player.sgRun);

  const pool = [];
  const partSkills = ECO.partSkillSet(save);
  const attackCount = Object.keys(player.skills).length;
  const passiveCount = Object.keys(player.passives).length;

  // 진화 카드는 가중치 ×3 (docs/06 §5.1)
  for (const e of availableEvolutions()) pool.push({ kind: "evolve", id: e.id, weight: 3 });

  for (const id in SKILLS) {
    if (player.lockedSkills?.has(id)) continue;      // 캐릭터 전용 금지 스킬(docs/06 §5.1)
    const owned = player.skills[id];
    if (owned) {
      // 진화한 스킬은 자체 최대 레벨(3)까지만 강화
      const max = owned.evolved ? EVOLUTIONS[owned.evolved].maxLevel : SKILLS[id].maxLevel;
      if (owned.lv < max) pool.push({ kind: "skill-up", id, weight: 1.5 * (bpTarget(id) ? 1.4 : 1) });
    } else if (attackCount < ATTACK_SLOTS && !player.bannedSkills?.has(id)) {
      // 캐릭터 친화 태그와 겹치면 ×1.3 (docs/06 §5.1)
      const aff = player.affinity?.some((t) => (SKILLS[id].tags || "").includes(t)) ? 1.3 : 1;
      const partW = partSkills.has(id) ? 1.2 : 1;      // 착용 부품 스킬 ×1.2 (docs/09 §3)
      pool.push({ kind: "skill-new", id, weight: aff * partW * (bpTarget(id) ? 1.4 : 1) });
    }
  }
  for (const id in PASSIVES) {
    if (player.bannedPassives?.has(id)) continue;
    const owned = player.passives[id];
    if (owned) {
      if (owned.lv < PASSIVES[id].maxLevel) pool.push({ kind: "passive-up", id, weight: 1.5 * (bpTarget(id) ? 1.4 : 1) });
    } else if (passiveCount < PASSIVE_SLOTS) {
      pool.push({ kind: "passive-new", id, weight: bpTarget(id) ? 1.4 : 1 });
    }
  }
  return pool;
}

// 가중치 비복원 추출(docs/06 §5.1: 보유 중 강화 카드 ×1.5)
function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const total = copy.reduce((s, c) => s + (c.weight || 1), 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < copy.length; idx++) {
      r -= copy[idx].weight || 1;
      if (r <= 0) break;
    }
    out.push(copy.splice(Math.min(idx, copy.length - 1), 1)[0]);
  }
  return out;
}

// 레벨업 조작(docs/06 §5.2): 새로고침 3 / 제외 2 / 잠금 1 / 건너뛰기 무제한(광휘 +20)
let currentCards = [];
let lockedCard = null;
function openLevelUp(reroll = false) {
  return sgChooseCards(reroll);

  mode = "levelup";
  const pool = buildCardPool().filter((c) => !(lockedCard && c.kind === lockedCard.kind && c.id === lockedCard.id));
  const nCards = runMods.cards || 3;
  let cards = pickN(pool, lockedCard ? nCards - 1 : nCards);
  if (lockedCard) cards.unshift(lockedCard);
  // 레벨 10 미만이고 공격 슬롯에 여유가 있으면 최소 1장은 공격(docs/06 §5.1 4번)
  if (player.lvl < 10 && Object.keys(player.skills).length < ATTACK_SLOTS &&
      !cards.some((c) => c.kind === "skill-new" || c.kind === "skill-up")) {
    const atk = pool.find((c) => c.kind === "skill-new");
    if (atk) cards[cards.length - 1] = atk;
  }
  // 풀이 모자라면 보충 카드(docs/06 §5.1 5번)
  const fillers = [{ kind: "heal" }, { kind: "gold" }, { kind: "lum" }];
  while (cards.length < nCards) cards.push(fillers[cards.length % 3]);
  currentCards = cards;
  elCardRow.innerHTML = "";
  cards.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "card" + (lockedCard && i === 0 ? " locked-card" : "");
    div.innerHTML = renderCard(c) + `
      <div class="card-ops">
        ${c.id && player.bans > 0 ? `<button class="op" data-op="ban">제외 ${player.bans}</button>` : ""}
        ${(player.locks ?? 1) > 0 && !(lockedCard && i === 0) ? `<button class="op" data-op="lock">잠금</button>` : ""}
      </div>`;
    div.addEventListener("click", (ev) => {
      const op = ev.target?.dataset?.op;
      if (op === "ban") {                           // 이번 판 풀에서 제거
        ev.stopPropagation();
        player.bans--; player.bannedSkills.add(c.id);
        if (c.kind.startsWith("passive")) player.bannedPassives = (player.bannedPassives || new Set()).add(c.id);
        playSfx("uiClick", 0.4); openLevelUp(true); return;
      }
      if (op === "lock") {                          // 다음 레벨업까지 보존
        ev.stopPropagation();
        player.locks = (player.locks ?? 1) - 1; lockedCard = c;
        div.classList.add("locked-card"); playSfx("uiClick", 0.4); return;
      }
      playSfx("cardSelect", 0.5);
      if (lockedCard && lockedCard === c) lockedCard = null;
      applyCard(c); closeLevelUp();
    });
    elCardRow.appendChild(div);
  });
  document.getElementById("lv-ops").innerHTML = `
    <button class="op big-op" id="op-reroll" ${player.rerolls > 0 && !runMods.noReroll ? "" : "disabled"}>새로고침 ${runMods.noReroll ? "불가" : player.rerolls}</button>
    <button class="op big-op" id="op-skip">건너뛰기 (광휘 +20)</button>
    <span class="lv-pending">${player.pendingLevels > 1 ? `남은 선택 ${player.pendingLevels}` : ""}</span>`;
  document.getElementById("op-reroll").onclick = () => {
    if (player.rerolls <= 0 || runMods.noReroll) return;
    player.rerolls--; playSfx("uiClick", 0.4); openLevelUp(true);
  };
  document.getElementById("op-skip").onclick = () => {
    playSfx("uiClick", 0.4); addLuminance(20); closeLevelUp();
  };
  elLevelup.classList.remove("hidden");
  if (!reroll) playSfx("levelupOpen", 0.5);
}
function closeLevelUp() {
  elLevelup.classList.add("hidden");
  player.pendingLevels = Math.max(0, (player.pendingLevels || 1) - 1);
  mode = "playing";
  player.sgLastChoice=runTime;
}

const KIND_LABEL = {
  projectile: "유도", spread: "산탄", pierce: "관통", chain: "연쇄",
  orbit: "회전", lob: "폭발", beam: "광선", strike: "낙뢰",
  field: "장판", summon: "소환", melee: "근접", boomerang: "왕복",
  bounce: "튕김", trap: "설치", clone: "분신",
};

// 빌드 청사진 목표(docs/06 §5.1 ×1.4, UI: 목표 카드 ★)
function bpTarget(id) { const bp = save.blueprint; return !!bp && (bp.attack.includes(id) || bp.passive.includes(id)); }
function renderCard(c) {
  if (c.kind === "heal") return `<span class="tag">보충</span><h3>회복</h3><p>최대 체력의 30%를 즉시 회복한다.</p>`;
  if (c.kind === "gold") return `<span class="tag">보충</span><h3>금화 주머니</h3><p>금화 +${50 * (chapter.index + 1)} (결과 화면에 합산)</p>`;
  if (c.kind === "lum") return `<span class="tag">보충</span><h3>광휘</h3><p>광휘 게이지 +50</p>`;
  if (c.kind === "evolve") {
    const e = EVOLUTIONS[c.id];
    const srcName = SKILLS[e.sourceA].name;
    const pairName = e.type === "fusion" ? SKILLS[e.sourceB]?.name : PASSIVES[e.sourceB]?.name;
    return `<span class="tag evo">${e.type === "fusion" ? "융합" : "진화"}</span>
      <h3 class="evo-name">${e.name}</h3>
      <div class="lvdots"><i style="background:#ffd76a"></i><i style="background:#ffd76a"></i><i style="background:#ffd76a"></i><i style="background:#ffd76a"></i><i style="background:#ffd76a"></i></div>
      <p><b style="color:#ffd76a">${srcName}</b> + ${pairName || "?"}<br>${e.behaviorChange || ""}</p>`;
  }
  if (c.kind === "skill-new" || c.kind === "skill-up") {
    const def = SKILLS[c.id];
    const nextLv = c.kind === "skill-new" ? 1 : player.skills[c.id].lv + 1;
    const dots = Array.from({ length: def.maxLevel }, (_, i) =>
      `<i style="background:${i < nextLv ? def.color : "rgba(255,255,255,0.15)"}"></i>`).join("");
    return `<span class="tag" style="color:${def.color}">공격 · ${KIND_LABEL[def.kind] || ""}</span>
      <h3 style="color:${def.color}">${bpTarget(c.id) ? "★ " : ""}${def.name}${c.kind === "skill-up" ? ` Lv${nextLv}` : " (신규)"}</h3>
      <div class="lvdots">${dots}</div>
      <p>${def.levelText[nextLv - 1]}</p>`;
  }
  const def = PASSIVES[c.id];
  const nextLv = c.kind === "passive-new" ? 1 : player.passives[c.id].lv + 1;
  const dots = Array.from({ length: def.maxLevel }, (_, i) =>
    `<i style="background:${i < nextLv ? "#9ad8ff" : "rgba(255,255,255,0.15)"}"></i>`).join("");
  return `<span class="tag" style="color:#9ad8ff">패시브</span>
    <h3 style="color:#cfe8ff">${bpTarget(c.id) ? "★ " : ""}${def.name}${c.kind === "passive-new" ? " (신규)" : ` Lv${nextLv}`}</h3>
    <div class="lvdots">${dots}</div>
    <p>${def.desc}</p>`;
}

function applyCard(c) {
  return sgApplyCard(c);

  if (c.kind === "heal") { player.hp = Math.min(player.hpMax, player.hp + player.hpMax * 0.3); return; }
  if (c.kind === "gold") { chestGold += 50 * (chapter.index + 1); return; }
  if (c.kind === "lum") { addLuminance(50); return; }
  if (c.kind === "evolve") {
    const e = EVOLUTIONS[c.id];
    const st = player.skills[e.sourceA];
    st.evolved = e.id;
    runStats.evolutions++;
    runStats.evoKinds.push(e.id);
    st.lv = 1;                       // 진화체는 Lv1~3으로 다시 시작(docs/07 §3.1)
    st.cd = 0;
    // 융합은 두 번째 재료 슬롯을 비워 새 공격을 받을 수 있게 한다(docs/06 §6)
    if (e.type === "fusion" && player.skills[e.sourceB]) {
      delete player.skills[e.sourceB];
      player.bannedSkills = player.bannedSkills || new Set();
      player.bannedSkills.add(e.sourceB);
    }
    // 진화 연출: 1초 무적 + 빛 기둥(docs/06 §11) + 주인공 점프 모션
    player.invulnT = Math.max(player.invulnT, 1.0);
    player.jumpT = JUMP_ANIM_S;
    blasts.push({ x: player.x, y: player.y, radius: 3.2 * U, life: 0.6, maxLife: 0.6, color: "#ffe9a8" });
    addShake(6, 0.35);
    playSfx("levelupOpen", 0.7);
    log(`진화! ${e.name}`);
    return;
  }
  if (c.kind === "skill-new") { player.skills[c.id] = { lv: 1, cd: 0 }; return; }
  if (c.kind === "skill-up") { player.skills[c.id].lv++; return; }
  if (c.kind === "passive-new") { player.passives[c.id] = { lv: 1 }; return; }
  if (c.kind === "passive-up") { player.passives[c.id].lv++; return; }
}

// ---------- Death / result ----------
// docs/06 §7.5 5단계: 체력 0이면 부활 스택이 있을 때 체력 50% + 3s 무적으로 되살아난다.
function onPlayerDeath() {
  if (player.revives > 0) {
    player.revives -= 1;
    runStats.revives++;
    player.hp = player.hpMax * 0.5;
    player.invulnT = 3.0;
    player.jumpT = JUMP_ANIM_S;
    // 부활 순간 주변을 밀어내 즉사 반복을 막는다(연출 겸 안전장치)
    for (const e of enemiesInRadius(player.x, player.y, 3 * U)) {
      const dx = e.x - player.x, dy = e.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      e.kbVx = (dx / len) * 420; e.kbVy = (dy / len) * 420;
    }
    blasts.push({ x: player.x, y: player.y, radius: 3 * U, life: 0.5, maxLife: 0.5, color: "#ffd76a" });
    floatingTexts.push({ x: player.x, y: player.y - 30, text: "부활!", life: 1.1, vy: -40, scale: 0, color: "#ffd76a", big: true });
    addShake(6, 0.3);
    playSfx("levelupOpen", 0.6);
    log(`부활! (남은 부활 ${player.revives}회)`);
    return;
  }
  player.downed = true;                 // 결과 화면 뒤 배경에 쓰러진 모습으로 남는다
  endRun(false);
}

function endRun(cleared) {
  return sgEnd(cleared);

  mode = "result";
  elBossLabel.textContent = "";
  const chIndex = CHAPTERS.findIndex((c) => c.id === chapter.id);
  const survivalMinutes = runTime / 60;
  const accXp = ACCOUNT_XP_PER_RUN({ chapter: chIndex + 1, survivalMinutes });
  const prog = save.progress.chapters[chapter.id] || { cleared: false, bestClearS: null };
  const isMain = runCfg.mode === "M01";
  const firstClear = isMain && cleared && !prog.cleared;
  const extra = {};             // 모드 보상: { TP, MEDAL, SHARD, DUST }
  const lines = [];             // 결과 화면 추가 줄
  let gold = 0, dust = 0;
  const repeatGold = chapter.repeat.gold;

  const chestOut = [];          // 즉시 개봉한 상자 결과 { text, color }
  const openNow = (tableId, n = 1, opt = {}) => {
    for (let i = 0; i < n; i++) { const r = ECO.openChest(save, tableId, { maxChapter: chIndex + 1, ...opt }); if (r) chestOut.push(r); }
  };
  let starsGained = 0, challengeFirst = false;
  const tier = chIndex < 20 ? 0 : chIndex < 40 ? 1 : 2;   // 모드 보상 난이도 구간

  switch (runCfg.mode) {
    case "M01": {
      const tm = runCfg.time;
      if (cleared) {
        // 첫 클리어 보상은 완전 모드 기준 1회 — 짧은 모드로 깨면 계수만큼, 이후 긴 모드로 깨면 차액 지급(docs/06 §4.3)
        const prevRank = prog.bestMode ?? -1;
        const prevMul = prevRank < 0 ? 0 : Object.values(TIME_MODES).find((x) => x.rank === prevRank).rewardMul;
        if (tm.rewardMul > prevMul) {
          const diff = tm.rewardMul - prevMul;
          gold = Math.round(chapter.firstClear.gold * diff);
          dust = Math.round(chapter.firstClear.dust * diff);
          if (prevRank < 0) {
            extra.TP = 1;
            // chapters.csv 첫 클리어: 장비 상자(등급) N · 캐릭터 인장 등(1회)
            const fr = parseReward(chapter.firstRaw);
            for (const k in fr) {
              if (k.startsWith("RW_EQ")) openNow(k, fr[k]);
              else if (!["GOLD", "DUST", "TP"].includes(k)) lines.push(...ECO.grant(save, { [k]: fr[k] }));
            }
          }
          lines.push(prevRank < 0 ? `첫 클리어 (${tm.name} ×${tm.rewardMul})` : `${tm.name} 모드 차액 지급`);
          save.progress.chapters[chapter.id] = { ...prog, bestMode: tm.rank };
        } else {
          gold = Math.round(repeatGold * (0.6 + tm.rewardMul * 0.4));
        }
        // 반복 드롭: 챕터 구간 장비 상자 확률(rewards.csv RW_CH_REPEAT)
        const pct = +(chapter.repeatRaw?.match(/장비 상자\D*(\d+)%/)?.[1] || 20);
        if (Math.random() * 100 < pct * (0.5 + tm.rewardMul * 0.5)) openNow(ECO.chapterChest(chIndex));
        // 10챕터마다 전설 상자 또는 인장 선택(docs/08 §1)
        if (prevRank < 0 && (chIndex + 1) % 10 === 0) openNow("RW_EQ_CHEST_L");
        // 별점: ★1 클리어 / ★2 최종 보스 무피해 / ★3 완전 모드 12:00 이내 Lv40 (CH01: 보스 전 Lv30)
        const oldStars = prog.stars || [false, false, false];
        // 서바이벌 챕터: ★2 = 부활 없이 버팀(보스 스테이지는 보스 무피해) / ★3 = 4:00 전에 Lv20
        const s2 = runCfg.survival && !runCfg.bossStage ? runStats.revives === 0 : starTrack.bossNoHit;
        const s3 = runCfg.survival ? !!starTrack.lvGoalAt && starTrack.lvGoalAt <= 240
          : chapter.id === "CH01"
          ? !!starTrack.lvGoalAt && starTrack.lvGoalAt <= (runCfg.bossAtS || 300)
          : tm.id === "full" && !!starTrack.lvGoalAt && starTrack.lvGoalAt <= 720;
        const newStars = [true, oldStars[1] || s2, oldStars[2] || s3];
        const gained = newStars.filter(Boolean).length - oldStars.filter(Boolean).length;
        starsGained = Math.max(0, gained);
        if (gained > 0) extra.TP = (extra.TP || 0) + gained;       // 별점당 특성점수 1
        save.progress.chapters[chapter.id] = { ...save.progress.chapters[chapter.id], ...prog, stars: newStars, bestMode: save.progress.chapters[chapter.id]?.bestMode ?? prog.bestMode };
        lines.push(`별점 ${"★".repeat(newStars.filter(Boolean).length)}${"☆".repeat(3 - newStars.filter(Boolean).length)}${gained > 0 ? ` (+${gained})` : ""}`);
      } else {
        gold = Math.round(killCount * GOLD_SHARD_VALUE(chIndex + 1) * 0.1);
      }
      break;
    }
    case "M02": {                                         // 도전: 첫 클리어 전체(훈장·코어·강화석), 반복 훈장 30%
      const cl = CHALLENGES.find((c) => c.id === runCfg.challenge);
      if (cleared) {
        const first = !save.challenges[cl.id];
        challengeFirst = first;
        for (const k in cl.reward) {
          if (k === "COLLECTIBLE") continue;
          if (first) extra[k] = (extra[k] || 0) + cl.reward[k];
          else if (k === "MEDAL") extra.MEDAL = Math.round(cl.reward.MEDAL * 0.3);
        }
        if (first && cl.tier === 3) extra.DUST = (extra.DUST || 0) + 20;   // 티어 3 첫 클리어 별가루 20 (docs/08)
        if (first && cl.reward.COLLECTIBLE) pendingCollectibles++;
        save.challenges[cl.id] = true;
        save.stats.challengeClears++;
        lines.push(`도전 ${first ? "첫 " : ""}클리어: ${cl.name}`);
      }
      break;
    }
    case "M03": {                                         // 자원 던전: 요일별 재화(월·목 금화/화·토 사료/수·일 코어/금 파편), 난이도 3단계
      const kind = ["CORE", "GOLD", "FOOD", "CORE", "GOLD", "SHARD", "FOOD"][new Date().getDay()];
      const table = { GOLD: [3000, 8000, 20000], FOOD: [60, 150, 400], CORE: [20, 50, 120], SHARD: [30, 80, 200] };
      const v = Math.round(table[kind][tier] * (cleared ? 1 : 0.3));
      if (kind === "GOLD") gold = v; else extra[kind] = v;
      lines.push(`자원 던전(${ECO.curName(kind)}) · 난이도 ${tier + 1}`);
      break;
    }
    case "M04": {                                         // 보스 점수 = 총 피해 / 챕터 배수
      const score = Math.round(runStats.bossDamage / Math.max(1, chapter.enemyMult));
      const best = save.modeRecords.M04 || 0;
      if (score > best) save.modeRecords.M04 = score;
      const grade = score >= 100000 ? "다이아" : score >= 40000 ? "플래티넘" : score >= 15000 ? "골드" : score >= 5000 ? "실버" : "브론즈";
      // 등급별 훈장·코어·SET07/16 수집품 상자(modes.csv M04)
      extra.MEDAL = { 다이아: 250, 플래티넘: 150, 골드: 80, 실버: 40, 브론즈: 20 }[grade];
      extra.CORE = { 다이아: 60, 플래티넘: 45, 골드: 30, 실버: 20, 브론즈: 10 }[grade];
      if (["다이아", "플래티넘", "골드"].includes(grade)) lines.push(...ECO.grant(save, { CHESTSET_SET07_SET16: 1 }));
      lines.push(`보스 점수 ${score.toLocaleString()} · ${grade}${score > best ? " (신기록)" : ""}`);
      break;
    }
    case "M05":                                           // 등반탑: 5층 TP 3 / 10층 별가루 100·인장 선택 30 / 20층 C06 / 30층 PT11
      if (cleared) {
        const f = runCfg.floor;
        save.modeRecords.M05 = Math.max(save.modeRecords.M05 || 0, f);
        if (f % 5 === 0) extra.TP = 3;
        if (f % 10 === 0) { extra.DUST = 100; extra.SEALBOX = 30; }
        if (f === 20) lines.push(...ECO.grant(save, { SEAL_C06: 30 }));
        if (f === 30) lines.push(...ECO.grant(save, { PET_PT11: 1 }));
        extra.MEDAL = 5 + f;
        extra.CORE = 5 + Math.floor(f / 2);
        lines.push(`${f}층 돌파!`);
      }
      break;
    case "M06": {                                         // 위험 구역: 파편·설계도·각성석·세트 수집품, 사망 시 절반
      const loot = 400 + chIndex * 20 + runStats.eliteKills * 60;
      extra.SHARD = cleared ? loot : Math.round(loot / 2);
      extra.BLUEPRINT = cleared ? 1 + (runStats.eliteKills >= 6 ? 1 : 0) : 0;
      extra.AWAKEN = cleared ? Math.min(3, 1 + Math.floor(runStats.eliteKills / 5)) : 0;
      if (cleared && Math.random() < 0.35) lines.push(...ECO.grant(save, { CHESTSET_SET04_SET10_SET13_SET17: 1 }));
      if (!cleared) pendingCollectibles = Math.floor(pendingCollectibles / 2);
      lines.push(cleared ? "탈출 성공 — 전리품 전량 반출" : "사망 — 전리품 절반 소실");
      break;
    }
    case "M07": {                                         // 무한 생존: 분당 훈장 2(상한 60) + 5분마다 무한 토큰 5, 기록 갱신 별가루 50
      const sec = Math.round(runTime);
      if (sec > (save.modeRecords.M07 || 0)) { save.modeRecords.M07 = sec; extra.DUST = 50; lines.push("생존 신기록!"); }
      extra.MEDAL = Math.min(60, Math.floor(runTime / 60) * 2);
      extra.INF_TOKEN = Math.floor(runTime / 300) * 5;
      break;
    }
    case "M08": {                                         // 원정: 각성석 3/6/10, 전설 설계도 1, SET09/18, 원정 토큰
      const reached = runCfg.stage - (cleared ? 0 : 1);
      const mul = cleared ? 1 : 0.5;
      extra.AWAKEN = Math.round([3, 6, 10][tier] * mul * (reached / runCfg.stages));
      extra.EXP_TOKEN = Math.round(20 * reached * mul);
      extra.DUST = Math.round(30 * reached * mul);
      if (cleared) {
        extra.BLUEPRINT = 1;
        lines.push(...ECO.grant(save, { CHESTSET_SET09_SET18: 1 }));
        openNow(ECO.chapterChest(chIndex));
      }
      lines.push(`원정 ${reached}/${runCfg.stages}단계 ${cleared ? "완주" : "도달"}`);
      break;
    }
    case "EV": {                                          // 이벤트 전투 결산
      const ev = runCfg.event;
      const a = ECO.activeEvents().find((x) => x.inst === ev.inst);
      const s = a && ECO.eventState(save, a);
      if (!s) break;
      if (ev.kind === "board") {
        s.pendingBattle = null;
        if (cleared) { lines.push("전투 칸 승리 — 보상 2배"); lines.push(...ECO.grant(save, { GOLD: 3000, DUST: 80 })); }
      } else if (ev.kind === "branch") {
        if (cleared) {
          s.path.push(ev.choice);
          lines.push(`노드 돌파 (깊이 ${s.path.length}/5)`, ...ECO.grant(save, { DUST: 30, CORE: 10 }));
          if (s.path.length >= 5) {
            const end = ECO.BRANCH_ENDINGS[(s.path[0] * 2 + s.path[4]) % 4];
            lines.push(`최종 보상: ${end.name}`, ...ECO.grant(save, end.reward));
            s.done++; s.path = [];
          }
        } else lines.push("노드 실패 — 지도 조각 소모");
      } else if (ev.kind === "hunt") {
        const d = ECO.HUNT_DIFF[ev.diff];
        const score = runStats.bossDamage / Math.max(1, chapter.enemyMult * d.mult);
        const gain = Math.min(20, Math.max(1, Math.floor(score / 3000))) * d.rew;
        const before = s.bars;
        s.bars = Math.min(100, s.bars + gain);
        runStats.huntTokens = Math.min(50, gain * 5);
        for (let k = Math.floor(before / 10); k < Math.floor(s.bars / 10); k++) lines.push(`${(k + 1) * 10}바 보상`, ...ECO.grant(save, ECO.HUNT_BAR_REWARD[k], { openNow: true }));
        if (before < 100 && s.bars >= 100) lines.push(...ECO.grant(save, { TITLE: "표적 사냥꾼" }), ...ECO.applyItem(save, "보스 전용 수집품", 1));
        lines.push(`표적 보스 체력 바 +${gain} (${s.bars}/100)`);
      } else if (ev.kind === "fort") {
        const pct = fort ? Math.max(0, fort.hp / fort.hpMax) : 0;
        runStats.fortTokens = cleared ? Math.round(10 + 20 * pct) : 5;
        lines.push(cleared ? `거점 방어 성공 — 봉화 체력 ${Math.round(pct * 100)}%` : "봉화 붕괴");
      }
      break;
    }
  }
  gold = Math.round((gold + chestGold) * (1 + stat("goldPct")));
  save = applyRunReward(save, runId, {
    accountXpGain: Math.round(accXp * (1 + stat("accXpPct"))), goldGain: gold, dustGain: dust,
    chapterId: chapter.id, cleared: isMain && cleared, survivalS: runTime,
  });
  for (const k in extra) if (extra[k] > 0) ECO.grant(save, { [k]: extra[k] });

  // 이벤트 참여 토큰
  lines.push(...ECO.eventOnRunEnd(save, {
    mode: runCfg.mode, cleared, challengeFirst, env: chapter.env, runTime, kills: runStats.kills, bossKills: runStats.bossKills,
    hunt: runCfg.event?.kind === "hunt", huntTokens: runStats.huntTokens, fort: runCfg.event?.kind === "fort", fortTokens: runStats.fortTokens,
  }, save.account.level, highestClearedIndex() + 1));

  // 수집품 확정
  const gotCols = [];
  for (let i = 0; i < pendingCollectibles; i++) gotCols.push(rollCollectible());

  // 누적 통계 → 미션·업적 진행
  const st = save.stats;
  st.runs++; if (cleared) st.clears++;
  st.kills += runStats.kills; st.bossKills += runStats.bossKills; st.eliteKills += runStats.eliteKills;
  st.evolutions += runStats.evolutions; st.revives += runStats.revives; st.chests += runStats.chests;
  st.gems += runStats.gems; st.damage += Math.round(damageDealt);
  st.survivalMin = Math.max(st.survivalMin, Math.floor(runTime / 60));
  const isM = (m) => runCfg.mode === m;
  const activeColSets = SETS.filter((s) => COLLECTIBLES.filter((c) => c.setId === s.id && save.collectibles[c.id]).length >= 3).length;
  advanceMissions({
    mainRuns: isM("M01") ? 1 : 0, mainClears: isM("M01") && cleared ? 1 : 0,
    mainKills: isM("M01") ? runStats.kills : 0, mainGems: isM("M01") ? runStats.gems : 0, mainElites: isM("M01") ? runStats.eliteKills : 0,
    evolutions: runStats.evolutions, dungeonRuns: isM("M03") ? 1 : 0, challengeRuns: isM("M02") ? 1 : 0, challengeFirst: challengeFirst ? 1 : 0,
    bossScoreRuns: isM("M04") ? 1 : 0, towerClears: isM("M05") && cleared ? 1 : 0,
    petClears: save.activePet && cleared ? 1 : 0, altCharRuns: save.character !== "C01" ? 1 : 0,
    abilityUses: runStats.abilityUses, darkGems: runStats.darkGems, statusDmg: Math.round(runStats.statusDmg), midBossNoHit: runStats.midBossNoHit,
    fastClears: isM("M01") && cleared && runCfg.time.id === "fast" ? 1 : 0, presetRuns: runStats.presetRun ? 1 : 0,
    endless5: isM("M07") && runTime >= 300 ? 1 : 0, endless15: isM("M07") && runTime >= 900 ? 1 : 0,
    hazardEscape: isM("M06") && cleared ? 1 : 0, expedRuns: isM("M08") ? 1 : 0, expedComplete: isM("M08") && cleared ? 1 : 0,
    evoKinds: runStats.evoKinds, clearChars: cleared ? [save.character] : [], modes: [runCfg.mode],
    setBonusClears: cleared && activeColSets >= 3 ? 1 : 0, stars: starsGained,
    fullNoHitBoss: isM("M01") && cleared && runCfg.time.id === "full" && starTrack.bossNoHit ? 1 : 0,
  });
  const drops = chestOut;
  save.lastBuild = { attack: Object.keys(player.skills), passive: Object.keys(player.passives) };
  if (cleared) {
    const have = new Set([...save.lastBuild.attack, ...save.lastBuild.passive]);
    for (const b of ECO.BUILDS) {
      if (b.essential.every((x) => have.has(x)) && !save.buildClears.includes(b.id)) { save.buildClears.push(b.id); lines.push(`빌드 달성: ${b.name}`); }
    }
  }
  // 다음 챕터 해금
  let unlockedMsg = "";
  if (isMain && cleared && chIndex + 1 < CHAPTERS.length) {
    const next = CHAPTERS[chIndex + 1];
    if (!save.progress.chapters[next.id]?.unlocked) {
      save.progress.chapters[next.id] = { ...(save.progress.chapters[next.id] || { cleared: false, bestClearS: null }), unlocked: true };
      unlockedMsg = `${stageLabel(next)} 열림!`;
      selectedChapterId = next.id;
    }
  }
  writeSave(save);

  const modeName = MODES.find((m) => m.id === runCfg.mode)?.name || "이벤트 전투";
  elResultTitle.textContent = cleared
    ? (isMain ? `성공! — ${stageLabel(chapter)}` : `${modeName} 성공`)
    : (runCfg.mode === "M04" || runCfg.mode === "M07" ? `${modeName} 종료` : "아쉬워요! 다시 도전해요");
  const extraRows = Object.entries(extra).filter(([, v]) => v > 0)
    .map(([k, v]) => `${ECO.curIcon(k)} ${ECO.curName(k)} +${v.toLocaleString()}`).join("  ");
  const colRows = gotCols.map((c) => `<span style="color:${RARITY[c.rarity].color}">${c.name}${c.dup ? "(중복)" : ""}</span>`).join(", ");
  elResultTable.innerHTML = `
    <tr><td>생존 시간</td><td class="v">${formatTime(runTime)}</td></tr>
    <tr><td>도달 레벨</td><td class="v">${player.lvl}</td></tr>
    <tr><td>${chapter.theme ? "정화한 수" : "처치 수"}</td><td class="v">${killCount}</td></tr>
    <tr><td>누적 피해</td><td class="v">${Math.round(damageDealt).toLocaleString()}</td></tr>
    <tr><td>계정 XP 획득</td><td class="v">+${accXp}</td></tr>
    <tr><td>금화 획득</td><td class="v">+${gold}${firstClear ? " (첫 클리어)" : ""}${chestGold ? ` (상자 +${chestGold})` : ""}</td></tr>
    ${dust ? `<tr><td>별가루 획득</td><td class="v">+${dust}</td></tr>` : ""}
    ${extraRows ? `<tr><td>추가 보상</td><td class="v">${extraRows}</td></tr>` : ""}
    ${lines.map((l) => `<tr><td colspan="2" style="color:#ffd76a;text-align:center">${l}</td></tr>`).join("")}
    ${colRows ? `<tr><td>수집품</td><td class="v">${colRows}</td></tr>` : ""}
    ${drops.length ? `<tr><td>장비 상자</td><td class="v">${drops.map((d) =>
      `<span style="color:${d.color}">${d.text}</span>`).join(", ")}</td></tr>` : ""}
    ${unlockedMsg ? `<tr><td colspan="2" style="color:#7ee08a;text-align:center;padding-top:8px">🔓 ${unlockedMsg}</td></tr>` : ""}
  `;
  elResult.classList.remove("hidden");
  playSfx("goldReward", 0.6);
  log(cleared ? "챕터 클리어, 보상 지급 완료" : "사망, 결과 화면 표시");
}

// ---------- Render ----------
function worldToScreen(x, y) {
  return { x: x - cam.x + viewW / 2, y: y - cam.y + viewH / 2 };
}

ctx.imageSmoothingEnabled = false; // 픽셀아트 원본을 흐릿하게 만들지 않음(일관된 그림체 유지)

let floorPattern = null, floorPatternKey = null;
function floorImage() { return SPRITES[chapter?.floor] || SPRITES.floor_ground; }   // 테마 바닥(448px 타일) 또는 기본 16px 타일
function getFloorPattern() {
  const key = chapter?.floor || "floor_ground";
  const img = floorImage();
  if (!img.complete || !img.naturalWidth) return null;
  if (!floorPattern || floorPatternKey !== key) { floorPattern = ctx.createPattern(img, "repeat"); floorPatternKey = key; }
  return floorPattern;
}

// 스프라이트 하나를 그림자+바운스+틴트+피격섬광까지 포함해 그리는 공통 루틴.
function drawEntitySprite(spriteImg, screenX, screenY, opts) {
  const {
    size = 48, facing = 1, bob = 0, tint = null, flash = false,
    spawnScale = 1, alpha = 1, glow = null, smooth = false,
  } = opts;
  if (!spriteImg || !spriteImg.complete || !spriteImg.naturalWidth) return;

  // 기본은 정사각(16×16 타일). width/height를 주면 그 비율로(주인공 프레임처럼 세로로 긴 그림)
  const drawH = (opts.height ?? size) * spawnScale;
  const drawW = (opts.width ?? size) * spawnScale;
  const footY = screenY + size * 0.32; // 발밑 기준선

  ctx.save();
  ctx.globalAlpha = alpha;

  // 발밑 그림자(타원)
  ctx.beginPath();
  ctx.ellipse(screenX, footY + 2, drawW * 0.32, drawW * 0.13, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill();

  if (glow) {
    const grad = ctx.createRadialGradient(screenX, footY - drawH * 0.4, 2, screenX, footY - drawH * 0.4, drawW * 1.1);
    grad.addColorStop(0, glow);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(screenX - drawW * 1.2, footY - drawH * 1.6, drawW * 2.4, drawH * 2.2);
  }

  let img = spriteImg;
  if (flash) img = tintedSprite(spriteImg, "rgba(255,255,255,0.85)", spriteImg.src + "#flash");
  else if (tint) img = tintedSprite(spriteImg, tint, spriteImg.src + tint);

  ctx.translate(screenX, footY - drawH * 0.5 + bob);
  ctx.scale(facing, 1);
  if (smooth) ctx.imageSmoothingEnabled = true;     // 고해상도 프레임을 축소할 때만 보간(픽셀 타일은 그대로)
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.imageSmoothingEnabled = false;
  ctx.restore();
}

// 주인공(호야·민지) 프레임 선택: 쓰러짐 > 피격 > 점프 연출 > 공격 > 이동(달리기/걷기) > 서 있기
const HERO_DRAW_H = 77;   // 캔버스 143px 중 '서 있기' 키 112px → 화면에서 약 60px (두 주인공 동일 크기)
function heroFrame() {
  const f = heroDef().frames;
  const pick = (list, t) => list[Math.min(list.length - 1, Math.floor(t * list.length))];
  // 원거리(야구방망이·피구공) 모드면 전용 프레임(ranged*)이 있을 때 그것을, 없으면 원본 프레임을 쓴다.
  // 근거리는 원본 공격 프레임(호야 칼·민지 연필). 무기를 따로 덧그리지 않는다(사용자 결정 2026-09-22: 코덱스 무기 레이어 대신 원본 그림).
  const ranged = sgRunProfile?.weaponMode === "ranged";
  const loaded = (list) => list && list.length && list.every((im) => im.complete && im.naturalWidth);   // 그림이 없거나 아직이면 원본으로
  const alt = (base, r) => (ranged && loaded(r) ? r : base);
  if (player.downed) return alt(f.down, f.rangedDown)[0];
  if (player.hitFlashT > 0.06 && f.hurt) return alt(f.hurt, f.rangedHurt)[0];
  if (player.jumpT > 0) return pick(alt(f.jump, f.rangedJump), 1 - player.jumpT / JUMP_ANIM_S);
  if (player.attackT > 0) {
    const list = ranged && loaded(f.ranged) ? f.ranged : f.attack;
    if (list && list.length) return pick(list, 1 - player.attackT / ATTACK_ANIM_S);
  }
  if (player.moving) {
    const running = player.buffKind === "speed" && player.buffT > 0;
    const list = running ? alt(f.run, f.rangedRun) : alt(f.walk, f.rangedWalk);
    return list[Math.floor(player.animT * 1.1) % list.length];   // animT는 이동 중 초당 8 증가 → 약 9fps
  }
  return alt(f.idle, f.rangedIdle)[0];
}
function drawHero(screenX, screenY) {
  const img = heroFrame();
  if (!img.complete || !img.naturalWidth) return;
  const h = HERO_DRAW_H, w = h * img.naturalWidth / img.naturalHeight;
  // size=44를 그대로 넘겨 발 기준선(footY = screenY + 44×0.32)을 기존 기사와 같게 유지한다
  const bob = player.downed ? 0 : player.moving ? Math.abs(Math.sin(player.animT)) * 1.5 : Math.sin(player.animT) * 0.8;
  const blinking = player.invulnT > 0 && !player.downed && Math.floor(runTime * 20) % 2 === 0;
  ctx.save();ctx.translate(screenX,screenY+14);ctx.rotate(sgWeapon.bodyLean());ctx.translate(-screenX,-screenY-14);
  drawEntitySprite(img, screenX, screenY, {
    size: 44, width: w, height: h, facing: player.facing, bob, smooth: true,
    flash: player.hitFlashT > 0.14 || blinking,
    alpha: player.invulnT > 0 ? 0.7 : 1,
    glow: "rgba(255,220,150,0.18)",
  });
  ctx.restore();
}

function drawHpBar(screenX, topY, w, ratio, color) {
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(screenX - w / 2, topY, w, 5);
  ctx.fillStyle = color; ctx.fillRect(screenX - w / 2, topY, w * Math.max(0, ratio), 5);
  ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(screenX - w / 2 + 0.5, topY + 0.5, w - 1, 4);
}

function drawDecorItem(d) {
  const s = worldToScreen(d.x, d.y);
  if (s.x < -80 || s.x > viewW + 80 || s.y < -80 || s.y > viewH + 80) return;
  if (d.h) {                                   // 고해상도 소품(환경 테마): 높이 기준으로 부드럽게 축소, 발밑 그림자
    if (d.opened && (d.litter || d.bin)) return; // 주운 쓰레기·정리한 쓰레기통은 사라진다
    const base = SPRITES[d.sprite];
    if (!base.complete || !base.naturalWidth) return;
    if (d.bin && d.cleanT > 0) {               // 쓰레기통 정리 진행 고리
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(s.x, s.y - d.h * 0.7, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, d.cleanT / 1.2)); ctx.stroke();
      ctx.strokeStyle = "rgba(120,220,100,0.9)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    if (d.bossLitter && d.expire) {            // 보스가 뿌린 쓰레기: 남은 시간만큼 깜빡임
      const left = d.expire - runTime;
      if (chapter?.theme === 1) {
        ctx.save(); ctx.strokeStyle = left < 3 ? "#d08b36" : "#559c6a"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y + 4, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left / 8)); ctx.stroke(); ctx.restore();
      } else if (left < 3 && Math.floor(runTime * 6) % 2 === 0) return;
    }
    if (d.litter) {                            // 주울 수 있는 쓰레기: 바닥 무늬에 묻히지 않게 초록 고리(보스가 뿌린 것은 더 크게)
      const pulse = 0.6 + 0.4 * Math.sin(runTime * 5 + d.flicker);
      const rr = (d.bossLitter ? 22 : 16) * pulse + 6;
      ctx.save();
      ctx.strokeStyle = d.bossLitter ? "rgba(120,230,110,0.85)" : "rgba(255,255,255,0.75)"; ctx.lineWidth = d.bossLitter ? 3 : 2;
      ctx.beginPath(); ctx.arc(s.x, s.y + 4, rr, 0, 7); ctx.stroke();
      ctx.fillStyle = d.bossLitter ? "rgba(120,230,110,0.18)" : "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.arc(s.x, s.y + 4, rr, 0, 7); ctx.fill();
      ctx.restore();
    }
    const img = d.chest && d.opened ? tintedSprite(base, "rgba(40,30,20,0.55)", d.sprite + "#opened") : base;
    const h = d.h, w = h * base.naturalWidth / base.naturalHeight;
    if (d.chest && !d.opened) {                // 재활용 봉투: 초록 반짝임 = "다가가면 받을 수 있어요"
      const glint = 0.5 + 0.5 * Math.sin(runTime * 3 + d.flicker);
      const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, h * 1.4);
      grad.addColorStop(0, `rgba(120,230,120,${0.35 * glint})`); grad.addColorStop(1, "rgba(120,230,120,0)");
      ctx.fillStyle = grad; ctx.fillRect(s.x - h * 1.5, s.y - h * 1.5, h * 3, h * 3);
    }
    ctx.save();
    ctx.globalAlpha = d.opened ? 0.6 : 1;
    ctx.beginPath(); ctx.ellipse(s.x, s.y + h * 0.42, w * 0.4, h * 0.12, 0, 0, 7); ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fill();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, s.x - w / 2, s.y - h * 0.55, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();
    return;
  }
  const size = 20 * d.scale;

  if (d.chest) {
    // 상자: 미개봉이면 반짝임으로 "다가가면 열 수 있다"는 신호를 준다. 개봉 후엔 어둡게 바래서 회수 완료를 표시.
    const img = d.opened ? tintedSprite(SPRITES.prop_chest, "rgba(20,15,10,0.55)", "chest_opened") : SPRITES.prop_chest;
    if (!d.opened) {
      const glint = 0.5 + 0.5 * Math.sin(runTime * 3 + d.flicker);
      const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, size * 1.8);
      grad.addColorStop(0, `rgba(255,225,120,${0.3 * glint})`);
      grad.addColorStop(1, "rgba(255,225,120,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(s.x - size * 2, s.y - size * 2, size * 4, size * 4);
    }
    ctx.save();
    ctx.globalAlpha = d.opened ? 0.7 : 1;
    ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
    ctx.restore();
    return;
  }

  const img = SPRITES[d.sprite];
  if (d.glow) {
    const flick = 0.75 + 0.25 * Math.sin(runTime * 6 + d.flicker);
    const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, size * 3.2 * flick);
    grad.addColorStop(0, `rgba(255,170,80,${0.35 * flick})`);
    grad.addColorStop(1, "rgba(255,170,80,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - size * 3.5, s.y - size * 3.5, size * 7, size * 7);
    ctx.save();
    ctx.translate(s.x, s.y - size * 0.5 * flick);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.drawImage(img, s.x - size / 2, s.y - size / 2, size, size);
  }
}

function drawGem(g) {
  const s = worldToScreen(g.x, g.y);
  const bob = Math.sin(runTime * 4 + (g.bob || 0)) * 3;
  const scale = g.spawnT ?? 1;
  const sprout = chapter?.theme ? SPRITES.item_sprout : null;
  if (sprout && sprout.complete && sprout.naturalWidth) {   // 환경 테마: 경험치 보석 대신 새싹
    const h = 18 * scale, w = h * sprout.naturalWidth / sprout.naturalHeight;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 1.1);
    grad.addColorStop(0, "rgba(180,255,160,0.5)"); grad.addColorStop(1, "rgba(180,255,160,0)");
    ctx.fillStyle = grad; ctx.fillRect(-h * 1.1, -h * 1.1, h * 2.2, h * 2.2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sprout, -w / 2, -h / 2, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();
    return;
  }
  const r = 7 * scale;
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  ctx.rotate(runTime * 1.6);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.5);
  grad.addColorStop(0, "rgba(160,220,255,0.55)");
  grad.addColorStop(1, "rgba(160,220,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(-r * 2.5, -r * 2.5, r * 5, r * 5);
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r * 0.75, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.75, 0); ctx.closePath();
  ctx.fillStyle = "#bfe9ff"; ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 0.3, 0); ctx.lineTo(0, r * 0.5); ctx.lineTo(-r * 0.3, 0); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawProjectile(p) {
  if (chapter?.theme === 1 && !["S01", "S02", "S09"].includes(p.skillId) && themeFx.projectile(ctx, p, worldToScreen)) return;
  // 궤적
  for (let i = 0; i < p.trail.length; i++) {
    const t = p.trail[i];
    const s = worldToScreen(t.x, t.y);
    const a = (i / p.trail.length) * 0.4;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, p.shape === "spear" ? 4 : 3, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const s = worldToScreen(p.x, p.y);
  const angle = p.angle ?? Math.atan2(p.vy, p.vx);
  ctx.save();
  ctx.translate(s.x, s.y);

  // 발광
  const glowR = p.shape === "jar" ? 14 : 11;
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  grad.addColorStop(0, "rgba(255,255,255,0.85)");
  grad.addColorStop(0.35, p.color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, glowR, 0, 7); ctx.fill();

  ctx.rotate(angle);
  if (p.shape === "spear") {
    // A recognisable two-prong litter grabber.
    ctx.fillStyle = p.color;
    ctx.strokeStyle='#5788a0';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(9,0);ctx.moveTo(7,0);ctx.lineTo(13,-6);ctx.lineTo(18,-5);ctx.moveTo(7,0);ctx.lineTo(13,6);ctx.lineTo(18,5);ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(2, 1.4); ctx.lineTo(-6, 0); ctx.lineTo(2, -1.4); ctx.closePath(); ctx.fill();
  } else if (p.shape === "pellet") {
    ctx.fillStyle = "#fff3d0";
    ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill();
  } else if (p.shape === "jar") {
    ctx.rotate(p.spin);
    ctx.fillStyle = "#8a5a32";
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#83c86a";
    ctx.beginPath(); ctx.ellipse(3,-6,5,2.7,-.6,0,7);ctx.fill();
  } else {
    // A rounded water drop replaces the old arrowhead.
    ctx.fillStyle = p.color;
    ctx.beginPath();ctx.ellipse(0,0,7,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, 1.2); ctx.lineTo(0, -1.2); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawDarkZones() {
  if (darkRatio() <= 0) return;
  const x0 = Math.floor((cam.x - viewW / 2) / DARK_CELL) - 1, x1 = Math.floor((cam.x + viewW / 2) / DARK_CELL) + 1;
  const y0 = Math.floor((cam.y - viewH / 2) / DARK_CELL) - 1, y1 = Math.floor((cam.y + viewH / 2) / DARK_CELL) + 1;
  for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
    const c = darkCenter(ix, iy);
    if (!c) continue;
    const s = worldToScreen(c.x, c.y);
    if (chapter?.theme === 1) { themeFx.smog(ctx, s.x, s.y, DARK_R, runTime + ix + iy, 1, true); continue; }
    const t1 = chapter?.theme === 1;             // 악취 구역: 누런 초록 안개 / 옛 챕터: 어둠 지대
    const g = ctx.createRadialGradient(s.x, s.y, DARK_R * 0.3, s.x, s.y, DARK_R);
    g.addColorStop(0, t1 ? "rgba(110,120,30,0.50)" : "rgba(8,4,18,0.72)"); g.addColorStop(0.8, t1 ? "rgba(120,130,40,0.35)" : "rgba(10,6,22,0.55)"); g.addColorStop(1, t1 ? "rgba(120,130,40,0)" : "rgba(10,6,22,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, DARK_R, 0, 7); ctx.fill();
    ctx.strokeStyle = t1 ? "rgba(90,110,20,0.35)" : "rgba(170,130,255,0.18)"; ctx.setLineDash([4, 8]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, DARK_R * 0.92, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}

// 방어 거점 봉화: 체력 있는 구조물(이벤트 EV_T4)
function drawFort() {
  if (!fort) return;
  const s = worldToScreen(fort.x, fort.y);
  const flick = 0.85 + 0.15 * Math.sin(runTime * 6);
  const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, fort.r * 2.2 * flick);
  g.addColorStop(0, fort.hitT > 0 ? "rgba(255,90,70,0.55)" : "rgba(255,210,120,0.5)"); g.addColorStop(1, "rgba(255,170,80,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, fort.r * 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = "#4a3b2a"; ctx.fillRect(s.x - 16, s.y - 6, 32, 18);
  ctx.strokeStyle = "#c9a46a"; ctx.lineWidth = 2; ctx.strokeRect(s.x - 16, s.y - 6, 32, 18);
  const img = SPRITES.prop_torch;
  if (img.complete) ctx.drawImage(img, s.x - 26, s.y - 52 * flick, 52, 52);
  drawHpBar(s.x, s.y - 58, 70, Math.max(0, fort.hp / fort.hpMax), "#ffc04a");
}
function drawBeacon() {
  drawFort();
  if (!beacon) return;
  const s = worldToScreen(beacon.x, beacon.y);
  const flick = 0.85 + 0.15 * Math.sin(runTime * 7);
  const t1 = chapter?.theme === 1;                       // 정화 장치(분리수거함): 초록 안전 구역 / 옛 챕터: 봉화(횃불)
  const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, beacon.r * 1.4 * flick);
  g.addColorStop(0, t1 ? "rgba(140,230,120,0.40)" : "rgba(255,200,110,0.45)"); g.addColorStop(1, t1 ? "rgba(120,220,100,0)" : "rgba(255,170,80,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, beacon.r * 1.4, 0, 7); ctx.fill();
  ctx.strokeStyle = t1 ? "rgba(80,180,70,0.6)" : "rgba(255,210,130,0.6)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(s.x, s.y, beacon.r, 0, 7); ctx.stroke();
  if (t1) {
    themeFx.beacon(ctx, s.x, s.y, beacon.r, runTime, dist(player.x, player.y, beacon.x, beacon.y) < beacon.r);
    const bins = SPRITES.t1_prop_bins;
    if (bins.complete && bins.naturalWidth) {
      const h = 96, w = h * bins.naturalWidth / bins.naturalHeight;
      ctx.save(); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bins, s.x - w / 2, s.y - h * 0.7 - 3 * flick, w, h);
      ctx.restore(); ctx.imageSmoothingEnabled = false;
    }
  } else {
    const img = SPRITES.prop_torch;
    if (img.complete) ctx.drawImage(img, s.x - 22, s.y - 40 * flick, 44, 44);
  }
}

function drawField(f) {
  if (chapter?.theme === 1 && f.hostile) {
    const s = worldToScreen(f.x, f.y); themeFx.smog(ctx, s.x, s.y, f.radius, runTime, f.life / f.maxLife); return;
  }
  const s = worldToScreen(f.x, f.y);
  const t = f.life / f.maxLife;
  const pulse = 0.85 + 0.15 * Math.sin(runTime * 5);
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 2);
  const g = ctx.createRadialGradient(s.x, s.y, f.radius * 0.2, s.x, s.y, f.radius * pulse);
  g.addColorStop(0, f.color + "55");
  g.addColorStop(0.7, f.color + "22");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s.x, s.y, f.radius * pulse, 0, 7); ctx.fill();
  ctx.strokeStyle = f.color; ctx.globalAlpha = 0.35 * Math.min(1, t * 2); ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]); ctx.lineDashOffset = -runTime * 20;
  ctx.beginPath(); ctx.arc(s.x, s.y, f.radius, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawMinion(m) {
  if(m.guardianPet){const im=sgPetImages[m.guardianPet];const pt=worldToScreen(m.x,m.y);if(im?.complete){ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(im,pt.x-29,pt.y-38+Math.sin(runTime*3)*2,58,58);if(R.friendshipLevel(sgRunProfile)>=5){ctx.fillStyle='#ffdc70';ctx.font='14px sans-serif';ctx.fillText('★',pt.x+15,pt.y-25);}ctx.restore();}return;}

  const s = worldToScreen(m.x, m.y);
  const bob = Math.sin(runTime * 4 + m.idx) * 3;
  if (m.pet && m.hpMax) {
    if (m.downT > 0) {             // 쓰러진 펫: 흐리게 + 부활 카운트다운
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#ffb0a0"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${Math.ceil(m.downT)}`, s.x, s.y - 12);
      return;
    }
    if (m.hp < m.hpMax) drawHpBar(s.x, s.y - 18, 24, Math.max(0, m.hp / m.hpMax), "#8fe0a0");
  }
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  g.addColorStop(0, m.color + "cc"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
  ctx.fillStyle = m.color;
  if (m.stationary) {            // 포탑: 사각 받침 + 포신
    ctx.fillRect(-7, -4, 14, 12);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(-2, -12, 4, 10);
  } else if (m.melee) {          // 늑대: 삼각 실루엣
    ctx.beginPath(); ctx.moveTo(-8, 6); ctx.lineTo(0, -8); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill();
  } else {                       // 드론: 마름모
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, 0); ctx.lineTo(0, 8); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function drawTrap(t) {
  const s = worldToScreen(t.x, t.y);
  const blink = 0.4 + 0.6 * Math.abs(Math.sin(runTime * 4));
  ctx.save();
  ctx.fillStyle = "#4a3a2a";
  ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, 7); ctx.fill();
  ctx.fillStyle = t.color; ctx.globalAlpha = blink;
  ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, 7); ctx.fill();
  ctx.restore();
}

function drawSwing(sw) {
  const s = worldToScreen(player.x, player.y);
  const t = sw.life / sw.maxLife;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.globalAlpha = t * 0.8;
  const g = ctx.createRadialGradient(0, 0, sw.reach * 0.2, 0, 0, sw.reach);
  g.addColorStop(0, "rgba(255,255,255,0.1)");
  g.addColorStop(0.7, sw.color + "99");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.arc(0, 0, sw.reach, sw.angle - sw.half, sw.angle + sw.half);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2 * t;
  ctx.beginPath(); ctx.arc(0, 0, sw.reach * (0.6 + 0.4 * (1 - t)), sw.angle - sw.half, sw.angle + sw.half); ctx.stroke();
  ctx.restore();
}

function drawBeam(b) {
  const s = worldToScreen(player.x, player.y);
  const fade = Math.min(1, b.life / 0.25);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(b.angle);
  ctx.globalAlpha = fade;
  const pulse = 0.85 + 0.15 * Math.sin(runTime * 30);
  const w = b.widthPx * pulse;
  const grad = ctx.createLinearGradient(0, 0, b.lenPx, 0);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.15, b.color);
  grad.addColorStop(1, "rgba(255,220,120,0.05)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, -w / 2, b.lenPx, w);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(0, -w / 6, b.lenPx, w / 3);
  // 발사구 광원
  const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 2.2);
  mg.addColorStop(0, "rgba(255,245,200,0.9)"); mg.addColorStop(1, "rgba(255,245,200,0)");
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(0, 0, w * 2.2, 0, 7); ctx.fill();
  ctx.restore();
}

function drawStrike(st) {
  const s = worldToScreen(st.x, st.y);
  const t = 1 - st.delay / st.maxDelay; // 0→1
  ctx.save();
  // 예고 원
  ctx.strokeStyle = `rgba(160,220,255,${0.4 + 0.5 * t})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(s.x, s.y, st.radiusPx, 0, 7); ctx.stroke();
  ctx.fillStyle = `rgba(160,220,255,${0.12 * t})`;
  ctx.beginPath(); ctx.arc(s.x, s.y, st.radiusPx * t, 0, 7); ctx.fill();
  // 하늘에서 내려오는 번개 예고선
  ctx.globalAlpha = 0.25 + 0.5 * t;
  ctx.strokeStyle = st.color; ctx.lineWidth = 1 + 2 * t;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - viewH);
  ctx.lineTo(s.x + (Math.random() - 0.5) * 6, s.y);
  ctx.stroke();
  ctx.restore();
}

function drawBlast(b) {
  if (chapter?.theme === 1) { const s = worldToScreen(b.x, b.y); themeFx.blast(ctx, b, s.x, s.y); return; }
  const s = worldToScreen(b.x, b.y);
  const t = 1 - b.life / b.maxLife; // 0→1 확산
  const r = b.radius * (0.35 + 0.75 * t);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  const g = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r);
  g.addColorStop(0, "rgba(255,255,230,0.85)");
  g.addColorStop(0.5, b.color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2 * (1 - t);
  ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.stroke();
  ctx.restore();
}

function drawArc(a) {
  const alpha = a.life / a.maxLife;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = a.color;
  ctx.lineWidth = 3;
  ctx.shadowColor = a.color; ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i < a.points.length - 1; i++) {
    const p0 = worldToScreen(a.points[i].x, a.points[i].y);
    const p1 = worldToScreen(a.points[i + 1].x, a.points[i + 1].y);
    ctx.moveTo(p0.x, p0.y);
    // 지그재그 번개
    const segs = 4;
    for (let k = 1; k <= segs; k++) {
      const f = k / segs;
      const jitter = k === segs ? 0 : (Math.random() - 0.5) * 12;
      const nx = p0.x + (p1.x - p0.x) * f + jitter;
      const ny = p0.y + (p1.y - p0.y) * f + jitter;
      ctx.lineTo(nx, ny);
    }
  }
  ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = "#ffffff"; ctx.stroke();
  ctx.restore();
}

function drawHitFx(fx) {
  if (chapter?.theme === 1) {
    const s = worldToScreen(fx.x, fx.y);
    themeFx.hit(ctx, s.x, s.y, 1 - fx.life / fx.maxLife, fx.vfxKind, fx.dir); return;
  }
  const s = worldToScreen(fx.x, fx.y);
  const t = fx.life / fx.maxLife;
  ctx.save();
  ctx.globalAlpha = t;
  ctx.strokeStyle = fx.color || "#ffe9a8";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(s.x, s.y, (1 - t) * 18 + 4, 0, 7); ctx.stroke();
  // 타격 방향으로 튀는 스파크(타격감)
  if (fx.dir) {
    const base = Math.atan2(fx.dir.y, fx.dir.x);
    ctx.strokeStyle = "#fff6d8";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = base + (i - 1) * 0.42;
      const len = (1 - t) * 20 + 6;
      ctx.beginPath();
      ctx.moveTo(s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 4);
      ctx.lineTo(s.x + Math.cos(a) * len, s.y + Math.sin(a) * len);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 회전 낫(S05) — 상시 유지형이라 매 프레임 위치를 계산해 그린다.
function drawOrbitBlades() {
  const st = player.skills.S05;
  if (!st) return;
  const def = effectiveSkill("S05");
  const mods = effectiveMods("S05");
  const radius = def.radiusU * U * mods.areaMul * (1 + totalAreaPct());
  const ps = worldToScreen(player.x, player.y);
  for (let i = 0; i < mods.blades; i++) {
    const a = player.orbitAngle + (i / mods.blades) * Math.PI * 2;
    const bx = ps.x + Math.cos(a) * radius, by = ps.y + Math.sin(a) * radius;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a + Math.PI / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
    g.addColorStop(0, "rgba(255,160,160,0.55)"); g.addColorStop(1, "rgba(255,120,120,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill();
    // Four broad paper blades: a pinwheel, readable on a phone.
    for(let leaf=0;leaf<4;leaf++){ctx.rotate(Math.PI/2);ctx.fillStyle=leaf%2?'#d9b1ef':'#8cbfdd';ctx.strokeStyle='#655a91';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-13);ctx.quadraticCurveTo(13,-12,9,-2);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.fillStyle='#fff0a4';ctx.beginPath();ctx.arc(0,0,3,0,7);ctx.fill();
    ctx.restore();
  }
  // 궤도 링
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ff9a9a"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ps.x, ps.y, radius, 0, 7); ctx.stroke();
  ctx.restore();
}

function drawTouchJoystick() {
  if (!touchJoy.active) return;
  const ox = touchJoy.ox, oy = touchJoy.oy;
  ctx.save();
  // 바깥 링
  ctx.strokeStyle = "rgba(255,230,180,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(ox, oy, JOY_RADIUS, 0, 7); ctx.stroke();
  ctx.fillStyle = "rgba(20,14,10,0.25)";
  ctx.beginPath(); ctx.arc(ox, oy, JOY_RADIUS, 0, 7); ctx.fill();
  // 스틱
  const sx = ox + touchJoy.dx, sy = oy + touchJoy.dy;
  const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26);
  g.addColorStop(0, "rgba(255,240,200,0.9)");
  g.addColorStop(1, "rgba(255,200,120,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(255,225,160,0.85)";
  ctx.beginPath(); ctx.arc(sx, sy, 18, 0, 7); ctx.fill();
  ctx.restore();
}

function drawMuzzleFlash() {
  if (!player.muzzleT || player.muzzleT <= 0) return;
  const s = worldToScreen(player.x, player.y);
  const t = player.muzzleT / 0.12;
  const a = player.aimAngle || 0;
  ctx.save();
  ctx.translate(s.x + Math.cos(a) * 16, s.y + Math.sin(a) * 16);
  ctx.rotate(a);
  ctx.globalAlpha = t;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 18 * t);
  g.addColorStop(0, "rgba(255,250,220,0.95)"); g.addColorStop(1, "rgba(255,200,100,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 18 * t, 10 * t, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawDeathFx(fx) {
  if (chapter?.theme === 1) {
    const s = worldToScreen(fx.x, fx.y);
    themeFx.purify(ctx, s.x, s.y, 1 - fx.life / fx.maxLife, fx.size || 64); return;
  }
  const s = worldToScreen(fx.x, fx.y);
  const t = fx.life / fx.maxLife;
  ctx.save();
  ctx.globalAlpha = t;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = (1 - t) * 22;
    ctx.fillStyle = fx.color;
    ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 3 * t, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------- 보스: 어울리는 공개 스프라이트를 찾지 못해 코드로 직접 그린다(ASSET_CREDITS.md 참조) ----------
function drawBoss() {
  const s = worldToScreen(boss.x, boss.y);
  const sway = Math.sin(runTime * 1.6) * 0.12;
  const phase2 = boss.phase === 2;
  // 표시 크기는 판정 반경과 분리(가독성 위해 보스별 배율 허용)
  const scale = (boss.radiusU * U / 1.1) * (bossDef.drawScale || 1);
  const pal = phase2 ? bossDef.palette2 : bossDef.palette;

  ctx.save();
  ctx.translate(s.x, s.y);

  // 어두운 배경에서 실루엣이 묻히지 않도록 외곽 발광 + 검은 테두리를 깐다
  const auraR = scale * 2.0;
  const aura = ctx.createRadialGradient(0, 0, scale * 0.4, 0, 0, auraR);
  aura.addColorStop(0, `rgba(${hexToRgb(pal.accent)},0.16)`);
  aura.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, auraR, 0, 7); ctx.fill();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = Math.max(2, scale * 0.12);

  // 그림자(공통)
  ctx.beginPath(); ctx.ellipse(0, scale * 1.15, scale * 1.1, scale * 0.35, 0, 0, 7);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();

  const flash = boss.flashT > 0;
  const body = flash ? "#ffffff" : pal.body;
  const dark = flash ? "#ffffff" : pal.bodyDark;

  if (bossDef.img) {                            // 그림 보스(환경 테마): 평소 / 2페이즈 화난 모습
    const img = SPRITES[phase2 ? bossDef.img.angry : bossDef.img.calm];
    if (img && img.complete && img.naturalWidth) {
      const h = bossDef.drawH || 150, w = h * img.naturalWidth / img.naturalHeight;
      const im = flash ? tintedSprite(img, "rgba(255,255,255,0.85)", img.src + "#flash") : img;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.rotate(sway * 0.4);
      ctx.drawImage(im, -w / 2, -h * 0.78, w, h);
      ctx.restore(); ctx.imageSmoothingEnabled = false;
    }
  } else switch (bossDef.shape) {
    case "beast": drawBossBeast(scale, body, dark, pal, sway, phase2); break;
    case "bell": drawBossBell(scale, body, dark, pal, sway, phase2); break;
    case "golem": drawBossGolem(scale, body, dark, pal, sway, phase2); break;
    case "blob": drawBossBlob(scale, body, dark, pal, sway, phase2); break;
    default: drawBossTree(scale, body, dark, pal, sway, phase2); break;
  }

  ctx.restore();

  // 보스 이름/체력 패널
  const w = Math.min(280, viewW - 40);
  const barY = chapter.theme === 1 ? 88 : 44;
  ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(viewW / 2 - w / 2, barY, w, 12);
  const hpGrad = ctx.createLinearGradient(viewW / 2 - w / 2, 0, viewW / 2 + w / 2, 0);
  hpGrad.addColorStop(0, phase2 ? "#ff6a4a" : "#e0a83a"); hpGrad.addColorStop(1, phase2 ? "#c02020" : "#a06a10");
  ctx.fillStyle = hpGrad; ctx.fillRect(viewW / 2 - w / 2, barY, w * Math.max(0, boss.hp / boss.hpMax), 12);
  ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.strokeRect(viewW / 2 - w / 2 + 0.5, barY + 0.5, w - 1, 11);
  ctx.fillStyle = "#fff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
  ctx.shadowColor = "#000"; ctx.shadowBlur = 3;
  ctx.fillText(`${bossDef.name}${phase2 ? " · 2페이즈" : ""}`, viewW / 2, barY - 6);
  ctx.shadowBlur = 0;

  if (boss.activePattern) drawTelegraph(boss.activePattern, s);
}

function bossEyes(scale, pal, phase2, y, spread) {
  const glow = 0.6 + 0.4 * Math.sin(runTime * 4);
  ctx.fillStyle = phase2 ? `rgba(255,70,50,${glow})` : `rgba(${hexToRgb(pal.accent)},${glow})`;
  ctx.beginPath(); ctx.ellipse(-scale * spread, y, scale * 0.13, scale * 0.09, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(scale * spread, y, scale * 0.13, scale * 0.09, 0, 0, 7); ctx.fill();
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

// 황혼의 거목 — 줄기 + 캐노피 + 잉걸불 잎
function drawBossTree(scale, body, dark, pal, sway, phase2) {
  ctx.save();
  ctx.rotate(sway * 0.6);
  const cg = ctx.createRadialGradient(0, -scale * 1.5, 4, 0, -scale * 1.3, scale * 1.7);
  cg.addColorStop(0, pal.canopy); cg.addColorStop(1, dark);
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(0, -scale * 1.4, scale * 1.55, scale * 1.15, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + runTime * 0.3;
    const rr = scale * (0.9 + 0.4 * Math.sin(runTime * 2 + i));
    ctx.fillStyle = `rgba(${hexToRgb(pal.accent)},${0.45 + 0.3 * Math.sin(runTime * 3 + i)})`;
    ctx.beginPath(); ctx.arc(Math.cos(a) * rr, -scale * 1.4 + Math.sin(a) * rr * 0.6, 3, 0, 7); ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = dark; ctx.lineWidth = scale * 0.22; ctx.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(-Math.PI / 2 + (i - 1.5) * 0.5 + sway);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -scale * 1.3); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-scale * 0.55, scale); ctx.lineTo(-scale * 0.75, -scale * 0.3);
  ctx.lineTo(-scale * 0.4, -scale * 1.05); ctx.lineTo(scale * 0.4, -scale * 1.05);
  ctx.lineTo(scale * 0.75, -scale * 0.3); ctx.lineTo(scale * 0.55, scale);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * scale * 0.25, scale * 0.9); ctx.lineTo(i * scale * 0.2, -scale); ctx.stroke(); }
  ctx.restore();
  bossEyes(scale, pal, phase2, -scale * 0.55, 0.22);
}

// 들개 왕 — 네발 짐승 실루엣, 달릴 때 몸이 늘어남
function drawBossBeast(scale, body, dark, pal, sway, phase2) {
  const run = Math.sin(runTime * 6) * scale * 0.08;
  ctx.fillStyle = dark;
  for (const lx of [-0.55, -0.2, 0.2, 0.55]) {      // 다리 4개
    ctx.save(); ctx.translate(lx * scale, scale * 0.55);
    ctx.rotate(Math.sin(runTime * 7 + lx * 4) * 0.35);
    ctx.fillRect(-scale * 0.1, 0, scale * 0.2, scale * 0.6);
    ctx.restore();
  }
  ctx.fillStyle = body;                              // 몸통
  ctx.beginPath(); ctx.ellipse(0, 0, scale * 1.05 + run, scale * 0.62, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark;                              // 갈기
  for (let i = 0; i < 7; i++) {
    ctx.save(); ctx.translate(-scale * 0.2 + i * scale * 0.12, -scale * 0.55);
    ctx.rotate(-0.4 + i * 0.1 + sway);
    ctx.fillRect(-scale * 0.05, 0, scale * 0.1, scale * 0.42);
    ctx.restore();
  }
  ctx.fillStyle = body;                              // 머리
  ctx.beginPath(); ctx.ellipse(scale * 0.85, -scale * 0.3, scale * 0.44, scale * 0.36, 0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath();                                   // 주둥이
  ctx.moveTo(scale * 1.15, -scale * 0.25); ctx.lineTo(scale * 1.6, -scale * 0.12);
  ctx.lineTo(scale * 1.15, -scale * 0.02); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff";                            // 이빨
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(scale * (1.2 + i * 0.12), -scale * 0.1);
    ctx.lineTo(scale * (1.26 + i * 0.12), scale * 0.04); ctx.lineTo(scale * (1.32 + i * 0.12), -scale * 0.1);
    ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.translate(scale * 0.85, -scale * 0.3);
  bossEyes(scale * 0.8, pal, phase2, -scale * 0.12, 0.2);
  ctx.restore();
}

// 마을의 종지기 — 커다란 종 + 흔들리는 추
function drawBossBell(scale, body, dark, pal, sway, phase2) {
  const swing = Math.sin(runTime * 2.2) * 0.25;
  ctx.strokeStyle = dark; ctx.lineWidth = scale * 0.12;
  ctx.beginPath(); ctx.moveTo(-scale * 1.1, -scale * 1.5); ctx.lineTo(scale * 1.1, -scale * 1.5); ctx.stroke();
  ctx.save();
  ctx.translate(0, -scale * 1.5); ctx.rotate(swing);
  ctx.fillStyle = body;                               // 종
  ctx.beginPath();
  ctx.moveTo(-scale * 0.9, scale * 1.1);
  ctx.quadraticCurveTo(-scale * 0.85, -scale * 0.1, 0, -scale * 0.25);
  ctx.quadraticCurveTo(scale * 0.85, -scale * 0.1, scale * 0.9, scale * 1.1);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark;
  ctx.fillRect(-scale * 1.0, scale * 1.05, scale * 2.0, scale * 0.22);
  ctx.fillStyle = `rgba(${hexToRgb(pal.accent)},0.9)`;   // 추
  ctx.beginPath(); ctx.arc(0, scale * 1.35, scale * 0.22, 0, 7); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(0, -scale * 1.5 + scale * 0.6);
  bossEyes(scale, pal, phase2, 0, 0.3);
  ctx.restore();
  // 울림 링
  const ring = (runTime * 0.6) % 1;
  ctx.strokeStyle = `rgba(${hexToRgb(pal.accent)},${0.35 * (1 - ring)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -scale * 0.6, scale * (1.2 + ring * 2.2), 0, 7); ctx.stroke();
}

// 절벽의 파수 거상 — 각진 돌덩이 몸체
function drawBossGolem(scale, body, dark, pal, sway, phase2) {
  const breathe = Math.sin(runTime * 1.4) * scale * 0.04;
  ctx.fillStyle = dark;
  ctx.fillRect(-scale * 0.95, scale * 0.35, scale * 0.55, scale * 0.85);   // 다리
  ctx.fillRect(scale * 0.4, scale * 0.35, scale * 0.55, scale * 0.85);
  ctx.fillStyle = body;                                                     // 몸통
  ctx.beginPath();
  ctx.moveTo(-scale * 1.0, -scale * 0.65 + breathe);
  ctx.lineTo(scale * 1.0, -scale * 0.65 + breathe);
  ctx.lineTo(scale * 0.8, scale * 0.5); ctx.lineTo(-scale * 0.8, scale * 0.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark;                                                     // 팔
  ctx.save(); ctx.rotate(sway * 0.5);
  ctx.fillRect(-scale * 1.55, -scale * 0.5, scale * 0.5, scale * 1.35);
  ctx.fillRect(scale * 1.05, -scale * 0.5, scale * 0.5, scale * 1.35);
  ctx.restore();
  ctx.fillStyle = body;                                                     // 머리
  ctx.fillRect(-scale * 0.42, -scale * 1.25 + breathe, scale * 0.84, scale * 0.62);
  // 균열 발광
  ctx.strokeStyle = `rgba(${hexToRgb(pal.accent)},${0.5 + 0.4 * Math.sin(runTime * 3)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-scale * 0.5, -scale * 0.4 + breathe); ctx.lineTo(-scale * 0.1, scale * 0.05);
  ctx.lineTo(-scale * 0.35, scale * 0.45); ctx.stroke();
  ctx.save(); ctx.translate(0, -scale * 0.95 + breathe);
  bossEyes(scale, pal, phase2, 0, 0.2);
  ctx.restore();
}

// 늪의 어미 — 출렁이는 점액 덩어리 + 알집
function drawBossBlob(scale, body, dark, pal, sway, phase2) {
  const wob = Math.sin(runTime * 2.4) * 0.1;
  ctx.fillStyle = body;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = scale * (1.15 + Math.sin(a * 3 + runTime * 2.2) * 0.1 + wob * Math.cos(a * 2));
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.82 + scale * 0.15;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 알집
  ctx.fillStyle = dark;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + runTime * 0.5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * scale * 0.5, Math.sin(a) * scale * 0.4 + scale * 0.15, scale * 0.2, 0, 7);
    ctx.fill();
  }
  // 흘러내리는 방울
  ctx.fillStyle = `rgba(${hexToRgb(pal.accent)},0.6)`;
  for (let i = 0; i < 3; i++) {
    const t = ((runTime * 0.8 + i * 0.33) % 1);
    ctx.beginPath();
    ctx.arc((i - 1) * scale * 0.55, scale * (0.9 + t * 0.6), scale * 0.1 * (1 - t), 0, 7);
    ctx.fill();
  }
  bossEyes(scale, pal, phase2, -scale * 0.25, 0.32);
}

function drawTelegraph(pat, bossScreen) {
  if (chapter?.theme === 1) return; // Theme 1 warnings are drawn below actors in draw().
  const t = 1 - Math.max(0, boss.telegraphT) / pat.telegraphS; // 0→1로 진행
  const pulse = 0.5 + 0.5 * Math.sin(runTime * 14);

  // 새 패턴 종류들
  if (pat.kind === "ringOut") {
    ctx.save();
    ctx.strokeStyle = `rgba(255,190,90,${0.45 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bossScreen.x, bossScreen.y, 4 * U * (0.3 + 0.7 * t), 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(255,190,90,${0.12 * t})`;
    ctx.beginPath(); ctx.arc(bossScreen.x, bossScreen.y, 4 * U, 0, 7); ctx.fill();
    ctx.restore();
    return;
  }
  if (pat.kind === "dashLine") {
    ctx.save();
    ctx.translate(bossScreen.x, bossScreen.y);
    ctx.rotate(pat.aimAngle);
    const g = ctx.createLinearGradient(0, 0, 7 * U, 0);
    g.addColorStop(0, `rgba(255,80,60,${0.15 + 0.35 * t})`);
    g.addColorStop(1, "rgba(255,80,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, -1.2 * U, 7 * U, 2.4 * U);
    ctx.strokeStyle = `rgba(255,120,80,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 2;
    ctx.strokeRect(0, -1.2 * U, 7 * U, 2.4 * U);
    ctx.restore();
    return;
  }
  if (pat.kind === "scatter" || pat.kind === "litter") {
    ctx.save();
    const rr = pat.kind === "litter" ? 0.9 * U : 1.2 * U;
    for (const s of (pat.spots || [])) {
      const p = worldToScreen(s.x, s.y);
      ctx.strokeStyle = `rgba(220,180,120,${0.4 + 0.45 * pulse})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(220,180,120,${0.14 * t})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr * t, 0, 7); ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (pat.kind === "vacuum") {                   // 쓰레기 흡입: 보스 쪽으로 좁혀 드는 점선 원 + 물릴 범위
    ctx.save();
    ctx.strokeStyle = `rgba(160,200,90,${0.35 + 0.4 * pulse})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    for (let i = 0; i < 3; i++) {
      const rr = (7 - ((t * 3 + i) % 3) * 1.6) * U;
      ctx.beginPath(); ctx.arc(bossScreen.x, bossScreen.y, rr, 0, 7); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(160,200,90,${0.12 + 0.15 * t})`;
    ctx.beginPath(); ctx.arc(bossScreen.x, bossScreen.y, 2.5 * U, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(120,170,60,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bossScreen.x, bossScreen.y, 2.5 * U, 0, 7); ctx.stroke();
    ctx.restore();
    return;
  }
  if (pat.kind === "summonOnly") {
    ctx.save();
    ctx.strokeStyle = `rgba(180,255,180,${0.35 + 0.4 * pulse})`; ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(bossScreen.x, bossScreen.y, 1.6 * U + 20 * t, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  if (pat.kind === "cone") {
    ctx.save();
    ctx.translate(bossScreen.x, bossScreen.y);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 4 * U);
    grad.addColorStop(0, `rgba(255,60,40,${0.05 + 0.25 * t})`);
    grad.addColorStop(1, `rgba(255,60,40,0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 4 * U, pat.aimAngle - Math.PI / 2, pat.aimAngle + Math.PI / 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(255,80,60,${0.4 + 0.4 * pulse})`; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  } else if (pat.kind === "groundCircle") {
    const ps = worldToScreen(pat.telegraphOriginX, pat.telegraphOriginY);
    const r = (pat.radiusU || 1.25) * U;
    ctx.save();
    ctx.strokeStyle = `rgba(255,90,50,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(ps.x, ps.y, r * (0.6 + 0.4 * t), 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255,90,50,${0.12 * t})`;
    ctx.beginPath(); ctx.arc(ps.x, ps.y, r, 0, 7); ctx.fill();
    ctx.restore();
  } else {
    // 씨앗 산탄: 방사형 경고선
    ctx.save();
    ctx.translate(bossScreen.x, bossScreen.y);
    ctx.strokeStyle = `rgba(255,140,60,${0.35 + 0.35 * pulse})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6 * U * t, Math.sin(a) * 6 * U * t); ctx.stroke();
    }
    ctx.restore();
  }
}

function onScreen(entity, margin=160) {
  const q=worldToScreen(entity.x,entity.y);
  return q.x>=-margin&&q.x<=viewW+margin&&q.y>=-margin&&q.y<=viewH+margin;
}
function draw() {
  if (mode === "menu") { ctx.fillStyle = "#0d0d14"; ctx.fillRect(0, 0, viewW, viewH); return; }
  // The floor is opaque: do not paint the same full-screen background twice.

  // 화면 흔들림(타격감): 카메라를 미세하게 흔든다. 판정에는 영향 없음.
  const shakeAmt = chapter?.theme === 1
    ? (themeFx.reducedMotion ? 0 : shake.t > 0 ? Math.min(8, shake.mag * (shake.t / 0.18)) : 0)
    : shake.t > 0 ? shake.mag * (shake.t / 0.18) : 0;
  cam.x = player.x + (shakeAmt ? (Math.random() - 0.5) * shakeAmt * 2 : 0);
  cam.y = player.y + (shakeAmt ? (Math.random() - 0.5) * shakeAmt * 2 : 0);

  // 바닥(반복 타일) — 실패 시(로딩 전) 이전 방식(단색+그리드)으로 대체
  const pat = getFloorPattern();
  if (pat) {
    const P = floorImage().naturalWidth || U;          // 무늬 반복 주기(타일 한 변)
    ctx.save();
    ctx.translate(-((cam.x % P) + P) % P, -((cam.y % P) + P) % P);
    ctx.fillStyle = pat;
    ctx.fillRect(-P, -P, viewW + P * 2, viewH + P * 2);
    ctx.restore();
    if (!chapter.theme) {                                // 옛 세계관 챕터만 어둡게(테마 바닥은 밝은 그대로)
      ctx.fillStyle = "rgba(10,8,16,0.35)";
      ctx.fillRect(0, 0, viewW, viewH);
      // 챕터별 환경 색조(ENV02 마을 / ENV03 절벽 / ENV04 늪)
      if (chapter.groundTint) { ctx.fillStyle = chapter.groundTint; ctx.fillRect(0, 0, viewW, viewH); }
    }
  } else {
    ctx.fillStyle = "#1a1712"; ctx.fillRect(0, 0, viewW, viewH);
  }
  // 은은한 격자(공간감 보조)
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  const gridSize = U * 2;
  const offX = ((cam.x % gridSize) + gridSize) % gridSize;
  const offY = ((cam.y % gridSize) + gridSize) % gridSize;
  for (let x = -offX; x < viewW; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewH); ctx.stroke(); }
  for (let y = -offY; y < viewH; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewW, y); ctx.stroke(); }

  drawDarkZones();
  if (chapter?.theme === 1 && boss?.activePattern) themeFx.telegraph(ctx, boss.activePattern, boss, boss.telegraphT, runTime, U, worldToScreen);
  drawBeacon();
  for (const d of decor) if (onScreen(d, Math.max(180, d.h || 0))) drawDecorItem(d);
  for (const f of fields) drawField(f);      // 장판은 바닥에
  for (const t of traps) drawTrap(t);
  sgElements.drawGround(ctx, worldToScreen);   // 원소 스킬 바닥층(불 웅덩이·용암·지뢰·그림자) — 적·주인공 아래
  for (const g of gems) if (onScreen(g, 48)) drawGem(g);

  // 적 (화면 밖은 그리기만 생략; 이동·공격·정화 계산은 그대로)
  for (const e of enemies) {
    if (!onScreen(e, 180)) continue;
    const s = worldToScreen(e.x, e.y);
    const def = ENEMIES[e.typeId];
    const bob = Math.sin(e.animT) * def.bobAmp;
    const img = SPRITES[def.sprite];
    const k = e.sgScale || 1;                    // 쪼개진 작은 적은 72% 크기
    if (def.hiRes) {                             // 환경 테마 적: 고해상도 그림을 높이 기준으로 부드럽게 축소(색조 없음)
      const h = def.drawH * k, w = h * ((img.naturalWidth / img.naturalHeight) || 1);
      if (e.sgTrait) sgDrawTraitRing(e, s.x, s.y + h * 0.7 * 0.32, w);
      drawEntitySprite(img, s.x, s.y, {
        size: h * 0.7, width: w, height: h, facing: e.facing, bob, smooth: true,
        tint: e.sgTint || null, flash: e.flashT > 0, spawnScale: e.spawnT,
        glow: e.elite ? "rgba(120,220,80,0.35)" : null,
      });
      if (e.sgTrait) sgDrawTraitBadge(e, s.x + w * 0.38, s.y + h * 0.224 - h * 0.92 + bob);
    } else {
      const size = 20 * def.drawScale * k;
      if (e.sgTrait) sgDrawTraitRing(e, s.x, s.y + size * 0.32, size);
      drawEntitySprite(img, s.x, s.y, {
        size, facing: e.facing, bob,
        tint: e.sgTint || def.tint, flash: e.flashT > 0, spawnScale: e.spawnT,
        glow: e.elite ? "rgba(255,90,50,0.35)" : null,
      });
      if (e.sgTrait) sgDrawTraitBadge(e, s.x + size * 0.38, s.y + size * 0.32 - size * 0.92 + bob);
    }
    // 체력바는 엘리트와 "피해를 입은 잡몹"에만 — 전부 표시하면 화면이 지저분해진다
    if (e.elite || e.hp < e.hpMax) {
      drawHpBar(s.x, s.y - def.radiusU * U - 14, def.radiusU * U * 2.2, e.hp / e.hpMax, e.elite ? "#ff8a3a" : "#e05050");
    }
  }

  if (boss) drawBoss();

  for (const st of strikes) drawStrike(st);      // 낙뢰 예고(적 아래)
  for (const b of beams) drawBeam(b);
  for (const p of projectiles) drawProjectile(p);

  // 플레이어(주인공 프레임 애니메이션)
  {
    const s = worldToScreen(player.x, player.y);
    drawHero(s.x, s.y);
  }
  for (const m of minions) drawMinion(m);
  for (const sw of swings) drawSwing(sw);
  sgElements.draw(ctx,worldToScreen);
  sgWeapon.draw(ctx,worldToScreen);
  sgDrawThreats();

  for (const a of arcs) drawArc(a);
  for (const b of blasts) drawBlast(b);
  // Cap only visual draw work; simulation and damage are unchanged.
  for (let i = chapter?.theme === 1 ? Math.max(0, hitFx.length - 96) : 0; i < hitFx.length; i++) drawHitFx(hitFx[i]);
  for (let i = chapter?.theme === 1 ? Math.max(0, deathFx.length - 64) : 0; i < deathFx.length; i++) drawDeathFx(deathFx[i]);
  if (chapter?.theme === 1) themeFx.draw(ctx, worldToScreen);

  // 숫자 그림만 최근 40개로 제한, 진화·보상 안내는 별도로 보존한다.
  const visibleTexts = [...floatingTexts.filter(t=>t.big).slice(-8), ...floatingTexts.filter(t=>!t.big).slice(-40)];
  for (const t of visibleTexts) {
    if (!onScreen(t, 100)) continue;
    const s = worldToScreen(t.x, t.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    const pop = t.big ? 1.35 : 1;
    ctx.scale((t.scale || 1) * pop, (t.scale || 1) * pop);
    ctx.font = `bold ${t.big ? 19 : 15}px sans-serif`; ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color || "#fff2c0";
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }

  if (chapter?.theme === 1 && boss?.activePattern) themeFx.telegraph(ctx, boss.activePattern, boss, boss.telegraphT, runTime, U, worldToScreen);
  drawTouchJoystick();

  // 비네트(황혼 분위기) — 어둠 지대 안이거나 시야 제한 규칙이면 시야가 좁아진다
  const inDark = isInDark(player.x, player.y);
  const vision = Math.min(inDark ? 0.62 : 1, runMods.vision || 1);
  const themed = !!chapter?.theme;
  const edge = vision < 1 ? (themed ? 0.75 : 0.9) : (themed ? 0.22 : 0.55);
  const vgKey = `${viewW}:${viewH}:${vision}:${themed}`;
  if (!vignetteCache || vignetteCache.key !== vgKey) {
    const image = document.createElement('canvas');image.width=Math.ceil(viewW/2);image.height=Math.ceil(viewH/2);
    const g=image.getContext('2d');g.scale(.5,.5);
    const vg=g.createRadialGradient(viewW/2,viewH/2,viewH*.35*vision,viewW/2,viewH/2,viewH*.75*vision);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(${themed?'40,50,20':'5,4,10'},${edge})`);
    g.fillStyle=vg;g.fillRect(0,0,viewW,viewH);vignetteCache={key:vgKey,image};
  }
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(vignetteCache.image,0,0,viewW,viewH);ctx.restore();
  if (inDark) {
    ctx.fillStyle = themed ? "#f0ff9a" : "#c9a8ff"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(themed ? "악취 구역 · 새싹 ×1.5" : "어둠 지대 · 보석 ×1.5", viewW / 2, viewH - 18);
  }

  if (debugFast) {
    ctx.fillStyle = "#ffe9a8"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("DEBUG FAST-FORWARD x8 (F)", 12, viewH - 12);
  }
}

// ---------- HUD ----------
function updateHud() {
  if (mode === "menu" || !player) return;
  setWidth(elHpbar, `${Math.max(0, (player.hp / player.hpMax) * 100).toFixed(1)}%`);
  setWidth(elXpbar, runCfg.rework && player.sgChoices>=runCfg.cardCap ? "100%" : `${Math.min(100, (player.xp / xpNeedFor(player.lvl)) * 100).toFixed(1)}%`);
  if(!runCfg.rework)setText(elLvl, `Lv.${player.lvl}${player.revives > 0 ? ` 💗${player.revives}` : ""}${player.shield > 1 ? ` 🛡${Math.round(player.shield)}` : ""}`);
  // 제한 시간 모드는 남은 시간, 그 외는 경과 시간
  setText(elTimer, runCfg.bossPhase ? (runCfg.rework ? `대장 구출 ${formatTime(360-runTime)}` : "👾 보스전!") : runCfg.timeLimitS ? `⏳${formatTime(runCfg.timeLimitS - runTime)}` : formatTime(runTime));
  const extra = runCfg.bossScore ? ` · 점수 ${Math.round(runStats.bossDamage / Math.max(1, chapter.enemyMult)).toLocaleString()}`
    : runCfg.floor ? ` · ${runCfg.floor}층`
    : runCfg.stages ? ` · 원정 ${runCfg.stage}/${runCfg.stages}`
    : runCfg.endless ? ` · 배수 ×${Math.pow(1.35, Math.floor(runTime / 300)).toFixed(2)}` : "";
  setText(elKillcount, `${chapter?.theme ? "정화" : "처치"} ${killCount}${extra}`);
  const lumEl = document.getElementById("lum-bar");
  setWidth(lumEl, `${player.lum}%`);
  document.getElementById("lum-wrap").classList.toggle("full", player.lum >= 100);
}

// ---------- Simulation tick (렌더 타이밍과 분리 — docs/14 §2 "시뮬 자체 고정 틱, 렌더 분리" 원칙) ----------
function simTick(dt) {
  if (mode !== "playing") return;
  runTime += dt;
  stageTime += dt;
  if(runCfg.bossStage&&runTime>=360){endRun(false);return;}

  // 제한 시간이 있는 모드: 시간이 다 되면 승리(자원 던전·보스 점수·등반탑 일반층·위험 구역) 또는 패배
  if (runCfg.timeLimitS && runTime >= runCfg.timeLimitS) {
    if (runCfg.survival) {
      // 서바이벌: 버티면 클리어. 보스 스테이지는 시간이 끝나는 순간 보스 등장 → 처치해야 클리어(onBossDefeated)
      if (!runCfg.bossPhase) {
        if (runCfg.bossStage) { runCfg.bossPhase = true; spawnBoss(); enemies.length=0; log("대장이 나타났어요! 쓰레기를 주우며 도와줘요."); }
        else { endRun(true); return; }
      }
    } else { endRun(!!runCfg.winOnTime || !!runCfg.bossScore); return; }
  }
  if (fort) { if (fort.hitT > 0) fort.hitT -= dt; if (fort.hp <= 0) { log("봉화가 무너졌다!"); endRun(false); return; } }
  // 광폭(docs/06 §10): 판 길이를 넘기면 30초마다 보스 공격 +25%, 최대 4단계
  if (runCfg.enrageAtS && boss && runTime >= runCfg.enrageAtS) {
    const st = Math.min(4, 1 + Math.floor((runTime - runCfg.enrageAtS) / 30));
    if (st > enrageStage) {
      enrageStage = st;
      boss.atkBase = Math.round(boss.atkBase * 1.25);
      log(`보스 광폭 ${st}단계!`); addShake(6, 0.4);
    }
  }
  updatePlayer(dt);
  if(mode!=="playing")return;
  updateSkills(dt);
  updateProjectiles(dt);
  updateBeams(dt);
  updateStrikes(dt);
  updateFields(dt);
  updateMinions(dt);
  updateTraps(dt);
  updateSpawning(dt);
  updateEnemies(dt);
  if(mode!=='playing')return;
  updateGems(dt);
  if(mode!=='playing')return;
  updateDecor(dt);
  sgGrowthTick(dt);
  if(enemies.length>160)enemies.sort((a,b)=>dist(a.x,a.y,player.x,player.y)-dist(b.x,b.y,player.x,player.y)).splice(160);
  if(gems.length>300)gems.splice(0,gems.length-300);

  updateFxTimers(dt);
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.life -= dt; t.y += (t.vy || -30) * dt;
    t.scale = Math.min(1, (t.scale || 0) + dt * 10);
    if (t.life <= 0) floatingTexts.splice(i, 1);
  }
  for (let i = hitFx.length - 1; i >= 0; i--) { hitFx[i].life -= dt; if (hitFx[i].life <= 0) hitFx.splice(i, 1); }
  for (let i = deathFx.length - 1; i >= 0; i--) { deathFx[i].life -= dt; if (deathFx[i].life <= 0) deathFx.splice(i, 1); }
}

// ---------- Main loop ----------
const FIXED_DT = 1 / 60;
const frameClock = createFrameClock(FIXED_DT, 4);
let lastT = performance.now();
function loop(now) {
  let realDt = (now - lastT) / 1000;
  lastT = now;
  if (realDt > 0.25) realDt = 0.25; // 탭 비활성 등으로 인한 큰 점프는 다음 프레임에서 스킵(순간이동 방지)
  // 히트스톱: 큰 타격 직후 아주 짧게 시뮬을 멈춰 타격감을 준다(렌더는 계속).
  if (hitStopT > 0) {
    hitStopT -= realDt;
    frameClock.reset();
  } else {
    const steps = frameClock.advance(realDt, mode === "playing" && !document.hidden, debugFast ? 8 : 1);
    for (let i = 0; i < steps; i++) simTick(FIXED_DT);
  }
  // 큰 폭발의 짧은 타격 멈춤(히트스톱) 프레임도 그대로 잰다 — 전에는 그때마다 측정이 처음으로 돌아가 후반 난전에서 화질이 늦게 내려갔다.
  if(renderQuality.sample(realDt,mode==='playing'&&!debugFast&&!document.hidden))resize();
  draw();
  updateHud();
  sgHud();
  elPauseBtn.classList.toggle("hidden", !(mode === "playing" || mode === "paused"));
  requestAnimationFrame(loop);
}
const elPauseBtn = document.getElementById("btn-pause");
requestAnimationFrame(loop);

// 자동화 테스트/QA 전용: rAF가 (탭 비가시성 등으로) 드물게 호출되는 환경에서도
// 시뮬레이션 시간을 즉시 진행시키기 위한 훅. 실제 플레이에는 노출하지 않는다.
if(SG_LOCAL){
window.__debugAdvance = function (seconds) {
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n; i++) simTick(FIXED_DT);
  draw();
  updateHud();
  return {
    runTime, mode, killCount,
    playerHp: player?.hp, playerLvl: player?.lvl, playerXp: player?.xp,
    enemyCount: enemies?.length, gemCount: gems?.length,
    bossHp: boss?.hp, bossHpMax: boss?.hpMax, bossPhase: boss?.phase,
    playerPos: player ? { x: Math.round(player.x), y: Math.round(player.y) } : null,
  };
};
// 자동화 테스트 전용: 실제 keydown/keyup 타이밍에 의존하지 않고 이동 입력을 강제한다.
window.__debugSetKeys = function (arr) { keys.clear(); for (const k of arr) keys.add(k); };
window.__debugDecor = function () { return decor; };
window.__debugChestGold = function () { return chestGold; };
// QA 전용: 스킬/패시브를 즉시 지급해 전 계열을 한 번에 확인한다.
window.__debugGrant = function (ids, lv = 5) {
  for (const id of ids) {
    if (SKILLS[id]) player.skills[id] = { lv: Math.min(lv, SKILLS[id].maxLevel), cd: 0 };
    if (PASSIVES[id]) player.passives[id] = { lv: Math.min(lv, PASSIVES[id].maxLevel) };
  }
  return { skills: Object.keys(player.skills), passives: Object.keys(player.passives) };
};
window.__debugMinions = function () { return minions.map((m) => ({ id: m.pet || m.skillId, hp: Math.round(m.hp ?? -1), hpMax: m.hpMax, downT: m.downT })); };
window.__debugClearSkills = function () { player.skills = {}; player.passives = {}; };
// QA 전용: 렌더 없이 시뮬만 진행(대량 자동 테스트용)
window.__debugEnd = function (cleared) { if (mode === "playing" || mode === "levelup") endRun(!!cleared); return mode; };
window.__debugPlayer = function () {
  return {
    atk: player.atk, hpMax: player.hpMax, revives: player.revives, lum: Math.round(player.lum),
    minions: minions.map((m) => m.pet || m.skillId), bonus: runBonus, mode: runCfg,
  };
};
window.__debugEvoPool = function () { return availableEvolutions().map((e) => e.id + " " + e.name); };
window.__debugForceEvolve = function (evoId) {
  const e = EVOLUTIONS[evoId];
  if (!e) return "no such evo";
  applyCard({ kind: "evolve", id: evoId });
  return { evolved: player.skills[e.sourceA]?.evolved, lv: player.skills[e.sourceA]?.lv };
};
window.__debugSim = function (seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) simTick(FIXED_DT);
  return { runTime, mode, killCount };
};
// QA 전용: 보스 즉시 소환 / 모든 챕터 해금
window.__debugForceBoss = function () { if (!boss) spawnBoss(); return bossDef.id; };
window.__debugBossHp = function (pct) { if (boss) boss.hp = boss.hpMax * pct; return boss && boss.hp; };   // 보스 체력 비율 강제(2페이즈 확인용)
window.__debugDecor = function () { return decor.map((d) => ({ x: Math.round(d.x - player.x), y: Math.round(d.y - player.y), sprite: d.sprite, solid: d.solid || 0, opened: d.opened, boss: !!d.bossLitter })); };
window.__debugBossPattern = function (name) {   // 다음 기술을 이름으로 지정(예: "쓰레기 뿌리기")
  const pat = bossDef.patterns.find((p) => p.name === name);
  if (!boss || !pat) return false;
  boss.forcePattern = pat; boss.activePattern = null; boss.restT = 0; return true;
};
window.__debugPlayerPos = function () { return { x: player.x, y: player.y }; };
window.__debugUnlockAll = function () {
  for (const c of CHAPTERS) {
    save.progress.chapters[c.id] = { ...(save.progress.chapters[c.id] || { cleared: false, bestClearS: null }), unlocked: true };
  }
  writeSave(save); refreshMenuMeta();
  return CHAPTERS.map((c) => c.id);
};
// QA 전용: 시뮬만 멈추고 렌더는 계속 — 짧은 이펙트를 스크린샷으로 확인할 때 사용
window.__debugFreeze = function (seconds) { hitStopT = seconds; return hitStopT; };
// QA 전용: 밀집 상황(성능·이펙트 확인)을 만들기 위한 강제 스폰
window.__debugSpawn = function (typeId, n, radiusPx = 200) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    const r = radiusPx * (0.5 + Math.random() * 0.5);
    spawnEnemyAt(typeId, player.x + Math.cos(a) * r, player.y + Math.sin(a) * r);
  }
  return enemies.length;
};
// QA 전용: 어려움의 특별한 적을 주인공 둘레에 만든다(trait: resist·armor·fast·regen·split)
window.__debugSpawnTrait = function (typeId, trait, n, radiusPx = 200) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4, r = radiusPx * (0.75 + Math.random() * 0.25);
    spawnEnemyAt(typeId, player.x + Math.cos(a) * r, player.y + Math.sin(a) * r);
    sgApplyTrait(enemies[enemies.length - 1], trait);
  }
  return enemies.filter((e) => e.sgTrait).map((e) => ({ trait: e.sgTrait, resist: e.sgResist || null, label: e.sgLabel }));
};
window.__debugSkillState = function () {
  const out = {};
  for (const id in player.skills) out[id] = { lv: player.skills[id].lv, cd: Math.round(player.skills[id].cd * 100) / 100 };
  return out;
};
window.__debugCounts = function () {
  return {
    projectiles: projectiles.length, beams: beams.length, strikes: strikes.length,
    blasts: blasts.length, arcs: arcs.length, enemies: enemies.length,
    shake: Math.round(shake.mag * 10) / 10,
    bossDist: boss ? Math.round(dist(boss.x, boss.y, player.x, player.y)) : null,
    bossDir: boss ? { x: Math.sign(boss.x - player.x), y: Math.sign(boss.y - player.y) } : null,
  };
};

// 자동화 테스트 전용: 레벨업 카드가 뜨면 첫 번째 카드를 자동 선택하며 지정한 초만큼 진행한다.
window.__debugAutoPlay = function (seconds) {
  let advanced = 0;
  const n = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < n && mode !== "result"; i++) {
    if (mode === "levelup") {
      const firstCard = elCardRow.querySelector(".card");
      if (firstCard) firstCard.click();
      continue; // 같은 프레임 재시도(다음 루프에서 mode가 playing으로 바뀐 뒤 tick)
    }
    simTick(FIXED_DT);
    advanced += FIXED_DT;
  }
  draw();
  updateHud();
  return {
    advanced, runTime, mode, killCount,
    playerHp: player?.hp, playerLvl: player?.lvl,
    enemyCount: enemies?.length,
    bossHp: boss?.hp, bossHpMax: boss?.hpMax, bossPhase: boss?.phase,
    playerPos: player ? { x: Math.round(player.x), y: Math.round(player.y) } : null,
  };
};

}
// 모든 모듈 상태가 선언된 뒤에 로비를 처음 그린다(선언 순서 문제 방지)
if(SG_LOCAL){
window.__save = () => save;
window.__eco = ECO;
window.__cloud = cloud;
window.__refresh = () => { writeSave(save); refreshMenuMeta(); };
window.__guardian=()=>sgState;
window.__sgEventPopup=()=>{sgMaybeEventPopup();return !!document.querySelector('dialog.sg-dialog[open] .sg-event');};
window.__bgm=()=>({...music.state(),mode,sound:elSound?{hidden:elSound.hidden,text:elSound.textContent}:null,hudMute:elMute.textContent,stored:(()=>{try{return localStorage.getItem('lumen_muted');}catch(e){return null;}})()});
window.__sgCard=(c)=>sgApplyCard(c);
window.__sgSnapshot=()=>({runTime,mode,skills:player?.skills,run:player?.sgRun,cards:currentCards,choices:player?.sgChoices,litter:runStats.litter,weapon:sgWeapon.snapshot(),elements:sgElements.snapshot(),difficulty:sgRunProfile?.difficulty,hurt:{contact:Math.round(runStats.hurtContact||0),hit:Math.round(runStats.hurtHit||0),blast:Math.round(runStats.hurtBlast||0)},enemyTypes:enemies.reduce((o,e)=>{o[e.typeId]=(o[e.typeId]||0)+1;return o;},{}),enemies:enemies.length,special:enemies.reduce((o,e)=>{if(e.sgTrait)o[e.sgTrait]=(o[e.sgTrait]||0)+1;return o;},{})});
window.__sgCombatLoad=(ids,profile={},supports={})=>{player.skills=Object.fromEntries(ids.map(id=>[id,{lv:R.RUN_RULES.maxSkillLevel,cd:0}]));player.pendingLevels=0;player.sgChoices=runCfg.cardCap;player.sgRun={consumed:[],fusionCount:0,supports:Object.fromEntries(Object.entries(supports).map(([k,v])=>[k,{lv:v}])),partnerOffers:{}};if(mode==='levelup'){mode='playing';elLevelup.classList.add('hidden');}Object.assign(sgRunProfile,profile);sgElements.reset();sgWeapon.reset();return window.__sgSnapshot();};
window.__debugPilot=(seconds)=>{
  window.__debugGod=false;
  const n=Math.floor(seconds*60);
  for(let i=0;i<n&&mode!=='result';i++){
    if(mode==='levelup'){
      // 사람처럼 고르기: 회복(위급) → 진화 → 키우던 스킬의 짝 지원품 → 스킬 레벨업 → 새 스킬(2개까지) → 첫 카드
      const partners=new Set(Object.keys(player.skills).flatMap(id=>R.SKILL_PARTNERS[id]||[]));
      let idx=currentCards.findIndex(c=>c.kind==='heal'&&player.hp/player.hpMax<.55);
      if(idx<0)idx=currentCards.findIndex(c=>c.kind==='evolve');
      if(idx<0)idx=currentCards.findIndex(c=>c.kind==='support-new'&&partners.has(c.id));
      if(idx<0)idx=currentCards.findIndex(c=>c.kind==='skill-up');
      if(idx<0&&Object.keys(player.skills).length<2)idx=currentCards.findIndex(c=>c.kind==='skill-new');
      if(idx<0)idx=currentCards.findIndex(c=>c.kind==='support-new'||c.kind==='support-up');
      if(idx<0)idx=0;elCardRow.children[idx]?.click();continue;}
    if(mode!=='playing')break;
    if(i%12===0){
      const targets=[...decor.filter(d=>d.litter&&!d.opened),...gems].sort((a,b)=>dist(a.x,a.y,player.x,player.y)-dist(b.x,b.y,player.x,player.y));
      const target=targets[0];let dx=0,dy=0;
      if(boss){const a=Math.atan2(boss.y-player.y,boss.x-player.x),d=dist(boss.x,boss.y,player.x,player.y);dx=Math.cos(a+(d<160?Math.PI/2:0));dy=Math.sin(a+(d<160?Math.PI/2:0));if(boss.activePattern&&d<150){dx=-Math.cos(a);dy=-Math.sin(a);}}
      else if(target){const a=Math.atan2(target.y-player.y,target.x-player.x);dx=Math.cos(a);dy=Math.sin(a);}
      else{dx=Math.cos(runTime/4);dy=Math.sin(runTime/4);}
      const avoid=window.__pilotAvoid??2;   // 0 = 피하지 않는 서툰 플레이어(난이도 비교용)
      for(const e of enemies){const d=dist(e.x,e.y,player.x,player.y);if(d<90){const a=Math.atan2(player.y-e.y,player.x-e.x),w=avoid*(1-d/90);dx+=Math.cos(a)*w;dy+=Math.sin(a)*w;}}
      keys.clear();if(dx>.2)keys.add('d');else if(dx<-.2)keys.add('a');if(dy>.2)keys.add('s');else if(dy<-.2)keys.add('w');
    }
    simTick(FIXED_DT);
  }
  keys.clear();draw();return {runTime,mode,hp:player.hp,maxHp:player.hpMax,kills:killCount,litter:runStats.litter,choices:player.sgChoices,bossHp:boss?.hp};
};
}
ECOUI.initEcoUI({
  save: () => save, write: () => writeSave(save), log, sfx: playSfx,
  refresh: () => { flushLobbyCounters(); refreshMenuMeta(); },
  highestCleared: () => highestClearedIndex() + 1,
  modeUnlocked: (id) => { const m = MODES.find((x) => x.id === id); return !m || modeUnlocked(m); },
  charUnlocked, charRaw: (id) => RAW_CHARACTERS.find((c) => c.id === id) || {},
  ruleName: (rid) => RULES[rid]?.name || rid,
  passiveName: (id) => PASSIVES[id]?.name || id,
  startEventBattle,
  renderCollectibles,            // 가방 탭 「도감」
});
document.querySelectorAll("[data-gear]").forEach((b) => b.addEventListener("click", () => {
  ECOUI.setGearSub(b.dataset.gear); playSfx("uiClick", 0.35); ECOUI.renderGearTab();
}));
refreshMenuMeta();
// 시작 화면 → (서버가 있으면 접속) → 시작하기 → 로비. 주인공을 아직 안 골랐으면 선택 화면을 먼저 띄운다.
const elTitle = document.getElementById("title");
const btnTitleStart = document.getElementById("btn-title-start");
const elLogin = document.getElementById("ts-login"), elUser = document.getElementById("ts-user");
const elLoginMsg = document.getElementById("login-msg"), elCloud = document.getElementById("m-cloud");
const elOffline = document.getElementById("ts-offline");
// 게임은 서버 계정으로만 진행한다: 연결 중 → 접속 카드(미접속) → 시작 버튼(접속됨). 연결 실패면 다시 시도만 보인다.
function refreshTitle() {
  btnTitleStart.firstChild.textContent = (save.stats?.runs || 0) > 0 ? "이어하기" : "시작하기";
  const connecting = !cloud.probed, offline = cloud.probed && !cloud.available;
  const needLogin = cloud.available && !cloud.loggedIn;
  elOffline.classList.toggle("hidden", !(connecting || offline));
  document.getElementById("ts-offline-title").textContent = connecting ? "서버에 연결하는 중…" : "서버에 연결할 수 없어요";
  document.getElementById("ts-offline-msg").textContent = offline ? "인터넷 연결을 확인하고 다시 시도해 주세요." : "";
  document.getElementById("ts-offline-btns").classList.toggle("hidden", !offline);
  elLogin.classList.toggle("hidden", !needLogin);
  btnTitleStart.classList.toggle("hidden", !cloud.loggedIn);
  btnTitleStart.disabled=!sgState.profile;
  elUser.classList.toggle("hidden", !cloud.loggedIn);
  // 아이디는 어떤 글자든 올 수 있어(제목용 부분 글꼴에 없을 수 있음) 시스템 글꼴로 표시한다
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  document.getElementById("ts-user-name").innerHTML = cloud.loggedIn ? `☁ <span class="sysfont">${esc(cloud.user)}</span> 님으로 접속 중` : "";
}
btnTitleStart.addEventListener("click", () => {
  playSfx("cardSelect", 0.5);
  elTitle.classList.add("hidden");
  bgmOn();   // 시작 화면 → 로비는 처음부터 다시 틀지 않고 이어서
  sgRefresh().then(sgMaybeGuidance).catch(e=>sgUI.notify("서버 연결",e.message));     // 정화 장치(봉화)가 모아 둔 금화를 자동으로 받는다
});

// ---------- 서버 저장(클라우드) ----------
function replaceSave(obj) {
  save = ECO.migrateSave(normalizeSave(obj));
  writeSave(save);
  refreshMenuMeta();
}
function loginMsg(text, err = false) { elLoginMsg.textContent = text; elLoginMsg.classList.toggle("err", err); }
function setCloudState(state, detail) {
  if (!cloud.loggedIn) { elCloud.textContent = ""; return; }
  elCloud.classList.toggle("err", state === "error");
  elCloud.textContent = state === "syncing" ? "☁ 저장 중…" : state === "error" ? `☁ 서버 저장 실패` : "☁ 저장됨";
  if (state === "error" && detail) log(`서버 저장 실패: ${detail}`);
}
// 접속 직후: 서버 저장본이 있으면 그것을 쓰고(다른 기기에서 이어하기), 없으면 이 기기의 진행을 올린다
async function afterLogin(info) {
  sgState={profile:null,passes:null,user:cloud.user,active:null,error:null};
  try{await sgRefresh();setCloudState('ok');}catch(e){sgState.error=e.message;setCloudState('error',e.message);}
  refreshTitle();refreshMenuMeta();
  sgMaybeEventPopup();
}
// 특별 이벤트 알림(2026-09-23 추석): 서버가 이벤트 날(아침 8시 기준 게임 날짜)에만 passes.event를 보낸다 → 로그인할 때 팝업.
// "닫기"는 이번만 닫고(다음 로그인 때 또 뜸), "오늘 하루 다시 보지 않기"는 그 날 동안 이 아이디로는 안 띄운다(localStorage).
function sgMaybeEventPopup(){
  const ev=sgState.passes?.event;if(!ev||!cloud.loggedIn||mode!=='menu')return;
  const hideKey=`seoho_event_hide_${cloud.user}_${ev.id}_${ev.day}`;
  try{if(localStorage.getItem(hideKey)==='1')return;}catch(e){}
  const t=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  sgUI.openDialog(`<div class="sg-event"><div class="sg-event-moon" aria-hidden="true">🌕</div><span class="sg-event-tag">${t(ev.title)}</span><h2>이용권 2배!</h2><p class="sg-event-msg">${t(ev.message)}</p><p class="sg-event-count">오늘 남은 이용권 <b>${t(sgState.passes.remaining)}</b>장 · 아침 8시마다 ${t(ev.dailyTotal)}장으로 채워져요</p><p class="sg-event-greet">🌾 ${t(ev.greeting)} 🌾</p></div><div class="sg-event-btns"><button class="sg-primary" data-close>닫기</button><button id="sg-event-hide">오늘 하루 다시 보지 않기</button></div>`);
  const hide=document.getElementById('sg-event-hide');
  if(hide)hide.onclick=()=>{try{localStorage.setItem(hideKey,'1');}catch(e){}sgUI.dialog.close();};
}

async function submitLogin(register) {
  const id = document.getElementById("login-id").value.trim();
  const pw = document.getElementById("login-pw").value;
  if (!id || !pw) { loginMsg("아이디와 비밀번호를 입력해 주세요.", true); return; }
  const btns = elLogin.querySelectorAll("button"); btns.forEach((b) => (b.disabled = true));
  loginMsg(register ? "계정을 만드는 중…" : "접속 중…");
  try {
    const info = register ? await cloud.register(id, pw) : await cloud.login(id, pw);
    playSfx("cardSelect", 0.5);
    loginMsg("");
    await afterLogin(info);
  } catch (e) {
    loginMsg(e.message || "접속에 실패했어요.", true);
  } finally { btns.forEach((b) => (b.disabled = false)); }
}
elLogin.addEventListener("submit", (e) => { e.preventDefault(); submitLogin(false); });
document.getElementById("btn-register").addEventListener("click", () => submitLogin(true));
document.getElementById("btn-logout").addEventListener("click", async () => {
  playSfx("uiClick", 0.4);
  await cloud.logout(); sgState={profile:null,passes:null,user:null,active:null,error:null}; setCloudState("off"); refreshTitle();
});
// Legacy save stays archived; guardian mutations are committed by the server.
window.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')togglePause();});
// 서버 찾기 → 토큰이 살아 있으면 자동 접속(다른 기기에서 저장한 진행을 내려받음)
async function connectCloud() {
  refreshTitle();
  if (!(await cloud.probe())) { refreshTitle(); return; }
  if (cloud.token) {
    const me = await cloud.me();
    if (me) { try { await afterLogin({ hasSave: true }); } catch (e) { setCloudState("error", e.message); } }
  }
  refreshTitle();
}
document.getElementById("btn-retry").addEventListener("click", () => { playSfx("uiClick", 0.4); connectCloud(); });
sgUI=new GuardianUI(elMenu,{
  getState:()=>sgState,start:sgStart,action:sgAction,refresh:sgRefresh,abandon:sgAbandon,
  logout:async()=>{await cloud.logout();sgState={profile:null,passes:null,user:null,active:null,error:null};elTitle.classList.remove('hidden');refreshTitle();sgUI.render();}
});
for(const id of ['sg-objective','sg-run-tools']){const el=document.createElement('div');el.id=id;document.body.append(el);}
sgUI.render();
sgUI.dialog.addEventListener('close',()=>queueMicrotask(sgMaybeGuidance));
setInterval(()=>{if(cloud.loggedIn&&mode==='menu'&&!sgUI.busy&&!sgSettling)sgRefresh().catch(()=>{});},15000);
connectCloud();
log("게임 로드 완료. WASD/방향키로 이동, 공격은 자동입니다.");

// ---------- Simplified guardians: server profile, daily passes and combat ----------
function sgApplyServer(data) {
  sgState={...sgState,...data,error:null,user:cloud.user};
  if(data.profile) save.hero=data.profile.hero;
  refreshMenuMeta();
}
// 받침에 맞는 목적격 조사: 물대포를 · 불꽃병을
const sgObj=s=>{const c=String(s).charCodeAt(String(s).length-1)-0xAC00;return `${s}${c>=0&&c<11172&&c%28===0?'를':'을'}`;};
const sgShownGuidance=new Set();
function sgMaybeGuidance(){
  if(!cloud.loggedIn||mode!=='menu'||sgSettling||sgUI?.busy||sgUI?.dialog.open||!elTitle.classList.contains('hidden')||elMenu.classList.contains('hidden'))return;
  const p=sgState.profile;if(!p)return;
  const once=kind=>{
    const key=sgStorageKey(kind);if(sgShownGuidance.has(key))return false;
    try{if(localStorage.getItem(key)==='1')return false;localStorage.setItem(key,'1');}catch(e){}
    sgShownGuidance.add(key);return true;
  };
  if(p.partsRepairNotice&&once('parts-fix-notice')){
    const items=p.partsRepairNotice.details||[];
    sgUI.notify('사라졌던 파츠를 돌려드렸어요',items.map(x=>`${R.PARTS[x.id]?.name||'파츠'}로 ${x.copies}개 복구${x.gifts?` · 넘치는 ${x.gifts}개는 보급권 ${x.gifts}장`:''}${x.refund?` · 강화 코인 ${x.refund}개 반환`:''}`).join(' / '));return;
  }
  if(R.pendingPart(p)&&R.selectableParts(p).length&&once('first-part-guide')){sgUI.firstPartDialog();return;}
  // 보급 규칙 안내(한 번, 2026-09-23 저녁 무작위·5등급 판): 1-1을 깬 학생만. 전 판 안내(supply-v2)는 대신한다.
  if(p.stages?.CH01?.cleared&&once('supply-v3-notice'))sgUI.notify('파츠 보급이 바뀌었어요','이제 보급은 고르는 것 없이 10종 중 무작위! 운이 좋으면 한 번에 3개(18%)나 7개(2%)가 나와요. 같은 파츠를 모으면 노말(1개) → 레어(3개) → 유니크(7개) → 에픽(25개) → 전설(80개)로 올라가요. 등급이 오를수록 그 스킬이 훨씬 강해지고, 전설은 피해 +80%에 30% 확률로 한 번 더 발동해요. 전설은 아주 오래 모아야 해요. 성공 보급권은 쉬움·보통 1장, 어려움 2장이고 같은 단계는 하루 2번 성공까지 받아요. 코인 300개로 보급권 1장(하루 1번)도 바꿀 수 있어요.');
}
const sgStorageKey=kind=>`seoho_v1_${kind}_${cloud.user||'guest'}`;
function sgReadPending(kind){try{return JSON.parse(localStorage.getItem(sgStorageKey(kind))||'null');}catch{return null;}}
function sgKeepPending(kind,data){if(data)localStorage.setItem(sgStorageKey(kind),JSON.stringify(data));else localStorage.removeItem(sgStorageKey(kind));}
async function sgPost(path,payload){
  try{return await cloud.request(path,{method:'POST',body:JSON.stringify(payload)});}
  catch(e){if(e.status)throw e;return cloud.request(path,{method:'POST',body:JSON.stringify(payload)});}
}
async function sgRefresh(){
  if(!cloud.loggedIn)return;
  try{
    const pendingAction=sgReadPending('action');
    // 끊겼던 요청은 같은 요청 번호로 다시 보낸다. 서버가 저장한 같은 결과(보급 카드 포함)가 돌아오므로 결과 카드를 다시 보여 준다.
    if(pendingAction){try{const r=await sgPost('/guardian/action',pendingAction);sgKeepPending('action',null);sgApplyServer(r);if(r.draw&&sgUI&&!sgUI.dialog.open)sgUI.showDrawResult(r.draw);}catch(e){if(e.status&&e.status<500)sgKeepPending('action',null);else throw e;}}
    const pending=sgReadPending('result');
    if(pending){try{const r=await sgPost('/play/finish',pending);sgKeepPending('result',null);sgApplyServer({...r,active:null});}catch(e){if(e.data?.code==='EXPIRED')sgKeepPending('result',null);else throw e;}}
    sgApplyServer(await cloud.request('/guardian'));
  }catch(e){sgState.error=e.message;refreshMenuMeta();throw e;}
}
async function sgAction(payload){
  const previous=sgReadPending('action');
  if(previous){await sgRefresh();throw new Error('이전 작업을 확인했어요. 다시 골라 주세요.');}
  const a={...payload,clientVersion:2,requestId:crypto.randomUUID()};sgKeepPending('action',a);
  try{const r=await sgPost('/guardian/action',a);sgKeepPending('action',null);sgApplyServer(r);playSfx('cardSelect',.45);return r;}
  catch(e){if(e.status&&e.status<500)sgKeepPending('action',null);throw e;}
}
async function sgAbandon(){
  const active=sgState.active;if(!active)return;
  const r=await sgPost('/play/finish',{requestId:crypto.randomUUID(),runId:active.id,cleared:false,seconds:0,litter:0});
  sgApplyServer({...r,active:null});
}
async function sgStart(stage){
  await sgRefresh();
  if(sgState.active)throw new Error('진행 중인 도전을 먼저 정리해 주세요. 이용권은 줄지 않아요.');
  const r=await sgPost('/play/start',{stage,clientVersion:2,requestId:crypto.randomUUID()});
  sgApplyServer({...r,active:{id:r.runId,stage}});sgRunToken=r.runId;sgServerDuration=r.duration;
  selectedChapterId=stage;selectedMode='M01';
  bgmOff();   // 출동해서 전투가 시작되면 테마곡 정지(서버가 출동을 받아 준 뒤에만 — 실패하면 로비 음악은 계속)
  newRun(stage,'M01');
  mode='playing';elMenu.classList.add('hidden');elResult.classList.add('hidden');
  keys.clear();touchJoy.active=false;sgUI?.dialog.close();
  log('움직이면 공격은 자동! 첫 공격 스킬을 골라 주세요.');
  player.pendingLevels=1;sgChooseCards();
}
function sgRunConfig(stage){
  // 난이도 3단계(R.DIFFICULTIES): 쉬움 ★ · 보통 ★★ · 어려움 ★★★(특별한 적 special 비율)
  const p=sgRunProfile||sgState.profile,s=R.STAGES.find(s=>s.id===stage),duration=sgServerDuration||R.durationFor(p,stage),D=R.DIFFICULTIES[R.difficultyOf(p)];
  return {mode:'M01',chapterId:stage,rework:true,time:{id:'guardian',dur:duration,rewardMul:1},survival:true,bossStage:stage==='CH05',timeLimitS:duration,noBoss:true,timeScale:duration/900,beaconAtS:Math.min(150,duration-45),gemMul:.8,densityMul:s.density,multMul:1,mods:{lateDensity:D.density||1,stageHp:s.enemyHp,stageAtk:s.enemyAtk,diffHp:D.enemyHp,diffSpd:D.enemySpd,diffTaken:D.taken,enemyHpMul:s.enemyHp*D.enemyHp,enemySpdMul:D.enemySpd,takenMul:D.taken*s.enemyAtk,special:D.special,hpGrowth:D.hpGrowth,atkGrowth:D.atkGrowth},cardCap:duration===180?R.RUN_RULES.introChoices:R.RUN_RULES.normalChoices};
}
function sgChooseCards(reroll=false){
  mode='levelup';keys.clear();touchJoy.active=false;
  currentCards=R.cardChoices(sgRunProfile,player.skills,player.sgRun,player.hp/player.hpMax);
  elCardRow.innerHTML='';
  for(const c of currentCards){const b=document.createElement('button');b.className='card';b.innerHTML=sgCardHTML(c);b.onclick=()=>{if(mode!=='levelup')return;playSfx('cardSelect',.45);sgApplyCard(c);closeLevelUp();};elCardRow.append(b);}
  document.getElementById('lv-ops').innerHTML=`<button class="op big-op" id="op-reroll" ${player.rerolls>0?'':'disabled'}>다시 고르기 · ${player.rerolls}번 남음</button><span class="lv-pending">지금은 시간이 멈춰 있어요.</span>`;
  document.getElementById('op-reroll').onclick=()=>{if(player.rerolls<=0)return;player.rerolls--;sgChooseCards(true);};
  elLevelup.classList.remove('hidden');if(!reroll)playSfx('levelupOpen',.4);
}
function sgCardHTML(c){
  if(c.kind==='heal')return `${sgIcon('heart')}<span class="tag">회복</span><h3>체력 채우기</h3><p>최대 체력의 20%를 채워요.</p>`;
  if(c.kind==='shield')return `${sgIcon('shield')}<span class="tag">보호</span><h3>방패 충전</h3><p>체력의 12%만큼 보호막을 얻어요. 겹쳐 쌓이지 않아요.</p>`;
  if(c.kind==='evolve'){const d=R.COMBOS[c.id];return `${sgSkillImg(d,'sg-evo-icon')}<span class="tag evo">진화 · ${R.SKILLS[d.skill].name} + ${R.SUPPORTS[d.support].name}</span><h3>${d.name}</h3><p>${d.desc}</p><b>훨씬 크고 강해져요!</b>`;}
  if(c.kind==='support-new'||c.kind==='support-up'){const d=R.SUPPORTS[c.id],lv=player.sgRun.supports[c.id]?.lv||0,pair=Object.values(R.COMBOS).filter(x=>x.support===c.id).map(x=>`${R.SKILLS[x.skill].name}${player.skills[x.skill]?' ✓':''}`).join(' / ');
    return `${sgSkillImg(d)}<span class="tag">지원품 · ${lv+1}/3단계</span><h3>${d.name}</h3><p>${d.desc}<br/><b>${d.label(lv+1)}</b></p><small>진화 짝<br/><b>${pair}</b></small>`;}
  const d=R.SKILLS[c.id],lv=player.skills[c.id]?.lv||0,partners=R.SKILL_PARTNERS[c.id].map(id=>`${R.SUPPORTS[id].name}${player.sgRun.supports[id]?' ✓':''}`).join(' / ');
  return `${sgSkillImg(d)}<span class="tag">${R.ELEMENTS[d.element].name} · ${lv+1}/${R.RUN_RULES.maxSkillLevel}단계</span><h3>${d.name}</h3><p>${lv?d.levels[lv-1]:d.desc}</p><small>${R.RUN_RULES.maxSkillLevel}단계 + 짝 지원품이면 진화<br/><b>${partners}</b></small>${R.hasPart(sgRunProfile,c.id)?`<small class="sg-on sg-my-part">${sgSkillImg(d)} 내 파츠 · ${R.PARTS['PART_'+c.id].name}</small>`:''}`;
}
function sgApplyCard(c){
  const result=R.applyRunCard(player.skills,player.sgRun,c);player.sgChoices++;
  if(result.healed)player.hp=Math.min(player.hpMax,player.hp+player.hpMax*result.healed);
  if(result.shielded)player.shield=Math.max(player.shield,player.hpMax*result.shielded);
  if(c.kind==='skill-new'&&!player.sgUsedSkills.includes(c.id))player.sgUsedSkills.push(c.id);
  if(result.support){
    if(!player.sgUsedSupports.includes(c.id))player.sgUsedSupports.push(c.id);
    const d=R.SUPPORTS[c.id];
    if(d.stat==='hpPct'){const lv=player.sgRun.supports[c.id].lv,add=R.supportValue(c.id,lv)-(lv>1?R.supportValue(c.id,lv-1):0),plus=Math.round(player.hpMax*add/(1+R.supportValue(c.id,lv)-add));player.hpMax+=plus;player.hp+=plus;}
    floatingTexts.push({x:player.x,y:player.y-40,text:`${d.name} ${d.label(player.sgRun.supports[c.id].lv)}`,life:1.6,vy:-16,scale:0,color:'#ffe9a8',big:true});
  }
  if(result.fusion){
    player.sgUsedFusions.push(c.id);runStats.evolutions++;runStats.evoKinds.push(c.id);
    player.invulnT=Math.max(player.invulnT,1);
    floatingTexts.push({x:player.x,y:player.y-40,text:`진화! ${R.COMBOS[c.id].name}`,life:2,vy:-16,scale:0,color:'#ffe066',big:true});
    playSfx('levelupOpen',.65);log(`진화! ${R.COMBOS[c.id].name}`);
  }
}

// 동물 친구는 따라다니기만 하고 효과는 버프(R.petBuff → sgSupportStat)로 항상 붙는다(2026-09-23)
function sgPetTick(m,dt){
  m.x+=(player.x-1.3*U-m.x)*Math.min(1,dt*5);m.y+=(player.y+.65*U-m.y)*Math.min(1,dt*5);
  m.cd-=dt;if(m.cd>0)return;m.cd=6;sgPetFx(m,R.PETS[m.guardianPet]?.color||'#ffe9a8');
}
function sgPetFx(m,color){hitFx.push({x:m.x,y:m.y,life:.5,maxLife:.5,color});}
function sgPush(radius,boost=1){for(const e of enemiesInRadius(player.x,player.y,radius)){if(e===boss)continue;const a=Math.atan2(e.y-player.y,e.x-player.x);e.kbVx=Math.cos(a)*180*boost;e.kbVy=Math.sin(a)*180*boost;}blasts.push({x:player.x,y:player.y,radius,life:.35,maxLife:.35,color:'#b4ddde'});}
function sgThreatTick(dt){
  // Bottle enemies teach a slow, announced ordinary projectile from stage 1-2.
  // These can be blocked by the rock-orbit part; boss danger areas remain unblockable.
  for(const e of enemies){
    if(e.typeId!=='T1_BOTTLE'||chapter.index<1||e.hp<=0)continue;
    e.sgThrowCd=(e.sgThrowCd??(5+Math.random()*3))-dt;
    if(e.sgThrowCd<=0&&dist(e.x,e.y,player.x,player.y)<7*U){e.sgThrowCd=8;e.sgThrowWarn=.85;e.sgThrowAngle=Math.atan2(player.y-e.y,player.x-e.x);}
    if(e.sgThrowWarn>0){e.sgThrowWarn-=dt;if(e.sgThrowWarn<=0&&sgHostileShots.length<12)sgHostileShots.push({x:e.x,y:e.y,angle:e.sgThrowAngle,hostile:true,boss:false,life:2,damage:e.atk*.55});}
  }
  for(const s of sgHostileShots){
    if(s.life<=0)continue;s.life-=dt;s.x+=Math.cos(s.angle)*4.5*U*dt;s.y+=Math.sin(s.angle)*4.5*U*dt;
    if(dist(s.x,s.y,player.x,player.y)<.6*U){applyBossHit(s.damage);s.life=0;}
  }
  sgHostileShots=sgHostileShots.filter(s=>s.life>0);
}
function sgDrawThreats(){
  ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#8b2720';ctx.fillStyle='#f6b363';
  for(const e of enemies)if(e.sgThrowWarn>0){const q=worldToScreen(e.x,e.y);ctx.beginPath();ctx.arc(q.x,q.y,18,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+Math.cos(e.sgThrowAngle)*32,q.y+Math.sin(e.sgThrowAngle)*32);ctx.stroke();}
  for(const s of sgHostileShots){const q=worldToScreen(s.x,s.y);ctx.beginPath();ctx.arc(q.x,q.y,6,0,7);ctx.fill();ctx.stroke();}
  ctx.restore();
}
function sgGrowthTick(dt){
  if((player.sgChoices||0)>=runCfg.cardCap)gems.length=0;
  // Guaranteed opportunities and an XP queue, separated by at least five seconds of play.
  const paced=Math.min(runCfg.cardCap,1+Math.floor(runTime/(runCfg.timeLimitS/runCfg.cardCap)));
  if(mode==='playing'&&player.sgChoices<runCfg.cardCap&&runTime-player.sgLastChoice>=(R.RUN_RULES.minChoiceInterval||5)){
    if(player.sgChoices<paced&&!player.pendingLevels){player.lvl++;player.pendingLevels=1;}
    if(player.pendingLevels>0)sgChooseCards();
  }

  // Keep a reachable clean-up target on screen; recollecting never grants coins or passes.
  if(runTime>10&&runTime>=(player.sgLitterAt||0)&&!decor.some(d=>d.litter&&!d.opened&&dist(d.x,d.y,player.x,player.y)<7*U)){
    player.sgLitterAt=runTime+12;const a=Math.random()*Math.PI*2;
    decor.push({x:player.x+Math.cos(a)*3.8*U,y:player.y+Math.sin(a)*3.8*U,sprite:'t1_prop_litter',h:30,litter:true,flicker:0,opened:false});
  }
}
let sgHudSignature='';
function sgHud(){
  const active=player&&mode==='playing'; // Keep battle overlays behind selection and pause dialogs.
  const objective=document.getElementById('sg-objective'),tools=document.getElementById('sg-run-tools');
  if(!active){setText(objective,'');if(tools.childNodes.length)tools.replaceChildren();sgHudSignature='';return;}
  const st=R.STAGES[chapter.index],n=runStats.litter||0;
  const hard=runMods.special>0;
  setText(objective,runTime<10?'PC: 방향키 · WASD / 모바일: 화면을 끌어 이동해요':hard&&runTime<22?'어려움 ★★★ · 방패를 든 적에게는 방패 색깔 원소가 잘 안 통해요. 다른 원소나 기본 무기로 공격해요!':`쓰레기 줍기 ${Math.min(n,st.target)}/${st.target}${n>=st.target?' ✔ 코인 +30':''} · ${runCfg.bossPhase?'대장을 깨끗하게 해 주세요!':st.tip}`);
  // Main HUD owns the timer so it is not overwritten twice in one frame.
  setText(elLvl,`성장 ${Math.min(runCfg.cardCap,player.sgChoices||0)}/${runCfg.cardCap}${player.shield>1?' · 방패':''}`);
  // Main HUD also owns the XP bar.
  const sup=player.sgRun.supports||{};
  const signature=sgRunProfile.weaponMode+'|'+Object.entries(player.skills).map(([id,v])=>id+':'+v.lv).join(',')+'|'+Object.entries(sup).map(([id,v])=>id+':'+v.lv).join(',');
  if(signature===sgHudSignature)return;sgHudSignature=signature;
  const html=`<span title="기본 무기">${sgIcon('mode_'+sgRunProfile.weaponMode)}기본</span>`
    +Object.entries(player.skills).map(([id,v])=>{const d=R.SKILLS[id]||R.COMBOS[id];return `<span class="${R.COMBOS[id]?'sg-evo':''}" title="${d.name}">${sgSkillImg(d)}${R.COMBOS[id]?'진화':`${v.lv}/${R.RUN_RULES.maxSkillLevel}`}</span>`;}).join('')
    +Array.from({length:Math.max(0,R.RUN_RULES.skillSlots-Object.keys(player.skills).length)},()=>'<span class="sg-empty-slot">＋</span>').join('')
    +`<span class="sg-hud-gap"></span>`
    +Object.entries(sup).map(([id,v])=>{const d=R.SUPPORTS[id];return `<span class="sg-support" title="${d.name}">${sgSkillImg(d)}${v.lv}/3</span>`;}).join('')
    +Array.from({length:Math.max(0,R.RUN_RULES.supportSlots-Object.keys(sup).length)},()=>'<span class="sg-empty-slot sg-support">＋</span>').join('');
  tools.innerHTML=html;
}
function sgEnd(cleared){
  if(sgSettling||mode==='result')return;
  mode='result';sgSettling=true;elBossLabel.textContent='';keys.clear();touchJoy.active=false;
  elLevelup.classList.add('hidden');elPause.classList.add('hidden');elResult.classList.remove('hidden');
  const pending={requestId:crypto.randomUUID(),runId,cleared,seconds:Math.min(360,runTime),litter:runStats.litter||0,hpFraction:player.hp/player.hpMax,bossSeconds:runCfg.bossPhase?Math.max(0,runTime-runCfg.timeLimitS):null,skillIds:player.sgUsedSkills,fusionIds:player.sgUsedFusions,supportIds:player.sgUsedSupports||[],partEffects:sgElements.snapshot().parts,revives:runStats.revives||0};
  sgKeepPending('result',pending);sgSettle(pending);
}
async function sgSettle(pending){
  const btn=document.getElementById('btn-continue');btn.disabled=true;elResultTitle.textContent='모험을 기록하는 중…';
  elResultTable.innerHTML='<tr><td>잠깐만 기다려 주세요. 결과와 이용권을 확인하고 있어요.</td></tr>';
  try{
    const r=await sgPost('/play/finish',pending);sgKeepPending('result',null);sgApplyServer({...r,active:null});
    const w=r.reward,dn=R.DIFFICULTIES[w.difficulty]?.name;elResultTitle.textContent=r.cleared?'우리 마을이 반짝반짝!':'멋진 도전이었어요!';
    elResultTable.innerHTML=`<tr><td colspan="2" style="text-align:center;font-size:28px;color:#ffd16e">${'★'.repeat(w.stars)}${'☆'.repeat(3-w.stars)}${dn?`<div style="font-size:13px;color:#cfe3ee">${dn} 난이도${r.cleared?` 성공 → 별 ${w.stars}개`:''}</div>`:''}</td></tr><tr><td>코인</td><td>+${w.coins}${w.goal?' (환경 목표 +30 포함)':''}</td></tr><tr><td>보급권</td><td>+${w.gifts}${w.stageGift?.capped?' · 오늘 이 단계는 2번 다 받았어요. 다른 단계에 도전해 봐요!':w.stageGift?(w.stageGift.left?` · 오늘 이 단계 ${w.stageGift.left}번 더`:' · 오늘 이 단계 보급권은 여기까지! 다른 단계는 또 받아요'):''}</td></tr><tr><td>우정</td><td>+${w.friendship}</td></tr><tr><td>이용권</td><td>${r.charged?'1장 사용':'그대로!'} · ${r.passes.remaining}장 남음</td></tr><tr><td colspan="2"><div class="sg-settlement">${r.cleared?(w.notes.join('<br/>')||'코인으로 훈련하고 파츠 레벨을 올려 보세요.'):'실패해도 이용권은 줄지 않아요. 조금 쉬었다가 다시 도전해요.'}<br/>${R.STAGES.find(s=>s.id===r.stage).tip}</div></td></tr>`;
    for(const activity of w.partActivity||[]){
      const d=R.PARTS[activity.id];if(!d)continue;
      const times=Object.entries(pending.partEffects||{}).filter(([id])=>(R.COMBOS[id]?.skill||id)===d.skill).reduce((n,[,v])=>n+(Number.isFinite(v)?Math.max(0,Math.floor(v)):0),0);
      const row=document.createElement('tr'),name=document.createElement('td'),help=document.createElement('td');
      name.textContent=d.name;help.textContent=!activity.active?`${sgObj(R.SKILLS[d.skill].name)} 안 골라 이번 판에는 쉬었어요`:times?`기능이 ${times}번 발동했어요`:'스킬을 골랐어요 · 이번 판에는 추가 기능 발동 기록이 없어요';
      row.append(name,help);elResultTable.append(row);
    }
    playSfx('goldReward',.5);btn.textContent=R.pendingPet(r.profile)?'새 친구 만나러 가기':'마을로 돌아가기';btn.disabled=false;sgSettling=false;
  }catch(e){
    // 30분 넘게 멈춘 판은 서버가 이미 정리했다(보상 없음·이용권 그대로). 다시 해도 같은 답이므로 결과 화면에 갇히지 않게 바로 돌아가게 한다.
    if(e.data?.code==='EXPIRED'){
      sgKeepPending('result',null);sgApplyServer({active:null});
      elResultTitle.textContent='오래 멈춘 도전이 정리됐어요';elResultTable.innerHTML='<tr><td id="sg-result-error"></td></tr>';
      document.getElementById('sg-result-error').textContent=e.message;
      btn.textContent='마을로 돌아가기';btn.disabled=false;sgSettling=false;return;
    }
    elResultTitle.textContent='결과를 안전하게 보관했어요';elResultTable.innerHTML='<tr><td id="sg-result-error"></td></tr><tr><td><button id="sg-retry-result">결과 확인 다시 하기</button></td></tr>';
    document.getElementById('sg-result-error').textContent=e.message;
    document.getElementById('sg-retry-result').onclick=()=>sgSettle(pending);
  }
}
