/* 작품 등록 화면 */
(function () {
  "use strict";

  const G = window.Gallery;
  const $ = (id) => document.getElementById(id);
  const esc = G.esc;

  const EMOJIS = ["🎮", "👾", "🚀", "🏎️", "⚽", "🐱", "🐶", "🦖", "🌟", "🌈", "🎨", "🎵", "📚", "🧮", "🔬", "🌍", "🍕", "🧩", "💡", "🏰", "👻", "❤️"];

  const form = $("form");
  const picked = { html: "", fileName: "", emoji: "", thumbnail: "" };

  /* ---------- 칸 채우기 ---------- */

  $("f-class").innerHTML =
    '<option value="">골라 주세요</option>' +
    G.getConfig()
      .classes.map((c) => `<option value="${esc(c.key)}">${esc(c.label)}</option>`)
      .join("");

  $("f-category").innerHTML = G.CATEGORIES.map(
    (c) => `<label><input type="radio" name="category" value="${esc(c.name)}" /><span>${c.emoji} ${esc(c.name)}</span></label>`,
  ).join("");

  $("emoji-row").innerHTML = EMOJIS.map((e) => `<button type="button" data-emoji="${e}" aria-pressed="false" aria-label="${e} 고르기">${e}</button>`).join("");

  function values() {
    const cls = G.findClass($("f-class").value);
    const category = form.querySelector('input[name="category"]:checked');
    return {
      title: $("f-title").value.trim(),
      grade: cls ? cls.grade : "",
      klass: cls ? cls.klass : "",
      number: $("f-number").value.trim(),
      name: $("f-name").value.trim(),
      category: category ? category.value : "",
      description: $("f-desc").value.trim(),
      emoji: picked.emoji,
      thumbnail: picked.thumbnail,
      fileName: picked.fileName,
      html: picked.html,
      code: $("f-code").value.trim(),
    };
  }

  /* ---------- 게시판 미리보기 ---------- */

  function updatePreview() {
    const v = values();
    const work = G.fromUpload({
      id: "preview",
      title: v.title || "작품 제목",
      name: v.name || "이름",
      grade: v.grade,
      klass: v.klass,
      number: v.number,
      category: v.category,
      emoji: v.emoji,
      thumbnail: v.thumbnail,
      createdAt: new Date().toISOString(),
    });
    $("card-preview").innerHTML = G.cardHTML(work, { link: false });
    $("desc-count").textContent = `${$("f-desc").value.length} / 1000`;
  }

  form.addEventListener("input", updatePreview);
  form.addEventListener("change", updatePreview);

  $("emoji-row").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-emoji]");
    if (!button) return;
    picked.emoji = picked.emoji === button.dataset.emoji ? "" : button.dataset.emoji;
    $("emoji-row")
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.emoji === picked.emoji)));
    updatePreview();
  });

  /* ---------- html 파일 ---------- */

  const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`);

  async function readHtml(file) {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    // 옛날 메모장으로 저장한 파일(ANSI)은 한글이 깨져서 다시 읽어요.
    if (text.includes("�")) {
      try {
        text = new TextDecoder("euc-kr").decode(buffer);
      } catch {
        /* 그대로 둬요 */
      }
    }
    return text;
  }

  async function takeFile(file) {
    showError("");
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      showError(`'${file.name}' 은(는) html 파일이 아니에요. 이름이 .html 로 끝나는 파일을 골라 주세요.`);
      return;
    }
    if (file.size > G.MAX_HTML_BYTES) {
      showError(`파일이 너무 커요 (${formatSize(file.size)}). 5MB까지 올릴 수 있어요.`);
      return;
    }
    const html = await readHtml(file);
    if (!html.includes("<")) {
      showError("파일 안에 html 코드가 없는 것 같아요. AI가 만들어 준 코드를 전부 붙여 넣었는지 확인해 주세요.");
      return;
    }
    Object.assign(picked, { html, fileName: file.name });
    $("file-name").textContent = file.name;
    $("file-size").textContent = formatSize(file.size);
    $("dropzone").hidden = true;
    $("file-view").hidden = false;
    $("preview").hidden = true;
    $("preview").innerHTML = "";
    $("btn-preview").textContent = "▶ 미리 실행";
  }

  function clearFile() {
    Object.assign(picked, { html: "", fileName: "" });
    $("f-file").value = "";
    $("preview").innerHTML = "";
    $("file-view").hidden = true;
    $("dropzone").hidden = false;
  }

  $("f-file").addEventListener("change", () => takeFile($("f-file").files[0]));

  $("btn-change").addEventListener("click", () => {
    clearFile();
    $("f-file").click();
  });

  $("btn-preview").addEventListener("click", () => {
    const box = $("preview");
    box.hidden = !box.hidden;
    if (box.hidden) {
      box.innerHTML = "";
    } else {
      G.mountWork(box, { html: picked.html }, "미리 실행").focus();
    }
    $("btn-preview").textContent = box.hidden ? "▶ 미리 실행" : "■ 미리 실행 닫기";
  });

  const dropzone = $("dropzone");
  ["dragenter", "dragover"].forEach((type) =>
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-over");
    }),
  );
  ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, () => dropzone.classList.remove("is-over")));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    takeFile(event.dataTransfer.files[0]);
  });
  // 파일을 상자 밖에 떨어뜨려도 브라우저가 그 파일을 열어 버리지 않게 해요.
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  /* ---------- 게시판 사진 (정사각형으로 잘라 작게 줄여요) ---------- */

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("사진을 열 수 없어요. 다른 사진을 골라 주세요."));
      img.src = url;
    });
  }

  async function makeThumbnail(file) {
    const img = await loadImage(file);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    URL.revokeObjectURL(img.src);
    for (const [size, quality] of [
      [240, 0.82],
      [240, 0.65],
      [200, 0.6],
      [160, 0.55],
    ]) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= G.MAX_THUMB_CHARS) return data;
    }
    throw new Error("사진을 줄이지 못했어요. 다른 사진을 골라 주세요.");
  }

  $("f-thumb").addEventListener("change", async () => {
    const file = $("f-thumb").files[0];
    $("f-thumb").value = "";
    if (!file) return;
    try {
      picked.thumbnail = await makeThumbnail(file);
      $("btn-thumb-clear").hidden = false;
      showError("");
    } catch (err) {
      showError(err.message);
    }
    updatePreview();
  });

  $("btn-thumb-clear").addEventListener("click", () => {
    picked.thumbnail = "";
    $("btn-thumb-clear").hidden = true;
    updatePreview();
  });

  /* ---------- 등록 ---------- */

  function showError(message) {
    $("form-error").textContent = message;
    $("form-error").hidden = !message;
  }

  // 빠진 칸을 위에서부터 차례로 알려 줘요.
  function firstProblem(v) {
    if (!v.title) return ["f-title", "작품 제목을 써 주세요."];
    if (!v.grade) return ["f-class", "학년·반을 골라 주세요."];
    if (!v.number) return ["f-number", "번호를 써 주세요."];
    if (!v.name) return ["f-name", "이름을 써 주세요."];
    if (!v.category) return [form.querySelector('input[name="category"]'), "분류를 골라 주세요."];
    if (!v.description) return ["f-desc", "작품 내용을 써 주세요."];
    if (!v.html) return ["f-file", "html 작품 파일을 넣어 주세요."];
    if (!$("code-field").hidden && !v.code) return ["f-code", "선생님이 알려 주신 등록 코드를 써 주세요."];
    return null;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const v = values();
    const problem = firstProblem(v);
    if (problem) {
      showError(problem[1]);
      const el = typeof problem[0] === "string" ? $(problem[0]) : problem[0];
      if (el === $("f-file")) $("dropzone").scrollIntoView({ block: "center", behavior: "smooth" });
      else if (el) el.focus();
      return;
    }

    const button = $("btn-submit");
    button.disabled = true;
    button.textContent = "올리는 중이에요… ⏳";
    showError("");
    try {
      const result = await G.api.create(v);
      showDone(result.id, v);
    } catch (err) {
      showError(err.message);
    } finally {
      button.disabled = false;
      button.textContent = "🚀 작품 등록하기";
    }
  });

  function showDone(id, v) {
    const cls = G.findClass(`${v.grade}-${v.klass}`);
    $("done-text").textContent = `'${v.title}' 작품이 ${cls ? cls.label : "우리 반"} 전시실에 올라갔어요.`;
    $("done-play").href = `play.html?id=${encodeURIComponent(id)}`;
    $("done-class").href = cls ? `index.html?class=${encodeURIComponent(cls.key)}` : "index.html";
    $("form-view").hidden = true;
    $("done-view").hidden = false;
    window.scrollTo({ top: 0 });
  }

  // 같은 학생이 이어서 올릴 수 있게 반·번호·이름은 남겨 둬요.
  $("done-again").addEventListener("click", () => {
    $("f-title").value = "";
    $("f-desc").value = "";
    form.querySelectorAll('input[name="category"]').forEach((r) => (r.checked = false));
    clearFile();
    picked.emoji = "";
    picked.thumbnail = "";
    $("btn-thumb-clear").hidden = true;
    $("emoji-row")
      .querySelectorAll("button")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
    $("done-view").hidden = true;
    $("form-view").hidden = false;
    updatePreview();
    window.scrollTo({ top: 0 });
    $("f-title").focus();
  });

  /* ---------- 시작 ---------- */

  G.renderTabs("register");
  G.renderNotices();
  updatePreview();

  // 선생님이 서버에 등록 코드를 정해 두었으면 코드 칸을 보여 줘요.
  G.api
    .info()
    .then((info) => {
      $("code-field").hidden = !info.needCode;
    })
    .catch((err) => G.renderNotices(err));
})();
