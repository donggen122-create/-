// 서버 저장(클라우드) 클라이언트 — server/ 의 Worker API와 통신한다.
// 게임은 항상 서버 계정으로 진행한다(기기 전용 모드 없음). API 주소는 ① localStorage 덮어쓰기(개발용) →
// ② 같은 주소의 /api(실서버에서 열었을 때) → ③ 실서버 고정 주소(단일 파일 file:// 등 다른 곳에서 열었을 때) 순서로 찾는다.
const TOKEN_KEY = "lumen_token";
const USER_KEY = "lumen_user";
const API_OVERRIDE_KEY = "lumen_api";   // 개발용: localStorage에 API 주소를 넣으면 그쪽으로 붙는다
const DEFAULT_API = "https://seoho-pangpang.seoho-pangpang-server.workers.dev/api";   // 실서버(server/README.md)

function apiCandidates() {
  const out = [];
  try { const o = localStorage.getItem(API_OVERRIDE_KEY); if (o) out.push(o.replace(/\/$/, "")); } catch (e) { /* 무시 */ }
  if (location.protocol === "http:" || location.protocol === "https:") out.push(`${location.origin}/api`);
  if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return out;
  if (!out.includes(DEFAULT_API)) out.push(DEFAULT_API);
  return out;
}
function readLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function writeLS(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 무시 */ } }

export const cloud = {
  available: false,           // 어느 후보든 /health 응답이 있으면 true
  probed: false,              // probe()를 한 번이라도 끝냈는지(연결 중 표시용)
  base: null,
  token: readLS(TOKEN_KEY),
  user: readLS(USER_KEY),
  lastError: null,
  get loggedIn() { return !!(this.available && this.token && this.user); },

  // 후보 주소를 차례로 찔러 첫 응답을 쓴다
  async probe() {
    this.probed = false; this.available = false; this.base = null;
    for (const base of apiCandidates()) {
      try {
        const r = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (r.ok) { this.base = base; this.available = true; break; }
      } catch (e) { /* 다음 후보 */ }
    }
    this.probed = true;
    return this.available;
  },

  async request(path, opt = {}) {
    const headers = { "Content-Type": "application/json", ...(opt.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const r = await fetch(`${this.base}${path}`, { ...opt, headers, signal: AbortSignal.timeout(10000) });
    let data = null;
    try { data = await r.json(); } catch (e) { /* 본문 없음 */ }
    // 401 = 토큰 만료, 403 = 선생님이 계정을 잠금 → 접속 정보를 지워 처음 화면에서 다시 로그인하게 한다
    if ((r.status === 401 || r.status === 403) && this.token && path !== "/login") { this.clearSession(); }
    if (!r.ok) { const error=new Error(data?.error || `서버 오류 (${r.status})`);error.status=r.status;error.data=data;throw error; }
    return data;
  },

  async register(id, pw) { return this.session(await this.request("/register", { method: "POST", body: JSON.stringify({ id, pw }) })); },
  async login(id, pw) { return this.session(await this.request("/login", { method: "POST", body: JSON.stringify({ id, pw }) })); },
  session(data) {
    this.token = data.token; this.user = data.id;
    writeLS(TOKEN_KEY, this.token); writeLS(USER_KEY, this.user);
    return data;
  },
  clearSession() { this.token = null; this.user = null; writeLS(TOKEN_KEY, null); writeLS(USER_KEY, null); },
  async logout() { try { if (this.token) await this.request("/logout", { method: "POST" }); } catch (e) { /* 무시 */ } this.clearSession(); },

  // 토큰이 살아 있는지 확인(자동 접속)
  async me() {
    if (!this.token) return null;
    try { const d = await this.request("/me"); this.user = d.id; writeLS(USER_KEY, d.id); return d; }
    catch (e) { return null; }
  },
  async download() { return this.request("/save"); },                     // { save, updatedAt, device }
  async upload(save) {
    return this.request("/save", { method: "PUT", body: JSON.stringify({ save, device: deviceTag() }) });
  },

  // 저장이 일어날 때마다 호출 → 2초 뒤 한 번만 올린다(연타 방지). 실패해도 게임은 계속(다음 저장 때 재시도)
  _timer: null, _pending: null, syncing: false, lastSyncAt: 0,
  scheduleUpload(save, onState) {
    if (!this.loggedIn) return;
    this._pending = save;
    clearTimeout(this._timer);
    this._timer = setTimeout(async () => {
      const s = this._pending; this._pending = null;
      this.syncing = true; onState?.("syncing");
      try { const r = await this.upload(s); this.lastSyncAt = r.updatedAt; this.lastError = null; onState?.("ok"); }
      catch (e) { this.lastError = e.message; onState?.("error", e.message); }
      this.syncing = false;
    }, 2000);
  },
  // 페이지를 떠날 때 대기 중인 저장이 있으면 즉시 시도
  flush() {
    if (!this._pending || !this.loggedIn) return;
    const s = this._pending; this._pending = null; clearTimeout(this._timer);
    try {
      fetch(`${this.base}/save`, { method: "PUT", keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ save: s, device: deviceTag() }) });
    } catch (e) { /* 무시 */ }
  },
};

function deviceTag() {
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "기기";
  return `${os} · ${new Date().toLocaleDateString("ko-KR")}`;
}
