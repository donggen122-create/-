// 메인 테마곡(시작 화면·로비 배경음) — 2026-09-23 사용자 요청
// 시작 화면 → 로비는 끊기지 않고 이어서, 전투를 시작하면 멈추고, 전투 뒤 로비로 돌아오면 처음부터 다시(main.js bgmOn/bgmOff).
// 음소거는 효과음과 같은 상태(assets.js isMuted, localStorage "lumen_muted")를 쓴다.
// 브라우저가 자동 재생을 막으면(play() 거부) 첫 pointerdown/keydown 때 재생을 시작한다.
import { isMuted } from "./assets.js";

const SRC = "./assets/audio/main-theme.mp3";
const VOLUME = 0.45;
let audio = null, wanted = false, unlockArmed = false;

function el() {
  if (!audio) { audio = new Audio(SRC); audio.loop = true; audio.preload = "auto"; audio.volume = VOLUME; }
  return audio;
}
function tryPlay() {
  const a = el();
  if (!wanted || isMuted()) { a.pause(); return; }
  if (!a.paused) return;
  const p = a.play();
  if (p && typeof p.catch === "function") p.catch(() => armUnlock());
}
function armUnlock() {
  if (unlockArmed) return;
  unlockArmed = true;
  const go = () => {
    unlockArmed = false;
    window.removeEventListener("pointerdown", go, true);
    window.removeEventListener("keydown", go, true);
    tryPlay();
  };
  window.addEventListener("pointerdown", go, true);
  window.addEventListener("keydown", go, true);
}

export const music = {
  // restart: 처음부터(전투 뒤 로비로 돌아올 때). 아니면 재생 중이던 곳에서 이어서.
  play({ restart = false } = {}) {
    wanted = true;
    const a = el();
    if (restart) { try { a.currentTime = 0; } catch (e) { /* 아직 불러오는 중이면 무시 */ } }
    tryPlay();
  },
  stop() { wanted = false; if (audio) audio.pause(); },
  // 음소거 버튼을 누른 뒤: 음소거면 멈추고, 풀었으면 시작 화면·로비에서만 다시 재생
  syncMute() { if (!audio) return; if (isMuted()) audio.pause(); else tryPlay(); },
  state() { return { wanted, paused: audio ? audio.paused : true, time: audio ? Math.round(audio.currentTime * 100) / 100 : 0, muted: isMuted(), unlockArmed }; },
};
