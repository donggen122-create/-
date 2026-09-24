// 환경 테마 6장 × 5단계 = 30단계의 표시 이름·보스 이름·환경 이야기(지식 카드).
// 2026-09-24: 대기오염(옛 3장 「뿌연 하늘」)을 2장 「대기오염 공장 지대」로 당기고 「더러워진 개울」을 3장으로 미뤘다(사용자 요청).
// 게임 데이터(chapters.csv → CHAPTERS)는 그대로 두고, 로비·결과 화면에서 "1-1 학교 운동장"처럼 보여 주는 용도로만 쓴다.
// CH01~CH05 = 1장, CH06~CH10 = 2장 … (챕터 index / 5). 표에 없는 장(31단계 이후)은 "N장" + 원래 챕터 이름으로 표시한다.
export const STAGES_PER_THEME = 5;

export const THEMES = [
  {
    name: "쓰레기 마을", boss: "쓰레기 산 대왕",
    stages: ["학교 운동장", "학교 앞 골목", "놀이터", "재활용 센터 앞", "쓰레기 산"],
    tips: [
      "바닥에 버린 쓰레기는 비와 바람을 타고 개울까지 흘러가요.",
      "담배꽁초 필터는 플라스틱이라 잘 안 썩어요.",
      "페트병은 라벨을 떼고 찌그러뜨린 뒤, 뚜껑을 닫아서 버려요!",
      "비닐봉지 한 장이 썩는 데 수백 년이 걸려요.",
      "분리배출 4가지 약속: 비우고, 헹구고, 분리하고, 섞지 않기!",
    ],
  },
  {
    name: "대기오염 공장 지대", boss: "굴뚝 가스 대왕",
    stages: ["매캐한 공단 입구", "굴뚝 골목", "가스 탱크 공장", "매연 도로", "굴뚝 대왕의 공장"],
    tips: [
      "공장 연기는 필터로 걸러서 내보내야 해요.",
      "미세먼지 나쁜 날엔 마스크! 실내는 환기와 공기청정기로.",
      "쓰레기를 태우면 해로운 가스가 나와요. 자동차 공회전도 금지!",
      "대기오염 물질이 빗물에 녹으면 산성비가 되어 숲과 건물을 상하게 해요.",
      "나무는 잎으로 먼지를 붙잡는 살아 있는 공기청정기예요.",
    ],
  },
  {
    name: "더러워진 개울", boss: "구정물 슬라임 왕",
    stages: ["빨래터 상류", "하수구 입구", "녹조 연못", "기름띠 개울", "개울 바닥"],
    tips: [
      "설거지 물은 받아서 쓰고, 세제는 조금만 써요.",
      "남은 음식과 기름은 하수구에 버리지 않아요.",
      "물에 음식물과 비료가 너무 많으면 녹조가 번져 물고기가 숨을 못 쉬어요.",
      "기름은 물 위에 얇게 퍼져 물속 생물의 숨을 막아요.",
      "물이 맑아지면 수달이 돌아와요!",
    ],
  },
  {
    name: "불타는 숲", boss: "산불 거인",
    stages: ["등산로 입구", "벌목장", "외래종 습격", "산불", "숲의 심장"],
    tips: [
      "산에서 생긴 쓰레기는 되가져오고, 불씨는 완전히 꺼요.",
      "이면지를 쓰면 나무를 덜 베어도 돼요.",
      "키우던 동물을 산이나 강에 놓아주면 안 돼요. 우리 동물의 자리를 빼앗아요.",
      "산불은 대부분 사람의 작은 실수에서 시작돼요.",
      "나무 한 그루 심기는 지구를 식히는 가장 쉬운 방법이에요.",
    ],
  },
  {
    name: "플라스틱 바다", boss: "쓰레기 섬 문어왕",
    stages: ["해변", "갯벌", "기름 유출", "쓰레기 해류", "쓰레기 섬"],
    tips: [
      "바다거북은 비닐을 해파리로 착각해서 먹어요.",
      "버려진 그물은 '유령 그물'이 되어 물고기를 계속 붙잡아요.",
      "2007년 태안에서는 100만 명 넘는 사람들이 바다의 기름을 닦아냈어요.",
      "미세플라스틱은 물고기를 거쳐 우리 식탁까지 와요.",
      "빨대와 일회용 컵 하나를 줄이면 바다가 조금 더 깨끗해져요.",
    ],
  },
  {
    name: "뜨거운 지구", boss: "탄소 대왕",
    stages: ["불 켜진 도시", "탄소 발전소", "녹아내리는 빙하", "이상기후", "지구의 심장"],
    tips: [
      "안 쓰는 플러그는 뽑기! 꺼져 있어도 전기를 먹는 '대기전력'이 있어요.",
      "석탄과 석유를 태우면 이산화탄소가 지구를 담요처럼 덮어요.",
      "지구가 더워져 빙하가 녹으면 바닷물이 높아져요.",
      "기후 위기는 태풍·폭염·홍수를 더 자주, 더 세게 만들어요.",
      "우리가 매일 하는 작은 선택이 지구의 온도를 바꿔요.",
    ],
  },
];

// ====================== 테마 1 「쓰레기 마을」 전투 데이터 ======================
// content.js가 CH01~CH05에 덮어씌운다(chapters.csv는 그대로). 그림은 assets.js의 t1_* 스프라이트.
// 행동은 엔진에 있는 것만 쓴다: chase(추적) · surround(포위) · blink(순간이동) · summon(소환). drawH = 화면 표시 높이(px, 주인공 60px 기준)
export const T1_ENEMIES = {
  T1_SNACKBAG:  { name: "과자봉지 유령", type: "normal", behavior: "chase", hpMult: 0.9, atkMult: 1.0, spdU: 2.4, radiusU: 0.36, mass: 1, xp: 2, sprite: "t1_en_snackbag", drawH: 46 },
  T1_BUTTBUG:   { name: "꽁초 벌레", type: "normal", behavior: "surround", hpMult: 0.4, atkMult: 0.6, spdU: 5.0, radiusU: 0.25, mass: 0.5, xp: 1, sprite: "t1_en_buttbug", drawH: 28 },
  T1_BOTTLE:    { name: "페트병 병정", type: "normal", behavior: "chase", hpMult: 2.5, atkMult: 1.2, spdU: 1.8, radiusU: 0.5, mass: 2, xp: 4, sprite: "t1_en_bottle", drawH: 56 },
  T1_BAGGY:     { name: "비닐봉지 유령", type: "normal", behavior: "blink", hpMult: 1.2, atkMult: 1.2, spdU: 2.0, radiusU: 0.4, mass: 1, xp: 4, sprite: "t1_en_baggy", drawH: 48 },
  T1_FLY:       { name: "파리", type: "normal", behavior: "chase", hpMult: 0.3, atkMult: 0.5, spdU: 4.5, radiusU: 0.2, mass: 0.4, xp: 1, sprite: "t1_en_fly", drawH: 22 },
  T1_FOODWASTE: { name: "음식물 쓰레기 덩어리", type: "elite", behavior: "summon", hpMult: 12, atkMult: 1.5, spdU: 1.6, radiusU: 0.8, mass: 4, xp: 20, sprite: "t1_en_foodwaste", drawH: 86,
                  summon: { id: "T1_FLY", n: 3, everyS: 5 }, onDeathSpawn: { id: "T1_FLY", n: 4 } },
};
// 보스 패턴 종류(kind)는 엔진 구현: scatter(여러 곳 낙하) · cone(부채꼴) · ringOut(퍼지는 링) · summonOnly(소환만)
export const T1_BOSS = {
  id: "T1_BOSS", name: "쓰레기 산 대왕", hpMult: 400, atkMult: 2.0, radiusU: 1.5, spdU: 1.4, restS: 2.0, drawScale: 1.25, phase2At: 0.5,
  img: { calm: "t1_boss_calm", angry: "t1_boss_angry" }, drawH: 150,
  // phase: 2 가 붙은 기술은 화난 모습(체력 50% 이하)부터 쓴다.
  //  - 악취 방귀 구름: 부채꼴 + 맞은 자리에 5초 악취 안개(안에 있으면 느려지고 체력이 닳음)
  //  - 쓰레기 흡입: 예고 동안 플레이어를 끌어당긴 뒤 2.5u 안이면 크게 물기(걸어서 벗어나면 회피)
  //  - 쓰레기 뿌리기: 플레이어 주변에 쓰레기 무더기 5개를 던짐. 8초 안에 주우면 보스 체력 3% 감소 + 1초 기절 + 내 체력 5% 회복
  patterns: [
    { name: "쓰레기 투척", kind: "scatter", telegraphS: 1.2, dmg: 1.0, cooldownS: 7, summon: null, count: 6, knockback: 0 },
    { name: "악취 방귀 구름", kind: "cone", telegraphS: 1.0, dmg: 1.1, cooldownS: 8, summon: null, count: 10, knockback: 0, stinkField: true },
    { name: "쓰레기 흡입", kind: "vacuum", telegraphS: 1.6, dmg: 1.4, cooldownS: 10, summon: null, count: 10, knockback: 0 },
    { name: "쓰레기 눈사태", kind: "ringOut", telegraphS: 1.3, dmg: 1.3, cooldownS: 10, summon: null, count: 10, knockback: 2, phase: 2 },
    { name: "봉지 유령 소환", kind: "summonOnly", telegraphS: 0.8, dmg: 0, cooldownS: 12, summon: { id: "T1_BAGGY", n: 4 }, count: 10, knockback: 0, phase: 2 },
    { name: "쓰레기 뿌리기", kind: "litter", telegraphS: 1.0, dmg: 0.8, cooldownS: 12, summon: null, count: 5, knockback: 0, phase: 2 },
  ],
};
// 단계별 구성(CH01~CH05). elites의 atS는 15분 기준 시각(서바이벌 5분에서는 1/3로 줄어든다: 180→60초)
export const T1_STAGES = [
  { mix: ["T1_SNACKBAG"], elites: [], dark: 0, floor: "t1_floor_dirt", hint: "과자봉지 유령이 어슬렁거려요 · 넘어진 쓰레기통 곁에 서면 정리돼요" },
  { mix: ["T1_SNACKBAG", "T1_BUTTBUG"], elites: [], dark: 0, floor: "t1_floor_concrete", hint: "꽁초 벌레 떼가 몰려와요 · 타이어에 부딪힌 적은 튕겨 나가요" },
  { mix: ["T1_SNACKBAG", "T1_BUTTBUG", "T1_BOTTLE"], elites: [{ id: "T1_FOODWASTE", atS: 180 }, { id: "T1_FOODWASTE", atS: 660 }], dark: 0, floor: "t1_floor_dirt", hint: "단단한 페트병 병정과 음식물 쓰레기 덩어리! · 바닥 쓰레기를 주우면 새싹이 나와요" },
  { mix: ["T1_SNACKBAG", "T1_BOTTLE", "T1_BAGGY"], elites: [{ id: "T1_FOODWASTE", atS: 450 }], dark: 0.15, floor: "t1_floor_concrete", hint: "비닐봉지 유령이 순간이동해요 · 악취 구역 조심!" },
  { mix: ["T1_SNACKBAG", "T1_BUTTBUG", "T1_BOTTLE", "T1_BAGGY"], elites: [{ id: "T1_FOODWASTE", atS: 300 }], dark: 0.3, floor: "t1_floor_trash", boss: "T1_BOSS", hint: "쓰레기 산 대왕! 대왕이 뿌린 쓰레기를 주우면 대왕이 약해져요" },
];

// ====================== 테마 2 「대기오염 공장 지대」 전투 데이터(2026-09-24, 이미지 에셋/테마2_대기오염_프롬프트.md) ======================
// 그림은 assets.js의 t2_* 스프라이트(game/tools/cut_theme2.py). 새 행동(main.js sgT2Tick): breather(가까이 오면 멈춰 불 뿜기, 원거리 없음) ·
// mine(바닥에 지뢰처럼 생김, 안 움직임, 가까이 가면 부풀었다가 펑) · raincloud(거리를 두고 떠다니며 내 주변에 산성비). frames = 상태별 그림.
export const T2_ENEMIES = {
  T2_DUST:    { name: "먼지몬", type: "normal", behavior: "surround", hpMult: 0.5, atkMult: 0.7, spdU: 4.4, radiusU: 0.28, mass: 0.5, xp: 1, sprite: "t2_en_dust", drawH: 34 },
  T2_GAS:     { name: "가스몬", type: "normal", behavior: "breather", hpMult: 1.7, atkMult: 1.1, spdU: 2.2, radiusU: 0.45, mass: 1.5, xp: 3, sprite: "t2_en_gas", drawH: 50,
                frames: { windup: "t2_en_gas_windup", fire: "t2_en_gas_fire" } },
  T2_GERM:    { name: "세균몬", type: "normal", behavior: "mine", hpMult: 1.0, atkMult: 1.8, spdU: 0, radiusU: 0.42, mass: 9, xp: 2, sprite: "t2_en_germ", drawH: 40,
                frames: { idle: ["t2_en_germ", "t2_en_germ2", "t2_en_germ3"], armed: "t2_en_germ_armed" } },
  T2_RAIN:    { name: "산성비 구름몬", type: "normal", behavior: "raincloud", hpMult: 1.4, atkMult: 1.0, spdU: 2.0, radiusU: 0.45, mass: 1, xp: 4, sprite: "t2_en_raincloud", drawH: 52 },
  T2_BIGDUST: { name: "왕먼지몬", type: "elite", behavior: "summon", hpMult: 12, atkMult: 1.5, spdU: 1.4, radiusU: 0.8, mass: 4, xp: 20, sprite: "t2_en_bigdust", drawH: 92,
                summon: { id: "T2_DUST", n: 3, everyS: 6 }, onDeathSpawn: { id: "T2_DUST", n: 6 } },
};
// 대왕 기술표는 boss-patterns.js BOSS_PATTERNS_T2(rework-content.js가 넣는다). 체력·공격은 rework-content.js.
export const T2_BOSS = {
  id: "T2_BOSS", name: "굴뚝 가스 대왕", hpMult: 400, atkMult: 2.0, radiusU: 1.5, spdU: 1.3, restS: 2.0, drawScale: 1.25, phase2At: 0.5,
  img: { calm: "t2_boss_calm", angry: "t2_boss_angry" }, drawH: 160, patterns: [],
};
// CH06~CH10. 목표는 "가스가 새는 밸브 잠그기"(litter 자리에 밸브), 매연 구역(dark)은 모든 단계에 조금씩.
export const T2_STAGES = [
  { mix: ["T2_DUST"], elites: [], dark: 0.08, floor: "t2_floor_factory", hint: "먼지몬 떼가 몰려와요 · 새는 밸브 옆에 서면 잠겨요" },
  { mix: ["T2_DUST", "T2_GAS"], elites: [], dark: 0.1, floor: "t2_floor_steel", hint: "가스몬이 입이 빨개지면 곧 불을 뿜어요! 옆이나 뒤로 피해요" },
  { mix: ["T2_DUST", "T2_GAS", "T2_GERM"], elites: [{ id: "T2_BIGDUST", atS: 180 }, { id: "T2_BIGDUST", atS: 660 }], dark: 0.12, floor: "t2_floor_factory", hint: "바닥의 세균몬은 가까이 가면 부풀었다가 펑! 멀리서 공격해요" },
  { mix: ["T2_DUST", "T2_GAS", "T2_RAIN", "T2_GERM"], elites: [{ id: "T2_BIGDUST", atS: 450 }], dark: 0.15, floor: "t2_floor_steel", hint: "산성비 구름몬이 떨어뜨리는 빗방울 표시를 피해요" },
  { mix: ["T2_DUST", "T2_GAS", "T2_RAIN", "T2_GERM"], elites: [{ id: "T2_BIGDUST", atS: 300 }], dark: 0.2, floor: "t2_floor_soot", boss: "T2_BOSS", hint: "굴뚝 가스 대왕! 대왕이 터뜨린 밸브를 잠그면 대왕이 약해져요" },
];

const DEFAULT_TIP = "우리가 매일 하는 작은 선택이 지구를 바꿔요.";

// 챕터 index(0부터) → 장·단계 표시 정보
export function stageInfo(index) {
  const t = Math.floor(index / STAGES_PER_THEME), k = index % STAGES_PER_THEME;
  const th = THEMES[t];
  return {
    themeIndex: t, k, label: `${t + 1}-${k + 1}`,
    themeName: th ? th.name : `${t + 1}장`,
    name: th ? th.stages[k] : null,
    tip: th ? th.tips[k] : DEFAULT_TIP,
    bossName: th ? th.boss : null,
    isBoss: k === STAGES_PER_THEME - 1,
  };
}
