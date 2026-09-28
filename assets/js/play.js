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
        work.source === "upload" && G.isTeacher()
          ? `<div class="teacher">
              <p class="teacher-title">👩‍🏫 선생님 메뉴</p>
              <div class="info-actions">
                <button class="btn btn-line" data-admin-play="feature" type="button">${work.featured ? "⭐ 추천 빼기" : "⭐ 추천 작품으로"}</button>
                <button class="btn btn-danger" data-admin-play="delete" type="button">🗑 삭제</button>
              </div>
            </div>`
          : ""
      }`;
    $("info").hidden = false;

    $("info")
      .querySelectorAll("[data-admin-play]")
      .forEach((button) =>
        button.addEventListener("click", async () => {
          const action = button.dataset.adminPlay;
          button.disabled = true;
          const done = await G.manageWork(work, action);
          button.disabled = false;
          if (!done) return;
          if (action === "delete") {
            window.alert("작품을 지웠어요.");
            location.href = classHref;
            return;
          }
          work.featured = !work.featured;
          renderInfo(work);
          window.alert(work.featured ? "추천 작품으로 정했어요. 전시관 왼쪽 '추천 작품'에 나와요." : "추천 작품에서 뺐어요.");
        }),
      );
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
  window.addEventListener("teacherchange", () => current && renderInfo(current.work));

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
