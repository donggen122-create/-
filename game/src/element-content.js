// 원소 스킬 체계 v3 (탕탕특공대 방식, 2026-09-22 밤 — docs/22_원소_스킬_체계_기획.md) · 2026-09-23 밀도 조정(5분 안에 진화 2~3회)
// 원소 스킬 10(원소당 2) · 지원품 8 · 진화 10(스킬 Lv.3 + 짝 지원품) · 파츠 10(스킬당 1, 로비 성장)
// 그림: game/assets/sprites/skills/<원소>_<이름>.png (사용자 Gemini 시트 → tools/cut_skills.py)
// 브라우저·서버(guardian.js)가 같이 쓰는 순수 데이터. 이름은 초등학생용 쉬운 말.
const ELEMENT_DATA = [
  { id: "fire", name: "불", title: "화염", color: "#FF6A2A", role: "폭발과 불바다" },
  { id: "water", name: "물", title: "파도", color: "#2AA8FF", role: "튕기고 느리게 만들기" },
  { id: "wind", name: "바람", title: "질풍", color: "#3ED88A", role: "왕복·회전 공격" },
  { id: "earth", name: "흙", title: "대지", color: "#C48A3F", role: "무거운 한 방과 지뢰" },
  { id: "lightning", name: "번개", title: "전류", color: "#FFD83A", role: "낙뢰와 벌 친구" },
];

// sprite: 도감·카드·HUD 아이콘 그림 이름. kind: element-combat.js의 동작 이름. interval: 발동 간격(초), dmgCoef: 공격력 배수.
// Lv.2 = 피해 +40%·개수/크기 증가, Lv.3 = 피해 +90%·간격 -20% + 진화 자격 (탕탕특공대 5단계를 5분 판에 맞춰 3단계로 압축)
const SKILL_DATA = [
  { id: "F1", element: "fire", name: "불꽃병", kind: "bottle", sprite: "fire_bottle", interval: 1.4, dmgCoef: 0.5,
    desc: "적이 몰려오는 길목에 병을 던져 4초 동안 큰 불 웅덩이를 남겨요.", levels: ["병 2개 · 피해 +40%", "병 3개 · 피해 +90% · 진화 가능"], based: "화염병" },
  { id: "F2", element: "fire", name: "로켓 폭죽", kind: "rocket", sprite: "fire_rocket", interval: 2.1, dmgCoef: 1.7,
    desc: "가장 가까운 적에게 폭죽 로켓을 쏴 크게 터뜨려요.", levels: ["로켓 2발 · 피해 +40%", "로켓 3발 · 피해 +90% · 진화 가능"], based: "로켓발사기" },
  { id: "W1", element: "water", name: "물풍선", kind: "balloon", sprite: "water_balloon", interval: 1.2, dmgCoef: 1.0,
    desc: "통통 튀는 물풍선이 5번 튕기며 맞은 적을 느리게 해요.", levels: ["풍선 2개 · 피해 +40%", "풍선 3개 · 피해 +90% · 진화 가능"], based: "축구공" },
  { id: "W2", element: "water", name: "물대포", kind: "beam", sprite: "water_beam_tip", interval: 1.3, dmgCoef: 0.45,
    desc: "굵은 물줄기를 쏴 직선 위의 적을 모두 맞혀요.", levels: ["물줄기 더 굵게 · 피해 +40%", "0.2초 더 길게 · 피해 +90% · 진화 가능"], based: "레이저 발사기" },
  { id: "V1", element: "wind", name: "바람 부메랑", kind: "boomerang", sprite: "wind_boomerang_1", interval: 1.3, dmgCoef: 0.9,
    desc: "부메랑이 날아갔다 돌아오며 두 번 맞혀요.", levels: ["부메랑 2개 · 피해 +40%", "부메랑 3개 · 피해 +90% · 진화 가능"], based: "부메랑" },
  { id: "V2", element: "wind", name: "회오리 팽이", kind: "orbit", sprite: "wind_top_1", interval: 0.45, dmgCoef: 0.55,
    desc: "주위를 도는 회오리가 닿는 적을 계속 쳐요.", levels: ["회오리 3개 · 피해 +40%", "회오리 4개 · 피해 +90% · 진화 가능"], based: "수호자" },
  { id: "E1", element: "earth", name: "돌멩이 던지기", kind: "stone", sprite: "earth_stone_1", interval: 1.2, dmgCoef: 2.2,
    desc: "무거운 돌을 던져 크게 때리고 뒤로 밀쳐요.", levels: ["돌 2개 · 피해 +40%", "돌 3개 · 피해 +90% · 진화 가능"], based: "벽돌" },
  { id: "E2", element: "earth", name: "두더지 지뢰", kind: "mine", sprite: "earth_mole_1", interval: 1.2, dmgCoef: 1.8,
    desc: "두더지를 심으면 땅속으로 적을 쫓아가 가까이서 흙을 터뜨려요.", levels: ["지뢰 최대 6개 · 피해 +40%", "지뢰 최대 8개 · 피해 +90% · 진화 가능"], based: "모듈형 지뢰" },
  { id: "L1", element: "lightning", name: "번개 구름", kind: "cloud", sprite: "lightning_cloud", interval: 1.2, dmgCoef: 1.7,
    desc: "적이 많은 곳에 먹구름이 생기고 번개가 떨어져요.", levels: ["구름 2개 · 피해 +40%", "구름 3개 · 피해 +90% · 진화 가능"], based: "번개 발사기" },
  { id: "L2", element: "lightning", name: "찌릿 벌", kind: "bee", sprite: "lightning_bee_1", interval: 0.5, dmgCoef: 0.75,
    desc: "전기 벌이 따라다니며 가까운 적에게 침을 쏴요.", levels: ["벌 2마리 · 피해 +40%", "벌 3마리 · 피해 +90% · 진화 가능"], based: "A형 드론" },
];

// 지원품: stat = main.js 통합 스탯 키, values = Lv.1/2/3 값. hpPct는 얻는 순간 최대 체력에 더한다.
const SUPPORT_DATA = [
  { id: "S1", element: "lightning", name: "번개 배터리", stat: "intervalPct", values: [0.15, 0.25, 0.35], desc: "모든 공격 간격이 짧아져요.", based: "에너지 큐브" },
  { id: "S2", element: "wind", name: "자석 팔찌", stat: "magnetPct", values: [1.0, 2.0, 3.0], desc: "새싹을 더 멀리서 주워요.", based: "탄력 자석" },
  { id: "S3", element: "wind", name: "바람 운동화", stat: "speedPct", values: [0.12, 0.20, 0.28], desc: "더 빨리 달려요.", based: "운동화" },
  { id: "S4", element: "fire", name: "불꽃 고추", stat: "dmgPct", values: [0.20, 0.35, 0.50], desc: "공격력이 세져요.", based: "고화력 총알" },
  { id: "S5", element: "water", name: "큰 물통", stat: "areaPct", values: [0.20, 0.35, 0.50], desc: "모든 스킬이 더 커져요.", based: "고성능 연료" },
  { id: "S6", element: "water", name: "이슬 물병", stat: "regenPct", values: [0.006, 0.010, 0.015], desc: "체력을 계속 회복해요.", based: "에너지 드링크" },
  { id: "S7", element: "earth", name: "튼튼 도시락", stat: "hpPct", values: [0.30, 0.50, 0.70], desc: "최대 체력이 늘어나요.", based: "피트니스 안내서" },
  { id: "S8", element: "earth", name: "흙 방패", stat: "takenPct", values: [-0.15, -0.25, -0.35], desc: "받는 피해가 줄어요.", based: "부랑자의 갑옷" },
];
const SUPPORT_LABEL = { intervalPct: v => `공격 간격 -${Math.round(v * 100)}%`, magnetPct: v => `줍기 범위 +${Math.round(v * 100)}%`, speedPct: v => `이동 속도 +${Math.round(v * 100)}%`,
  dmgPct: v => `공격력 +${Math.round(v * 100)}%`, areaPct: v => `스킬 범위 +${Math.round(v * 100)}%`, regenPct: v => `초당 체력 ${(v * 100).toFixed(1)}% 회복`, hpPct: v => `최대 체력 +${Math.round(v * 100)}%`, takenPct: v => `받는 피해 ${Math.round(v * 100)}%` };

// 진화: 스킬 Lv.3 + 짝 지원품 보유 → 금색 카드. kind는 element-combat.js의 진화 동작.
const EVO_DATA = [
  { id: "EVO_F1", skill: "F1", support: "S4", name: "화산 폭탄", kind: "volcano", sprite: "fire_volcano", interval: 1.6, dmgCoef: 1.0, desc: "폭탄 3개가 큰 용암 웅덩이를 5초 동안 남기고, 떨어질 때 크게 터져요." },
  { id: "EVO_F2", skill: "F2", support: "S1", name: "불꽃놀이 로켓", kind: "firework", sprite: "fire_frocket", interval: 2.4, dmgCoef: 1.9, desc: "로켓 3연발! 폭발이 불꽃 6개로 갈라져 사방으로 퍼져요." },
  { id: "EVO_W1", skill: "W1", support: "S5", name: "왕 물풍선", kind: "kballoon", sprite: "water_kballoon", interval: 1.2, dmgCoef: 1.5, desc: "2배 큰 풍선 2개가 10번 튕기고 맞은 적을 3초 느리게 해요." },
  { id: "EVO_W2", skill: "W2", support: "S6", name: "무지개 물대포", kind: "rbeam", sprite: "water_rbeam_tip", interval: 1.3, dmgCoef: 0.7, desc: "2배 굵은 무지개 물줄기가 1초 동안 적을 멈춰 세워요." },
  { id: "EVO_V1", skill: "V1", support: "S2", name: "자석 부메랑", kind: "mboomerang", sprite: "wind_mboomerang_1", interval: 1.2, dmgCoef: 1.2, desc: "부메랑 4개가 돌아올 때 적을 끌어와요." },
  { id: "EVO_V2", skill: "V2", support: "S3", name: "태풍 팽이", kind: "typhoon", sprite: "wind_typhoon_1", interval: 0.35, dmgCoef: 0.9, desc: "큰 회오리 5개가 빠르게 돌며 적을 밀쳐요." },
  { id: "EVO_E1", skill: "E1", support: "S8", name: "바위 굴리기", kind: "boulder", sprite: "earth_boulder_1", interval: 1.4, dmgCoef: 2.6, desc: "큰 바위 2개가 굴러가며 지나는 적을 모두 뭉개요." },
  { id: "EVO_E2", skill: "E2", support: "S7", name: "두더지 폭탄밭", kind: "molefield", sprite: "earth_molefield", interval: 0.9, dmgCoef: 2.2, desc: "지뢰 최대 12개, 하나가 터지면 옆 지뢰도 연이어 터져요." },
  { id: "EVO_L1", skill: "L1", support: "S1", name: "천둥 번개 구름", kind: "storm", sprite: "lightning_storm", interval: 2.0, dmgCoef: 1.1, desc: "큰 먹구름이 3초 머물며 번개를 8번 떨어뜨려요." },
  { id: "EVO_L2", skill: "L2", support: "S2", name: "벌떼 소환", kind: "swarm", sprite: "lightning_swarm", interval: 0.4, dmgCoef: 0.9, desc: "벌 5마리가 적을 따라가는 침을 쏴요." },
];

// 파츠(로비 성장, Codex v2 규칙 유지): 스킬당 1개. feature는 element-combat.js가 읽는 기능 키.
const PART_DATA = [
  { id: "PART_F1", skill: "F1", name: "불꽃병 기름통", feature: "puddleLonger", desc: "불 웅덩이가 1초 더 오래 타요." },
  { id: "PART_F2", skill: "F2", name: "로켓 유도 날개", feature: "homing", desc: "로켓이 적을 따라 방향을 조금씩 바꿔요." },
  { id: "PART_W1", skill: "W1", name: "물풍선 고무줄", feature: "extraBounce", desc: "풍선이 2번 더 튕겨요." },
  { id: "PART_W2", skill: "W2", name: "물대포 압력 펌프", feature: "longerBeam", desc: "물줄기가 0.2초 더 오래 나가요." },
  { id: "PART_V1", skill: "V1", name: "부메랑 회수 날개", feature: "extraBlade", desc: "돌아온 뒤 작은 바람 날을 한 번 더 던져요." },
  { id: "PART_V2", skill: "V2", name: "팽이 풍향계", feature: "widerOrbit", desc: "회오리가 더 넓게 돌아요." },
  { id: "PART_E1", skill: "E1", name: "돌멩이 새총", feature: "splitStone", desc: "돌이 맞으면 작은 돌 2개로 갈라져요." },
  { id: "PART_E2", skill: "E2", name: "두더지 도시락", feature: "mineWider", desc: "지뢰 폭발 범위가 30% 넓어져요." },
  { id: "PART_L1", skill: "L1", name: "번개 피뢰침", feature: "doubleBolt", desc: "번개가 한 번 더 떨어져요(피해 30%)." },
  { id: "PART_L2", skill: "L2", name: "벌 꿀단지", feature: "fasterBee", desc: "벌이 침을 25% 더 자주 쏴요." },
];

export const ELEMENTS = Object.fromEntries(ELEMENT_DATA.map(e => [e.id, { ...e, icon: `element_${e.id}`, desc: e.role }]));
export const SKILLS = Object.fromEntries(SKILL_DATA.map(s => [s.id, { ...s, behavior: s.desc, icon: `skill_${s.id}`, color: ELEMENTS[s.element].color, unlock: 0, maxLevel: 3 }]));
export const SUPPORTS = Object.fromEntries(SUPPORT_DATA.map(s => [s.id, { ...s, icon: `support_${s.id}`, sprite: `support_${s.id}`, color: ELEMENTS[s.element].color, maxLevel: 3, label: lv => SUPPORT_LABEL[s.stat](s.values[Math.max(0, Math.min(2, lv - 1))]) }]));
// COMBOS = 진화(이름은 기존 코드 호환용). ingredients = [스킬, 지원품]
export const COMBOS = Object.fromEntries(EVO_DATA.map(e => [e.id, { ...e, ingredients: [e.skill, e.support], element: SKILLS[e.skill].element, elements: [SKILLS[e.skill].element], behavior: e.desc, icon: `evo_${e.id}`, color: SKILLS[e.skill].color, maxLevel: 1, evolved: true }]));
export const EVOLUTIONS = COMBOS;
export const RECIPES = Object.values(COMBOS);
export const PARTS = Object.fromEntries(PART_DATA.map(p => [p.id, { ...p, element: SKILLS[p.skill].element, feature_from_first_copy: p.desc, icon: `part_${p.id}`, sprite: SKILLS[p.skill].sprite, color: SKILLS[p.skill].color, max_level: 10, copies_for_grade: [1, 3, 7] }]));
// 스킬 → 짝 지원품 목록(진화 재료)
export const SKILL_PARTNERS = Object.fromEntries(Object.keys(SKILLS).map(id => [id, RECIPES.filter(c => c.skill === id).map(c => c.support)]));
export const EVO_OF = Object.fromEntries(RECIPES.map(c => [c.skill, c.id]));
// 5분 판 기준: 선택 기회 16(3분 판)/24(5분 판), 스킬 3단계·지원품 3단계, 진화 = 스킬 Lv.3 + 짝 지원품
export const RUN_RULES = { skillSlots: 4, supportSlots: 4, maxSkillLevel: 3, maxSupportLevel: 3, introChoices: 16, normalChoices: 24, rerolls: 2, minChoiceInterval: 4 };
export const LEVEL_DAMAGE = [1, 1.4, 1.9];
