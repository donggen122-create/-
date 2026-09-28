/* 첫 화면(홈)과 반별 전시실 */
(function () {
  "use strict";

  const G = window.Gallery;
  const $ = (id) => document.getElementById(id);
  const esc = G.esc;

  const state = { classKey: "", cat: "", q: "", by: "title", sort: "new" };
  let works = [];
  let loaded = false;
  let spotTimer = null;
  let spotPaused = false;

  function readUrl() {
    const p = new URLSearchParams(location.search);
    const cls = G.findClass(p.get("class"));
    const cat = G.findCategory(p.get("cat"));
    state.classKey = cls ? cls.key : "";
    state.cat = cat ? cat.name : "";
    state.q = (p.get("q") || "").trim();
    state.by = p.get("by") === "author" ? "author" : "title";
    state.sort = ["new", "number", "title"].includes(p.get("sort")) ? p.get("sort") : "new";
  }

  function writeUrl(push) {
    const p = new URLSearchParams();
    if (state.classKey) p.set("class", state.classKey);
    if (state.cat) p.set("cat", state.cat);
    if (state.q) p.set("q", state.q);
    if (state.by !== "title") p.set("by", state.by);
    if (state.sort !== "new") p.set("sort", state.sort);
    const qs = p.toString();
    history[push ? "pushState" : "replaceState"](null, "", qs ? `?${qs}` : location.pathname);
  }

  const skeleton = (n) => Array.from({ length: n }, () => '<div class="card skeleton"><div class="card-thumb"></div><div class="card-title"></div></div>').join("");

  const emptyHTML = (big, message) => `<div class="empty"><span class="big">${big}</span>${message}</div>`;

  /* ---------- 홈 ---------- */

  function renderHome() {
    $("doors").innerHTML = G.getConfig()
      .classes.map((c) => {
        const list = works.filter((w) => w.classKey === c.key);
        const thumbs = list.slice(0, 4).map((w) => `<div class="door-thumb">${G.thumbHTML(w)}</div>`);
        while (thumbs.length < 4) thumbs.push('<div class="door-thumb"></div>');
        return `
          <a class="door" href="index.html?class=${encodeURIComponent(c.key)}" data-key="${esc(c.key)}">
            <div class="door-head"><span class="door-name">${esc(c.label)}</span><span class="door-count">${loaded ? `작품 ${list.length}개` : "…"}</span></div>
            <div class="door-thumbs">${thumbs.join("")}</div>
            <div class="door-go">전시실 들어가기 →</div>
          </a>`;
      })
      .join("");

    if (!loaded) {
      $("new-grid").innerHTML = skeleton(7);
      return;
    }
    const recent = works.slice(0, 14);
    $("new-grid").innerHTML = recent.length
      ? recent.map((w) => G.cardHTML(w, { manage: G.isTeacher() })).join("")
      : emptyHTML("🌱", '아직 전시된 작품이 없어요.<br /><a href="register.html">첫 번째 작품을 등록해 보세요!</a>');
  }

  /* ---------- 반별 전시실 ---------- */

  const squash = (s) => String(s).toLowerCase().replace(/\s+/g, "");

  function renderClass(cls) {
    const inClass = works.filter((w) => w.classKey === cls.key);

    const chips = [{ name: "", emoji: "🏠", label: "전체" }].concat(G.CATEGORIES.map((c) => ({ ...c, label: c.name })));
    $("cat-chips").innerHTML = chips
      .map((c) => {
        const n = c.name ? inClass.filter((w) => w.category === c.name).length : inClass.length;
        if (c.name && !n && state.cat !== c.name) return "";
        return `<button type="button" data-cat="${esc(c.name)}" aria-pressed="${state.cat === c.name}">${c.emoji} ${esc(c.label)}<span class="n">${loaded ? n : ""}</span></button>`;
      })
      .join("");

    $("search-input").value = state.q;
    $("search-by").value = state.by;
    $("sort").value = state.sort;
    $("class-title").textContent = cls.label;

    if (!loaded) {
      $("class-count").textContent = "";
      $("class-grid").innerHTML = skeleton(7);
      return;
    }

    const q = squash(state.q);
    let list = inClass.filter((w) => !state.cat || w.category === state.cat);
    if (q) list = list.filter((w) => squash(state.by === "author" ? w.author : w.title).includes(q));
    if (state.sort === "title") list = list.slice().sort((a, b) => a.title.localeCompare(b.title, "ko"));
    if (state.sort === "number") list = list.slice().sort((a, b) => (a.number || 999) - (b.number || 999) || a.title.localeCompare(b.title, "ko"));

    $("class-count").textContent = `${list.length}개`;
    if (list.length) {
      $("class-grid").innerHTML = list.map((w) => G.cardHTML(w, { withClass: false, manage: G.isTeacher() })).join("");
    } else if (!inClass.length) {
      $("class-grid").innerHTML = emptyHTML("🌱", `아직 ${esc(cls.label)} 작품이 없어요.<br /><a href="register.html">첫 번째 작품을 올려 볼까요?</a>`);
    } else {
      $("class-grid").innerHTML = emptyHTML("🔍", '찾는 작품이 없어요. <button type="button" data-reset>전체 작품 보기</button>');
    }
  }

  /* ---------- 추천 작품 TV ---------- */

  function renderSpotlight(cls) {
    clearInterval(spotTimer);
    const link = $("spot-link");
    const pool = cls ? works.filter((w) => w.classKey === cls.key) : works;
    let picks = pool.filter((w) => w.featured);
    if (!picks.length) picks = pool.slice(0, 5);
    picks = picks.slice(0, 7);

    if (!picks.length) {
      link.removeAttribute("href");
      link.innerHTML = `<div class="spotlight-empty">${loaded ? "작품이 올라오면<br />여기에서 소개해요!" : '<div class="spinner"></div>'}</div>`;
      $("spot-title").innerHTML = "&nbsp;";
      $("spot-by").innerHTML = "&nbsp;";
      $("spot-dots").innerHTML = "";
      return;
    }

    let index = 0;
    const show = (n) => {
      index = (n + picks.length) % picks.length;
      const w = picks[index];
      link.href = G.playUrl(w);
      link.setAttribute("aria-label", `${w.title} 실행하기`);
      link.innerHTML = G.thumbHTML(w);
      $("spot-title").textContent = w.title;
      $("spot-by").textContent = [G.classLabel(w), w.author].filter(Boolean).join(" ");
      $("spot-dots")
        .querySelectorAll("button")
        .forEach((b, i) => b.setAttribute("aria-current", String(i === index)));
    };

    $("spot-dots").innerHTML = picks.map((w, i) => `<button type="button" data-n="${i}" aria-label="${esc(w.title)}">${i + 1}</button>`).join("");
    $("spot-dots").onclick = (event) => {
      const button = event.target.closest("button[data-n]");
      if (button) show(Number(button.dataset.n));
    };
    show(0);
    if (picks.length > 1) {
      spotTimer = setInterval(() => {
        if (!spotPaused) show(index + 1);
      }, 4500);
    }
  }

  /* ---------- 전체 그리기 ---------- */

  function render() {
    const cls = G.findClass(state.classKey);
    G.renderTabs(cls ? cls.key : "home");
    $("toolbar").hidden = !cls;
    $("home-classes").hidden = !!cls;
    $("home-new").hidden = !!cls;
    $("class-view").hidden = !cls;
    document.title = cls ? `${cls.label} 전시실 · 서호초등학교 바이브코딩 전시관` : "서호초등학교 바이브코딩 전시관";
    if (cls) renderClass(cls);
    else renderHome();
    renderSpotlight(cls);
  }

  /* ---------- 이벤트 ---------- */

  // 탭과 반 전시실 문은 페이지를 새로 읽지 않고 바로 바꿔요.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-key]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const key = link.dataset.key;
    if (key !== "home" && !G.findClass(key)) return;
    event.preventDefault();
    Object.assign(state, { classKey: key === "home" ? "" : key, cat: "", q: "" });
    writeUrl(true);
    render();
    window.scrollTo({ top: 0 });
  });

  $("cat-chips").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cat]");
    if (!button) return;
    state.cat = button.dataset.cat;
    writeUrl(false);
    render();
  });

  $("class-grid").addEventListener("click", (event) => {
    if (!event.target.closest("[data-reset]")) return;
    Object.assign(state, { cat: "", q: "" });
    writeUrl(false);
    render();
  });

  $("search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.q = $("search-input").value.trim();
    state.by = $("search-by").value;
    writeUrl(false);
    render();
  });

  $("sort").addEventListener("change", () => {
    state.sort = $("sort").value;
    writeUrl(false);
    render();
  });

  const spotlight = $("spotlight");
  spotlight.addEventListener("mouseenter", () => (spotPaused = true));
  spotlight.addEventListener("mouseleave", () => (spotPaused = false));
  spotlight.addEventListener("focusin", () => (spotPaused = true));
  spotlight.addEventListener("focusout", () => (spotPaused = false));

  // 선생님 모드: 작품 그림 위의 ⭐(추천)·🗑(삭제) 버튼
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-admin]");
    if (!button) return;
    event.preventDefault();
    const work = works.find((w) => w.id === button.dataset.id);
    if (!work || button.disabled) return;
    button.disabled = true;
    const done = await G.manageWork(work, button.dataset.admin);
    button.disabled = false;
    if (done) reload();
  });

  window.addEventListener("teacherchange", render);

  window.addEventListener("popstate", () => {
    readUrl();
    render();
  });

  /* ---------- 시작 ---------- */

  readUrl();
  G.renderNotices();
  render();

  function reload() {
    return G.loadWorks().then((result) => {
      works = result.works;
      loaded = true;
      G.setCount(works.length);
      G.renderNotices(result.error);
      render();
    });
  }

  reload();
})();
