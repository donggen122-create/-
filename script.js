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

const SHAPES = {
  I: [
    [0, 1], [1, 1], [2, 1], [3, 1],
  ],
  O: [
    [1, 0], [2, 0], [1, 1], [2, 1],
  ],
  T: [
    [1, 0], [0, 1], [1, 1], [2, 1],
  ],
  S: [
    [1, 0], [2, 0], [0, 1], [1, 1],
  ],
  Z: [
    [0, 0], [1, 0], [1, 1], [2, 1],
  ],
  J: [
    [0, 0], [0, 1], [1, 1], [2, 1],
  ],
  L: [
    [2, 0], [0, 1], [1, 1], [2, 1],
  ],
};

const PIECE_TYPES = Object.keys(SHAPES);

const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next-canvas");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold-canvas");
const holdCtx = holdCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const linesEl = document.getElementById("lines");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startBtn = document.getElementById("start-btn");

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
  constructor(type) {
    this.type = type;
    this.rotation = 0;
    this.cells = SHAPES[type].map((c) => [...c]);
    this.x = type === "I" ? 3 : 3;
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
    this.level = 1;
    this.lines = 0;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.gameOver = false;
    this.rafId = null;
  }

  spawn() {
    const type = this.queue.next();
    const piece = new Piece(type);
    if (this.collides(piece, piece.x, piece.y, piece.rotation)) {
      this.endGame();
      return;
    }
    this.current = piece;
    this.canHold = true;
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
    if (!this.current || this.gameOver || this.paused || !this.canHold) return;
    const currentType = this.current.type;
    if (this.hold) {
      this.current = new Piece(this.hold);
    } else {
      this.spawn();
    }
    this.hold = currentType;
    this.canHold = false;
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
    this.clearLines();
    this.spawn();
  }

  clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (this.board[y].every((cell) => cell)) {
        this.board.splice(y, 1);
        this.board.unshift(Array(COLS).fill(null));
        cleared += 1;
        y += 1;
      }
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * this.level;
      this.score += points;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 75);
    }
  }

  endGame() {
    this.gameOver = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    showOverlay("게임 오버", `점수: ${this.score} — 다시 시작하려면 버튼을 누르세요`);
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
    this.level = 1;
    this.lines = 0;
    this.dropInterval = 1000;
    this.dropCounter = 0;
    this.gameOver = false;
    this.paused = false;
    this.running = true;
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
    const ghostY = game.getGhostY();
    const ghostCells = game.current.absoluteCells(game.current.rotation, game.current.x, ghostY);
    ctx.globalAlpha = 0.25;
    for (const [cx, cy] of ghostCells) {
      if (cy >= 0) drawCell(ctx, cx, cy, COLORS[game.current.type]);
    }
    ctx.globalAlpha = 1;

    const cells = game.current.absoluteCells();
    for (const [cx, cy] of cells) {
      if (cy >= 0) drawCell(ctx, cx, cy, COLORS[game.current.type]);
    }
  }

  renderNext();
  renderHold();
  scoreEl.textContent = game.score;
  levelEl.textContent = game.level;
  linesEl.textContent = game.lines;
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
  const upcoming = game.queue.peek(4);
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
