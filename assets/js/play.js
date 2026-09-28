/* 작품 실행 화면 */
(function () {
  "use strict";

  const G = window.Gallery;
  const $ = (id) => document.getElementById(id);
  const esc = G.esc;

  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const fullView = params.get("view") === "full";

  async function loadWork() {
    const staticWork = G.getStaticWorks().find((w) => w.id === id);
    if (staticWork) return { work: staticWork, source: { src: staticWork.file } };
    if (!id) throw new Error("작품을 찾을 수 없어요.");
    const data = await G.api.get(id);
    return { work: G.fromUpload(data.work), source: { html: String(data.html || "") } };
  }

  /* ---------- 새 창: 작품만 화면 가득 ---------- */

  if (fullView) {
    document.body.className = "fullview";
    document.body.innerHTML = '<div class="stage-loading"><div class="spinner"></div>작품을 불러오는 중이에요…</div>';
    loadWork()
      .then(({ work, source }) => {
        document.title = `${work.title} · 서호초등학교 바이브코딩 전시관`;
        document.body.innerHTML = "";
        G.mountWork(document.body, source, work.title).focus();
      })
      .catch((err) => {
        document.body.innerHTML = `<div class="stage-loading">😢 ${esc(err.message)}</div>`;
      });
    return;
  }

  /* ---------- 보통 화면 ---------- */

  const stage = $("stage");
  const screen = $("screen");
  let frame = null;
  let current = null;

  function mount() {
    frame = G.mountWork(screen, current.source, current.work.title);
    frame.addEventListener("load", () => frame.focus(), { once: true });
  }

  function showError(message) {
    G.renderTabs("home");
    $("loading").innerHTML = `<div style="font-size:48px">😢</div><strong>${esc(message)}</strong><a class="btn btn-orange" href="index.html">전시관으로 돌아가기</a>`;
  }

  function renderInfo(work) {
    const cls = G.findClass(work.classKey);
    const classHref = cls ? `index.html?class=${encodeURIComponent(cls.key)}` : "index.html";
    const catHref = cls ? `${classHref}&cat=${encodeURIComponent(work.category)}` : classHref;

    document.title = `${work.title} · 서호초등학교 바이브코딩 전시관`;
    G.renderTabs(cls ? cls.key : "home");

    $("crumbs").innerHTML = [
      '<a href="index.html">🏠 홈</a>',
      cls ? `<a href="${classHref}">${esc(cls.label)}</a>` : "",
      `<span>${esc(work.title)}</span>`,
    ]
      .filter(Boolean)
      .join("<span>›</span>");

    $("info").innerHTML = `
      <div class="info-thumb">${G.thumbHTML(work)}</div>
      <h1>${esc(work.title)}</h1>
      <a class="tag" href="${catHref}">${work.categoryEmoji} ${esc(work.category)}</a>
      <ul class="meta">
        <li><span>만든 사람</span>${esc(G.studentLine(work))}</li>
        ${work.dateText ? `<li><span>올린 날</span>${esc(work.dateText)}</li>` : ""}
      </ul>
      ${work.description ? `<p class="desc">${esc(work.description)}</p>` : ""}
      <div class="info-actions">
        <a class="btn btn-line" href="${classHref}">← ${cls ? `${esc(cls.label)} 전시실` : "전시관 홈"}</a>
      </div>
      ${
        work.source === "upload"
          ? `<details class="teacher">
              <summary>👩‍🏫 선생님 메뉴</summary>
              <div class="info-actions">
                <button class="btn btn-line" id="btn-feature" type="button">${work.featured ? "⭐ 추천 빼기" : "⭐ 추천 작품으로"}</button>
                <button class="btn btn-danger" id="btn-delete" type="button">🗑 삭제</button>
              </div>
            </details>`
          : ""
      }`;
    $("info").hidden = false;

    if (work.source !== "upload") return;
    $("btn-delete").addEventListener("click", () => {
      if (!window.confirm(`'${work.title}' 작품을 지울까요? 지우면 되돌릴 수 없어요.`)) return;
      asTeacher((password) => G.api.remove(work.id, password)).then((ok) => {
        if (!ok) return;
        window.alert("작품을 지웠어요.");
        location.href = classHref;
      });
    });
    $("btn-feature").addEventListener("click", () => {
      asTeacher((password) => G.api.setFeatured(work.id, !work.featured, password)).then((ok) => {
        if (!ok) return;
        work.featured = !work.featured;
        $("btn-feature").textContent = work.featured ? "⭐ 추천 빼기" : "⭐ 추천 작품으로";
        window.alert(work.featured ? "추천 작품으로 정했어요. 전시관 왼쪽 '추천 작품'에 나와요." : "추천 작품에서 뺐어요.");
      });
    });
  }

  // 선생님 비밀번호는 이 창을 닫을 때까지만 기억해요.
  const PASSWORD_KEY = "seoho-gallery-teacher";
  async function asTeacher(action) {
    let password = "";
    if ((await G.api.mode()) === "server") {
      try {
        password = sessionStorage.getItem(PASSWORD_KEY) || "";
      } catch {
        password = "";
      }
      if (!password) password = window.prompt("선생님 비밀번호를 입력해 주세요.") || "";
      if (!password) return false;
    }
    try {
      await action(password);
      try {
        if (password) sessionStorage.setItem(PASSWORD_KEY, password);
      } catch {
        /* 기억하지 못해도 괜찮아요 */
      }
      return true;
    } catch (err) {
      try {
        sessionStorage.removeItem(PASSWORD_KEY);
      } catch {
        /* 괜찮아요 */
      }
      window.alert(err.message);
      return false;
    }
  }

  async function renderMore(work) {
    const { works } = await G.loadWorks();
    const others = works.filter((w) => w.id !== work.id);
    const sameClass = work.classKey ? others.filter((w) => w.classKey === work.classKey) : [];
    const list = (sameClass.length ? sameClass : others).slice(0, 14);
    if (!list.length) return;
    $("more-title").textContent = sameClass.length ? `${G.classLabel(work)} 친구들의 다른 작품` : "다른 친구들의 작품";
    $("more-grid").innerHTML = list.map((w) => G.cardHTML(w, { withClass: !sameClass.length })).join("");
    $("more").hidden = false;
  }

  $("btn-restart").addEventListener("click", mount);

  $("btn-full").addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    const request = stage.requestFullscreen || stage.webkitRequestFullscreen;
    const openWindow = () => window.open($("btn-window").href, "_blank", "noopener");
    if (!request) return openWindow();
    const result = request.call(stage);
    if (result && result.then) result.then(() => frame && frame.focus(), openWindow);
  });

  document.addEventListener("fullscreenchange", () => {
    $("btn-full").textContent = document.fullscreenElement ? "✕ 작게 보기" : "⛶ 크게 보기";
    if (frame) frame.focus();
  });

  screen.addEventListener("pointerdown", () => frame && frame.focus());

  G.renderNotices();
  G.renderTabs("");

  loadWork()
    .then((result) => {
      current = result;
      $("loading").remove();
      renderInfo(result.work);
      mount();
      $("btn-restart").disabled = false;
      $("btn-full").disabled = false;
      $("btn-window").href = `play.html?id=${encodeURIComponent(id)}&view=full`;
      $("btn-window").hidden = false;
      renderMore(result.work);
    })
    .catch((err) => showError(err.message));
})();
