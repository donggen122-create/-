/* 모든 페이지가 함께 쓰는 기능. config.js 보다 먼저 불러와야 오류를 잡을 수 있어요. */
(function () {
  "use strict";

  const CATEGORIES = [
    { name: "게임", emoji: "🎮", aliases: ["게임"] },
    { name: "학습·퀴즈", emoji: "📚", aliases: ["학습", "퀴즈", "공부"] },
    { name: "그림·음악", emoji: "🎨", aliases: ["그림", "음악", "미술", "예술"] },
    { name: "생활 도구", emoji: "🛠️", aliases: ["생활", "도구", "앱"] },
    { name: "이야기", emoji: "📖", aliases: ["이야기", "동화", "소설"] },
    { name: "기타", emoji: "✨", aliases: [] },
  ];

  const DEFAULT_CLASSES = ["6학년 1반", "6학년 2반", "6학년 3반"];
  const NEW_DAYS = 14;
  const MAX_HTML_BYTES = 5 * 1024 * 1024;
  const MAX_THUMB_CHARS = 45000;
  const DEMO_KEY = "seoho-vibe-gallery-demo-v1";
  const COLORS = [
    ["#ffd166", "#ff9f1c"],
    ["#8ecae6", "#219ebc"],
    ["#b8f2e6", "#3fb8a9"],
    ["#ffc8dd", "#ff7aa2"],
    ["#d7c3f5", "#9b5de5"],
    ["#c7f59b", "#58b85c"],
    ["#ffb4a2", "#ff6b6b"],
    ["#a0c4ff", "#4b6cf0"],
  ];

  /* ---------- 설정 파일 오타 잡기 ---------- */

  const scriptErrors = {};
  window.addEventListener("error", (event) => {
    if (event.filename && /config\.js/.test(event.filename)) scriptErrors["config.js"] = event.lineno || 0;
  });

  function brokenScripts() {
    const broken = { ...scriptErrors };
    // eslint-disable-next-line no-undef
    if (document.querySelector('script[src$="config.js"]') && typeof CONFIG === "undefined") broken["config.js"] ??= 0;
    return Object.entries(broken);
  }

  /* ---------- 작은 도우미 ---------- */

  const text = (value) => (value === undefined || value === null ? "" : String(value).trim());
  const squash = (value) => text(value).replace(/[\s·・./,_-]/g, "");

  function esc(value) {
    return text(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function toNumber(value) {
    const n = parseInt(text(value), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function parseDate(value) {
    const s = text(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const date = new Date(s);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const match = /^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/.exec(s);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // 그림 주소는 사진 데이터, 인터넷 주소, 저장소 안의 파일만 받아요.
  function safeImage(src) {
    const s = text(src);
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s && !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
    return "";
  }

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    return Math.random().toString(16).slice(2, 12).padEnd(10, "0");
  }

  /* ---------- 분류와 반 ---------- */

  function findCategory(name) {
    const key = squash(name);
    if (!key) return null;
    return (
      CATEGORIES.find((c) => squash(c.name) === key) ||
      CATEGORIES.find((c) => c.aliases.some((alias) => key.includes(alias))) ||
      null
    );
  }

  function categoryInfo(name) {
    return findCategory(name) || CATEGORIES[CATEGORIES.length - 1];
  }

  function parseClass(label) {
    const s = text(label);
    const match = /(\d+)\s*학년\s*(\d+)\s*반/.exec(s) || /^(\d+)\s*-\s*(\d+)$/.exec(s);
    if (!match) return null;
    const grade = Number(match[1]);
    const klass = Number(match[2]);
    return { key: `${grade}-${klass}`, grade, klass, label: `${grade}학년 ${klass}반` };
  }

  let config = null;
  function getConfig() {
    if (config) return config;
    // eslint-disable-next-line no-undef
    const raw = typeof CONFIG !== "undefined" && CONFIG && typeof CONFIG === "object" ? CONFIG : {};
    const labels = Array.isArray(raw["반목록"]) && raw["반목록"].length ? raw["반목록"] : DEFAULT_CLASSES;
    const classes = [];
    labels.map(parseClass).forEach((c) => c && !classes.some((x) => x.key === c.key) && classes.push(c));
    config = { serverUrl: text(raw["서버주소"]), classes };
    return config;
  }

  function findClass(key) {
    return getConfig().classes.find((c) => c.key === text(key)) || null;
  }

  /* ---------- 작품 정리 ---------- */

  function makeWork(f) {
    const category = categoryInfo(f.category);
    const date = parseDate(f.date);
    const ageDays = date ? (Date.now() - date.getTime()) / 86400000 : Infinity;
    const grade = toNumber(f.grade);
    const klass = toNumber(f.klass);
    return {
      id: text(f.id),
      title: text(f.title) || "제목 없는 작품",
      author: text(f.author) || "이름 없음",
      grade,
      klass,
      number: toNumber(f.number),
      classKey: grade && klass ? `${grade}-${klass}` : "",
      category: category.name,
      categoryEmoji: category.emoji,
      description: text(f.description),
      thumbnail: safeImage(f.thumbnail),
      emoji: Array.from(text(f.emoji)).slice(0, 8).join("") || category.emoji,
      date,
      dateText: date ? `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}` : "",
      isNew: ageDays > -2 && ageDays < NEW_DAYS,
      featured: f.featured === true || f.featured === "true",
    };
  }

  function fromUpload(raw) {
    return makeWork({
      id: raw.id,
      title: raw.title,
      author: raw.name,
      grade: raw.grade,
      klass: raw.klass,
      number: raw.number,
      category: raw.category,
      description: raw.description,
      thumbnail: raw.thumbnail,
      emoji: raw.emoji,
      date: raw.createdAt,
      featured: raw.featured,
    });
  }

  function sortNewest(works) {
    return works.slice().sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  }

  /* ---------- 작품 저장소: 서버(Cloudflare Worker + D1) 또는 체험 모드 ---------- */

  // 서버와 체험 모드가 똑같이 검사해요. 통과하면 저장할 모양으로 정리해 돌려줘요.
  function validateSubmission(input) {
    const cls = findClass(`${toNumber(input.grade)}-${toNumber(input.klass)}`);
    const clean = {
      title: text(input.title).slice(0, 60),
      grade: cls ? cls.grade : null,
      klass: cls ? cls.klass : null,
      number: toNumber(input.number),
      name: text(input.name).slice(0, 20),
      category: categoryInfo(input.category).name,
      description: text(input.description).slice(0, 1000),
      emoji: Array.from(text(input.emoji)).slice(0, 8).join(""),
      thumbnail: text(input.thumbnail),
      fileName: text(input.fileName).slice(0, 120),
      html: String(input.html || ""),
      code: text(input.code),
    };
    if (!clean.title) throw new Error("작품 제목을 써 주세요.");
    if (!cls) throw new Error("학년과 반을 골라 주세요.");
    if (!clean.number || clean.number > 60) throw new Error("번호를 알맞게 써 주세요.");
    if (!clean.name) throw new Error("이름을 써 주세요.");
    if (!clean.description) throw new Error("작품 내용을 써 주세요.");
    if (!clean.html.trim()) throw new Error("html 작품 파일을 넣어 주세요.");
    if (new Blob([clean.html]).size > MAX_HTML_BYTES) throw new Error("작품 파일이 너무 커요. (5MB까지 올릴 수 있어요)");
    if (clean.thumbnail && (!/^data:image\/(png|jpeg|webp);base64,/.test(clean.thumbnail) || clean.thumbnail.length > MAX_THUMB_CHARS)) {
      clean.thumbnail = "";
    }
    return clean;
  }

  // 작품 저장 서버(Cloudflare Worker) 주소. 전시관을 Cloudflare 에서 열면 같은 주소의 /api 를 써요.
  function apiBase() {
    const configured = getConfig().serverUrl.replace(/\/+$/, "").replace(/\/api$/, "");
    return configured ? `${configured}/api` : new URL("api", location.href).href;
  }

  async function serverCall(method, path, body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let data;
    try {
      const res = await fetch(apiBase() + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      data = await res.json();
    } catch (err) {
      if (err.name === "AbortError") throw new Error("서버가 너무 오래 대답하지 않아요. 잠시 뒤에 다시 해 보세요.");
      throw new Error("작품 저장 서버에 연결하지 못했어요. 인터넷 연결이나 config.js 의 서버주소를 확인해 주세요.");
    } finally {
      clearTimeout(timer);
    }
    if (!data || !data.ok) throw new Error((data && data.error) || "알 수 없는 오류가 생겼어요.");
    return data;
  }

  // 서버주소가 비어 있으면 지금 주소에 서버(/api)가 있는지 한 번 물어봐요. 없으면 체험 모드예요.
  let modePromise = null;
  function detectMode() {
    if (modePromise) return modePromise;
    if (getConfig().serverUrl) {
      modePromise = Promise.resolve("server");
    } else if (location.protocol === "file:") {
      modePromise = Promise.resolve("demo");
    } else {
      modePromise = fetch(`${apiBase()}/info`, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => (data && data.ok ? "server" : "demo"))
        .catch(() => "demo");
    }
    return modePromise;
  }

  function demoRead() {
    try {
      const items = JSON.parse(localStorage.getItem(DEMO_KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function demoWrite(items) {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(items));
    } catch {
      throw new Error("체험 모드 저장 공간이 가득 찼거나 쓸 수 없어요. 작품 저장 서버를 연결해 주세요.");
    }
  }

  const withoutHtml = ({ html, ...rest }) => rest; // eslint-disable-line no-unused-vars

  const api = {
    mode: detectMode,

    async info() {
      if ((await detectMode()) === "server") return serverCall("GET", "/info", null, 30000);
      return { ok: true, needCode: false, canManage: true };
    },

    async list() {
      if ((await detectMode()) === "server") return serverCall("GET", "/works", null, 30000);
      return { ok: true, works: demoRead().map(withoutHtml), needCode: false };
    },

    async get(id) {
      if ((await detectMode()) === "server") return serverCall("GET", `/works/${encodeURIComponent(id)}`, null, 60000);
      const item = demoRead().find((w) => w.id === id);
      if (!item) throw new Error("작품을 찾을 수 없어요.");
      return { ok: true, work: withoutHtml(item), html: item.html };
    },

    async create(input) {
      const clean = validateSubmission(input);
      if ((await detectMode()) === "server") return serverCall("POST", "/works", clean, 120000);
      const { code, ...item } = clean; // eslint-disable-line no-unused-vars
      Object.assign(item, { id: randomId(), createdAt: new Date().toISOString(), featured: false });
      demoWrite([item, ...demoRead()]);
      return { ok: true, id: item.id };
    },

    // fields: featured, title, grade, klass, number, name, category, description 중 바꿀 것만
    async updateWork(id, fields, password) {
      if ((await detectMode()) === "server") return serverCall("PATCH", `/works/${encodeURIComponent(id)}`, { ...fields, password }, 30000);
      demoWrite(demoRead().map((w) => (w.id === id ? { ...w, ...fields } : w)));
      return { ok: true };
    },

    async remove(id, password) {
      if ((await detectMode()) === "server") return serverCall("DELETE", `/works/${encodeURIComponent(id)}`, { password }, 30000);
      demoWrite(demoRead().filter((w) => w.id !== id));
      return { ok: true };
    },

    async login(password) {
      if ((await detectMode()) === "server") return serverCall("POST", "/login", { password }, 30000);
      return { ok: true };
    },
  };

  async function loadWorks() {
    try {
      const data = await api.list();
      const works = (data.works || []).map(fromUpload).filter((w) => w.id);
      return { works: sortNewest(works), needCode: !!data.needCode, error: null };
    } catch (error) {
      return { works: [], needCode: false, error };
    }
  }

  /* ---------- 작품 실행 틀 ---------- */

  // 학생이 올린 html 은 전시관과 분리된 안전한 틀(sandbox) 안에서 실행해요.
  // 그 틀 안에서는 localStorage 를 못 쓰니, 기록 저장을 쓰는 작품이 멈추지 않도록 임시 저장소를 넣어 줘요.
  const SANDBOX = "allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock allow-downloads";
  const STORAGE_SHIM =
    "<script>(function(){function m(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){var k=Object.keys(d);return i<k.length?k[i]:null},get length(){return Object.keys(d).length}}}" +
    '["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("_")}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(e2){}}})})();<\/script>';

  function withStorageShim(html) {
    for (const re of [/<head(\s[^>]*)?>/i, /<html(\s[^>]*)?>/i, /<!doctype[^>]*>/i]) {
      const match = re.exec(html);
      if (match) {
        const at = match.index + match[0].length;
        return html.slice(0, at) + STORAGE_SHIM + html.slice(at);
      }
    }
    return STORAGE_SHIM + html;
  }

  function mountWork(container, html, title) {
    container.querySelectorAll("iframe").forEach((old) => old.remove());
    const frame = document.createElement("iframe");
    frame.title = title || "작품 실행 화면";
    frame.setAttribute("allow", "fullscreen; autoplay; gamepad; accelerometer; gyroscope");
    frame.setAttribute("allowfullscreen", "");
    frame.setAttribute("sandbox", SANDBOX);
    frame.srcdoc = withStorageShim(html);
    container.appendChild(frame);
    return frame;
  }

  /* ---------- 화면 조각 ---------- */

  function colorFor(seed) {
    let hash = 0;
    for (const ch of text(seed)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    return COLORS[hash % COLORS.length];
  }

  function thumbHTML(work) {
    const [c1, c2] = colorFor(work.title + work.author);
    const fallback = `<div class="thumb-fallback" style="--c1:${c1};--c2:${c2}"><span class="thumb-emoji">${esc(work.emoji)}</span></div>`;
    if (!work.thumbnail) return fallback;
    return `${fallback}<img class="thumb-img" src="${esc(work.thumbnail)}" alt="" loading="lazy" onerror="this.remove()" />`;
  }

  function classLabel(work) {
    const cls = findClass(work.classKey);
    if (cls) return cls.label;
    return [work.grade && `${work.grade}학년`, work.klass && `${work.klass}반`].filter(Boolean).join(" ");
  }

  function studentLine(work, { withClass = true } = {}) {
    return [withClass && classLabel(work), work.number && `${work.number}번`, work.author].filter(Boolean).join(" ");
  }

  function playUrl(work) {
    return `play.html?id=${encodeURIComponent(work.id)}`;
  }

  // manage: 선생님 모드에서 작품 그림 위에 추천·수정·삭제 버튼을 붙여요.
  function cardHTML(work, { link = true, withClass = true, manage = false } = {}) {
    const tag = link ? "a" : "div";
    const href = link ? ` href="${esc(playUrl(work))}"` : "";
    const who = withClass ? [classLabel(work), work.author].filter(Boolean).join(" ") : studentLine(work, { withClass: false });
    const card = cardInner(work, tag, href, who);
    if (!manage) return card;
    return `
      <div class="card-wrap">
        ${card}
        <div class="card-admin">
          <button type="button" data-admin="feature" data-id="${esc(work.id)}" aria-pressed="${work.featured}" title="${work.featured ? "추천 빼기" : "추천 작품으로"}">⭐</button>
          <button type="button" data-admin="edit" data-id="${esc(work.id)}" title="제목·내용 고치기">✏️</button>
          <button type="button" class="danger" data-admin="delete" data-id="${esc(work.id)}" title="삭제">🗑</button>
        </div>
      </div>`;
  }

  function cardInner(work, tag, href, who) {
    return `
      <${tag} class="card"${href} title="${esc(work.title)}">
        <div class="card-thumb">
          ${thumbHTML(work)}
          ${work.isNew ? '<span class="ribbon">NEW</span>' : ""}
          <span class="card-cat" title="${esc(work.category)}">${work.categoryEmoji}</span>
          <span class="card-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg></span>
        </div>
        <div class="card-title">${esc(work.title)}</div>
        <div class="card-author">${esc(who)}</div>
      </${tag}>`;
  }

  function renderTabs(active) {
    const nav = document.getElementById("tabs");
    if (!nav) return;
    const items = [{ key: "home", href: "index.html", label: "🏠 홈" }]
      .concat(getConfig().classes.map((c) => ({ key: c.key, href: `index.html?class=${encodeURIComponent(c.key)}`, label: c.label })))
      .concat([{ key: "register", href: "register.html", label: "✏️ 작품 등록", extra: " tab-register" }]);
    nav.innerHTML = items
      .map((item) => {
        const current = item.key === active ? ' is-active" aria-current="page' : "";
        return `<a class="tab${item.extra || ""}${current}" href="${item.href}" data-key="${esc(item.key)}">${esc(item.label)}</a>`;
      })
      .join("");
  }

  // 설정 파일 오타, 서버 연결 문제, 체험 모드 안내를 페이지 위쪽에 보여 줘요.
  async function renderNotices(error) {
    const box = document.getElementById("notices");
    if (!box) return;
    const mode = await detectMode();
    const html = brokenScripts().map(
      ([file, line]) => `
        <div class="notice notice-error" role="alert">
          <strong>⚠️ ${file} 파일을 읽지 못했어요${line ? ` (${line}번째 줄 근처)` : ""}.</strong>
          마지막으로 고친 곳에 쉼표( , )나 큰따옴표( " )가 빠지지 않았는지 확인해 주세요.
        </div>`,
    );
    if (error) {
      html.push(`<div class="notice notice-error" role="alert"><strong>⚠️ 작품을 불러오지 못했어요.</strong> ${esc(error.message)}</div>`);
    }
    if (isTeacher()) {
      html.push(`
        <div class="notice notice-teacher">
          <strong>👩‍🏫 선생님 모드</strong> 작품 그림 위의 <b>⭐</b> 버튼으로 추천하고, <b>✏️</b> 버튼으로 제목·내용을 고치고, <b>🗑</b> 버튼으로 지울 수 있어요.
        </div>`);
    }
    if (mode === "demo") {
      html.push(`
        <div class="notice notice-demo">
          <strong>🧪 체험 모드</strong> 지금은 등록한 작품이 <b>이 컴퓨터(브라우저)에만</b> 저장돼요.
          모든 친구가 함께 보려면 Cloudflare 에 올린 전시관 주소로 들어와 주세요. (README.md 안내 참고)
        </div>`);
    }
    box.innerHTML = html.join("");
  }

  /* ---------- 선생님 로그인 ---------- */

  // 비밀번호는 이 창(탭)을 닫을 때까지만 기억해요.
  const TEACHER_KEY = "seoho-gallery-teacher";

  function teacherPassword() {
    try {
      return sessionStorage.getItem(TEACHER_KEY) || "";
    } catch {
      return "";
    }
  }

  function isTeacher() {
    return !!teacherPassword();
  }

  function setTeacher(password) {
    try {
      if (password) sessionStorage.setItem(TEACHER_KEY, password);
      else sessionStorage.removeItem(TEACHER_KEY);
    } catch {
      /* 기억하지 못해도 괜찮아요 */
    }
    renderTeacherButton();
    window.dispatchEvent(new Event("teacherchange"));
  }

  // 로그인 창을 띄우고, 로그인하면 true 로 끝나요.
  function openLogin() {
    return new Promise((resolve) => {
      let dialog = document.getElementById("teacher-login");
      if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "teacher-login";
        dialog.className = "login";
        document.body.appendChild(dialog);
      }
      dialog.innerHTML = `
        <form class="login-form">
          <h2>👩‍🏫 선생님 로그인</h2>
          <p class="hint">로그인하면 학생 작품을 추천하거나 지울 수 있어요.</p>
          <input type="password" name="password" placeholder="선생님 비밀번호" autocomplete="current-password" aria-label="선생님 비밀번호" />
          <p class="form-error" hidden></p>
          <div class="login-actions">
            <button type="button" class="btn btn-line" data-close>닫기</button>
            <button type="submit" class="btn btn-orange">로그인</button>
          </div>
        </form>`;
      const form = dialog.querySelector("form");
      const input = form.elements.password;
      const error = form.querySelector(".form-error");
      const submit = form.querySelector('button[type="submit"]');
      form.querySelector("[data-close]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => resolve(isTeacher()), { once: true });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = input.value;
        if (!password) return input.focus();
        submit.disabled = true;
        error.hidden = true;
        try {
          await api.login(password);
          setTeacher(password);
          dialog.close();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
          input.select();
        } finally {
          submit.disabled = false;
        }
      });
      dialog.showModal();
      input.focus();
    });
  }

  function renderTeacherButton() {
    const top = document.querySelector(".header-top");
    if (!top) return;
    let button = document.getElementById("teacher-btn");
    if (!button) {
      button = document.createElement("button");
      button.id = "teacher-btn";
      button.type = "button";
      button.className = "teacher-btn";
      button.addEventListener("click", () => {
        if (!isTeacher()) openLogin();
        else if (window.confirm("선생님 모드에서 나갈까요?")) setTeacher("");
      });
      top.appendChild(button);
    }
    const on = isTeacher();
    button.classList.toggle("is-on", on);
    button.textContent = on ? "👩‍🏫 선생님 모드" : "🔒 선생님";
    button.title = on ? "누르면 선생님 모드에서 나가요" : "선생님 로그인";
  }

  // 작품 정보를 고치는 창. 저장하면 true 로 끝나요.
  function openEditor(work) {
    return new Promise((resolve) => {
      let dialog = document.getElementById("work-editor");
      if (!dialog) {
        dialog = document.createElement("dialog");
        dialog.id = "work-editor";
        dialog.className = "login editor";
        document.body.appendChild(dialog);
      }
      const classes = getConfig().classes.slice();
      if (work.classKey && !classes.some((c) => c.key === work.classKey)) {
        classes.push({ key: work.classKey, grade: work.grade, klass: work.klass, label: classLabel(work) });
      }
      dialog.innerHTML = `
        <form class="login-form">
          <h2>✏️ 작품 정보 고치기</h2>
          <label>작품 제목<input name="title" maxlength="60" value="${esc(work.title)}" /></label>
          <div class="editor-row">
            <label>학년·반<select name="cls">${classes
              .map((c) => `<option value="${esc(c.key)}"${c.key === work.classKey ? " selected" : ""}>${esc(c.label)}</option>`)
              .join("")}</select></label>
            <label>번호<input name="number" type="number" min="1" max="60" value="${esc(work.number || "")}" /></label>
            <label>이름<input name="name" maxlength="20" value="${esc(work.author)}" /></label>
          </div>
          <label>분류<select name="category">${CATEGORIES.map(
            (c) => `<option value="${esc(c.name)}"${c.name === work.category ? " selected" : ""}>${c.emoji} ${esc(c.name)}</option>`,
          ).join("")}</select></label>
          <label>작품 내용<textarea name="description" maxlength="1000" rows="6">${esc(work.description)}</textarea></label>
          <p class="form-error" hidden></p>
          <div class="login-actions">
            <button type="button" class="btn btn-line" data-close>취소</button>
            <button type="submit" class="btn btn-orange">저장</button>
          </div>
        </form>`;
      const form = dialog.querySelector("form");
      const error = form.querySelector(".form-error");
      const submit = form.querySelector('button[type="submit"]');
      let saved = false;
      form.addEventListener("input", () => (error.hidden = true));
      form.querySelector("[data-close]").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => resolve(saved), { once: true });
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const f = form.elements;
        const cls = classes.find((c) => c.key === f.cls.value);
        const fields = {
          title: f.title.value.trim(),
          grade: cls ? cls.grade : null,
          klass: cls ? cls.klass : null,
          number: toNumber(f.number.value),
          name: f.name.value.trim(),
          category: f.category.value,
          description: f.description.value.trim(),
        };
        const missing = !fields.title ? "작품 제목을" : !fields.number ? "번호를" : !fields.name ? "이름을" : !fields.description ? "작품 내용을" : "";
        if (missing) {
          error.textContent = `${missing} 써 주세요.`;
          error.hidden = false;
          return;
        }
        submit.disabled = true;
        error.hidden = true;
        try {
          await api.updateWork(work.id, fields, teacherPassword());
          saved = true;
          dialog.close();
        } catch (err) {
          error.textContent = err.message;
          error.hidden = false;
          if (/비밀번호/.test(err.message)) setTeacher("");
        } finally {
          submit.disabled = false;
        }
      });
      dialog.showModal();
      form.elements.title.focus();
    });
  }

  // 추천 켜기·끄기(feature), 고치기(edit), 삭제(delete). 로그인이 안 돼 있으면 먼저 로그인 창을 띄워요.
  async function manageWork(work, action) {
    if (action === "delete" && !window.confirm(`'${work.title}' 작품을 지울까요? 지우면 되돌릴 수 없어요.`)) return false;
    if (!isTeacher() && !(await openLogin())) return false;
    if (action === "edit") return openEditor(work);
    try {
      if (action === "delete") await api.remove(work.id, teacherPassword());
      else await api.updateWork(work.id, { featured: !work.featured }, teacherPassword());
      return true;
    } catch (err) {
      if (/비밀번호/.test(err.message)) setTeacher("");
      window.alert(err.message);
      return false;
    }
  }

  document.addEventListener("DOMContentLoaded", renderTeacherButton);
  window.addEventListener("teacherchange", () => renderNotices());

  function setCount(n) {
    const el = document.getElementById("work-count");
    if (el) el.textContent = String(n);
  }

  window.Gallery = {
    CATEGORIES,
    MAX_HTML_BYTES,
    MAX_THUMB_CHARS,
    api,
    esc,
    getConfig,
    findClass,
    findCategory,
    categoryInfo,
    fromUpload,
    loadWorks,
    sortNewest,
    mountWork,
    thumbHTML,
    cardHTML,
    classLabel,
    studentLine,
    playUrl,
    renderTabs,
    renderNotices,
    setCount,
    isTeacher,
    openLogin,
    manageWork,
  };
})();
