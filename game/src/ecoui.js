// 로비 UI: 장비(인벤토리·합성·분해·각인·잠금)/부품/상자/프리셋, 상점 7종, 캐릭터 육성, 펫, 이벤트, 칭호.
import { EQUIPMENT, EQUIP_GRADES, SLOT_NAMES, SLOT_ORDER, equipMainStat, equipLevelCost, CHARACTERS, SKILLS, BOSSES } from "./content.js";
import { PETS, COLLECTIBLES, SETS, RARITY } from "./meta.js";
import * as E from "./economy.js";

let C = null;                       // main.js가 넘겨주는 컨텍스트
export function initEcoUI(ctx) { C = ctx; }
const S = () => C.save();
const done = (msg, sfx = "goldReward") => { if (msg) C.log(msg); C.sfx(sfx, 0.45); C.write(); C.refresh(); };
const gname = (g) => EQUIP_GRADES[g]?.name || "";
const gcol = (g) => EQUIP_GRADES[g]?.color || "#999";
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

// ---------- 토스트(상자 결과 등) ----------
export function toast(title, lines) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.getElementById("menu").appendChild(el); }
  el.innerHTML = `<div class="t-box"><div class="t-title">${esc(title)}</div>${lines.map((l) =>
    typeof l === "string" ? `<div class="t-line">${esc(l)}</div>` : `<div class="t-line" style="color:${l.color}">${esc(l.text)}</div>`).join("")}
    <button class="buy" id="toast-ok">확인</button></div>`;
  el.classList.remove("hidden");
  el.querySelector("#toast-ok").onclick = () => el.classList.add("hidden");
}

// ====================== 장비 탭 ======================
let gearSub = "equip", gearSlot = "WPN", sortBy = "grade", selUid = null;
export function setGearSub(s) { gearSub = s; }
export function renderGearTab() {
  const body = document.getElementById("gear-body");
  document.querySelectorAll("[data-gear]").forEach((b) => b.classList.toggle("on", b.dataset.gear === gearSub));
  if (gearSub === "equip") return renderEquip(body);
  if (gearSub === "part") return renderParts(body);
  if (gearSub === "chest") return renderChests(body);
  if (gearSub === "col") return C.renderCollectibles(body);   // 도감(수집품)은 가방 탭 안에서 보여 준다
  return renderPresets(body);
}
function renderEquip(body) {
  const save = S();
  const sets = E.equipSetCounts(save);
  const setTxt = Object.entries(sets).filter(([, n]) => n >= 2).map(([k, n]) =>
    `${E.EQUIP_SETS[k]?.name || k} ${n}세트`).join(" · ");
  const slotHtml = SLOT_ORDER.map((slot) => {
    const it = E.equippedItem(save, slot);
    return `<div class="slot ${slot === gearSlot ? "sel" : ""}" data-slot="${slot}" style="${it ? `border-color:${gcol(it.grade)}` : ""}">
      <div class="sl-name">${SLOT_NAMES[slot]}</div>
      <div class="sl-item" style="color:${it ? gcol(it.grade) : "#6f6659"}">${it ? EQUIPMENT[it.id].name : "비어 있음"}</div>
      ${it ? `<div class="sl-lv">Lv ${it.lv}${save.engrave[it.uid] ? " · 각인" : ""}</div>` : ""}</div>`;
  }).join("");
  const list = save.inv.filter((i) => EQUIPMENT[i.id].slot === gearSlot).sort((a, b) =>
    sortBy === "lv" ? b.lv - a.lv || b.grade - a.grade
      : sortBy === "set" ? EQUIPMENT[a.id].setId.localeCompare(EQUIPMENT[b.id].setId) || b.grade - a.grade
      : sortBy === "new" ? b.uid - a.uid : b.grade - a.grade || b.lv - a.lv);
  const cur = E.equippedItem(save, gearSlot);
  const preview = E.batchSynth(save, true);
  body.innerHTML = `
    <div class="slot-row">${slotHtml}</div>
    <div class="sub-tabs"><span class="tp">보관 ${save.inv.length}/200${setTxt ? ` · <b>${setTxt}</b>` : ""}</span></div>
    <div class="sub-tabs">
      ${["grade:등급", "lv:레벨", "set:세트", "new:획득순"].map((x) => { const [k, n] = x.split(":");
        return `<button class="chip-btn ${sortBy === k ? "on" : ""}" data-sort="${k}">${n}</button>`; }).join("")}
      <button class="buy" id="btn-batch" ${preview.length ? "" : "disabled"}>일괄 합성<small>${preview.length}회</small></button>
    </div>
    <div class="gear-list">${list.length ? list.map((it) => gearRow(save, it, cur)).join("") :
      `<div class="empty">${SLOT_NAMES[gearSlot]} 없음 — 챕터 클리어·상자에서 획득</div>`}</div>`;
  body.querySelectorAll("[data-slot]").forEach((el) => el.onclick = () => { gearSlot = el.dataset.slot; selUid = null; C.sfx("uiClick", 0.35); renderGearTab(); });
  body.querySelectorAll("[data-sort]").forEach((el) => el.onclick = () => { sortBy = el.dataset.sort; renderGearTab(); });
  body.querySelector("#btn-batch").onclick = () => {
    const r = E.batchSynth(save);
    toast("일괄 합성 완료", r.map((x) => ({ text: `${gname(x.grade)} ${EQUIPMENT[x.id].name}`, color: gcol(x.grade) })));
    done(`일괄 합성 ${r.length}회`);
  };
  body.querySelectorAll("[data-act]").forEach((b) => b.onclick = (ev) => {
    ev.stopPropagation();
    const [act, u] = b.dataset.act.split(":"); const uid = +u; const it = E.invItem(save, uid);
    if (act === "sel") { selUid = selUid === uid ? null : uid; return renderGearTab(); }
    if (act === "equip") { save.equipped[gearSlot] = uid; return done(null, "cardSelect"); }
    if (act === "lock") { it.locked = !it.locked; return done(null, "uiClick"); }
    if (act === "lv") {
      const price = equipLevelCost(it.grade, it.lv);
      if (save.currencies.GOLD < price || it.lv >= EQUIP_GRADES[it.grade].maxLv) return;
      save.currencies.GOLD -= price; it.lv++; E.bump(save, "equipLv", 1);
      return done(null);
    }
    if (act === "lv10") {
      let n = 0;
      while (n < 10 && it.lv < EQUIP_GRADES[it.grade].maxLv && save.currencies.GOLD >= equipLevelCost(it.grade, it.lv)) {
        save.currencies.GOLD -= equipLevelCost(it.grade, it.lv); it.lv++; n++;
      }
      if (n) E.bump(save, "equipLv", n);
      return done(`레벨업 ×${n}`);
    }
    if (act === "syn") {
      const r = E.synthesize(save, uid);
      if (r) { toast("합성 성공!", [{ text: `${gname(r.item.grade)} ${EQUIPMENT[r.item.id].name}`, color: gcol(r.item.grade) }, r.refund ? `레벨 금화 환급 ${r.refund.toLocaleString()}` : "결과 Lv1"]); done(null, "levelupOpen"); }
      return;
    }
    if (act === "dis") {
      const r = E.dismantle(save, uid);
      if (r) { toast("분해 완료", [`${r.out.length ? `하위 등급 재료 ${r.out.length}개 환급` : ""}`, r.gold ? `레벨 금화 90% 환급 ${r.gold.toLocaleString()}` : ""].filter(Boolean)); selUid = null; done(null); }
      return;
    }
    if (act.startsWith("eng")) {
      const kind = act.slice(3);
      if (E.engrave(save, uid, kind)) done("각인 부여");
    }
  });
}
function gearRow(save, it, cur) {
  const def = EQUIPMENT[it.id]; const g = EQUIP_GRADES[it.grade];
  const on = E.isEquipped(save, it.uid);
  const stat = equipMainStat(def, it.grade, it.lv);
  const diff = cur && !on && EQUIPMENT[cur.id].mainStat === def.mainStat ? stat - equipMainStat(EQUIPMENT[cur.id], cur.grade, cur.lv) : null;
  const opts = [it.grade >= 2 && def.optRare, it.grade >= 3 && def.optEpic, it.grade >= 4 && def.legendEffect].filter(Boolean);
  const price = equipLevelCost(it.grade, it.lv);
  const maxed = it.lv >= g.maxLv;
  const open = selUid === it.uid;
  const plan = open ? E.synthPlan(save, it) : null;
  const eng = save.engrave[it.uid];
  return `<div class="shop-item gear ${open ? "open" : ""}" data-act="sel:${it.uid}">
    <div class="si-icon" style="border-color:${g.color};color:${g.color}">${def.mainStat === "atk" ? "⚔" : "🛡"}</div>
    <div class="si-main">
      <div class="si-name" style="color:${g.color}">${it.locked ? "🔒" : ""}${def.name}<em>${g.name} · Lv ${it.lv}/${g.maxLv} · ${E.EQUIP_SETS[def.setId]?.name || ""}</em></div>
      <div class="si-val">${def.mainStat === "atk" ? "공격력" : "체력"} +${stat}${diff != null ? ` <b style="color:${diff >= 0 ? "#7ee08a" : "#ff7a6a"}">(${diff >= 0 ? "+" : ""}${diff})</b>` : ""}${on ? " · 착용 중" : ""}</div>
      ${opts.length ? `<div class="si-desc">${opts.map(esc).join(" · ")}</div>` : ""}
      ${eng ? `<div class="si-desc" style="color:#ff9a6a">각인: ${E.ENGRAVES.find((x) => x.id === eng)?.name}</div>` : ""}
      ${open ? `<div class="gear-ops">
        <button class="buy" data-act="lock:${it.uid}">${it.locked ? "잠금 해제" : "잠금"}</button>
        <button class="buy" data-act="lv10:${it.uid}" ${maxed || save.currencies.GOLD < price ? "disabled" : ""}>레벨 ×10</button>
        <button class="buy" data-act="syn:${it.uid}" ${plan?.mats ? "" : "disabled"}>합성${plan?.mats ? `<small>→ ${gname(it.grade + 1)}</small>` : `<small>${esc(plan?.need || "최고 등급")}</small>`}</button>
        <button class="buy" data-act="dis:${it.uid}" ${on || it.locked ? "disabled" : ""}>분해</button>
        ${it.grade >= 5 ? E.ENGRAVES.map((x) => `<button class="buy" data-act="eng${x.id}:${it.uid}">${x.name}<small>🔨${eng ? 25 : 50}${eng ? "" : " 💰100k"}</small></button>`).join("") : ""}
      </div>` : ""}
    </div>
    <div class="gear-btns">
      <button class="buy" data-act="equip:${it.uid}" ${on ? "disabled" : ""}>${on ? "착용 중" : "착용"}</button>
      <button class="buy" data-act="lv:${it.uid}" ${maxed || save.currencies.GOLD < price ? "disabled" : ""}>${maxed ? "최대" : "강화"}${maxed ? "" : `<small>💰 ${price.toLocaleString()}</small>`}</button>
    </div>
  </div>`;
}

// ---------- 부품 ----------
let partView = "all";
function renderParts(body) {
  const save = S();
  const unlocked = C.highestCleared() >= 5;
  if (!unlocked) { body.innerHTML = `<div class="empty">🔒 부품은 CH05 클리어 후 해금됩니다.</div>`; return; }
  const slotBtn = (kind, i) => {
    const id = save.partSlots[kind][i]; const p = id && E.partById(id); const g = id ? E.partGrade(save, id) : -1;
    return `<div class="slot" data-pslot="${kind}:${i}" style="${p ? `border-color:${gcol(g)}` : ""}">
      <div class="sl-name">${kind === "atk" ? "공격" : "보조"} ${i + 1}</div>
      <div class="sl-item" style="color:${p ? gcol(g) : "#6f6659"}">${p ? p.name : "비어 있음"}</div>
      ${p ? `<div class="sl-lv">${gname(g)}${save.resonance[id] ? " · 공명" : ""}</div>` : ""}</div>`;
  };
  const owned = E.PARTS.filter((p) => E.partGrade(save, p.id) >= 0);
  const shown = partView === "all" ? E.PARTS : owned;
  body.innerHTML = `
    <div class="slot-row">${[0, 1, 2].map((i) => slotBtn("atk", i)).join("")}${[0, 1].map((i) => slotBtn("sup", i)).join("")}</div>
    <div class="sub-tabs"><span class="tp">⚙️ 코어 <b>${save.currencies.CORE}</b> · 보유 ${owned.length}/24 · 공명 ${Object.keys(save.resonance).length}/3</span>
      <button class="buy" id="btn-partbox" ${save.currencies.CORE >= 30 ? "" : "disabled"}>부품 상자<small>⚙️30 · 천장 ${40 - ((save.pity.RW_PART_CHEST || 0) % 40)}</small></button>
      <button class="chip-btn ${partView === "all" ? "on" : ""}" data-pv="all">전체</button><button class="chip-btn ${partView === "own" ? "on" : ""}" data-pv="own">보유</button></div>
    <div class="note">공격 슬롯: 능력치 + 동작 변경(영웅↑) · 보조 슬롯: 능력치만 · ★ 선호 스킬 3개는 상자 가중치 ×2</div>
    <div class="gear-list">${shown.map((p) => {
      const g = E.partGrade(save, p.id); const c = save.parts[p.id] || [0, 0, 0, 0, 0, 0];
      const fav = save.partFav.includes(p.skill);
      const eqAt = save.partSlots.atk.includes(p.id) ? "공격" : save.partSlots.sup.includes(p.id) ? "보조" : "";
      return `<div class="shop-item ${g < 0 ? "dim" : ""}">
        <div class="si-icon" style="border-color:${gcol(g)};color:${gcol(g)}">⚙</div>
        <div class="si-main">
          <div class="si-name" style="color:${g >= 0 ? gcol(g) : "#aaa"}">${p.name}<em>${SKILLS[p.skill]?.name || p.skill} · ${g >= 0 ? gname(g) : "미보유"}${eqAt ? ` · ${eqAt} 장착` : ""}</em></div>
          <div class="si-val">능력치: ${p.stat === "hp" ? "체력" : "공격력"} +${g >= 0 ? p.vals[g] : p.vals[0]}% · 보유 ${c.map((n, i) => n ? `${gname(i)}${n}` : "").filter(Boolean).join(" ") || "-"}</div>
          <div class="si-desc">영웅: ${esc(p.epic)}<br>전설: ${esc(p.legend)} · 신화: ${esc(p.myth)}<br>공명: ${esc(p.res)}</div>
          ${g >= 0 ? `<div class="gear-ops">
            ${[0, 1, 2].map((i) => `<button class="buy" data-peq="atk:${i}:${p.id}">공격${i + 1}</button>`).join("")}
            ${[0, 1].map((i) => `<button class="buy" data-peq="sup:${i}:${p.id}">보조${i + 1}</button>`).join("")}
            ${[0, 1, 2, 3, 4].map((gg) => c[gg] >= (gg === 4 ? 2 : 3) ? `<button class="buy" data-psyn="${p.id}:${gg}">${gname(gg)}→${gname(gg + 1)}${gg === 4 ? "<small>⚙️100</small>" : ""}</button>` : "").join("")}
            ${g >= 5 && !save.resonance[p.id] ? `<button class="buy" data-pres="${p.id}" ${C.highestCleared() >= 30 && save.currencies.CORE >= 200 ? "" : "disabled"}>공명<small>⚙️200 · CH30</small></button>` : ""}
            ${c.map((n, gg) => n > 0 ? `<button class="buy" data-pdis="${p.id}:${gg}">분해 ${gname(gg)}</button>` : "").join("")}
          </div>` : ""}
        </div>
        <button class="buy" data-pfav="${p.skill}">${fav ? "★" : "☆"}</button>
      </div>`;
    }).join("")}</div>`;
  body.querySelector("#btn-partbox").onclick = () => {
    save.currencies.CORE -= 30; const r = E.openChest(save, "RW_PART_CHEST");
    toast("부품 상자", [{ text: r.text, color: r.color }]); done(null, "levelupOpen");
  };
  body.querySelectorAll("[data-pv]").forEach((b) => b.onclick = () => { partView = b.dataset.pv; renderGearTab(); });
  body.querySelectorAll("[data-peq]").forEach((b) => b.onclick = () => { const [k, i, id] = b.dataset.peq.split(":"); E.equipPart(save, k, +i, id); done(null, "cardSelect"); });
  body.querySelectorAll("[data-pslot]").forEach((b) => b.onclick = () => { const [k, i] = b.dataset.pslot.split(":"); save.partSlots[k][+i] = null; done(null, "uiClick"); });
  body.querySelectorAll("[data-psyn]").forEach((b) => b.onclick = () => { const [id, g] = b.dataset.psyn.split(":"); if (E.partSynth(save, id, +g)) done(`부품 합성: ${E.partById(id).name} ${gname(+g + 1)}`, "levelupOpen"); });
  body.querySelectorAll("[data-pdis]").forEach((b) => b.onclick = () => { const [id, g] = b.dataset.pdis.split(":"); if (E.partDismantle(save, id, +g)) done("부품 분해(100% 환급)"); });
  body.querySelectorAll("[data-pres]").forEach((b) => b.onclick = () => { if (E.resonate(save, b.dataset.pres)) done("부품 공명!", "levelupOpen"); });
  body.querySelectorAll("[data-pfav]").forEach((b) => b.onclick = () => {
    const s = b.dataset.pfav; const i = save.partFav.indexOf(s);
    if (i >= 0) save.partFav.splice(i, 1); else if (save.partFav.length < 3) save.partFav.push(s);
    done(null, "uiClick");
  });
}

// ---------- 상자 보관함 ----------
function renderChests(body) {
  const save = S();
  const ids = Object.keys(E.CHESTS).filter((k) => k.startsWith("RW_EQ_CHEST"));
  body.innerHTML = `
    <div class="note">모험을 성공하면 받는 선물 상자예요. 열면 장비가 나와요!${save.currencies.BLUEPRINT ? ` · 📜 설계도 ${save.currencies.BLUEPRINT}/30` : ""}</div>
    <div class="gear-list">${ids.map((k) => {
      const t = E.CHESTS[k]; const n = save.chests[k] || 0;
      const odds = t.rows.map((r) => `${gname(r.grade)} ${r.w}%`).join(" / ");
      const pity = t.pity.map((p) => `${p.every - ((save.pity[k] || 0) % p.every)}회 후 ${gname(p.grade)} 확정`).join(" · ");
      return `<div class="shop-item ${n ? "" : "dim"}">
        <div class="si-icon">🎁</div>
        <div class="si-main"><div class="si-name">${t.name}<em>보유 ${n}</em></div>
          <div class="si-desc">${odds}</div>${pity ? `<div class="si-val">${pity}</div>` : ""}
          ${k === "RW_EQ_CHEST_L" && n ? `<div class="gear-ops">${SLOT_ORDER.map((s) => `<button class="buy" data-open="${k}:${s}">${SLOT_NAMES[s]}</button>`).join("")}</div>` : ""}
        </div>
        <div class="gear-btns"><button class="buy" data-open="${k}" ${n ? "" : "disabled"}>열기</button>
          <button class="buy" data-openall="${k}" ${n > 1 ? "" : "disabled"}>모두</button></div>
      </div>`;
    }).join("")}</div>`;
  const maxCh = C.highestCleared() + 1;
  body.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => {
    const [k, slot] = b.dataset.open.split(":");
    const r = E.openStoredChest(save, k, { slot, maxChapter: maxCh });
    if (r) { toast(E.CHESTS[k].name, [{ text: r.text, color: r.color }]); done(null, "levelupOpen"); }
  });
  body.querySelectorAll("[data-openall]").forEach((b) => b.onclick = () => {
    const k = b.dataset.openall; const out = [];
    while ((save.chests[k] || 0) > 0 && out.length < 50) { const r = E.openStoredChest(save, k, { maxChapter: maxCh }); if (r) out.push({ text: r.text, color: r.color }); }
    toast(`${E.CHESTS[k].name} ×${out.length}`, out); done(null, "levelupOpen");
  });
}

// ---------- 프리셋 ----------
function renderPresets(body) {
  const save = S();
  if (C.highestCleared() < 3) { body.innerHTML = `<div class="empty">🔒 빌드 프리셋은 CH03 클리어 후 해금됩니다.</div>`; return; }
  const n = E.PRESET_MAX + (save.account.level >= 30 ? 1 : 0);          // 계정 Lv30 프리셋 +1 (docs/11 §7)
  const bp = save.blueprint;
  const nm = (id) => SKILLS[id]?.name || C.passiveName(id);
  body.innerHTML = `<div class="set-card ev"><div class="set-head">빌드 청사진 <span>목표 카드 가중치 ×1.4 · 레벨업 카드에 ★</span></div>
      ${bp ? `<div class="si-val">${esc(bp.name)}: ${bp.attack.map(nm).join(", ")}</div><div class="si-desc">패시브: ${bp.passive.map(nm).join(", ")}</div>` : `<div class="si-desc">지정된 청사진 없음</div>`}
      <div class="gear-ops"><button class="buy" data-bp="last" ${save.lastBuild ? "" : "disabled"}>지난 판 빌드를 청사진으로</button><button class="buy" data-bp="clear" ${bp ? "" : "disabled"}>해제</button></div></div>
    <div class="note">추천 빌드 12 (builds.json) — 청사진 지정 또는 보유 중인 캐릭터·장비·부품·펫까지 한 번에 적용 · 달성 ${save.buildClears.length}/12</div>
    <div class="gear-list">${E.BUILDS.map((b) => `<div class="shop-item ${save.buildClears.includes(b.id) ? "" : ""}">
      <div class="si-icon">${save.buildClears.includes(b.id) ? "✅" : b.id}</div>
      <div class="si-main"><div class="si-name">${esc(b.name)}<em>${CHARACTERS.find((c) => c.id === b.character)?.name} · ${b.modes.join("/")}</em></div>
        <div class="si-desc">${b.attack.map(nm).join(" · ")}</div><div class="si-desc">핵심: ${b.essential.map(nm).join(", ")} · 진화 ${esc(b.evo.join(" → "))}</div></div>
      <div class="gear-btns"><button class="buy" data-bp="set:${b.id}">청사진</button><button class="buy" data-bp="all:${b.id}">전체 적용</button></div></div>`).join("")}</div>
    <div class="note" style="margin-top:10px">장비 6 + 부품 5 + 펫 3 + 캐릭터 1 + 청사진을 한 번에 저장·불러오기</div>
    <div class="gear-list">${Array.from({ length: n }, (_, i) => {
      const p = save.presets[i];
      const desc = p ? `${CHARACTERS.find((c) => c.id === p.character)?.name} · 장비 ${Object.values(p.equipped).filter(Boolean).length}/6 · 부품 ${[...p.partSlots.atk, ...p.partSlots.sup].filter(Boolean).length}/5 · 펫 ${[p.activePet, ...p.petAssist].filter(Boolean).length}/3` : "비어 있음";
      return `<div class="shop-item"><div class="si-icon">${i + 1}</div>
        <div class="si-main"><div class="si-name">${p ? esc(p.name) : `프리셋 ${i + 1}`}</div><div class="si-desc">${desc}</div></div>
        <div class="gear-btns"><button class="buy" data-psave="${i}">저장</button><button class="buy" data-pload="${i}" ${p ? "" : "disabled"}>불러오기</button></div></div>`;
    }).join("")}</div>`;
  body.querySelectorAll("[data-bp]").forEach((b) => b.onclick = () => {
    const [a, id] = b.dataset.bp.split(":");
    if (a === "last") E.setBlueprint(save, { name: "지난 판 빌드", ...save.lastBuild });
    if (a === "clear") E.setBlueprint(save, null);
    if (a === "set") E.setBlueprint(save, E.BUILDS.find((x) => x.id === id));
    if (a === "all") { const bd = E.BUILDS.find((x) => x.id === id); toast("추천 빌드 적용", E.applyRecommended(save, bd, C.charUnlocked(CHARACTERS.find((c) => c.id === bd.character)))); }
    done(null, "cardSelect");
  });
  body.querySelectorAll("[data-psave]").forEach((b) => b.onclick = () => { E.savePreset(save, +b.dataset.psave); done(`프리셋 ${+b.dataset.psave + 1} 저장`, "cardSelect"); });
  body.querySelectorAll("[data-pload]").forEach((b) => b.onclick = () => { E.loadPreset(save, +b.dataset.pload); done(`프리셋 ${+b.dataset.pload + 1} 적용`, "cardSelect"); });
}

// ====================== 캐릭터 육성(상세 하단) ======================
export function charGrowthHtml(c, unlocked) {
  const save = S(); const st = E.charState(save, c.id);
  const bond = E.bondLevel(save, C.charUnlocked);
  const seals = save.seals[c.id] || 0;
  const promoCost = E.PROMO_COST[st.promo]; const awkCost = E.AWAKEN_COST[st.awk];
  const acc = save.account.level;
  const raw = C.charRaw(c.id);
  return `<div class="cd-grow">
    <div class="cd-row"><em>레벨</em> Lv ${st.lv}/60 (ATK·HP +${2 * (st.lv - 1)}%)
      <button class="buy sm" data-cg="lv" ${unlocked && st.lv < Math.min(60, acc + 5) && save.currencies.GOLD >= E.charLvCost(st.lv) ? "" : "disabled"}>레벨업<small>💰${E.charLvCost(st.lv).toLocaleString()}${st.lv >= acc + 5 ? " · 계정Lv+5 상한" : ""}</small></button></div>
    <div class="cd-row"><em>승급</em> ${"◆".repeat(st.promo)}${"◇".repeat(5 - st.promo)} (ATK·HP +${6 * st.promo}%) · 인장 <b>${seals}</b>
      <button class="buy sm" data-cg="promo" ${unlocked && st.promo < 5 && seals >= promoCost ? "" : "disabled"}>승급<small>${st.promo < 5 ? `인장 ${promoCost}` : "최대"}</small></button></div>
    <div class="cd-row sm">3단계: ${esc(raw.promo3 || "-")} · 5단계: ${esc(raw.promo5 || "-")}</div>
    <div class="cd-row"><em>각성</em> ${"★".repeat(st.awk)}${"☆".repeat(3 - st.awk)} · 💎 ${save.currencies.AWAKEN}
      <button class="buy sm" data-cg="awk" ${unlocked && st.awk < 3 && C.highestCleared() >= 40 && save.currencies.AWAKEN >= awkCost ? "" : "disabled"}>각성<small>${st.awk < 3 ? `💎${awkCost}${C.highestCleared() < 40 ? " · CH40" : ""}` : "최대"}</small></button></div>
    <div class="cd-row sm">1: 판당 부활 +1 · 2: ${esc(raw.awaken2 || "-")} · 3: ${esc(raw.awaken3 || "-")}</div>
    <div class="cd-row"><em>파수단 결속</em> Lv ${bond}/50 — 전 캐릭터 ATK·HP +${bond}%</div>
    <div class="cd-row"><em>인장 선택</em> 🎫 ${save.currencies.SEALBOX}
      <button class="buy sm" data-cg="box10" ${save.currencies.SEALBOX >= 1 ? "" : "disabled"}>이 캐릭터에 10</button>
      ${!unlocked ? `<button class="buy sm" data-cg="unlock" ${seals >= 30 ? "" : "disabled"}>인장 30으로 해금</button>` : ""}</div>
  </div>`;
}
export function bindCharGrowth(root, c) {
  const save = S();
  root.querySelectorAll("[data-cg]").forEach((b) => b.onclick = () => {
    const a = b.dataset.cg;
    if (a === "lv") { const r = E.charLevelUp(save, c.id, save.account.level); if (r.ok) done(`${c.name} 레벨업`); }
    if (a === "promo" && E.charPromote(save, c.id)) done(`${c.name} 승급!`, "levelupOpen");
    if (a === "awk" && E.charAwaken(save, c.id)) done(`${c.name} 각성!`, "levelupOpen");
    if (a === "box10") { const n = E.useSealBox(save, c.id, 10); if (n) done(`${c.name} 인장 +${n}`); }
    if (a === "unlock" && E.charUnlockBySeal(save, c.id)) done(`${c.name} 해금!`, "levelupOpen");
  });
}

// ====================== 펫 ======================
export function renderPets(el) {
  const save = S();
  const owned = PETS.filter((p) => save.pets[p.id]);
  const pityMissing = 10 - ((save.pity.RW_PET_CHEST || 0) % 10);
  el.innerHTML = `
    <div class="sub-tabs"><span class="tp">보유 ${owned.length}/${PETS.length} · 🍖 ${save.currencies.FOOD} · 💎 ${save.currencies.AWAKEN}${owned.length >= 12 ? " · 도감 완성(펫 체력 +10%)" : ""}</span>
      <button class="buy" id="btn-petbox" ${save.currencies.DUST >= 150 ? "" : "disabled"}>친구 동물 상자<small>✨150 · 새 친구 확정 ${pityMissing}회</small></button></div>
    <div class="note">같이 가는 친구 1마리는 함께 싸우고, 응원 친구 2마리는 응원 능력만 보태 줘요(같은 능력은 겹치지 않아요). 같은 친구 3마리 → 등급 상승</div>
    <div class="shop-list">${PETS.map((p) => {
      const o = save.pets[p.id];
      const on = save.activePet === p.id; const ai = save.petAssist.indexOf(p.id);
      return `<div class="shop-item ${o ? "" : "dim"}">
        <div class="si-icon" style="${o ? `border-color:${gcol(o.grade)}` : ""}">🐾</div>
        <div class="si-main">
          <div class="si-name" style="${o ? `color:${gcol(o.grade)}` : ""}">${p.name}<em>${o ? `${gname(o.grade)} · Lv ${o.lv}/50${o.evo ? " · 진화" : ""}${o.awk ? " · 각성" : ""} · 중복 ${o.dup}` : "아직 없음"} · ${p.role}</em></div>
          <div class="si-desc">같이 가면: ${esc(p.deploySkill)}</div>
          <div class="si-val">응원하면: ${esc(p.assist)}${o ? ` · 힘 ×${E.petPower(save, p.id).toFixed(2)}` : ""}</div>
          ${o ? `<div class="gear-ops">
            <button class="buy" data-pa="on:${p.id}" ${on ? "disabled" : ""}>${on ? "같이 가는 중" : "같이 가기"}</button>
            <button class="buy" data-pa="as0:${p.id}" ${ai === 0 ? "disabled" : ""}>응원 1</button>
            <button class="buy" data-pa="as1:${p.id}" ${ai === 1 ? "disabled" : ""}>응원 2</button>
            <button class="buy" data-pa="lv:${p.id}" ${o.lv < 50 && save.currencies.FOOD >= E.petFoodCost(o.lv) ? "" : "disabled"}>레벨업<small>🍖${E.petFoodCost(o.lv)}</small></button>
            <button class="buy" data-pa="gr:${p.id}" ${o.grade < 4 && o.dup >= 2 ? "" : "disabled"}>등급↑<small>중복 2</small></button>
            <button class="buy" data-pa="evo:${p.id}" ${!o.evo && o.grade >= 3 && save.currencies.AWAKEN >= 5 ? "" : "disabled"}>진화<small>영웅·💎5</small></button>
            <button class="buy" data-pa="awk:${p.id}" ${!o.awk && o.grade >= 4 && save.currencies.AWAKEN >= 15 ? "" : "disabled"}>각성<small>전설·💎15</small></button>
          </div>` : `<div class="si-lock">${esc(p.unlock)}</div>`}
        </div></div>`;
    }).join("")}</div>`;
  el.querySelector("#btn-petbox").onclick = () => {
    save.currencies.DUST -= 150; const r = E.openChest(save, "RW_PET_CHEST");
    if (!save.activePet) save.activePet = Object.keys(save.pets)[0];
    toast("펫 상자", [{ text: r.text, color: r.color }]); done(null, "levelupOpen");
  };
  el.querySelectorAll("[data-pa]").forEach((b) => b.onclick = () => {
    const [a, id] = b.dataset.pa.split(":");
    if (a === "on") { save.activePet = id; save.petAssist = save.petAssist.map((x) => (x === id ? null : x)); }
    if (a === "as0" || a === "as1") {
      const i = +a.slice(2); const assist = PETS.find((p) => p.id === id).assist;
      const other = save.petAssist[1 - i];
      if (other && PETS.find((p) => p.id === other).assist === assist) { C.log("같은 지원 스킬은 중복 불가"); return; }
      if (save.activePet === id) save.activePet = null;
      save.petAssist[i] = id;
    }
    if (a === "lv") E.petLevelUp(save, id);
    if (a === "gr") E.petGradeUp(save, id);
    if (a === "evo") E.petEvolve(save, id);
    if (a === "awk") E.petAwaken(save, id);
    done(null, "cardSelect");
  });
}

// ====================== 상점 탭 ======================
let shopSub = "train";
export function renderShopTab(renderTrain) {
  const save = S();
  // 초등학생용 단순화: 강해지기(훈련소)와 별가루 가게만. 모드 전용 상점(훈장·무한·위험 구역·보스 점수·원정)은 모드와 함께 숨김
  const tabs = [["train", "강해지기"], ...(E.SHOPS.RW_SHOP_DUST ? [["RW_SHOP_DUST", "별가루 가게"]] : [])];
  if (!tabs.some(([k]) => k === shopSub)) shopSub = "train";
  document.getElementById("shop-tabs").innerHTML = tabs.map(([k, n]) =>
    `<button class="chip-btn ${shopSub === k ? "on" : ""}" data-shop="${k}">${n}</button>`).join("");
  document.querySelectorAll("[data-shop]").forEach((b) => b.onclick = () => { shopSub = b.dataset.shop; C.sfx("uiClick", 0.35); renderShopTab(renderTrain); });
  const list = document.getElementById("shop-list");
  if (shopSub === "train") return renderTrain(list);
  renderShopList(list, E.SHOPS[shopSub]);
}
function renderShopList(list, shop, discount) {
  const save = S();
  const mode = E.SHOP_MODE[shop.id];
  const locked = mode && !C.modeUnlocked(mode);
  list.innerHTML = `<div class="sub-tabs"><span class="tp">${esc(shop.fullName)} · 보유 ${E.curIcon(shop.cur)} <b>${(save.currencies[shop.cur] || 0).toLocaleString()}</b></span></div>
    ${locked ? `<div class="empty">🔒 ${mode} 모드 해금 후 이용 가능</div>` : ""}
    ${shop.items.map((it) => {
      const bought = E.shopBought(save, it);
      const price = E.shopPrice(save, it);
      const can = !locked && E.shopCanBuy(save, shop, it);
      const lim = it.period === "none" ? "무제한" : `${it.limitText} (${bought}/${it.after != null ? 1 : it.limit})`;
      return `<div class="shop-item ${can ? "" : "dim"}">
        <div class="si-icon">${shopIcon(it.name)}</div>
        <div class="si-main"><div class="si-name">${esc(it.name)}${it.qty > 1 ? ` ×${it.qty}` : ""}<em>${esc(lim)}</em></div>
          ${it.note ? `<div class="si-desc">${esc(it.note)}</div>` : ""}</div>
        <button class="buy" data-sbuy="${it.key}" ${can ? "" : "disabled"}>구매<small>${E.curIcon(shop.cur)} ${price.toLocaleString()}</small></button>
      </div>`;
    }).join("")}`;
  list.querySelectorAll("[data-sbuy]").forEach((b) => b.onclick = () => {
    const it = shop.items.find((x) => x.key === b.dataset.sbuy);
    const out = E.shopBuy(save, shop, it, { maxChapter: C.highestCleared() + 1 });
    if (out) { toast(`구매: ${it.name}`, out); done(null, "goldReward"); }
  });
}
function shopIcon(n) {
  return /인장/.test(n) ? "🎫" : /부품/.test(n) ? "⚙️" : /강화석/.test(n) ? "🔨" : /에너지/.test(n) ? "⚡" : /펫|PT/.test(n) ? "🐾"
    : /장비 상자/.test(n) ? "🎁" : /SET|수집/.test(n) ? "🧩" : /각성석/.test(n) ? "💎" : /설계도/.test(n) ? "📜" : /티켓/.test(n) ? "🎟️" : /특성/.test(n) ? "🔷" : "🛒";
}

// ====================== 임무 탭: 이벤트 · 칭호 ======================
export function renderEvents(el) {
  const save = S();
  const settled = E.settleOldEvents(save);
  if (settled.length) { toast("이벤트 종료 정산", settled); C.write(); }
  const cleared = C.highestCleared();
  const evs = E.activeEvents();
  el.innerHTML = evs.map((a) => {
    const ok = E.eventUnlocked(a, save.account.level, cleared);
    const s = E.eventState(save, a);
    const days = Math.max(0, Math.ceil(((a.endsWeek * 7 * 86400000 + Date.UTC(2026, 0, 5)) - Date.now()) / 86400000));
    return `<div class="set-card ev">
      <div class="set-head">${a.def.name} <span>${days}일 남음 · ${a.def.tokenName} ${a.tpl === "EV_T6" ? s.tally : a.tpl === "EV_T5" ? s.ingr.join("/") : (save.currencies[a.def.tokenId] || 0)} · 오늘 ${s.gainedToday}/${a.def.dailyCap}</span></div>
      <div class="si-desc">${esc(a.def.participation)}</div>
      <div class="si-desc" style="color:#bfae8a">획득: ${esc(a.def.sources)}</div>
      ${ok ? eventBody(save, a, s) : `<div class="si-lock">🔒 계정 Lv15 + ${a.def.unlock} 클리어 필요 (현재 Lv${save.account.level})</div>`}
    </div>`;
  }).join("");
  bindEvents(el, evs);
}
function eventBody(save, a, s) {
  const shop = E.SHOPS[a.def.shop];
  const shopBtn = shop ? `<button class="buy" data-evshop="${a.def.shop}">교환소</button>` : "";
  switch (a.tpl) {
    case "EV_T1": {
      const cells = E.boardCells(a.inst);
      const ic = { start: "🏁", reward: "🎁", battle: "⚔️", shop: "🏷️", warp: "🌀" };
      return `<div class="board">${cells.map((c, i) => `<span class="bc ${i === s.pos ? "me" : ""}">${i === s.pos ? "🧙" : ic[c]}</span>`).join("")}</div>
        <div class="gear-ops"><button class="buy" data-ev="roll:${a.inst}" ${(save.currencies.EVT_BOARD || 0) >= 1 ? "" : "disabled"}>주사위 굴리기<small>🎲1</small></button>
        ${s.pendingBattle ? `<button class="buy" data-ev="board-battle:${a.inst}">전투 칸 도전</button>` : ""}${shopBtn}
        <span class="tp">${s.laps}바퀴${s.discount ? " · 할인권" : ""}</span></div>`;
    }
    case "EV_T2": {
      const depth = s.path.length;
      const endIdx = depth >= 5 ? (s.path[0] * 2 + s.path[4]) % 4 : null;
      return `<div class="si-val">경로 ${s.path.map((x) => (x ? "▶우" : "◀좌")).join(" ") || "시작"} · 깊이 ${depth}/5 · 완주 ${s.done}/3</div>
        ${depth < 5 && s.done < 3 ? `<div class="gear-ops">${[0, 1].map((ch) => {
          const rid = E.branchNodeRule(a.inst, depth, ch);
          return `<button class="buy" data-ev="branch:${a.inst}:${ch}" ${(save.currencies.EVT_MAP || 0) >= 3 ? "" : "disabled"}>${ch ? "오른쪽" : "왼쪽"} 노드<small>🗺️3 · ${esc(C.ruleName(rid))}</small></button>`;
        }).join("")}${shopBtn}</div>` : `<div class="si-val">${endIdx != null ? `최종: ${E.BRANCH_ENDINGS[endIdx].name}` : ""}</div>${shopBtn}`}`;
    }
    case "EV_T3": {
      const bid = E.huntBoss(a.inst);
      if (s.huntDay !== E.todayKey()) { s.huntDay = E.todayKey(); s.huntN = 0; }
      return `<div class="si-val">표적: ${BOSSES[bid]?.name || bid} · 체력 바 ${s.bars}/100 · 오늘 도전 ${s.huntN}/3</div>
        <div class="bar"><i style="width:${s.bars}%"></i></div>
        <div class="gear-ops">${E.HUNT_DIFF.map((d, i) => `<button class="buy" data-ev="hunt:${a.inst}:${i}" ${s.huntN < 3 && s.bars < 100 ? "" : "disabled"}>${d.name}<small>×${d.mult} · 보상×${d.rew}</small></button>`).join("")}${shopBtn}</div>`;
    }
    case "EV_T4":
      return `<div class="si-val">거점 Lv ${s.fortLv}/10 · 봉화 체력 ${Math.round(E.fortHp(s.fortLv))} · 포탑 ${E.fortTurrets(s.fortLv)}</div>
        <div class="gear-ops"><button class="buy" data-ev="fort:${a.inst}">거점 방어(5:00)</button>
        <button class="buy" data-ev="fortup:${a.inst}" ${s.fortLv < 10 && (save.currencies.EVT_FORT || 0) >= E.fortUpCost(s.fortLv) ? "" : "disabled"}>거점 강화<small>📦${E.fortUpCost(s.fortLv)}</small></button>${shopBtn}</div>`;
    case "EV_T5": {
      const sel = s.sel || [0, 0, 0, 0];
      return `<div class="si-val">재료 ${E.INGR_NAMES.map((n, i) => `${n} ${s.ingr[i]}`).join(" · ")} · 도감 ${s.recipes.length}/25 · 🎁 ${save.currencies.EVT_INGR || 0}</div>
        <div class="gear-ops">${E.INGR_NAMES.map((n, i) => `<button class="buy" data-ev="ing:${a.inst}:${i}">${n} ${sel[i]}</button>`).join("")}
          <button class="buy" data-ev="mix:${a.inst}">조합</button><button class="buy" data-ev="mixclr:${a.inst}">초기화</button>${shopBtn}</div>
        <div class="si-desc">공개 레시피: ${E.RECIPES.filter((r) => !r.hidden).slice(0, 20).map((r) =>
          `${s.recipes.includes(r.id) ? "✅" : ""}${r.inp.map((n, i) => (n ? E.INGR_NAMES[i] + n : "")).join("")}→${r.out.box ? "축제 상자" : r.out.buff.name}`).join(" · ")}</div>
        <div class="si-desc">숨김 힌트: ${E.RECIPES.filter((r) => r.hidden).map((r) => (s.recipes.includes(r.id) ? "✅" : "") + r.hint).join(" · ")}</div>`;
    }
    case "EV_T6":
      return `<div class="gear-list">${E.TALLY_STEPS.map((st, i) => `<div class="shop-item ${s.claimed.includes(i) ? "dim" : ""}">
        <div class="si-main"><div class="si-name">${i + 1}단계 · 기여도 ${st.need}</div><div class="bar"><i style="width:${Math.min(100, (s.tally / st.need) * 100)}%"></i></div>
        <div class="si-val">${E.rewardText(st.reward)}</div></div>
        <button class="buy" data-ev="tally:${a.inst}:${i}" ${s.tally >= st.need && !s.claimed.includes(i) ? "" : "disabled"}>${s.claimed.includes(i) ? "완료" : "받기"}</button></div>`).join("")}</div>
        <div class="si-desc">로컬판 — 개인 누적 목표로 표기(공동 진행률 없음)</div>`;
  }
  return "";
}
function bindEvents(el, evs) {
  const save = S();
  const find = (inst) => evs.find((a) => a.inst === inst);
  el.querySelectorAll("[data-evshop]").forEach((b) => b.onclick = () => {
    const shop = E.SHOPS[b.dataset.evshop];
    renderShopList(el, shop);
    const back = document.createElement("button"); back.className = "buy"; back.textContent = "← 이벤트";
    back.onclick = () => C.refresh(); el.prepend(back);
  });
  el.querySelectorAll("[data-ev]").forEach((b) => b.onclick = () => {
    const [act, inst, arg] = b.dataset.ev.split(":");
    const a = find(inst); const s = E.eventState(save, a);
    if (act === "roll") { const r = E.boardRoll(save, a); if (r) { toast("탐사 보드", r.msgs); done(null, "levelupOpen"); } }
    if (act === "board-battle") C.startEventBattle({ kind: "board", inst, rule: s.pendingBattle.rule });
    if (act === "branch") {
      if ((save.currencies.EVT_MAP || 0) < 3) return;
      save.currencies.EVT_MAP -= 3; C.write();
      C.startEventBattle({ kind: "branch", inst, choice: +arg, rule: E.branchNodeRule(inst, s.path.length, +arg) });
    }
    if (act === "hunt") { s.huntN++; C.write(); C.startEventBattle({ kind: "hunt", inst, diff: +arg, boss: E.huntBoss(inst) }); }
    if (act === "fort") C.startEventBattle({ kind: "fort", inst, lv: s.fortLv });
    if (act === "fortup") {
      const cost = E.fortUpCost(s.fortLv);
      if ((save.currencies.EVT_FORT || 0) >= cost) {
        save.currencies.EVT_FORT -= cost; s.fortLv++;
        const msgs = [`거점 Lv ${s.fortLv}`];
        if (s.fortLv === 10) msgs.push(...E.applyItem(save, "한정 펫", 1));
        toast("방어 거점", msgs); done(null, "levelupOpen");
      }
    }
    if (act === "ing") { s.sel ||= [0, 0, 0, 0]; s.sel[+arg] = (s.sel[+arg] + 1) % 4; C.refresh(); }
    if (act === "mixclr") { s.sel = [0, 0, 0, 0]; C.refresh(); }
    if (act === "mix") {
      const r = E.combine(save, a, s.sel || [0, 0, 0, 0]);
      if (r) { toast("재료 조합", r.msgs); s.sel = [0, 0, 0, 0]; done(null, r.fail ? "uiClick" : "levelupOpen"); }
    }
    if (act === "tally") {
      const i = +arg; const st = E.TALLY_STEPS[i];
      if (s.tally >= st.need && !s.claimed.includes(i)) { s.claimed.push(i); toast(`누적 목표 ${i + 1}단계`, E.grant(save, st.reward, { openNow: true })); done(null); }
    }
  });
}

export function renderTitles(el) {
  const save = S();
  el.innerHTML = `<div class="sub-tabs"><span class="tp">현재 칭호: <b>${esc(save.title || "없음")}</b> · 보유 ${save.titles.length}</span></div>
    <div class="shop-list">${save.titles.length ? save.titles.map((t) => `<div class="shop-item">
      <div class="si-icon">🏅</div><div class="si-main"><div class="si-name">${esc(t)}</div></div>
      <button class="buy" data-title="${esc(t)}" ${save.title === t ? "disabled" : ""}>${save.title === t ? "사용 중" : "사용"}</button></div>`).join("")
      : `<div class="empty">칭호는 업적 보상(예: 모든 별, 백만 마리, 진화 도감 II)으로 얻습니다.</div>`}</div>`;
  el.querySelectorAll("[data-title]").forEach((b) => b.onclick = () => { save.title = b.dataset.title; done(null, "cardSelect"); });
}
