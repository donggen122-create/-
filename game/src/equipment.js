// 장비(2026-09-24 사용자 기획 확정, docs/34_장비_시스템_기획.md). 브라우저·서버(rework-core)가 같이 쓰는 순수 데이터.
// 6칸 × 성별마다 원거리·근거리 세트 = 24종. 남녀 같은 역할 장비는 능력·특수 효과가 똑같고 이름·그림만 다르다(공평).
export const GEAR_SLOTS = ['helm', 'armor', 'shoes', 'gloves', 'necklace', 'weapon'];
export const GEAR_SLOT_NAMES = { helm: '투구', armor: '갑옷', shoes: '신발', gloves: '장갑', necklace: '목걸이', weapon: '무기' };
export const GEAR_SET_SIZES = [2, 4, 6];
// 등급(파츠와 같음): 노말 1 · 레어 3 · 유니크 7 · 에픽 25 · 전설 80개. 능력은 등급 배율을 곱한다.
export const GEAR_GRADE_MULT = [1, 1.5, 2, 2.8, 4];
export const GEAR_SETS = {
  hoya_ranged: { hero: 'hoya', type: 'ranged', name: '야구복 세트', color: '#2f7fd6' },
  minji_ranged: { hero: 'minji', type: 'ranged', name: '피구복 세트', color: '#e0569b' },
  hoya_melee: { hero: 'hoya', type: 'melee', name: '교복 세트', color: '#34597f' },
  minji_melee: { hero: 'minji', type: 'melee', name: '교복 세트', color: '#8d4a7a' },
};
const NAMES = {
  hoya_ranged: { helm: '야구 헬멧', armor: '야구 유니폼', shoes: '야구 스파이크', gloves: '야구 글러브', necklace: '우승 메달 목걸이', weapon: '강속구 야구 배트' },
  minji_ranged: { helm: '피구 머리띠', armor: '피구 체육복', shoes: '피구 운동화', gloves: '손목 보호대', necklace: '호루라기 목걸이', weapon: '번개 피구공' },
  hoya_melee: { helm: '학생 모자', armor: '교복 재킷', shoes: '실내화', gloves: '목장갑', necklace: '명찰 목걸이', weapon: '목검' },
  minji_melee: { helm: '리본 머리핀', armor: '교복 조끼', shoes: '교복 구두', gloves: '손목 밴드', necklace: '하트 명찰 목걸이', weapon: '왕 연필' },
};
// 칸별 기본 능력(노말). 키는 main.js 통합 스탯 키(critPct·hpPct·speedPct·regenPct·takenPct·dmgPct·intervalPct)와 장비 전용 키.
//  weaponDmgPct = 기본 무기 피해, weaponRangePct = 원거리 기본 무기 사거리, weaponArcPct = 근거리 휘두르기 범위
export const GEAR_BASE = {
  ranged: { helm: { critPct: .02 }, armor: { hpPct: .05 }, shoes: { speedPct: .02 }, gloves: { intervalPct: .02 }, necklace: { dmgPct: .03 }, weapon: { weaponDmgPct: .10, weaponRangePct: .04 } },
  melee: { helm: { takenPct: -.02 }, armor: { hpPct: .06 }, shoes: { speedPct: .02 }, gloves: { weaponDmgPct: .06 }, necklace: { regenPct: .002 }, weapon: { weaponDmgPct: .10, weaponArcPct: .05 } },
};
// 세트 효과(같은 세트 개수, 등급과 상관없이). 2026-09-24 모의 뒤 조정: 근거리 4·6세트·굳건을 조금 낮추고 원거리 2세트에 이동 속도, 원거리 갑옷 체력 4→5%. pierce = 기본 무기 공이 뚫고 가는 적 수, searchRangePct = 스킬이 적을 찾는 거리,
// contactCapPct = 부딪혀서 1초에 잃는 체력 상한, shieldEvery/shieldPct = 보호막 주기(초)·크기, swingBlock = 근거리 휘두르기가 적 탄을 없앰
export const GEAR_SET_BONUS = {
  ranged: { 2: { weaponRangePct: .15, speedPct: .05 }, 4: { dmgPct: .10, critDmgPct: .20 }, 6: { pierce: 1, searchRangePct: .15 } },
  melee: { 2: { hpPct: .15 }, 4: { takenPct: -.10, contactCapPct: -.15 }, 6: { shieldEvery: 12, shieldPct: .12, swingBlock: 1 } },
};
export const GEAR_SET_TEXT = {
  ranged: { 2: '기본 무기 사거리 +15% · 이동 속도 +5%', 4: '모든 피해 +10% · 치명타 피해 +20%', 6: '기본 무기 공이 적 1명 더 뚫고 감 · 스킬이 적을 찾는 거리 +15%' },
  melee: { 2: '최대 체력 +15%', 4: '받는 피해 -10% · 부딪혀 잃는 체력 상한 -15%', 6: '12초마다 보호막(최대 체력 12%) · 휘두르기가 적 탄을 없앰' },
};
// 특수 효과: 유니크(등급 2)에서 열림 → 에픽(3) 강화 → 전설(4) 추가. v = [유니크, 에픽] 값, 전설은 에픽 값 + legend 효과.
export const GEAR_SPECIALS = {
  ranged: {
    helm: { key: 'focus', name: '집중', v: [5, 3], text: ['5초 동안 안 맞으면 다음 공격 치명타 확정', '3초만 안 맞아도 됨', '확정 치명타 피해 +50%'] },
    armor: { key: 'sturdy', name: '든든', v: [30, 20], text: ['체력 30% 아래로 떨어지면 3초 동안 받는 피해 -50%(30초에 1번)', '20초에 1번(더 자주)', '그때 체력 10% 회복'] },
    shoes: { key: 'steal', name: '도루', v: [8, 5], text: ['8초마다 1초 동안 이동 속도 +40%', '5초마다(더 자주)', '그 1초 동안 적과 부딪히지 않음'] },
    gloves: { key: 'catch', name: '캐치', v: [8, 5], text: ['날아오는 적 탄 8초에 1개 잡기(대왕 탄 제외)', '5초에 1개(더 자주)', '잡은 탄을 되던져 적에게 피해'] },
    necklace: { key: 'cheer', name: '응원', v: [.15, .25], text: ['대왕에게 주는 피해 +15%', '대왕에게 주는 피해 +25%로 강해짐', '대왕 공격으로 받는 피해 -20%'] },
    weapon: { key: 'fastball', name: '강속구', v: [5, 4], text: ['5번째 공마다 강속구(피해 2배, 뚫고 감)', '4번째 공마다(더 자주)', '3번째 공마다 + 맞은 자리 작은 폭발'] },
  },
  melee: {
    helm: { key: 'calm', name: '침착', v: [10, 7], text: ['10초마다 다음 피해 1번 막기', '7초마다(더 자주)', '막을 때 주변 적 밀쳐내기'] },
    armor: { key: 'endure', name: '버티기', v: [.30, .40], text: ['체력 30% 아래에서 받는 피해 -30%', '받는 피해 -40%로 강해짐', '판마다 1번 쓰러져도 체력 절반으로 일어남'] },
    shoes: { key: 'firm', name: '굳건', v: [.15, .25], text: ['적에게 부딪혀 받는 피해 -15%', '부딪혀 받는 피해 -25%로 강해짐', '부딪힌 적을 1초 느리게'] },
    gloves: { key: 'absorb', name: '흡수', v: [.005, .01], text: ['기본 무기로 적을 쓰러뜨리면 체력 0.5% 회복', '회복 1%로 강해짐', '10% 확률로 2배 회복'] },
    necklace: { key: 'reflect', name: '반사', v: [.30, .50], text: ['부딪힌 적에게 받은 피해의 30% 되돌려 줌', '되돌려 주는 피해 50%로 강해짐', '되돌려 주는 피해 80% + 반사로 적 0.5초 멈춤'] },
    weapon: { key: 'spin', name: '회전 베기', v: [6, 5], text: ['6번째 휘두르기마다 한 바퀴 베기(주변 전체)', '5번째 휘두르기마다(더 자주)', '4번째마다 + 범위 +30%'] },
  },
};
export const GEAR = Object.fromEntries(Object.entries(GEAR_SETS).flatMap(([set, s]) => GEAR_SLOTS.map((slot) => {
  const id = `${set}_${slot}`;
  return [id, { id, set, slot, hero: s.hero, type: s.type, name: NAMES[set][slot], setName: s.name, color: s.color, icon: `gear_${id}`,
    base: GEAR_BASE[s.type][slot], special: GEAR_SPECIALS[s.type][slot] }];
})));
export const gearIdsFor = (hero) => Object.keys(GEAR).filter((id) => GEAR[id].hero === hero);
