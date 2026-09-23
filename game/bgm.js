// 메인 테마곡(BGM) 관리 모듈.
// - 시작 화면 ~ 로비: 끊기지 않고 무한 반복 (화면 전환 시에도 이어서 재생)
// - 출동(게임 시작): 정지
// - 로비 복귀: 처음부터 다시 재생
// - 음소거 상태는 localStorage에 저장 (막혀 있어도 동작)

const MUTE_KEY = "seoho-bgm-muted";

const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeMuted = (muted) => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // 저장소를 쓸 수 없으면 이번 세션 동안만 유지
  }
};

window.createBgm = (src) => {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.muted = readMuted();

  // 재생해야 하는 구간(시작 화면/로비)인지 여부
  let wanted = false;
  const listeners = new Set();

  const tryPlay = () => {
    if (!wanted) return;
    audio.play().catch(() => {
      // 브라우저 자동재생 정책으로 막힌 경우: 첫 사용자 입력 때 재생
      waitForGesture();
    });
  };

  let waiting = false;
  const waitForGesture = () => {
    if (waiting) return;
    waiting = true;
    const resume = () => {
      waiting = false;
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      tryPlay();
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
  };

  return {
    /** 메뉴 구간 진입: 이미 재생 중이면 끊지 않고 그대로 이어서 재생 */
    playMenu() {
      wanted = true;
      if (audio.paused) tryPlay();
    },

    /** 로비 복귀: 처음부터 다시 재생 */
    restart() {
      wanted = true;
      audio.currentTime = 0;
      tryPlay();
    },

    /** 출동: 정지 */
    stop() {
      wanted = false;
      audio.pause();
    },

    get muted() {
      return audio.muted;
    },

    setMuted(muted) {
      audio.muted = muted;
      writeMuted(muted);
      listeners.forEach((fn) => fn(muted));
    },

    toggleMute() {
      this.setMuted(!audio.muted);
    },

    onMuteChange(fn) {
      listeners.add(fn);
      fn(audio.muted);
    },
  };
};
