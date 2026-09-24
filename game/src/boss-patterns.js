// 쓰레기 산 대왕(1-5 보스) 기술표 — 2026-09-23 저녁 사용자 "보스가 너무 약해, 원거리·중거리·근거리 스킬 패턴도 만들어".
// 대왕과 나 사이 거리로 기술 묶음을 고른다(칸 = U). 판정·그림은 main.js(resolveBossPattern)·theme-effects.js(telegraph).
//  - 근거리(3.5칸 안): 내려찍기(원 밖으로) · 흡입 물기(반대로 걷기) · 방귀 부채꼴(뒤·옆으로)
//  - 중거리(3.5~7.5칸): 몸통 박치기(빨간 길에서 비키기) · 폭격(그림자 피하기) · 방귀 부채꼴
//  - 원거리(7.5칸 밖): 연속 던지기(날아오는 쓰레기 옆으로) · 점프 내려앉기(그림자에서 벗어나기) · 봉지 유령 소환(화난 뒤)
//  - 쓰레기 뿌리기는 거리와 상관없이 3번째 기술마다(바닥에 대왕 쓰레기가 없을 때) — 주우면 대왕이 약해진다.
// 화난 모습(체력 50% 이하): 쉬는 시간이 짧아지고, follow가 있는 기술은 곧바로 한 번 더(여진·두 번째 박치기), 던지기는 더 많이.
export const BOSS_BANDS = { close: 3.5, mid: 7.5 };
export const BOSS_BAND_NAMES = { close: '근거리', mid: '중거리', far: '원거리', any: '' };
export const BOSS_REST = { calm: 1.2, angry: .8 };
export const BOSS_PATTERNS = [
  { name: '쓰레기 내려찍기', kind: 'slam', ranges: ['close'], telegraphS: 1.0, dmg: 1.8, radiusU: 3.2, knockback: 2.2, hint: '원 밖으로 빠져나가요!',
    follow: { name: '여진', kind: 'slam', telegraphS: .75, dmg: 1.2, radiusU: 4.6, knockback: 1.5, hint: '한 번 더! 더 멀리!' } },
  { name: '쓰레기 흡입', kind: 'vacuum', ranges: ['close'], telegraphS: 1.5, dmg: 2.0, hint: '대왕 반대쪽으로 계속 걸어요!' },
  { name: '악취 방귀 구름', kind: 'cone', ranges: ['close', 'mid'], telegraphS: 1.1, dmg: 1.2, stinkField: true, hint: '대왕 뒤나 옆으로 돌아가요!' },
  { name: '쓰레기 몸통 박치기', kind: 'dashLine', ranges: ['mid'], telegraphS: 1.1, dmg: 1.6, lengthU: 8, hint: '빨간 길에서 옆으로 비켜요!',
    follow: { name: '다시 박치기', kind: 'dashLine', telegraphS: .8, dmg: 1.6, lengthU: 8, hint: '또 온다! 옆으로!' } },
  { name: '쓰레기 폭격', kind: 'scatter', ranges: ['mid', 'far'], telegraphS: 1.2, dmg: 1.1, count: 7, spreadU: 4, hint: '표시가 없는 곳으로 피해요!' },
  { name: '쓰레기 연속 던지기', kind: 'volley', ranges: ['far'], telegraphS: .9, dmg: .6, waves: 3, shots: 5, angryWaves: 4, angryShots: 7, spread: .9, speedU: 5.5, hint: '날아오는 쓰레기를 옆으로 피해요!' },
  { name: '대왕 점프', kind: 'leap', ranges: ['far'], telegraphS: 1.3, dmg: 1.6, radiusU: 2.6, hint: '그림자에서 벗어나요!' },
  { name: '봉지 유령 소환', kind: 'summonOnly', ranges: ['far', 'mid'], telegraphS: .9, dmg: 0, summon: { id: 'T1_BAGGY', n: 4 }, phase: 2, hint: '유령부터 치워요!' },
  { name: '쓰레기 뿌리기', kind: 'litter', ranges: ['any'], telegraphS: 1.2, dmg: .8, count: 5, hint: '떨어진 쓰레기를 주우면 대왕이 약해져요!' },
];
// 2-5 굴뚝 가스 대왕(2026-09-24): 파이프·부품이 모인 가스 몬스터. 같은 틀(거리 묶음·follow·3번째마다 밸브)에 기술만 다르다.
//  - 근거리: 불꽃 브레스(부채꼴 불길) · 증기 폭발(원, 화나면 한 번 더 크게) · 매연 구름(부채꼴 + 오래 남는 매연)
//  - 중거리: 파이프 휘두르기(빨간 길 — 대왕은 제자리, 화나면 반대로 한 번 더) · 매연 구름 · 매연 폭탄
//  - 원거리: 매연 폭탄(떨어질 자리 표시) · 굴뚝 매연탄(부채꼴로 날아옴) · 먼지몬 부르기(화난 뒤)
//  - 밸브 터뜨리기: 3번째 기술마다 새는 밸브를 흩뿌림 → 잠그면(5개) 대왕이 약해진다(1장의 쓰레기 뿌리기와 같은 규칙)
export const BOSS_PATTERNS_T2 = [
  { name: '불꽃 브레스', kind: 'cone', ranges: ['close'], telegraphS: 1.0, dmg: 1.7, fx: 'flame', hint: '대왕 뒤나 옆으로 돌아가요!' },
  { name: '증기 폭발', kind: 'slam', ranges: ['close'], telegraphS: 1.0, dmg: 1.7, radiusU: 3.2, knockback: 2.2, hint: '원 밖으로 빠져나가요!',
    follow: { name: '한 번 더 증기', kind: 'slam', telegraphS: .75, dmg: 1.2, radiusU: 4.6, knockback: 1.5, hint: '한 번 더! 더 멀리!' } },
  { name: '매연 구름', kind: 'cone', ranges: ['close', 'mid'], telegraphS: 1.1, dmg: 1.1, stinkField: true, hint: '매연이 남는 곳 밖으로 피해요!' },
  { name: '파이프 휘두르기', kind: 'dashLine', stay: true, ranges: ['mid'], telegraphS: 1.0, dmg: 1.6, lengthU: 8, hint: '빨간 길에서 옆으로 비켜요!',
    follow: { name: '반대로 휘두르기', kind: 'dashLine', stay: true, telegraphS: .8, dmg: 1.6, lengthU: 8, hint: '또 온다! 옆으로!' } },
  { name: '매연 폭탄', kind: 'scatter', ranges: ['mid', 'far'], telegraphS: 1.3, dmg: 1.2, count: 7, spreadU: 4, hint: '표시가 없는 곳으로 피해요!' },
  { name: '굴뚝 매연탄', kind: 'volley', ranges: ['far'], telegraphS: .9, dmg: .6, waves: 3, shots: 5, angryWaves: 4, angryShots: 7, spread: .9, speedU: 5.2, hint: '날아오는 매연탄을 옆으로 피해요!' },
  { name: '먼지몬 부르기', kind: 'summonOnly', ranges: ['far', 'mid'], telegraphS: .9, dmg: 0, summon: { id: 'T2_DUST', n: 5 }, phase: 2, hint: '먼지몬부터 치워요!' },
  { name: '밸브 터뜨리기', kind: 'litter', ranges: ['any'], telegraphS: 1.2, dmg: .8, count: 5, hint: '새는 밸브를 잠그면 대왕이 약해져요!' },
];
// 대왕이 몸으로 부딪히면(0.6초마다) 공격력의 이만큼. 난이도의 1초 접촉 피해 상한(contactCap)을 함께 따른다.
export const BOSS_CONTACT = .5;

export function bossBand(distU) { return distU < BOSS_BANDS.close ? 'close' : distU < BOSS_BANDS.mid ? 'mid' : 'far'; }

// state: { distU, phase, last(직전 기술 이름), sinceLitter(뿌리기 뒤 기술 수), litterOnGround }
// ranges가 없는 옛 보스 기술표는 예전처럼 아무거나 고른다.
export function pickBossPattern(patterns, state, rng = Math.random) {
  const usable = patterns.filter((p) => !p.phase || p.phase <= (state.phase || 1));
  if (!usable.length) return null;
  if (!usable.some((p) => p.ranges)) return usable[Math.floor(rng() * usable.length)];
  const litter = usable.find((p) => p.kind === 'litter');
  if (litter && (state.sinceLitter ?? 0) >= 3 && !state.litterOnGround) return litter;
  const band = bossBand(state.distU);
  const inBand = usable.filter((p) => p.kind !== 'litter' && p.ranges?.includes(band));
  const fresh = inBand.filter((p) => p.name !== state.last);
  const pool = fresh.length ? fresh : inBand.length ? inBand : usable;
  return pool[Math.floor(rng() * pool.length)];
}
