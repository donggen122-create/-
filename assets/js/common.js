/* 모든 페이지가 함께 쓰는 기능. config.js, works.js 보다 먼저 불러와야 오류를 잡을 수 있어요. */
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
    const match = event.filename && /(works|config)\.js/.exec(event.filename);
    if (match) scriptErrors[`${match[1]}.js`] = event.lineno || 0;
  });

  function brokenScripts() {
    const broken = { ...scriptErrors };
    // eslint-disable-next-line no-undef
    if (document.querySelector('script[src$="config.js"]') && typeof CONFIG === "undefined") broken["config.js"] ??= 0;
    // eslint-disable-next-line no-undef
    if (document.querySelector('script[src$="works.js"]') && typeof WORKS === "undefined") broken["works.js"] ??= 0;
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
      source: f.source,
      title: text(f.title) || "제목 없는 작품",
      author: text(f.author) || "이름 없음",
      grade,
      klass,
      number: toNumber(f.number),
      classKey: grade && klass ? `${grade}-${klass}` : "",
      category: category.name,
      categoryEmoji: category.emoji,
      description: text(f.description),
      file: text(f.file),
      thumbnail: safeImage(f.thumbnail),
      emoji: Array.from(text(f.emoji)).slice(0, 8).join("") || category.emoji,
      date,
      dateText: date ? `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}` : "",
      isNew: ageDays > -2 && ageDays < NEW_DAYS,
      featured: f.featured === true || f.featured === "true",
    };
  }

  function fromStatic(raw) {
    return makeWork({
      id: raw["파일"],
      source: "static",
      title: raw["제목"],
      author: raw["만든이"],
      grade: raw["학년"],
      klass: raw["반"],
      number: raw["번호"],
      category: raw["분류"],
      description: raw["소개"],
      file: raw["파일"],
      thumbnail: raw["썸네일"],
      emoji: raw["이모지"],
      date: raw["등록일"],
      featured: raw["추천"],
    });
  }

  function fromUpload(raw) {
    return makeWork({
      id: raw.id,
      source: "upload",
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

  function getStaticWorks() {
    // eslint-disable-next-line no-undef
    const raw = typeof WORKS !== "undefined" && Array.isArray(WORKS) ? WORKS : [];
    const seen = new Set();
    return raw
      .filter((item) => item && typeof item === "object" && text(item["파일"]))
      .map(fromStatic)
      .filter((work) => !seen.has(work.id) && seen.add(work.id));
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

    async setFeatured(id, featured, password) {
      if ((await detectMode()) === "server") return serverCall("PATCH", `/works/${encodeURIComponent(id)}`, { featured, password }, 30000);
      demoWrite(demoRead().map((w) => (w.id === id ? { ...w, featured } : w)));
      return { ok: true };
    },

    async remove(id, password) {
      if ((await detectMode()) === "server") return serverCall("DELETE", `/works/${encodeURIComponent(id)}`, { password }, 30000);
      demoWrite(demoRead().filter((w) => w.id !== id));
      return { ok: true };
    },
  };

  async function loadWorks() {
    const staticWorks = getStaticWorks();
    try {
      const data = await api.list();
      const uploads = (data.works || []).map(fromUpload).filter((w) => w.id);
      return { works: sortNewest(uploads.concat(staticWorks)), needCode: !!data.needCode, error: null };
    } catch (error) {
      return { works: sortNewest(staticWorks), needCode: false, error };
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

  // source: { src } 는 저장소 안의 작품 파일, { html } 은 학생이 올린 작품 내용
  function mountWork(container, source, title) {
    container.querySelectorAll("iframe").forEach((old) => old.remove());
    const frame = document.createElement("iframe");
    frame.title = title || "작품 실행 화면";
    frame.setAttribute("allow", "fullscreen; autoplay; gamepad; accelerometer; gyroscope");
    frame.setAttribute("allowfullscreen", "");
    if (source.html !== undefined) {
      frame.setAttribute("sandbox", SANDBOX);
      frame.srcdoc = withStorageShim(source.html);
    } else {
      frame.src = source.src;
    }
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

  function cardHTML(work, { link = true, withClass = true } = {}) {
    const tag = link ? "a" : "div";
    const href = link ? ` href="${esc(playUrl(work))}"` : "";
    const who = withClass ? [classLabel(work), work.author].filter(Boolean).join(" ") : studentLine(work, { withClass: false });
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
    if (mode === "demo") {
      html.push(`
        <div class="notice notice-demo">
          <strong>🧪 체험 모드</strong> 지금은 등록한 작품이 <b>이 컴퓨터(브라우저)에만</b> 저장돼요.
          모든 친구가 함께 보려면 Cloudflare 에 올린 전시관 주소로 들어와 주세요. (README.md 안내 참고)
        </div>`);
    }
    box.innerHTML = html.join("");
  }

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
    fromStatic,
    fromUpload,
    getStaticWorks,
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
  };
})();
