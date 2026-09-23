const bgm = createBgm("audio/main-theme.mp3");

const screens = {
  title: document.getElementById("screen-title"),
  lobby: document.getElementById("screen-lobby"),
  battle: document.getElementById("screen-battle"),
};

let current = "title";

const show = (name) => {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === name);
  });
  current = name;
};

// 시작 화면: 테마곡 재생 시작 (자동재생이 막히면 첫 입력 때 재생)
bgm.playMenu();

// 시작 화면 → 로비: 노래는 끊기지 않고 이어서 재생
const enterLobbyFromTitle = () => {
  if (current !== "title") return;
  show("lobby");
  bgm.playMenu();
};
screens.title.addEventListener("click", enterLobbyFromTitle);
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLButtonElement) return;
  enterLobbyFromTitle();
});

// 출동 → 게임 시작: 노래 정지
document.getElementById("deploy").addEventListener("click", () => {
  bgm.stop();
  show("battle");
});

// 게임 → 로비 복귀: 노래를 처음부터 다시 재생
document.getElementById("back-to-lobby").addEventListener("click", () => {
  show("lobby");
  bgm.restart();
});

// 우측 상단 음소거 버튼
const muteButton = document.getElementById("mute-toggle");
muteButton.addEventListener("click", (event) => {
  event.stopPropagation();
  bgm.toggleMute();
});
bgm.onMuteChange((muted) => {
  muteButton.querySelector(".icon").textContent = muted ? "🔇" : "🔊";
  muteButton.setAttribute("aria-pressed", String(muted));
  muteButton.setAttribute("aria-label", muted ? "배경음악 켜기" : "배경음악 음소거");
});
