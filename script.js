const COLS = 10;
const ROWS = 20;
const CELL = 24;

const COLORS = {
  I: "#2dd4ee",
  O: "#f4d35e",
  T: "#c084fc",
  S: "#4ade80",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#fb923c",
};

const SPECIAL_COLORS = {
  bomb: "#ff3b3b",
  laser: "#e2f8ff",
};

const SPECIAL_ICONS = {
  bomb: "\u{1F4A3}",
  laser: "⚡",
};

const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

const PIECE_TYPES = Object.keys(SHAPES);

// Player-level perks: each unlocks a special rule on top of vanilla Tetris.
const PERK_INFO = [
  { level: 2, name: "무제한 홀드", desc: "한 조각에서 홀드를 여러 번 바꿀 수 있어요" },
  { level: 3, name: "폭탄 조각", desc: "가끔 폭탄 조각이 등장해 주변 3x3을 날려요" },
  { level: 4, name: "콤보 실드", desc: "콤보 중 실수해도 한 번은 콤보가 끊기지 않아요" },
  { level: 5, name: "넥스트 확장", desc: "다음 조각을 6개까지 미리 볼 수 있어요" },
  { level: 6, name: "레이저 조각", desc: "가끔 레이저 조각이 등장해 놓인 줄을 바로 지워요" },
  { level: 7, name: "점수 배율 상승", desc: "레벨이 오를 때마다 점수 배율이 10%씩 늘어나요" },
];

const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold-canvas");
const holdCtx = holdCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const stageEl = document.getElementById("stage");
const linesEl = document.getElementById("lines");
const comboEl = document.getElementById("combo");
const playerLevelEl = document.getElementById("player-level");
const expFillEl = document.getElementById("exp-fill");
const expTextEl = document.getElementById("exp-text");
const perksListEl = document.getElementById("perks-list");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("start-btn");

function buildPerksList() {
  perksListEl.innerHTML = "";
  PERK_INFO.forEach((perk) => {
    const li = document.createElement("li");
    li.className = "perk";
    li.dataset.level = perk.level;
    li.innerHTML = `
      <span class="perk-name">${perk.name}</span>
      <span class="perk-desc">${perk.desc}</span>
      <span class="perk-level">Lv.${perk.level}</span>
    `;
    perksListEl.appendChild(li);
  });
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function bag() {
  const arr = [...PIECE_TYPES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class PieceQueue {
  constructor() {
    this.queue = [...bag(), ...bag()];
  }
  next() {
    const piece = this.queue.shift();
    if (this.queue.length <= 7) {
      this.queue.push(...bag());
    }
    return piece;
  }
  peek(n) {
    return this.queue.slice(0, n);
  }
}

function rotateCells(cells, times) {
  let result = cells;
  for (let t = 0; t < times; t++) {
    const maxX = Math.max(...result.map((c) => c[0]));
    result = result.map(([x, y]) => [maxX - y, x]);
  }
  return result;
}

class Piece {
  constructor(type, special = null) {
    this.type = type;
    this.special = special;
    this.rotation = 0;
    this.x = 3;
    this.y = 0;
  }
  getCells(rotation = this.rotation) {
    const base = SHAPES[this.type];
    return rotateCells(base, ((rotation % 4) + 4) % 4);
  }
  absoluteCells(rotation = this.rotation, x = this.x, y = this.y) {
    return this.getCells(rotation).map(([cx, cy]) => [cx + x, cy + y]);
  }
}

class Game {
  constructor() {
    this.board = createBoard();
    this.queue = new PieceQueue();
    this.current = null;
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.stage = 1;
    this.lines = 0;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.rafId = null;

    // RPG-style progression, separate from the drop-speed "stage".
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.comboCount = 0;
    this.comboShieldUsed = false;
    this.toasts = [];
    this.screenFlash = 0;
  }

  get unlimitedHold() {
    return this.playerLevel >= 2;
  }
  get bombChance() {
    return this.playerLevel >= 3 ? 0.06 : 0;
  }
  get comboShieldPerk() {
    return this.playerLevel >= 4;
  }
  get nextPreviewCount() {
    return this.playerLevel >= 5 ? 6 : 4;
  }
  get laserChance() {
    return this.playerLevel >= 6 ? 0.05 : 0;
  }
  get scoreMultiplier() {
    return 1 + Math.max(0, this.playerLevel - 6) * 0.1;
  }

  addToast(text) {
    this.toasts.push({ text, expiresAt: performance.now() + 1600 });
  }

  spawn() {
    const type = this.queue.next();
    let special = null;
    if (this.laserChance > 0 && Math.random() < this.laserChance) {
      special = "laser";
    } else if (this.bombChance > 0 && Math.random() < this.bombChance) {
      special = "bomb";
    }
    const piece = new Piece(type, special);
    if (this.collides(piece, piece.x, piece.y, piece.rotation)) {
      this.endGame();
      return;
    }
    this.current = piece;
    this.canHold = true;
    if (special) {
      this.addToast(special === "bomb" ? "\u{1F4A3} 폭탄 조각 등장!" : "⚡ 레이저 조각 등장!");
    }
  }

  collides(piece, x, y, rotation) {
    const cells = piece.absoluteCells(rotation, x, y);
    for (const [cx, cy] of cells) {
      if (cx < 0 || cx >= COLS || cy >= ROWS) return true;
      if (cy < 0) continue;
      if (this.board[cy][cx]) return true;
    }
    return false;
  }

  move(dx) {
    if (!this.current || this.gameOver || this.paused) return;
    const nx = this.current.x + dx;
    if (!this.collides(this.current, nx, this.current.y, this.current.rotation)) {
      this.current.x = nx;
    }
  }

  softDrop() {
    if (!this.current || this.gameOver || this.paused) return;
    if (!this.collides(this.current, this.current.x, this.current.y + 1, this.current.rotation)) {
      this.current.y += 1;
      this.score += 1;
      this.dropCounter = 0;
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (!this.current || this.gameOver || this.paused) return;
    let dist = 0;
    while (!this.collides(this.current, this.current.x, this.current.y + 1, this.current.rotation)) {
      this.current.y += 1;
      dist += 1;
    }
    this.score += dist * 2;
    this.lockPiece();
  }

  rotate(dir) {
    if (!this.current || this.gameOver || this.paused) return;
    const piece = this.current;
    const newRotation = piece.rotation + dir;
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collides(piece, piece.x + kick, piece.y, newRotation)) {
        piece.x += kick;
        piece.rotation = ((newRotation % 4) + 4) % 4;
        return;
      }
    }
  }

  holdPiece() {
    if (!this.current || this.gameOver || this.paused) return;
    if (!this.canHold && !this.unlimitedHold) return;
    const currentType = this.current.type;
    if (this.hold) {
      this.current = new Piece(this.hold);
    } else {
      this.spawn();
    }
    this.hold = currentType;
    if (!this.unlimitedHold) this.canHold = false;
  }

  detonateBomb(piece) {
    const cells = piece.absoluteCells();
    const [coreX, coreY] = cells[Math.floor(cells.length / 2)];
    let cleared = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = coreX + dx;
        const y = coreY + dy;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        if (this.board[y][x]) cleared += 1;
        this.board[y][x] = null;
      }
    }
    this.addToast("\u{1F4A5} 폭탄 폭발!");
    this.screenFlash = 1;
    return cleared;
  }

  lockPiece() {
    const cells = this.current.absoluteCells();
    for (const [cx, cy] of cells) {
      if (cy < 0) {
        this.endGame();
        return;
      }
      this.board[cy][cx] = this.current.type;
    }

    let forcedRows = [];
    let bombBonusCells = 0;
    if (this.current.special === "bomb") {
      bombBonusCells = this.detonateBomb(this.current);
    } else if (this.current.special === "laser") {
      forcedRows = [...new Set(cells.map(([, cy]) => cy).filter((cy) => cy >= 0))];
      this.addToast("⚡ 레이저 발동!");
      this.screenFlash = 1;
    }

    const clearedCount = this.clearLines(forcedRows);
    this.applyProgress(clearedCount, bombBonusCells);
    this.checkPerfectClear(clearedCount);
    this.spawn();
  }

  clearLines(forcedRows = []) {
    const forced = new Set(forcedRows);
    const remaining = [];
    let cleared = 0;
    for (let y = 0; y < ROWS; y++) {
      const full = this.board[y].every((cell) => cell);
      if (full || forced.has(y)) {
        cleared += 1;
      } else {
        remaining.push(this.board[y]);
      }
    }
    for (let i = 0; i < cleared; i++) {
      remaining.unshift(Array(COLS).fill(null));
    }
    this.board = remaining;
    return cleared;
  }

  applyProgress(clearedCount, bombBonusCells = 0) {
    let expGain = 0;
    let scoreGain = 0;

    if (clearedCount > 0) {
      this.comboCount += 1;
      this.comboShieldUsed = false;
      const baseExp = [0, 15, 40, 90, 160];
      const basePoints = [0, 100, 300, 500, 800];
      const idx = Math.min(clearedCount, 4);
      const comboMult = 1 + (this.comboCount - 1) * 0.15;
      expGain += Math.round(baseExp[idx] * comboMult);
      scoreGain += Math.round(basePoints[idx] * this.stage * comboMult * this.scoreMultiplier);
      if (this.comboCount >= 2) {
        this.addToast(`COMBO x${this.comboCount}`);
      }
    } else if (this.comboShieldPerk && this.comboCount > 0 && !this.comboShieldUsed) {
      this.comboShieldUsed = true;
      this.addToast("\u{1F6E1} 콤보 실드 발동");
    } else {
      this.comboCount = 0;
      this.comboShieldUsed = false;
    }

    if (bombBonusCells > 0) {
      expGain += 20 + bombBonusCells * 3;
      scoreGain += bombBonusCells * 15;
    }

    this.lines += clearedCount;
    this.stage = Math.floor(this.lines / 10) + 1;
    this.dropInterval = Math.max(100, 1000 - (this.stage - 1) * 75);

    this.score += scoreGain;
    this.gainExp(expGain);
  }

  gainExp(amount) {
    if (amount <= 0) return;
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.playerLevel += 1;
      this.expToNext = 100 + (this.playerLevel - 1) * 60;
      const perk = PERK_INFO.find((p) => p.level === this.playerLevel);
      this.addToast(`⭐ LEVEL UP! Lv.${this.playerLevel}` + (perk ? ` - ${perk.name} 해금!` : ""));
    }
  }

  checkPerfectClear(clearedCount) {
    if (clearedCount === 0) return;
    const empty = this.board.every((row) => row.every((cell) => !cell));
    if (empty) {
      this.score += 2000;
      this.gainExp(500);
      this.addToast("\u{1F31F} PERFECT CLEAR! +2000");
    }
  }

  endGame() {
    this.gameOver = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    showOverlay("게임 오버", `점수: ${this.score} (Lv.${this.playerLevel}) — 다시 시작하려면 버튼을 누르세요`);
  }

  togglePause() {
    if (this.gameOver || !this.running) return;
    this.paused = !this.paused;
    if (this.paused) {
      showOverlay("일시정지", "계속하려면 P를 누르세요");
    } else {
      hideOverlay();
      this.lastTime = performance.now();
    }
  }

  update(time) {
    if (!this.running) return;
    if (!this.paused && !this.gameOver) {
      const delta = time - this.lastTime;
      this.dropCounter += delta;
      if (this.dropCounter > this.dropInterval) {
        this.dropCounter = 0;
        if (!this.collides(this.current, this.current.x, this.current.y + 1, this.current.rotation)) {
          this.current.y += 1;
        } else {
          this.lockPiece();
        }
      }
      render();
    }
    this.lastTime = time;
    this.rafId = requestAnimationFrame((t) => this.update(t));
  }

  start() {
    this.board = createBoard();
    this.queue = new PieceQueue();
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.stage = 1;
    this.lines = 0;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.gameOver = false;
    this.paused = false;
    this.running = true;
    this.playerLevel = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.comboCount = 0;
    this.comboShieldUsed = false;
    this.toasts = [];
    this.screenFlash = 0;
    this.spawn();
    hideOverlay();
    this.lastTime = performance.now();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((t) => this.update(t));
  }

  getGhostY() {
    let y = this.current.y;
    while (!this.collides(this.current, this.current.x, y + 1, this.current.rotation)) {
      y += 1;
    }
    return y;
  }
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function drawCell(context, x, y, color, size = CELL) {
  context.fillStyle = color;
  context.fillRect(x * size, y * size, size, size);
  context.strokeStyle = "rgba(0,0,0,0.35)";
  context.lineWidth = 1;
  context.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
  context.fillStyle = "rgba(255,255,255,0.15)";
  context.fillRect(x * size, y * size, size, 3);
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, ROWS * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(COLS * CELL, y * CELL);
    ctx.stroke();
  }
}

function pieceColor(piece) {
  return SPECIAL_COLORS[piece.special] || COLORS[piece.type];
}

function renderScreenFlash() {
  if (game.screenFlash > 0) {
    ctx.fillStyle = `rgba(255,120,60,${game.screenFlash * 0.35})`;
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    game.screenFlash = Math.max(0, game.screenFlash - 0.06);
  }
}

function renderToasts() {
  const now = performance.now();
  game.toasts = game.toasts.filter((t) => t.expiresAt > now);
  game.toasts.forEach((t, i) => {
    const remain = (t.expiresAt - now) / 1600;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, remain * 1.6));
    ctx.font = 'bold 13px "Pretendard", sans-serif';
    ctx.textAlign = "center";
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 3;
    const ty = 20 + i * 18;
    ctx.strokeText(t.text, boardCanvas.width / 2, ty);
    ctx.fillText(t.text, boardCanvas.width / 2, ty);
    ctx.restore();
  });
}

function render() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  drawGrid();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = game.board[y][x];
      if (cell) drawCell(ctx, x, y, COLORS[cell]);
    }
  }

  if (game.current) {
    const color = pieceColor(game.current);
    const ghostY = game.getGhostY();
    const ghostCells = game.current.absoluteCells(game.current.rotation, game.current.x, ghostY);
    ctx.globalAlpha = 0.25;
    for (const [cx, cy] of ghostCells) {
      if (cy >= 0) drawCell(ctx, cx, cy, color);
    }
    ctx.globalAlpha = 1;

    const cells = game.current.absoluteCells();
    for (const [cx, cy] of cells) {
      if (cy >= 0) drawCell(ctx, cx, cy, color);
    }

    if (game.current.special) {
      const [coreX, coreY] = cells[Math.floor(cells.length / 2)];
      ctx.font = `${CELL - 4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(SPECIAL_ICONS[game.current.special], coreX * CELL + CELL / 2, coreY * CELL + CELL / 2);
    }
  }

  renderScreenFlash();
  renderToasts();
  renderNext();
  renderHold();

  scoreEl.textContent = game.score;
  stageEl.textContent = game.stage;
  linesEl.textContent = game.lines;
  comboEl.textContent = game.comboCount >= 2 ? `x${game.comboCount}` : "-";
  comboEl.classList.toggle("active", game.comboCount >= 2);
  playerLevelEl.textContent = game.playerLevel;
  expFillEl.style.width = `${Math.min(100, (game.exp / game.expToNext) * 100)}%`;
  expTextEl.textContent = `${game.exp} / ${game.expToNext}`;
  perksListEl.querySelectorAll(".perk").forEach((el) => {
    el.classList.toggle("unlocked", game.playerLevel >= Number(el.dataset.level));
  });
}

function renderMiniPiece(context, type, offsetY, cellSize) {
  const cells = SHAPES[type];
  const minX = Math.min(...cells.map((c) => c[0]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const width = maxX - minX + 1;
  const offsetX = (4 - width) / 2 - minX;
  for (const [cx, cy] of cells) {
    drawCell(context, cx + offsetX, cy + offsetY, COLORS[type], cellSize);
  }
}

function renderNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const upcoming = game.queue.peek(game.nextPreviewCount);
  upcoming.forEach((type, i) => {
    renderMiniPiece(nextCtx, type, i * 2, 24);
  });
}

function renderHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (game.hold) {
    renderMiniPiece(holdCtx, game.hold, 0.5, 24);
  }
}

buildPerksList();
const game = new Game();

function keyHandler(e) {
  if (e.repeat && ["ArrowUp", " ", "c", "C", "z", "Z"].includes(e.key)) return;
  switch (e.key) {
    case "ArrowLeft":
      e.preventDefault();
      game.move(-1);
      break;
    case "ArrowRight":
      e.preventDefault();
      game.move(1);
      break;
    case "ArrowDown":
      e.preventDefault();
      game.softDrop();
      break;
    case "ArrowUp":
    case "x":
    case "X":
      e.preventDefault();
      game.rotate(1);
      break;
    case "z":
    case "Z":
      e.preventDefault();
      game.rotate(-1);
      break;
    case " ":
      e.preventDefault();
      if (!game.running) {
        game.start();
      } else {
        game.hardDrop();
      }
      break;
    case "c":
    case "C":
      e.preventDefault();
      game.holdPiece();
      break;
    case "p":
    case "P":
      e.preventDefault();
      game.togglePause();
      break;
  }
  if (game.running) render();
}

document.addEventListener("keydown", keyHandler);
startBtn.addEventListener("click", () => game.start());

render();
