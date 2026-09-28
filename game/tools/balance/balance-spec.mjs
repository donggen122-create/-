// 밸런스 회의 자료(엑셀) 설계: 게임 코드(rework-core.js·equipment.js)에서 숫자를 읽어 JSON을 만든다. 엑셀 만들기는 balance-xlsx.ps1(이 PC의 엑셀 COM).
// 사용(프로젝트 폴더에서): node game/tools/balance/balance-spec.mjs . <scratch>/spec.json → powershell -File game/tools/balance/balance-xlsx.ps1 -Spec <scratch>/spec.json -Out <결과.xlsx>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.argv[2], OUT = process.argv[3];
const R = await import(pathToFileURL(path.join(ROOT, 'game/src/rework-core.js')));
const E = await import(pathToFileURL(path.join(ROOT, 'game/src/equipment.js')));

const col = (c) => { let s = ''; c++; while (c) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const A1 = (r, c) => `${col(c)}${r}`;
function sheet(name) { return { name, cells: [], ranges: [], widths: {}, freeze: null, heights: {} }; }
const put = (sh, r, c, v, s = [], nf = null) => sh.cells.push({ r, c, v, s, nf });
const style = (sh, a1, s, extra = {}) => sh.ranges.push({ a1, s, ...extra });
const GRADES = R.GRADE_NAMES, GFILL = ['g0', 'g1', 'g2', 'g3', 'g4'];
const G = "'등급과 보급'";   // 다른 시트에서 부를 때(따옴표 필요)
const STAT = { critPct: '치명타 확률', hpPct: '최대 체력', speedPct: '이동 속도', atkSpeedPct: '공격 속도', dmgPct: '모든 피해', weaponDmgPct: '기본 무기 피해', weaponRangePct: '기본 무기 사거리', takenPct: '받는 피해', regenPct: '1초마다 체력 회복', weaponArcPct: '휘두르기 범위', areaPct: '스킬 범위', magnetPct: '새싹 줍기 범위', xpPct: '새싹 경험치', coinPct: '코인 획득' };
const sheets = [];

// ───────── 1. 읽는 법 ─────────
{
  const s = sheet('읽는 법'); sheets.push(s);
  s.widths = { 0: 3, 1: 22, 2: 70 };
  put(s, 1, 1, '서호팡팡수호대 밸런스 회의 자료', ['title']);
  put(s, 2, 1, '2026-09-28 실서버 게임의 실제 숫자예요. 게임 코드에서 그대로 옮겼어요.', ['note']);
  put(s, 4, 1, '시트', ['h']); put(s, 4, 2, '무엇이 있나요', ['h']);
  const list = [
    ['등급과 보급', '노말~전설 등급마다 필요한 개수, 보급 1번에 나오는 개수와 확률, 원하는 것을 모으려면 보급을 몇 번 해야 하는지, 보급권 얻는 법'],
    ['친구(펫)', '동물 친구 4마리의 능력(등급별 숫자)과 유니크부터 생기는 특수 능력'],
    ['장비', '6칸 장비의 능력(등급별 숫자), 특수 효과, 같은 세트를 모으면 생기는 세트 효과'],
    ['능력치(훈련)', '공격력·체력·이동 속도 훈련 1~100단계의 효과와 코인 비용'],
    ['코인 벌기', '단계와 난이도마다 성공 1번에 받는 코인, 훈련까지 며칠 걸리는지 계산기'],
  ];
  list.forEach(([a, b], i) => { put(s, 5 + i, 1, a, ['cell', 'bold']); put(s, 5 + i, 2, b, ['cell', 'wrap']); });
  put(s, 11, 1, '색과 글씨', ['section']);
  GRADES.forEach((g, i) => { put(s, 12 + i, 1, g, ['cell', 'center', 'bold', GFILL[i]]); put(s, 12 + i, 2, ['가장 낮은 등급', '두 번째 등급', '세 번째 등급 · 특수 능력이 생겨요', '네 번째 등급 · 특수 능력이 강해져요', '가장 높은 등급 · 특수 능력이 하나 더 생겨요'][i], ['cell']); });
  put(s, 17, 1, '파란 글씨 칸', ['cell', 'center', 'input']); put(s, 17, 2, '회의에서 바꿔 볼 수 있는 숫자예요. 바꾸면 옆의 계산이 따라 바뀌어요. 여기서 바꿔도 실제 게임은 바뀌지 않아요.', ['cell', 'wrap']);
  put(s, 18, 1, '검은 글씨 칸', ['cell', 'center']); put(s, 18, 2, '파란 글씨 숫자로 계산된 결과예요.', ['cell']);
  put(s, 20, 1, '회의에서 이야기해 볼 것', ['section']);
  const qs = [
    '친구 4마리 중 누구와 함께 출동하고 싶나요? 그 친구가 너무 세거나 약하지 않나요?',
    '장비 하나를 레어(같은 장비 20개)로 만들려면 보급을 몇 번 해야 하나요? 알맞은가요, 너무 먼가요?',
    '보급 1번에 1개가 80%, 3개가 18%, 7개가 2%로 나와요. 이 운이 재미있나요, 억울한가요?',
    '훈련 비용과 효과는 알맞나요? 어려움에 도전하려면 공격·체력 15단계(1장), 20단계(2장)가 필요해요.',
    '하루에 받는 코인과 보급권은 충분한가요?',
  ];
  qs.forEach((q, i) => { put(s, 21 + i, 1, '①②③④⑤'[i], ['center', 'bold']); put(s, 21 + i, 2, q, ['wrap']); });
}

// ───────── 2. 등급과 보급 ─────────
{
  const s = sheet('등급과 보급'); sheets.push(s);
  s.widths = { 0: 26, 1: 17, 2: 17, 3: 17, 4: 17, 5: 17, 6: 17, 7: 40 };
  put(s, 1, 0, '등급과 보급 — 같은 것을 모으면 강해져요', ['title']);
  put(s, 2, 0, '파란 글씨 칸은 바꿔 볼 수 있어요(게임은 바뀌지 않아요). 다른 시트의 등급별 숫자가 이 표를 따라 바뀌어요.', ['note']);
  put(s, 4, 0, '① 등급마다 필요한 개수와 힘', ['section']);
  ['등급', '장비·친구 카드 개수', '파츠 개수', '장비·친구 힘 (전설 대비)', '파츠 스킬 피해 보너스', '파츠 스킬 발동 간격'].forEach((h, c) => put(s, 5, c, h, ['h', 'wrap']));
  GRADES.forEach((g, i) => {
    const r = 6 + i;
    put(s, r, 0, g, ['cell', 'center', 'bold', GFILL[i]]);
    put(s, r, 1, R.CARD_COPIES[i], ['cell', 'input', 'center'], '#,##0"개"');
    put(s, r, 2, R.GRADE_COPIES[i], ['cell', 'input', 'center'], '#,##0"개"');
    put(s, r, 3, R.PET_GRADE_RATE[i], ['cell', 'input', 'center'], '0%');
    put(s, r, 4, R.GRADE_DAMAGE[i], ['cell', 'input', 'center'], '+0%');
    put(s, r, 5, R.GRADE_INTERVAL[i], ['cell', 'input', 'center'], '0%');
  });
  put(s, 11, 0, '장비는 개수가 모이면 "합성" 버튼으로 등급을 올려요. 친구와 파츠는 개수가 모이면 저절로 올라가요. 발동 간격 75% = 스킬이 더 자주 나가요.', ['note']);

  put(s, 13, 0, '② 보급 1번에 나오는 개수 (파츠·장비·친구 모두 같아요)', ['section']);
  ['나오는 개수', '확률'].forEach((h, c) => put(s, 14, c, h, ['h']));
  R.SUPPLY_BUNDLES.forEach((b, i) => { put(s, 15 + i, 0, b.qty, ['cell', 'center', 'input'], '0"개"'); put(s, 15 + i, 1, b.chance, ['cell', 'center', 'input'], '0%'); });
  put(s, 18, 0, '확률 합계 (100%여야 해요)', ['cell', 'bold']); put(s, 18, 1, '=SUM(B15:B17)', ['cell', 'center'], '0%');
  put(s, 19, 0, '보급 1번에 평균 몇 개?', ['cell', 'bold']); put(s, 19, 1, '=SUMPRODUCT(A15:A17,B15:B17)', ['cell', 'center', 'bold'], '0.00"개"');
  put(s, 20, 0, '무엇이 나올지는 아직 전설이 아닌 것 중에서 똑같은 확률로 골라요. "5번 보급"은 보급권 5장으로 5번을 한꺼번에 여는 것이고 확률은 같아요.', ['note']);

  put(s, 22, 0, '③ 원하는 것 하나를 그 등급까지 모으려면 보급 몇 번? (평균, 대략)', ['section']);
  ['종류', '가짓수', '레어', '유니크', '에픽', '전설'].forEach((h, c) => put(s, 23, c, h, ['h', ...(c >= 2 ? [GFILL[c - 1]] : [])]));
  // 가짓수로 나눈 확률로 한 가지가 나오고, 평균 개수만큼 쌓인다 → 필요한 개수 × 가짓수 ÷ 평균 개수
  const kinds = [['장비 (내 캐릭터 장비 중 1개)', E.gearIdsFor('hoya').length, 'B'], ['친구 (4마리 중 1마리)', R.PET_IDS.length, 'B'], ['파츠 (10종 중 1개)', Object.keys(R.PARTS).length, 'C']];
  kinds.forEach(([name, n, copyCol], i) => {
    const r = 24 + i;
    put(s, r, 0, name, ['cell', 'bold']); put(s, r, 1, n, ['cell', 'center', 'input'], '0"가지"');
    [7, 8, 9, 10].forEach((gr, j) => put(s, r, 2 + j, `=ROUND(${copyCol}$${gr}*$B${r}/$B$19,0)`, ['cell', 'center'], '#,##0"번"'));
  });
  put(s, 27, 0, '예) 장비 하나를 레어(같은 장비 20개)로 만들려면 평균 약 160번. 보급할 때마다 다른 장비도 함께 모이니 장비 전체로는 더 빨리 강해져요. 전설이 된 것은 더 나오지 않아서 실제로는 조금 빨라요.', ['note']);

  put(s, 29, 0, '④ 보급권 얻는 법', ['section']);
  put(s, 30, 0, '방법', ['h']); put(s, 30, 1, '보급권', ['h', 'center']); put(s, 30, 2, '한도', ['h', 'center']); put(s, 30, 4, '설명', ['h']);
  const gifts = [
    ['쉬움·보통 성공', `${R.CLEAR_GIFTS.easy}장`, `같은 단계는 하루 ${R.STAGE_GIFT_CLEARS_PER_DAY}번까지`, '여러 단계를 돌면 더 받아요'],
    ['어려움 성공', `${R.CLEAR_GIFTS.hard}장`, `같은 단계는 하루 ${R.STAGE_GIFT_CLEARS_PER_DAY}번까지`, ''],
    ['대왕 단계(1-5·2-5) 처음 성공', '+1장', '처음 한 번', ''],
    ['150초 넘게 버티고 실패 2번', '1장', '하루 1장', '잘 못 깨도 조금씩 받아요'],
    [`일일 미션 ${R.MISSIONS.length}개`, `2장씩 (모두 ${R.MISSION_GIFTS}장)`, `하루 ${R.MISSION_GIFTS}장`, R.MISSIONS.map((m) => m.name).join(' · ')],
    ['코인으로 바꾸기', '1장', `하루 ${R.SUPPLY_EXCHANGE_COSTS.length}번`, `코인 ${R.SUPPLY_EXCHANGE_COSTS.join(' → ')}개 (바꿀수록 비싸져요)`],
  ];
  gifts.forEach((g, i) => { const r = 31 + i; put(s, r, 0, g[0], ['cell', 'bold']); put(s, r, 1, g[1], ['cell', 'center']); put(s, r, 2, g[2], ['cell', 'center']); style(s, `C${r}:D${r}`, ['cell'], { merge: true }); put(s, r, 4, g[3], ['cell', 'wrap']); style(s, `E${r}:H${r}`, ['cell', 'wrap'], { merge: true }); });
  style(s, 'C30:D30', ['h', 'center'], { merge: true }); style(s, 'E30:H30', ['h'], { merge: true });
  for (let rr = 31; rr <= 36; rr++) s.heights[rr] = rr === 35 ? 34 : 20;
  put(s, 38, 0, '처음 선물: 캐릭터를 고르면 무기 2개 · 1-1 처음 성공 파츠 1개 고르기 · 1-3 처음 성공 친구 카드 1장 고르기 · 1-5 처음 성공 친구 카드 3장 고르기', ['note']);
  put(s, 39, 0, '이용권: 매일 아침 8시에 10장. 성공하면 1장을 쓰고, 실패하면 쓰지 않아요 → 하루 10번까지 성공할 수 있어요.', ['note']);
  s.freeze = null;
}

// ───────── 3. 친구(펫) ─────────
{
  const s = sheet('친구(펫)'); sheets.push(s);
  s.widths = { 0: 6, 1: 11, 2: 16, 3: 18, 4: 12, 5: 11, 6: 11, 7: 11, 8: 11, 9: 11 };
  put(s, 1, 0, '동물 친구 4마리 — 함께 출동한 친구 1마리의 힘', ['title']);
  put(s, 2, 0, '전설(최대) 파란 글씨를 바꾸면 등급별 숫자가 따라 바뀌어요. 등급별 힘 비율은 "등급과 보급" 시트 ①의 장비·친구 힘.', ['note']);
  put(s, 4, 0, '① 친구 능력 (등급별)', ['section']);
  ['번호', '친구', '역할', '능력', '전설(최대)', ...GRADES].forEach((h, c) => put(s, 5, c, h, ['h', 'center', ...(c >= 5 ? [GFILL[c - 5]] : [])]));
  let r = 6;
  for (const [id, pet] of Object.entries(R.PETS)) {
    const keys = Object.entries(pet.buffs), r0 = r;
    keys.forEach(([k, v], i) => {
      put(s, r, 0, i ? '' : pet.no, ['cell', 'center']); put(s, r, 1, i ? '' : pet.name, ['cell', 'bold', 'center']); put(s, r, 2, i ? '' : pet.role, ['cell', 'center']);
      put(s, r, 3, ({ dmgPct: '모든 스킬 피해', regenPct: '1초마다 체력 회복' })[k] || STAT[k] || k, ['cell']);
      put(s, r, 4, v, ['cell', 'input', 'center'], v < 0 ? '0%' : '+0%');
      GRADES.forEach((g, j) => put(s, r, 5 + j, `=$E${r}*${G}!$D$${6 + j}`, ['cell', 'center', GFILL[j]], v < 0 ? '0.0%' : '+0.0%'));
      r++;
    });
    style(s, `A${r0}:A${r - 1}`, ['cell', 'center'], { merge: true, valign: 'center' }); style(s, `B${r0}:B${r - 1}`, ['cell', 'bold', 'center'], { merge: true, valign: 'center' }); style(s, `C${r0}:C${r - 1}`, ['cell', 'center'], { merge: true, valign: 'center' });
  }
  put(s, r, 0, '받는 피해 -30% = 적에게 맞을 때 덜 아파요. 공격 속도 +50% = 1초에 공격을 1.5배 해요(공격 간격 약 33% 짧아짐). 코인 획득은 성공 보상 코인에 더해져요.', ['note']); r += 2;
  put(s, r, 0, '② 특수 능력 (유니크부터 생겨요)', ['section']); r++;
  s.widths[10] = 11;
  put(s, r, 0, '친구', ['h']); style(s, `A${r}:B${r}`, ['h'], { merge: true });
  put(s, r, 2, '특수 능력', ['h', 'center']); put(s, r, 3, '유니크', ['h', 'g2', 'center']); style(s, `D${r}:E${r}`, ['h', 'g2', 'center'], { merge: true });
  put(s, r, 5, '에픽', ['h', 'g3', 'center']); style(s, `F${r}:G${r}`, ['h', 'g3', 'center'], { merge: true }); put(s, r, 7, '전설 (에픽 + 추가)', ['h', 'g4', 'center']); style(s, `H${r}:J${r}`, ['h', 'g4', 'center'], { merge: true }); r++;
  for (const pet of Object.values(R.PETS)) {
    put(s, r, 0, pet.name, ['cell', 'bold', 'center']); style(s, `A${r}:B${r}`, ['cell', 'bold', 'center'], { merge: true });
    put(s, r, 2, pet.special.name, ['cell', 'center', 'bold']);
    put(s, r, 3, pet.special.text[0], ['cell', 'wrap', 'g2']); style(s, `D${r}:E${r}`, ['cell', 'wrap', 'g2'], { merge: true });
    put(s, r, 5, pet.special.text[1], ['cell', 'wrap', 'g3']); style(s, `F${r}:G${r}`, ['cell', 'wrap', 'g3'], { merge: true });
    put(s, r, 7, pet.special.text[2], ['cell', 'wrap', 'g4']); style(s, `H${r}:J${r}`, ['cell', 'wrap', 'g4'], { merge: true });
    s.heights[r] = 48; r++;
  }
  r++;
  put(s, r, 0, '③ 친구 만나는 법', ['section']); r++;
  [`1-3 처음 성공: 4마리 중 1마리 골라 카드 1장 · 1-5 처음 성공: 1마리 골라 카드 3장`, `친구 보급(보급권 1장): 아직 전설이 아닌 친구 중 무작위 1마리 카드, 1·3·7장 (확률은 "등급과 보급" ②)`, `같은 친구 카드를 모으면 등급이 저절로 올라가요: ${R.CARD_COPIES.map((n, i) => `${GRADES[i]} ${n}장`).join(' · ')}`, '출동할 때 친구는 1마리만 함께 가요.']
    .forEach((t) => { put(s, r, 0, '• ' + t, ['wrap']); style(s, `A${r}:J${r}`, ['wrap'], { merge: true }); s.heights[r] = t.length > 60 ? 30 : 18; r++; });
}

// ───────── 4. 장비 ─────────
{
  const s = sheet('장비'); sheets.push(s);
  s.widths = { 0: 10, 1: 8, 2: 17, 3: 17, 4: 16, 5: 11, 6: 10, 7: 10, 8: 10, 9: 10, 10: 10 };
  put(s, 1, 0, '장비 — 6칸, 원거리·근거리 세트', ['title']);
  put(s, 2, 0, '호야와 민지의 같은 역할 장비는 이름·그림만 다르고 능력이 똑같아요. 전설(최대) 파란 글씨를 바꾸면 등급별 숫자가 따라 바뀌어요.', ['note']);
  put(s, 4, 0, '① 장비 능력 (등급별)', ['section']);
  ['세트', '칸', '호야 장비', '민지 장비', '능력', '전설(최대)', ...GRADES].forEach((h, c) => put(s, 5, c, h, ['h', 'center', ...(c >= 6 ? [GFILL[c - 6]] : [])]));
  let r = 6;
  for (const type of ['ranged', 'melee']) {
    const r0 = r;
    for (const slot of E.GEAR_SLOTS) {
      const hoya = E.GEAR[`hoya_${type}_${slot}`], minji = E.GEAR[`minji_${type}_${slot}`], stats = Object.entries(hoya.max), s0 = r;
      stats.forEach(([k, v], i) => {
        put(s, r, 0, r === r0 ? (type === 'ranged' ? '원거리' : '근거리') : '', ['cell', 'center', 'bold']);
        put(s, r, 1, i ? '' : E.GEAR_SLOT_NAMES[slot], ['cell', 'center']); put(s, r, 2, i ? '' : hoya.name, ['cell']); put(s, r, 3, i ? '' : minji.name, ['cell']);
        put(s, r, 4, STAT[k] || k, ['cell']); put(s, r, 5, v, ['cell', 'input', 'center'], v < 0 ? '0%' : '+0%');
        GRADES.forEach((g, j) => put(s, r, 6 + j, `=$F${r}*${G}!$D$${6 + j}`, ['cell', 'center', GFILL[j]], v < 0 ? '0.0%' : '+0.0%'));
        r++;
      });
      if (stats.length > 1) { style(s, `B${s0}:B${r - 1}`, ['cell', 'center'], { merge: true, valign: 'center' }); style(s, `C${s0}:C${r - 1}`, ['cell'], { merge: true, valign: 'center' }); style(s, `D${s0}:D${r - 1}`, ['cell'], { merge: true, valign: 'center' }); }
    }
    style(s, `A${r0}:A${r - 1}`, ['cell', 'center', 'bold'], { merge: true, valign: 'center' });
  }
  put(s, r, 0, '원거리 세트: 호야 야구복 · 민지 피구복 / 근거리 세트: 호야·민지 교복. 받는 피해 -30% = 덜 아파요. 공격 속도 +50% = 1초에 공격 1.5배.', ['note']); r += 2;

  put(s, r, 0, '② 특수 효과 (유니크부터)', ['section']); r++;
  ['세트', '칸', '이름'].forEach((h, c) => put(s, r, c, h, ['h', 'center']));
  put(s, r, 3, '유니크', ['h', 'g2', 'center']); style(s, `D${r}:E${r}`, ['h', 'g2', 'center'], { merge: true });
  put(s, r, 5, '에픽', ['h', 'g3', 'center']); style(s, `F${r}:H${r}`, ['h', 'g3', 'center'], { merge: true });
  put(s, r, 8, '전설 (에픽 + 추가)', ['h', 'g4', 'center']); style(s, `I${r}:K${r}`, ['h', 'g4', 'center'], { merge: true }); r++;
  for (const type of ['ranged', 'melee']) for (const slot of E.GEAR_SLOTS) {
    const sp = E.GEAR_SPECIALS[type][slot];
    put(s, r, 0, type === 'ranged' ? '원거리' : '근거리', ['cell', 'center']); put(s, r, 1, E.GEAR_SLOT_NAMES[slot], ['cell', 'center']); put(s, r, 2, sp.name, ['cell', 'bold', 'center']);
    put(s, r, 3, sp.text[0], ['cell', 'wrap', 'g2']); style(s, `D${r}:E${r}`, ['cell', 'wrap', 'g2'], { merge: true });
    put(s, r, 5, sp.text[1], ['cell', 'wrap', 'g3']); style(s, `F${r}:H${r}`, ['cell', 'wrap', 'g3'], { merge: true });
    put(s, r, 8, sp.text[2], ['cell', 'wrap', 'g4']); style(s, `I${r}:K${r}`, ['cell', 'wrap', 'g4'], { merge: true });
    s.heights[r] = 34; r++;
  }
  r++;
  put(s, r, 0, '③ 세트 효과 (같은 세트를 여러 칸 끼우면, 등급과 상관없이)', ['section']); r++;
  put(s, r, 0, '세트', ['h', 'center']); style(s, `A${r}:B${r}`, ['h', 'center'], { merge: true });
  E.GEAR_SET_SIZES.forEach((n, i) => { const c0 = 2 + i * 3; put(s, r, c0, `${n}개`, ['h', 'center']); style(s, `${col(c0)}${r}:${col(c0 + 2)}${r}`, ['h', 'center'], { merge: true }); }); r++;
  for (const type of ['ranged', 'melee']) {
    put(s, r, 0, type === 'ranged' ? '원거리 세트' : '근거리 세트', ['cell', 'bold', 'center']); style(s, `A${r}:B${r}`, ['cell', 'bold', 'center'], { merge: true });
    E.GEAR_SET_SIZES.forEach((n, i) => { const c0 = 2 + i * 3; put(s, r, c0, E.GEAR_SET_TEXT[type][n], ['cell', 'wrap']); style(s, `${col(c0)}${r}:${col(c0 + 2)}${r}`, ['cell', 'wrap'], { merge: true }); });
    s.heights[r] = 34; r++;
  }
  r++;
  put(s, r, 0, '④ 장비 얻는 법', ['section']); r++;
  ['캐릭터(호야·민지)를 고르면 원거리·근거리 무기 1개씩 무료. 캐릭터는 한 번 고르면 바꿀 수 없어요(선생님만 바꿀 수 있음).',
    `장비 보급(보급권 1장): 내 캐릭터 장비 ${E.gearIdsFor('hoya').length}종 중 아직 전설이 아닌 것 하나가 무작위로 1·3·7개.`,
    `같은 장비를 모으면 "합성"으로 등급을 올려요: ${R.CARD_COPIES.map((n, i) => `${GRADES[i]} ${n}개`).join(' · ')} (모은 개수는 그대로 쌓여요).`,
    '무기 칸에 원거리 무기를 끼우면 원거리로, 근거리 무기를 끼우면 근거리로 싸워요.']
    .forEach((t) => { put(s, r, 0, '• ' + t, ['wrap']); style(s, `A${r}:K${r}`, ['wrap'], { merge: true }); s.heights[r] = t.length > 70 ? 30 : 18; r++; });
}

// ───────── 5. 능력치(훈련) ─────────
{
  const s = sheet('능력치(훈련)'); sheets.push(s);
  s.widths = { 0: 30, 1: 14, 2: 3, 3: 12, 4: 12, 5: 12, 6: 12, 7: 16, 8: 18 };
  put(s, 1, 0, '기본 능력치(훈련) — 코인으로 한 단계씩, 최대 100단계', ['title']);
  put(s, 2, 0, '공격력·체력·이동 속도를 따로 올려요. 파란 글씨를 바꾸면 아래 표가 모두 따라 바뀌어요.', ['note']);
  put(s, 4, 0, '규칙 (바꿔 볼 수 있어요)', ['section']);
  const rules = [['공격력·체력 1단계당 +', .03, '0%'], ['이동 속도 1단계당 + (31단계까지)', .005, '0.0%'], ['이동 속도 1단계당 + (31단계 뒤)', .001, '0.0%'], ['1→2단계 비용 (코인)', 50, '#,##0'], ['단계마다 늘어나는 비용 (코인)', 12, '#,##0'], ['최대 단계', R.TRAINING_MAX, '0']];
  rules.forEach(([a, v, nf], i) => { put(s, 5 + i, 0, a, ['cell']); put(s, 5 + i, 1, v, ['cell', 'input', 'center'], nf); });
  // 게임 코드와 같은지(첫 값): trainingGain·trainingCost
  const T0 = 15;   // 표 머리글 줄
  put(s, 4, 3, '주요 단계 한눈에', ['section']);
  ['단계', '공격력', '체력', '이동 속도', '한 능력치 코인', '세 능력치 모두'].forEach((h, i) => put(s, 5, 3 + i, h, ['h', 'center', 'wrap']));
  [10, 15, 20, 40, 60, 100].forEach((lv, i) => {
    const rr = 6 + i, tr = T0 + lv;   // 단계 lv의 표 줄
    put(s, rr, 3, lv, ['cell', 'center', 'bold', ...(lv === 15 || lv === 20 ? ['warn'] : lv === 40 ? ['g3'] : [])], '0"단계"');
    put(s, rr, 4, `=B${tr}`, ['cell', 'center'], '+0%'); put(s, rr, 5, `=C${tr}`, ['cell', 'center'], '+0%'); put(s, rr, 6, `=D${tr}`, ['cell', 'center'], '+0.0%');
    put(s, rr, 7, `=F${tr}`, ['cell', 'center'], '#,##0'); put(s, rr, 8, `=G${tr}`, ['cell', 'center'], '#,##0');
  });
  put(s, 12, 3, `어려움 도전 최소: 1장 공격·체력 ${R.HARD_MIN[1].attack}단계 · 2장 ${R.HARD_MIN[2].attack}단계(노랑). 어려움 권장: 공격·체력 ${R.HARD_READY[1].attack} · 이동 속도 ${R.HARD_READY[1].speed}(주황).`, ['note']);
  ['단계', '공격력', '체력', '이동 속도', '다음 단계 비용', '이 단계까지 쓴 코인 (한 능력치)', '세 능력치 모두 이 단계'].forEach((h, i) => put(s, T0, [0, 1, 3, 4, 5, 6, 7][i] ?? i, h, ['h', 'center', 'wrap']));
  // 열: A 단계 · B 공격 · C 체력 · D 이동 · E 비용 · F 누적 · G 세 개 — 머리글을 열에 맞게 다시
  s.cells = s.cells.filter((c) => c.r !== T0);
  ['단계', '공격력', '체력', '이동 속도', '다음 단계 비용', '이 단계까지 쓴 코인(한 능력치)', '세 능력치 모두 이 단계'].forEach((h, i) => put(s, T0, i, h, ['h', 'center', 'wrap']));
  s.heights[T0] = 32;
  for (let lv = 1; lv <= R.TRAINING_MAX; lv++) {
    const rr = T0 + lv, hl = lv === 15 || lv === 20 ? ['warn'] : lv === 40 ? ['g3'] : [];
    put(s, rr, 0, lv, ['cell', 'center', 'bold', ...hl], '0');
    put(s, rr, 1, `=($A${rr}-1)*$B$5`, ['cell', 'center', ...hl], '+0%');
    put(s, rr, 2, `=($A${rr}-1)*$B$5`, ['cell', 'center', ...hl], '+0%');
    put(s, rr, 3, `=MIN(($A${rr}-1)*$B$6,30*$B$6)+MAX(0,$A${rr}-31)*$B$7`, ['cell', 'center', ...hl], '+0.0%');
    put(s, rr, 4, `=IF($A${rr}>=$B$10,"최대",$B$8+$B$9*($A${rr}-1))`, ['cell', 'center', ...hl], '#,##0');
    put(s, rr, 5, lv === 1 ? 0 : `=F${rr - 1}+E${rr - 1}`, ['cell', 'center', ...hl], '#,##0');
    put(s, rr, 6, `=F${rr}*3`, ['cell', 'center', ...hl], '#,##0');
  }
  // 위 열 너비를 표에 맞게
  s.widths = { 0: 33, 1: 14, 2: 12, 3: 12, 4: 14, 5: 18, 6: 18, 7: 16, 8: 18 };
  s.freeze = null;
  s.check = { trainingCost40: Array.from({ length: 39 }, (_, i) => R.trainingCost(i + 1)).reduce((a, b) => a + b, 0), speed100: R.trainingGain('speed', 100), atk100: R.trainingGain('attack', 100) };
}

// ───────── 6. 코인 벌기 ─────────
{
  const s = sheet('코인 벌기'); sheets.push(s);
  s.widths = { 0: 30, 1: 12, 2: 20, 3: 12, 4: 12, 5: 12, 6: 16 };
  put(s, 1, 0, '코인 벌기 — 성공 1번에 받는 코인', ['title']);
  put(s, 2, 0, '이미 성공한 단계를 다시 성공하고 환경 목표(쓰레기 줍기·밸브 잠그기)도 해낸 경우예요. 파란 글씨를 바꿔 볼 수 있어요.', ['note']);
  put(s, 4, 0, '규칙', ['section']);
  const rules = [['기본 코인 (1-1)', 120], ['단계마다 더해지는 코인', 10], ['환경 목표를 해내면 +', 30], ['대왕 단계(1-5·2-5) 성공 +', 60], ['처음 성공하면 한 번 더 +', 120], ['쉬움 배율', R.COIN_MULT.easy], ['보통 배율', R.COIN_MULT.normal], ['어려움 배율', R.COIN_MULT.hard], ['아기사슴 전설: 코인 +', R.PETS.deer.buffs.coinPct]];
  rules.forEach(([a, v], i) => { put(s, 5 + i, 0, a, ['cell']); put(s, 5 + i, 1, v, ['cell', 'input', 'center'], i >= 5 && i <= 7 ? '0.0"배"' : i === 8 ? '0%' : '#,##0'); });
  const T0 = 16;
  put(s, T0 - 1, 0, '단계별 코인 (다시 성공 + 환경 목표)', ['section']);
  ['단계', '번호', '이름', '쉬움', '보통', '어려움', '처음 성공(보통)'].forEach((h, i) => put(s, T0, i, h, ['h', 'center']));
  R.STAGES.forEach((st, i) => {
    const n = i + 1, rr = T0 + 1 + i;
    put(s, rr, 0, R.stageLabel(st.id), ['cell', 'center', 'bold']); put(s, rr, 1, n, ['cell', 'center']); put(s, rr, 2, st.name, ['cell']);
    const core = `($B$5+$B$6*($B${rr}-1)+$B$7+IF(MOD($B${rr},5)=0,$B$8,0))`;
    put(s, rr, 3, `=INT(${core}*$B$10)`, ['cell', 'center'], '#,##0');
    put(s, rr, 4, `=INT(${core}*$B$11)`, ['cell', 'center'], '#,##0');
    put(s, rr, 5, `=INT(${core}*$B$12)`, ['cell', 'center'], '#,##0');
    put(s, rr, 6, `=INT((IF($B${rr}<=2,INT(($B$5+$B$6*($B${rr}-1))*0.6),$B$5+$B$6*($B${rr}-1))+$B$7+IF(MOD($B${rr},5)=0,$B$8,0)+$B$9)*$B$11)`, ['cell', 'center'], '#,##0');
  });
  const last = T0 + R.STAGES.length;
  put(s, last + 1, 0, '1-1·1-2는 처음 성공 전에는 기본 코인이 60%예요. 실패하면 버틴 시간만큼 조금 받아요(최대 기본 코인의 60%). 아기사슴과 함께 가면 코인이 더 늘어요.', ['note']);
  const C0 = last + 3;
  put(s, C0, 0, '계산기: 훈련까지 며칠 걸릴까?', ['section']);
  put(s, C0 + 1, 0, '하루에 성공하는 횟수', ['cell']); put(s, C0 + 1, 1, 10, ['cell', 'input', 'center'], '0"번"');
  put(s, C0 + 2, 0, '도는 단계 번호 (1~10)', ['cell']); put(s, C0 + 2, 1, 3, ['cell', 'input', 'center'], '0');
  put(s, C0 + 3, 0, '난이도 (1 쉬움 · 2 보통 · 3 어려움)', ['cell']); put(s, C0 + 3, 1, 2, ['cell', 'input', 'center'], '0');
  put(s, C0 + 4, 0, '목표 훈련 단계', ['cell']); put(s, C0 + 4, 1, 40, ['cell', 'input', 'center'], '0"단계"');
  put(s, C0 + 5, 0, '하루에 받는 코인', ['cell', 'bold']); put(s, C0 + 5, 1, `=B${C0 + 1}*INDEX(D${T0 + 1}:F${last},B${C0 + 2},B${C0 + 3})`, ['cell', 'center', 'bold'], '#,##0');
  put(s, C0 + 6, 0, '한 능력치를 목표까지 걸리는 날', ['cell', 'bold']); put(s, C0 + 6, 1, `=ROUNDUP(INDEX('능력치(훈련)'!F16:F115,B${C0 + 4})/B${C0 + 5},0)`, ['cell', 'center', 'bold'], '0"일"');
  put(s, C0 + 7, 0, '세 능력치 모두 목표까지 걸리는 날', ['cell', 'bold']); put(s, C0 + 7, 1, `=ROUNDUP(INDEX('능력치(훈련)'!G16:G115,B${C0 + 4})/B${C0 + 5},0)`, ['cell', 'center', 'bold'], '0"일"');
  put(s, C0 + 8, 0, '코인은 파츠 레벨 올리기·보급권 바꾸기에도 써요. 이 계산은 코인을 훈련에만 쓴다고 본 거예요.', ['note']);
  s.check = { coins_CH03_normal_goal: Math.floor((120 + 20 + 30) * 1) };
}

fs.writeFileSync(OUT, JSON.stringify({ font: "맑은 고딕", sheets }));
console.log('sheets', sheets.map((s) => `${s.name}:${s.cells.length}`).join(' '), JSON.stringify(sheets.map((s) => s.check).filter(Boolean)));
