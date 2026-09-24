// 에셋 매니페스트 — 콘텐츠 ID와 실제 파일을 한곳에서 연결한다.
// 출처는 ASSET_CREDITS.md 참조. 이미지 크기(16x16 원본)와 게임 내 표시/충돌 크기는 분리되어 있으며,
// 표시 크기는 content.js의 각 정의(radiusU 등)가, 확대 배율은 아래 DRAW_SCALE이 담당한다.

const IMG_BASE = "./assets/sprites/";
const AUDIO_BASE = "./assets/audio/";
const UI_BASE = "./assets/ui/";

export const ELEMENT_WEAPONS=Object.fromEntries(['sword','pencil','bat','dodgeball','baseball'].map(id=>{
  const img=new Image();img.src=`./assets/elements_v2/weapons/${id}.png`;
  // Find transparent padding once so the hand anchor is independent of generator canvas size.
  img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);const data=g.getImageData(0,0,c.width,c.height).data;let l=c.width,t=c.height,r=0,b=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>40){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r>=l)img.assetBounds={x:l,y:t,w:r-l+1,h:b-t+1};};
  return [id,img];
}));

export const SPRITE_FILES = {
  vfx_purify: IMG_BASE + "vfx/purify-v1.png",
  vfx_smog: IMG_BASE + "vfx/smog-v1.png",
  vfx_splash: IMG_BASE + "vfx/splash-v1.png",
  player_knight: IMG_BASE + "player_knight.png",
  enemy_wraith: IMG_BASE + "enemy_wraith.png",
  enemy_spider: IMG_BASE + "enemy_spider.png",
  enemy_elite: IMG_BASE + "enemy_elite.png",
  prop_torch: IMG_BASE + "prop_torch.png",
  prop_rock: IMG_BASE + "prop_rock.png",
  prop_chest: IMG_BASE + "prop_chest.png",
  floor_ground: IMG_BASE + "floor_ground.png",
  // 환경 테마 1 「쓰레기 마을」 — 이미지 에셋/테마 1단계 *.jpg 등(Gemini) → tools/cut_theme1.py. 바닥 3종은 448px 이어 붙는 타일
  t1_floor_dirt: IMG_BASE + "t1/floor_dirt.png",
  t1_floor_concrete: IMG_BASE + "t1/floor_concrete.png",
  t1_floor_trash: IMG_BASE + "t1/floor_trash.png",
  t1_prop_bins: IMG_BASE + "t1/prop_bins.png",              // 분리수거함 = 정화 장치(안전 구역)
  t1_prop_bin_fallen: IMG_BASE + "t1/prop_bin_fallen.png",
  t1_prop_bags: IMG_BASE + "t1/prop_bags.png",
  t1_prop_tire: IMG_BASE + "t1/prop_tire.png",
  t1_prop_bench: IMG_BASE + "t1/prop_bench.png",
  t1_prop_litter: IMG_BASE + "t1/prop_litter.png",
  t1_en_snackbag: IMG_BASE + "t1/en_snackbag.png",
  t1_en_buttbug: IMG_BASE + "t1/en_buttbug.png",
  t1_en_bottle: IMG_BASE + "t1/en_bottle.png",
  t1_en_baggy: IMG_BASE + "t1/en_baggy.png",
  t1_en_foodwaste: IMG_BASE + "t1/en_foodwaste.png",
  t1_en_fly: IMG_BASE + "t1/en_fly.png",
  t1_boss_calm: IMG_BASE + "t1/boss_calm.png",
  t1_boss_angry: IMG_BASE + "t1/boss_angry.png",
  // 대왕 기술 효과(사용자 Gemini 2026-09-23, game/tools/cut_boss_fx.py): 던지는 쓰레기 뭉치 · 쾅 충격파 고리 · 금 간 땅
  t1_fx_trashball: IMG_BASE + "t1/fx_trashball.png",
  t1_fx_shockring: IMG_BASE + "t1/fx_shockring.png",
  t1_fx_crack: IMG_BASE + "t1/fx_crack.png",
  // 테마 2 「대기오염 공장 지대」(사용자 Gemini 2026-09-24, game/tools/cut_theme2.py)
  t2_en_dust: IMG_BASE + "t2/en_dust.png",
  t2_en_gas: IMG_BASE + "t2/en_gas.png",
  t2_en_gas_fire: IMG_BASE + "t2/en_gas_fire.png",
  t2_en_gas_windup: IMG_BASE + "t2/en_gas_windup.png",
  t2_en_germ: IMG_BASE + "t2/en_germ.png",
  t2_en_germ2: IMG_BASE + "t2/en_germ2.png",
  t2_en_germ3: IMG_BASE + "t2/en_germ3.png",
  t2_en_germ_armed: IMG_BASE + "t2/en_germ_armed.png",
  t2_en_raincloud: IMG_BASE + "t2/en_raincloud.png",
  t2_en_bigdust: IMG_BASE + "t2/en_bigdust.png",
  t2_boss_calm: IMG_BASE + "t2/boss_calm.png",
  t2_boss_angry: IMG_BASE + "t2/boss_angry.png",
  t2_prop_tree: IMG_BASE + "t2/prop_tree.png",
  t2_prop_drums: IMG_BASE + "t2/prop_drums.png",
  t2_prop_pipe: IMG_BASE + "t2/prop_pipe.png",
  t2_prop_chimney: IMG_BASE + "t2/prop_chimney.png",
  t2_prop_cones: IMG_BASE + "t2/prop_cones.png",
  t2_prop_pedestal: IMG_BASE + "t2/prop_pedestal.png",
  t2_prop_valve: IMG_BASE + "t2/prop_valve.png",
  t2_fx_flame: IMG_BASE + "t2/fx_flame.png",
  t2_fx_smog: IMG_BASE + "t2/fx_smog.png",
  t2_fx_bomb: IMG_BASE + "t2/fx_bomb.png",
  t2_fx_splat: IMG_BASE + "t2/fx_splat.png",
  t2_floor_factory: IMG_BASE + "t2/floor_factory.png",
  t2_floor_steel: IMG_BASE + "t2/floor_steel.png",
  t2_floor_soot: IMG_BASE + "t2/floor_soot.png",
  // 공용 아이템(모든 테마): 새싹(경험치) · 큰 새싹 · 재활용 봉투(보물) · 하트 · 지구 에너지 구슬 · 별가루
  item_sprout: IMG_BASE + "t1/item_sprout.png",
  item_sprout_big: IMG_BASE + "t1/item_sprout_big.png",
  item_recycle: IMG_BASE + "t1/item_recycle.png",
  item_heart: IMG_BASE + "t1/item_heart.png",
  item_orb: IMG_BASE + "t1/item_orb.png",
  item_star: IMG_BASE + "t1/item_star.png",
};

// 주인공 2종(호야·민지) 프레임 애니메이션. 원본: 이미지 에셋/*.png(Gemini 앱 생성) → tools/cut_heroes.py로 잘라낸
// 128px 높이 투명 PNG. 모두 오른쪽을 보는 옆모습이며 발바닥 기준선이 맞춰져 있다(왼쪽 이동은 좌우 반전).
// 경로는 단일 파일 빌드(tools/build-single.ps1)가 문자열째로 data URI로 바꾸므로 반드시 리터럴로 적는다.
export const HERO_FILES = {
  hoya: {
    idle: [IMG_BASE + "heroes/hoya_idle_1.png"],
    walk: [IMG_BASE + "heroes/hoya_walk_1.png", IMG_BASE + "heroes/hoya_walk_2.png", IMG_BASE + "heroes/hoya_walk_3.png"],
    run: [IMG_BASE + "heroes/hoya_run_1.png", IMG_BASE + "heroes/hoya_run_2.png", IMG_BASE + "heroes/hoya_run_3.png"],
    jump: [IMG_BASE + "heroes/hoya_jump_1.png", IMG_BASE + "heroes/hoya_jump_2.png"],
    attack: [IMG_BASE + "heroes/hoya_attack_1.png", IMG_BASE + "heroes/hoya_attack_2.png", IMG_BASE + "heroes/hoya_attack_3.png"],
    hurt: [IMG_BASE + "heroes/hoya_hurt_1.png"],
    down: [IMG_BASE + "heroes/hoya_down_1.png"],
    // 원거리(야구방망이) 모드 전용 — 사용자 Gemini 시트 → tools/cut_heroes_bat.py. 없으면 위 프레임으로 대신함
    ranged: [IMG_BASE + "heroes/hoya_ranged_1.png", IMG_BASE + "heroes/hoya_ranged_2.png", IMG_BASE + "heroes/hoya_ranged_3.png", IMG_BASE + "heroes/hoya_ranged_4.png", IMG_BASE + "heroes/hoya_ranged_5.png", IMG_BASE + "heroes/hoya_ranged_6.png"],
    rangedIdle: [IMG_BASE + "heroes/hoya_ranged_idle_1.png"],
    rangedWalk: [IMG_BASE + "heroes/hoya_ranged_walk_1.png", IMG_BASE + "heroes/hoya_ranged_walk_2.png", IMG_BASE + "heroes/hoya_ranged_walk_3.png"],
    rangedRun: [IMG_BASE + "heroes/hoya_ranged_run_1.png", IMG_BASE + "heroes/hoya_ranged_run_2.png", IMG_BASE + "heroes/hoya_ranged_run_3.png"],
    rangedJump: [IMG_BASE + "heroes/hoya_ranged_jump_1.png", IMG_BASE + "heroes/hoya_ranged_jump_2.png"],
    rangedHurt: [IMG_BASE + "heroes/hoya_ranged_hurt_1.png"],
    rangedDown: [IMG_BASE + "heroes/hoya_ranged_down_1.png"],
  },
  minji: {
    idle: [IMG_BASE + "heroes/minji_idle_1.png"],
    walk: [IMG_BASE + "heroes/minji_walk_1.png", IMG_BASE + "heroes/minji_walk_2.png", IMG_BASE + "heroes/minji_walk_3.png"],
    run: [IMG_BASE + "heroes/minji_run_1.png", IMG_BASE + "heroes/minji_run_2.png", IMG_BASE + "heroes/minji_run_3.png"],
    jump: [IMG_BASE + "heroes/minji_jump_1.png"],
    attack: [IMG_BASE + "heroes/minji_attack_1.png", IMG_BASE + "heroes/minji_attack_2.png", IMG_BASE + "heroes/minji_attack_3.png"],
    hurt: [IMG_BASE + "heroes/minji_hurt_1.png"],
    down: [IMG_BASE + "heroes/minji_down_1.png"],
    // 원거리(피구공 던지기) 모드 전용 — 사용자 Gemini 시트(전투 시트만 있어 걷기·달리기는 원본 그대로)
    ranged: [IMG_BASE + "heroes/minji_ranged_1.png", IMG_BASE + "heroes/minji_ranged_2.png", IMG_BASE + "heroes/minji_ranged_3.png", IMG_BASE + "heroes/minji_ranged_4.png", IMG_BASE + "heroes/minji_ranged_5.png", IMG_BASE + "heroes/minji_ranged_6.png"],
    rangedIdle: [IMG_BASE + "heroes/minji_ranged_idle_1.png"],
    rangedHurt: [IMG_BASE + "heroes/minji_ranged_hurt_1.png"],
    rangedDown: [IMG_BASE + "heroes/minji_ranged_down_1.png"],
  },
};
export const HERO_INFO = {
  hoya: { id: "hoya", name: "호야", desc: "파란 후드티와 장난감 칼. 씩씩한 남자아이" },
  minji: { id: "minji", name: "민지", desc: "분홍 가디건과 마법 색연필. 밝은 여자아이" },
};

export const UI_FILES = {
  panelBorder: UI_BASE + "panel-border.png",
  panelBorderThin: UI_BASE + "panel-border-thin.png",
};

export const SFX_FILES = {
  attackFire: AUDIO_BASE + "attack_whoosh.ogg",
  hitLight: AUDIO_BASE + "hit_light.ogg",
  hitLight2: AUDIO_BASE + "hit_light2.ogg",
  hitBoss: AUDIO_BASE + "hit_boss.ogg",
  gemPickup: AUDIO_BASE + "gem_pickup.ogg",
  goldReward: AUDIO_BASE + "gold_reward.ogg",
  bossTelegraph: AUDIO_BASE + "boss_telegraph.ogg",
  levelupOpen: AUDIO_BASE + "levelup_open.ogg",
  cardSelect: AUDIO_BASE + "card_select.ogg",
  uiClick: AUDIO_BASE + "ui_click.ogg",
};

const imageCache = {};
export function loadImage(src) {
  if (imageCache[src]) return imageCache[src];
  const img = new Image();
  img.src = src;
  imageCache[src] = img;
  return img;
}

export const SPRITES = Object.fromEntries(
  Object.entries(SPRITE_FILES).map(([k, v]) => [k, loadImage(v)])
);
export const UI_IMAGES = Object.fromEntries(
  Object.entries(UI_FILES).map(([k, v]) => [k, loadImage(v)])
);
// HEROES[id].frames[anim] = HTMLImageElement[]
export const HEROES = Object.fromEntries(
  Object.entries(HERO_FILES).map(([id, anims]) => [id, {
    ...HERO_INFO[id],
    frames: Object.fromEntries(Object.entries(anims).map(([a, list]) => [a, list.map(loadImage)])),
  }])
);

// ---- 색조 틴트 (source-atop 합성) — 같은 원본 스프라이트를 콘텐츠별로 재채색 ----
const tintCache = {};
export function tintedSprite(img, colorRgba, key) {
  const cacheKey = key || (img.src + colorRgba);
  if (tintCache[cacheKey]) return tintCache[cacheKey];
  const w = img.naturalWidth || 16, h = img.naturalHeight || 16;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cx = c.getContext("2d");
  const draw = () => {
    cx.clearRect(0, 0, w, h);
    cx.drawImage(img, 0, 0, w, h);
    cx.globalCompositeOperation = "source-atop";
    cx.fillStyle = colorRgba;
    cx.fillRect(0, 0, w, h);
    cx.globalCompositeOperation = "source-over";
  };
  if (img.complete && img.naturalWidth) draw();
  else img.addEventListener("load", () => { c.width = img.naturalWidth; c.height = img.naturalHeight; draw(); }, { once: true });
  tintCache[cacheKey] = c;
  return c;
}

// ---- 효과음: Web Audio API ----
// <audio> 엘리먼트를 복제해 재생하면 동시 타격이 많을 때 Chrome의 WebMediaPlayer 개수 한도
// ("too many WebMediaPlayers")에 걸려 소리가 끊긴다. 짧은 SFX는 AudioBuffer 한 번만 디코딩해두고
// 재생할 때마다 가벼운 BufferSource를 만드는 방식이 정석이라 그렇게 처리한다.
const MUTE_KEY = "lumen_muted";
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { /* 저장소 차단 환경: 기본값 사용 */ }

let audioCtx = null;
let masterGain = null;
const bufferCache = {};   // name -> AudioBuffer
const pendingLoads = {};  // name -> Promise
const lastPlayedAt = {};  // name -> timestamp (연타 스팸 방지)
const MIN_GAP_MS = 45;    // 같은 효과음 최소 간격
let activeVoices = 0;
const MAX_VOICES = 24;

function ensureCtx() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

function loadBuffer(name) {
  if (bufferCache[name]) return Promise.resolve(bufferCache[name]);
  if (pendingLoads[name]) return pendingLoads[name];
  const ctx = ensureCtx();
  if (!ctx) return Promise.resolve(null);
  pendingLoads[name] = fetch(SFX_FILES[name])
    .then((r) => r.arrayBuffer())
    .then((buf) => ctx.decodeAudioData(buf))
    .then((decoded) => { bufferCache[name] = decoded; return decoded; })
    .catch(() => null);
  return pendingLoads[name];
}

// 첫 사용자 입력 시 오디오 컨텍스트를 깨우고 전체 프리로드(자동재생 정책 대응)
function primeAudio() {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  for (const name in SFX_FILES) loadBuffer(name);
}
window.addEventListener("pointerdown", primeAudio, { once: true });
window.addEventListener("keydown", primeAudio, { once: true });

export function playSfx(name, volume = 0.6) {
  if (muted) return;
  const now = performance.now();
  if (lastPlayedAt[name] && now - lastPlayedAt[name] < MIN_GAP_MS) return;
  if (activeVoices >= MAX_VOICES) return;
  const ctx = ensureCtx();
  if (!ctx) return;
  const buf = bufferCache[name];
  if (!buf) { loadBuffer(name); return; } // 아직 디코딩 전이면 이번 재생은 건너뛴다
  lastPlayedAt[name] = now;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g); g.connect(masterGain);
    activeVoices++;
    src.onended = () => { activeVoices--; src.disconnect(); g.disconnect(); };
    src.start();
  } catch (e) { /* 재생 실패는 게임 진행에 영향 없음 */ }
}
export function isMuted() { return muted; }
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch (e) { /* 저장 실패는 무시 */ }
  if (masterGain) masterGain.gain.value = v ? 0 : 1;
  if (!v) primeAudio();
}
export function toggleMuted() { setMuted(!muted); return muted; }
