// Browser/Worker shared rules. No DOM, storage, clocks or network side effects.
import { ELEMENTS, SKILLS, PARTS, COMBOS, SUPPORTS, EVO_OF, SKILL_PARTNERS, LEVEL_DAMAGE, RUN_RULES } from './element-content.js';
export { ELEMENTS, SKILLS, PARTS, COMBOS, SUPPORTS, EVO_OF, SKILL_PARTNERS, RUN_RULES, LEVEL_DAMAGE };
import { GEAR, GEAR_SETS, GEAR_SLOTS, GEAR_SLOT_NAMES, GEAR_GRADE_MULT, GEAR_SET_BONUS, GEAR_SET_SIZES, GEAR_SET_TEXT, GEAR_SPECIALS, gearIdsFor } from './equipment.js';
export { GEAR, GEAR_SETS, GEAR_SLOTS, GEAR_SLOT_NAMES, GEAR_GRADE_MULT, GEAR_SET_BONUS, GEAR_SET_SIZES, GEAR_SET_TEXT, GEAR_SPECIALS, gearIdsFor };
export const VERSION = 2;
export const PASS_NOTICE = '매일 아침 8시에 기본 이용권이 10장으로 새로 채워져요. 성공하면 1장, 실패하면 0장! 기본 이용권으로 하루에 10번 성공할 수 있어요. 선생님이 추가로 지급한 이용권은 다음 아침 8시까지 사용할 수 있어요. 이용권은 미션이나 보급에서 나오지 않아요.';
export const TOOLS=SKILLS, SETS=ELEMENTS;
export const SLOTS={attack:'공격 훈련',hp:'체력 훈련',speed:'기동 훈련'};
// 파츠 등급(2026-09-23 저녁 사용자 결정, docs/27): 같은 파츠를 모으면 자동 승급 — 노말 1 · 레어 3 · 유니크 7 · 에픽 25 · 전설 80개.
// 전설은 열심히 해도 두 달 이상(모의 3,000번: 매일 하는 학생 중앙 약 73일, 운이 아주 좋아도 약 62일). 뽑기는 "보급", 코인은 "레벨 올리기"라고 부른다.
export const GRADE_NAMES=['노말','레어','유니크','에픽','전설'];
export const GRADE_COPIES=[1,3,7,25,80];
export const GOLD_COPIES=7;                // 유니크(옛 금): 파츠마다 유니크 기능이 열리는 개수
export const LEGEND_COPIES=80;
// 보급 1번 = 10종 중 무작위 파츠(전설 파츠 제외)를 운으로 1개 80% · 3개 18% · 7개 2%. 고르는 것은 없다(사용자: "선택지를 주지 말자, 운이 필요하게").
export const SUPPLY_BUNDLES=[{qty:1,chance:.8},{qty:3,chance:.18},{qty:7,chance:.02}];
export const SUPPLY_EXCHANGE_COST=300;   // 첫 교환 값(옛 이름, 화면·검사 호환)
// 코인 → 보급권 교환(2026-09-24 사용자 "교환은 하루 3번"): 게임 날짜(아침 8시 기준)마다 3번, 값은 300 → 450 → 600.
export const SUPPLY_EXCHANGE_COSTS=[300,450,600];
export function supplyBuysToday(p,day){if(!day)return 0;if(p?.supplyBuy?.day===day)return p.supplyBuy.count||0;return p?.supplyBuyDay===day?1:0;}
export function supplyExchangeCost(p,day){const n=supplyBuysToday(p,day);return n<SUPPLY_EXCHANGE_COSTS.length?SUPPLY_EXCHANGE_COSTS[n]:null;}
// 성공 보급권(2026-09-23 사용자): 쉬움·보통 1장, 어려움 2장. 같은 단계는 게임 날짜(아침 8시)마다 2번 성공까지만 보급권 → 여러 단계를 하도록.
export const CLEAR_GIFTS={easy:1,normal:1,hard:2};
export const STAGE_GIFT_CLEARS_PER_DAY=2;
// 성공 코인 난이도 배율(2026-09-24 사용자): 쉬움 0.8 · 보통 1 · 어려움 2(처음 성공·대왕·목표 보너스 포함). 실패 코인은 늘리지 않는다
// (실패는 이용권을 쓰지 않으니 어려움에서 일부러 실패해 코인을 모으지 못하게: 실패는 min(배율, 1)).
export const COIN_MULT={easy:.8,normal:1,hard:2};
export function stageGiftLeft(p,stage,day){const g=p?.stageGifts;return Math.max(0,STAGE_GIFT_CLEARS_PER_DAY-(day&&g?.day===day?(g.counts?.[stage]||0):0));}
export const PART_LEVEL_STEP=.03;        // 레벨 1단계마다 그 스킬 피해 +3%(훈련 1단계와 같은 숫자)
// 등급 능력(2026-09-23 저녁 사용자: "전설인데 추가 능력이 더 좋아야"): 그 파츠 스킬의 피해·발동 간격.
// 유니크부터 유니크 기능, 에픽부터 유니크 기능 강화(추가 공격 피해 2배 등), 전설은 30% 확률로 한 번 더 발동(팽이·벌은 +2개).
export const GRADE_DAMAGE=[0,.10,.25,.45,.80];
export const GRADE_INTERVAL=[1,1,.95,.85,.75];
export const LEGEND_EXTRA_CAST=.3;
export const GRADE_STEP=.06;             // (옛 값, 쓰지 않음) 등급 피해는 GRADE_DAMAGE
// 동물 친구(2026-09-24 밤 사용자 "4종으로 줄이고 유니크부터 특수능력 추가. 보급권으로"): 4종 · 친구 카드를 모아 등급(파츠·장비와 같은 1/3/7/25/80장).
// 네 방향(사용자 "1 생존 · 2 이속 공속 · 3 공격력 및 공격범위 · 4 새싹 경험치 및 코인 획득량"): 앞의 셋은 판 안 강화, 4번은 성장·재화.
// 함께 출동한 친구 1마리의 버프(buffs, main.js 통합 스탯 키 · coinPct는 서버 정산) × 등급 배율 + 유니크부터 특수 능력(유니크 1 · 에픽 2 · 전설 3단계, main.js sgPetTick).
// 동물은 그대로 두고 역할만 새로: 참새 → 야옹이(속도), 물범이 → 수달이(범위)로 합침. 우정은 없앴다(migratePets가 함께 출동하던 친구 카드로 바꿈).
// 성장 테이블(2026-09-24 밤 사용자 "최대치를 맥시멈으로 잡고 성장 테이블 수정"): buffs = 전설(최대) 값, 등급마다 그 20 · 40 · 60 · 80 · 100%.
// 전설 최대: 꼬북이 받는 피해 -30%·최대 체력 +30%·초당 회복 2% / 야옹이 이동 속도 +30%·공격 속도 +50% / 수달이 스킬 피해 +50%·범위 +30% / 아기사슴 새싹 경험치 +50%·줍기 범위 +150%·코인 +50%
export const PET_GRADE_RATE=[.2,.4,.6,.8,1];
export const PETS = {
  turtle: { no: 1, name: '꼬북이', role: '생존', color: '#82b876', buffs: { takenPct: -.30, hpPct: .30, regenPct: .02 },
    special: { key: 'shell', name: '등껍질 방패', v: [15, 10], text: ['15초마다 보호막(최대 체력 10%)', '10초마다 · 보호막 15%', '판마다 1번 쓰러져도 일어남'] } },
  cat: { no: 2, name: '야옹이', role: '이동·공격 속도', color: '#efac6a', buffs: { speedPct: .30, atkSpeedPct: .50 },
    special: { key: 'dash', name: '바람 질주', v: [10, 7], text: ['10초마다 3초 동안 공격 속도 +25%', '7초마다(더 자주)', '그 3초 동안 이동 속도도 +30%'] } },
  otter: { no: 3, name: '수달이', role: '공격력·범위', color: '#70bdd1', buffs: { dmgPct: .50, areaPct: .30 },
    special: { key: 'splash', name: '물방울 폭탄', v: [5, 3.5], text: ['5초마다 적이 많은 곳에 물방울 폭탄(주변 적 모두 피해)', '3.5초마다 · 폭탄 피해 1.5배', '물방울 폭탄 3개를 한꺼번에'] } },
  deer: { no: 4, name: '아기사슴', role: '새싹 경험치·코인', color: '#a7be70', buffs: { xpPct: .50, magnetPct: 1.5, coinPct: .50 },
    special: { key: 'magnet', name: '새싹 자석', v: [20, 12], text: ['20초마다 화면의 새싹을 모두 끌어오기', '12초마다(더 자주)', '끌어온 새싹 경험치 +50%'] } },
};
export const PET_IDS=Object.keys(PETS);
export const PET_MERGE={sparrow:'cat',seal:'otter'};
export const PET_VERSION=2;
const PET_STAT={dmgPct:'모든 스킬 피해',areaPct:'스킬 범위',takenPct:'받는 피해',regenPct:'초당 체력 회복',hpPct:'최대 체력',speedPct:'이동 속도',atkSpeedPct:'공격 속도',magnetPct:'새싹 줍기 범위',xpPct:'새싹 경험치',coinPct:'코인 획득'};
const pctLabel=v=>{const x=Math.round(Math.abs(v)*1000)/10;return `${x}%`;};
const petRate=g=>PET_GRADE_RATE[Math.max(0,Math.min(4,g|0))];
const petValue=(v,g)=>Math.round(v*petRate(g)*10000)/10000;
// 그 등급의 버프 한 줄(화면·검사 공용). 받는 피해는 "-"로 보여 준다
export function petBuffText(id,g=0){const pet=PETS[id];if(!pet)return '';return Object.entries(pet.buffs).map(([k,v])=>`${PET_STAT[k]} ${v<0?'-':'+'}${pctLabel(petValue(v,g))}`).join(' · ');}
// 공격 속도 +a(초당 공격 1+a배) → 공격 간격 줄이기 비율(main.js intervalPct): +50% → 간격 ×0.667(-33.3%)
export const petIntervalCut=a=>a>0?1-1/(1+a):0;
export const petCopies=(p,id)=>Math.max(0,Math.floor(Number(p?.petCopies?.[id])||0));
export const hasPet=(p,id)=>own(PETS,id)&&petCopies(p,id)>0;
export function petGrade(p,id){const c=petCopies(p,id);return c>0?grade(c):-1;}
// 함께 출동한 친구의 특수 능력 단계: 0 없음 · 1 유니크 · 2 에픽 · 3 전설
export function petSpecial(p){const id=p?.activePet,g=hasPet(p,id)?petGrade(p,id):-1;return g>=2?{id,key:PETS[id].special.key,tier:g-1}:null;}
export function petBuffFor(p,id,key){if(!hasPet(p,id))return 0;return petValue(PETS[id].buffs[key]||0,petGrade(p,id));}
export function petBuff(p,key){return petBuffFor(p,p?.activePet,key);}
export function petDrawPool(p){return PET_IDS.filter(id=>petCopies(p,id)<LEGEND_COPIES);}
export const needsPetMigration=p=>!!p&&p.petVersion!==PET_VERSION;
// 옛 친구(6종 · 우정 0~28) → 4종 친구 카드. 가진 친구마다 1장(참새·물범이는 합쳐진 친구에), 우정 4마다 함께 출동하던 친구에게 1장 더
// (우정 28 = +7장 → 유니크, 우정 8 = +2장 → 레어). 원래 값은 petMigration에 남긴다. 몇 번 불러도 같은 결과.
export function migratePets(previous){
 const p=structuredClone(previous);if(!needsPetMigration(p))return p;
 const copies={},mapped=id=>own(PETS,PET_MERGE[id]||id)?PET_MERGE[id]||id:null;
 for(const old of Array.isArray(p.pets)?p.pets:[]){const id=mapped(old);if(id)copies[id]=(copies[id]||0)+1;}
 const wanted=mapped(p.activePet),active=wanted&&copies[wanted]?wanted:PET_IDS.find(id=>copies[id])||null;
 const friendship=Math.max(0,Math.min(28,Math.floor(Number(p.friendship)||0))),bonus=active?Math.floor(friendship/4):0;
 if(bonus)copies[active]+=bonus;
 if(p.pets?.length||friendship)p.petMigration={pets:[...(p.pets||[])],activePet:p.activePet??null,friendship,bonus,to:active};
 p.petCopies=copies;p.pets=PET_IDS.filter(id=>copies[id]>0);p.activePet=active;p.petVersion=PET_VERSION;delete p.friendship;
 return p;
}
export function addPetCards(p,id,qty=1){
 if(!own(PETS,id))throw new Error('없는 친구예요.');p.petCopies ||= {};
 const before=petCopies(p,id),after=Math.min(LEGEND_COPIES,before+Math.max(1,Math.floor(qty)));
 p.petCopies[id]=after;p.pets=PET_IDS.filter(x=>petCopies(p,x)>0);if(!hasPet(p,p.activePet))p.activePet=id;
 return {id,qty,before,after,gradeBefore:before?grade(before):-1,gradeAfter:grade(after),isNew:!before,mode:'pet'};
}
export function petDrawMessage(d){const pet=PETS[d.id];if(d.isNew)return `${pet.name} 친구 카드${d.qty>1?` ×${d.qty}`:''}! 새 친구를 만났어요.`;return `${pet.name} 카드 ×${d.qty} · ${d.before}→${d.after}장${d.gradeAfter>d.gradeBefore?` · ${GRADE_NAMES[d.gradeAfter]} 달성!`:''}`;}
// 일일 미션(2026-09-24 밤 사용자 "보급권 수급을 위한 미션 시스템. 일일미션 깨면 하루에 10개씩 추가로"): 게임 날짜(아침 8시)마다 5개 × 보급권 2장 = 10장.
// 다 하는 순간 보급권이 바로 들어온다(받기 버튼 없음 → 못 받고 넘어가는 날이 없음). 진행은 서버가 정산(completeRun)·작업(action)에서 센다(ctx.day).
export const MISSIONS=[
 {id:'win1',name:'도전 1번 성공하기',key:'wins',target:1,gifts:2},
 {id:'goal1',name:'환경 목표 1번 해내기',key:'goals',target:1,gifts:2,hint:'성공하면서 쓰레기 줍기·밸브 잠그기까지'},
 {id:'grow1',name:'훈련·파츠 레벨 1번 올리기',key:'grows',target:1,gifts:2,hint:'훈련 탭 · 파츠 탭에서 코인으로'},
 {id:'win3',name:'도전 3번 성공하기',key:'wins',target:3,gifts:2},
 {id:'win5',name:'도전 5번 성공하기',key:'wins',target:5,gifts:2},
];
export const MISSION_GIFTS=MISSIONS.reduce((n,m)=>n+m.gifts,0);
export function missionState(p,day){const m=p?.missions;return m&&day&&m.day===day?{day,counts:{...m.counts},done:[...m.done]}:{day:day||null,counts:{},done:[]};}
export function missionList(p,day){const m=missionState(p,day);return MISSIONS.map(ms=>({...ms,now:Math.min(ms.target,m.counts[ms.key]||0),done:m.done.includes(ms.id)}));}
function missionProgress(p,day,key,n=1){
 if(!day||!n)return [];if(p.missions?.day!==day)p.missions={day,counts:{},done:[]};
 const m=p.missions,done=[];m.counts[key]=(m.counts[key]||0)+n;
 for(const ms of MISSIONS)if(ms.key===key&&!m.done.includes(ms.id)&&m.counts[key]>=ms.target){m.done.push(ms.id);p.gifts=(p.gifts||0)+ms.gifts;done.push({id:ms.id,name:ms.name,gifts:ms.gifts});}
 return done;
}
const missionNote=done=>done.length?` · 미션 완료! 보급권 +${done.reduce((n,m)=>n+m.gifts,0)}`:'';
// 난이도 3단계(2026-09-23 사용자 요청): 성공하면 쉬움 ★ · 보통 ★★ · 어려움 ★★★. 배수는 main.js sgRunConfig가 쓰고, special은 "특별한 능력을 가진 적" 비율(어려움만).
export const DIFFICULTIES = {
  // density: 적 수 배수(STAGES.density에 곱함). hpGrowth·atkGrowth: 1분마다 새로 나오는 적의 체력·공격력 추가 증가율(스킬이 커져도 후반이 심심하지 않게)
  // bossHp: 1-5 대왕 체력 배율(적 체력 enemyHp에 더 곱함, docs/29 — 어려움은 적 체력이 이미 5.5배라 대왕만 줄여 2분 안에 잡을 수 있게)
  // contactCap: 1초에 부딪혀서 잃을 수 있는 최대 체력 비율(둘러싸여도 빠져나올 시간). 모든 난이도: 처음 1분은 적 공격이 55%→100%로 서서히 세진다(main.js takeDamage)
  easy:   { name: '쉬움',   stars: 1, desc: '적이 약하고 받는 피해가 적어요. 성공하면 별 1개 · 보급권 1장 · 코인 0.8배.', enemyHp: .9,  enemySpd: .85, taken: .4,  density: 1,   hpGrowth: 0,   atkGrowth: 0,   contactCap: .25, special: 0, bossHp: .5 },
  normal: { name: '보통',   stars: 2, desc: '기본 난이도예요. 시간이 갈수록 적이 조금씩 강해져요. 성공하면 별 2개 · 보급권 1장 · 코인 1배.', enemyHp: 1, enemySpd: 1, taken: 1, density: 1.1, hpGrowth: .12, atkGrowth: .06, contactCap: .3, special: 0, bossHp: .85 },
  // 어려움(2026-09-23 저녁 사용자: "유니크 이상 파츠 + 기본 능력치 40 이상이어야 간신히 클리어"): 자동 조종 1-3 어려움 10판씩 — 훈련 40·유니크 3개 4/10,
  // 훈련 20·유니크 1/10, 훈련 40·파츠 없음 수준 1/10, 훈련 1 0/10(docs/28). 체력 ×5.5 · 받는 피해 ×4.8 · 1분마다 새 적 체력 +45%.
  hard:   { name: '어려움', stars: 3, desc: '아주 어려워요! 기본 능력치(훈련) 40단계 이상과 유니크 이상 파츠가 있어야 겨우 버틸 수 있어요. 적이 아주 튼튼하고 세며 시간이 갈수록 더 강해져요. 원소 방패·단단 갑옷·날쌘이·회복이·쪼개지기 같은 특별한 적도 나와요. 성공하면 별 3개 · 보급권 2장 · 코인 2배.', enemyHp: 5.5, enemySpd: 1.08, taken: 4.8, density: 1.2, hpGrowth: .45, atkGrowth: .1, contactCap: .35, special: .3, bossHp: .4 },
};
export const difficultyOf=p=>Object.hasOwn(DIFFICULTIES,p?.difficulty)?p.difficulty:'easy';
// 어려움에서만 나오는 특별한 적(main.js가 동작·표시). weight: 뽑힐 비율. 엘리트(큰 적)는 늘 '원소 방패'.
export const SPECIAL_TRAITS = {
  resist: { name: '원소 방패', weight: 3, color: '#8fd3ff', desc: '방패 색깔 원소의 스킬 피해를 75% 막아요. 다른 원소 스킬이나 기본 무기로 공격해요.' },
  armor:  { name: '단단 갑옷', weight: 2, color: '#aeb8c6', desc: '원소 스킬 피해를 절반만 받아요. 기본 무기 피해는 그대로 들어가요.' },
  fast:   { name: '날쌘이',   weight: 2, color: '#ff4fd8', desc: '1.6배 빠르게 달려와요. 대신 체력이 조금 낮아요.' },
  regen:  { name: '회복이',   weight: 1.5, color: '#ff5a6e', desc: '1.5초 동안 안 맞으면 체력이 빠르게 차요. 쉬지 말고 공격해요.' },
  split:  { name: '쪼개지기', weight: 1.5, color: '#a77bff', desc: '쓰러지면 작은 적 2마리로 나뉘어요.' },
};
export const STAGES = [
  // 2026-09-23 밀도 조정: 적은 더 많이(density ×1.5 → 사용자 요청으로 다시 ×1.3 = 원래의 약 2배), 체력은 조금 낮게(×0.85) → 스킬로 쓸어버리는 맛
  { id:'CH01', name:'과자봉지 골목', goal:'떨어진 쓰레기 3개 줍기', target:3, enemyHp:.72, enemyAtk:.85, density:1.55, tip:'새싹을 모으면 새로운 도구를 골라요.', story:'과자봉지가 바람에 날아다녀! 골목부터 함께 치워 볼까?', unlock:'처음 성공하면 코인 120개 더!' },
  { id:'CH02', name:'분리수거 놀이터', goal:'떨어진 쓰레기 4개 줍기', target:4, enemyHp:.8, enemyAtk:.92, density:1.75, tip:'도구 3단계 + 짝꿍 도움 1단계 = 자동 합체!', story:'병과 봉지가 뒤섞였어. 차근차근 모아 보자!', unlock:'처음 성공하면 쭉쭉 집게 열림' },
  { id:'CH03', name:'바람 부는 공원', goal:'떨어진 쓰레기 5개 줍기', target:5, enemyHp:.87, enemyAtk:1, density:1.95, tip:'위험한 빨간 표시가 보이면 옆으로 피해요.', story:'공원에서 동물 친구가 기다리고 있어!', unlock:'처음 성공하면 첫 동물 친구 선택' },
  { id:'CH04', name:'다시 피는 꽃길', goal:'떨어진 쓰레기 6개 줍기', target:6, enemyHp:.94, enemyAtk:1.07, density:2.05, tip:'어려우면 쉬움으로 다시 도전해요.', story:'꽃이 다시 자라도록 깨끗한 길을 만들자!', unlock:'처음 성공하면 톡톡 씨앗 열림' },
  { id:'CH05', name:'쓰레기 대장 구출', goal:'떨어진 쓰레기 5개 줍기', target:5, enemyHp:1.0, enemyAtk:1.12, density:2.1, tip:'쓰레기를 5개 모으면 대장도 약해져요!', story:'대장은 쓰레기 때문에 괴로워하고 있어. 함께 깨끗하게 해 주자!', unlock:'새싹 도구 + 새 친구 선택 + 선물 상자 열림' },
  // 2장 「대기오염 공장 지대」(2026-09-24 사용자, themes.js T2_*): 목표는 가스가 새는 밸브 잠그기(1장의 쓰레기 줍기 자리). 1-5를 성공하면 열린다.
  { id:'CH06', name:'매캐한 공단 입구', goal:'가스가 새는 밸브 3개 잠그기', target:3, enemyHp:1.15, enemyAtk:1.2, density:2.0, tip:'', story:'공장 굴뚝에서 시커먼 매연이 뿜어져! 새는 밸브부터 잠가 보자.', unlock:'' },
  { id:'CH07', name:'굴뚝 골목', goal:'가스가 새는 밸브 4개 잠그기', target:4, enemyHp:1.25, enemyAtk:1.26, density:2.1, tip:'', story:'입이 빨개진 가스몬은 곧 불을 뿜어! 옆으로 피하자.', unlock:'' },
  { id:'CH08', name:'가스 탱크 공장', goal:'가스가 새는 밸브 5개 잠그기', target:5, enemyHp:1.35, enemyAtk:1.32, density:2.15, tip:'', story:'바닥에 세균몬이 숨어 있어. 가까이 가기 전에 멀리서 공격!', unlock:'' },
  { id:'CH09', name:'매연 도로', goal:'가스가 새는 밸브 6개 잠그기', target:6, enemyHp:1.45, enemyAtk:1.38, density:2.2, tip:'', story:'산성비 구름몬이 빗방울을 떨어뜨려. 표시를 보고 피하자!', unlock:'' },
  { id:'CH10', name:'굴뚝 대왕의 공장', goal:'가스가 새는 밸브 5개 잠그기', target:5, enemyHp:1.5, enemyAtk:1.42, density:2.2, tip:'', story:'파이프로 된 굴뚝 가스 대왕이 나타났어! 밸브를 잠가 대왕을 약하게 만들자.', unlock:'' },
];

const stageCopy=[
 ['새싹을 모아 원소 스킬을 고르고 3단계까지 키워요.','첫 파츠 1개 선택 + 파츠·친구 보급 열림'],
 ['지원품은 나를 튼튼하게, 스킬의 짝 지원품은 진화의 열쇠예요.','첫 성공 코인 120개 추가'],
 ['스킬 3단계 + 짝 지원품이면 금색 진화 카드가 나와요.','처음 성공하면 첫 동물 친구 선택'],
 ['가까운 적·멀리 있는 적에 맞춰 스킬을 조합해요.','첫 성공 코인 120개 추가'],
 ['쓰레기를 5개 모으면 대장도 약해져요!','새 친구 선택 + 보급권 1장 추가'],
 ['매연 구역 안에서는 느려지고 조금씩 닳아요. 공기 정화 나무 곁은 안전해요.','첫 성공 코인 120개 추가'],
 ['가스몬은 원거리 공격이 없어요. 거리를 두고 싸워요.','첫 성공 코인 120개 추가'],
 ['세균몬은 움직이지 않아요. 멀리서 공격하면 안전하게 없앨 수 있어요.','첫 성공 코인 120개 추가'],
 ['빗방울 표시가 3곳 생기면 곧 산성비가 떨어져요.','첫 성공 코인 120개 추가'],
 ['밸브를 5개 잠그면 대왕도 약해져요!','보급권 1장 추가 + 코인 60개 더'],
];
STAGES.forEach((s,i)=>{s.tip=stageCopy[i][0];s.unlock=stageCopy[i][1];});
const clone=x=>structuredClone(x);
const own=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
const clampInt=(n,min,max)=>Math.max(min,Math.min(max,Math.floor(Number(n)||min)));
export function freshProfile(legacy={}) {
 const stages={};
 for(const s of STAGES){const old=legacy.progress?.chapters?.[s.id];if(old?.cleared){const count=Array.isArray(old.stars)?old.stars.filter(Boolean).length:Number(old.stars)||1;stages[s.id]={cleared:true,stars:Math.min(3,Math.max(1,count)),best:old.bestClearS||300};}}
 return {version:VERSION,coins:0,gifts:0,training:{attack:1,hp:1,speed:1},parts:{},equippedParts:[],pets:[],petCopies:{},petVersion:PET_VERSION,activePet:null,stages,runs:0,wins:0,failRemainder:0,giftCounts:{part:0,pet:0},milestones:{},difficulty:'easy',weaponMode:'melee',hero:legacy.hero==='minji'?'minji':'hoya',heroLocked:false,gear:{},equippedGear:{},skillUsage:{},fusionUsage:{},migratedAtVersion:VERSION};
}
export function maxClear(p){return Math.max(0,...STAGES.filter(s=>p.stages?.[s.id]?.cleared).map(s=>Number(s.id.slice(2))));}
export function stageUnlocked(p,id){const i=STAGES.findIndex(s=>s.id===id);return i===0||(i>0&&!!p.stages?.[STAGES[i-1].id]?.cleared);}
export function availableTools(){return Object.keys(SKILLS);}
// 대왕 단계(각 장의 5번째: 1-5·2-5)는 4분 뒤 대왕 등장
export const BOSS_STAGES=['CH05','CH10'];
export const isBossStage=id=>BOSS_STAGES.includes(id);
export function durationFor(p,id){return ['CH01','CH02'].includes(id)&&!p.stages?.[id]?.cleared?180:isBossStage(id)?240:300;}
// 훈련(기본 능력치) 만렙 100(2026-09-23 저녁 사용자). 비용 식은 그대로(100 + 25×(단계-1)), 40단계까지 한 능력치에 22,425코인, 100단계까지 131,175코인.
export const TRAINING_MAX=100;
// 훈련비(2026-09-24 사용자 "훈련비 인하"): 100+25×(단계-1) → 50+12×(단계-1). 세 가지 모두 40까지 67,275 → 32,526코인, 100까지 393,525 → 189,486코인.
export function trainingCost(level){return level>=TRAINING_MAX?null:50+12*(level-1);}
export const upgradeCost=trainingCost;
export function partUpgradeCost(level){return level>=10?null:60+20*(level-1);}
export function partResetRefund(level){const n=clampInt(level,1,10)-1;return 60*n+10*n*(n-1);}
export function grade(copies){const n=Number(copies)||0;let g=0;for(let i=1;i<GRADE_COPIES.length;i++)if(n>=GRADE_COPIES[i])g=i;return g;}
export function nextGradeAt(copies){return GRADE_COPIES.find(n=>n>(Number(copies)||0))??null;}
export function setCounts(p){const counts=Object.fromEntries(Object.keys(ELEMENTS).map(e=>[e,0]));for(const id of new Set(p.equippedParts||[]))if(PARTS[id]&&p.parts?.[id]?.copies>0)counts[PARTS[id].element]++;return counts;}
export function hasPart(p,skillId){const id=skillId.startsWith('PART_')?skillId:`PART_${skillId}`;return !!(p.equippedParts?.includes(id)&&p.parts?.[id]?.copies>0);}
export function hasGold(p,skillId){if(!hasPart(p,skillId))return false;return grade(p.parts[skillId.startsWith('PART_')?skillId:`PART_${skillId}`].copies)>=2;}
export function partBonus(p,skillId){if(!hasPart(p,skillId))return 0;const part=p.parts[skillId.startsWith('PART_')?skillId:`PART_${skillId}`];return (clampInt(part.level,1,10)-1)*PART_LEVEL_STEP+GRADE_DAMAGE[grade(part.copies)];}
// 장착한 파츠의 등급(없으면 -1)과 그에 따른 발동 간격 배수
export function partGrade(p,skillId){if(!hasPart(p,skillId))return -1;return grade(p.parts[skillId.startsWith('PART_')?skillId:`PART_${skillId}`].copies);}
export function partIntervalMul(p,skillId){const g=partGrade(p,skillId);return g<0?1:GRADE_INTERVAL[g];}
export function elementBonus(p,element){return (setCounts(p)[element]||0)>=2?.04:0;}
// 아직 전설이 아닌 파츠(보급에서 나올 수 있고, 첫 무료 파츠로 고를 수 있음)
export function selectableParts(p){return Object.keys(PARTS).filter(id=>(p.parts?.[id]?.copies||0)<LEGEND_COPIES);}
// 서로 다른 원소 파츠 3개를 끼우면 최대 체력 +5%(2차). 같은 원소 2개(+4%)와 동시에는 될 수 없다.
export function rainbowSet(p){const ids=runParts(p);return ids.length===3&&new Set(ids.map(id=>PARTS[id].element)).size===3;}
// 보급 방식은 하나(random). 화면이 이 값을 함께 보내야 하고, 옛 화면(pick·new·element)은 새로고침 안내로 거절한다. 모두 전설이면 null.
export function drawMode(p){return selectableParts(p).length?'random':null;}
export function bundleFor(roll){let acc=0;for(const b of SUPPLY_BUNDLES){acc+=b.chance;if(roll<acc)return b.qty;}return SUPPLY_BUNDLES[0].qty;}
export function drawMessage(d){const name=PARTS[d.id]?.name||'파츠';if(d.isNew)return `${name}${d.qty>1?` ×${d.qty}`:''} 획득!${d.autoEquipped?' 빈 칸에 끼웠어요.':''}`;return `${name} ×${d.qty} · ${d.before}→${d.after}개${d.gradeAfter>d.gradeBefore?` · ${GRADE_NAMES[d.gradeAfter]} 달성!`:''}`;}
export function hasUnique(p,skillId){return hasGold(p,skillId);}
export function runParts(p){return [...new Set(p.equippedParts||[])].filter(id=>own(PARTS,id)&&p.parts?.[id]?.copies>0).slice(0,3);}
export function skillDamageMultiplier(p,id){const combo=COMBOS[id];if(combo)return skillDamageMultiplier(p,combo.skill);return 1+partBonus(p,id)+elementBonus(p,SKILLS[id]?.element);}
export function levelMultiplier(lv){return LEVEL_DAMAGE[clampInt(lv,1,5)-1];}
export function supportValue(id,lv){const s=SUPPORTS[id];return s?s.values[clampInt(lv,1,3)-1]:0;}
// 훈련 효과(공격·체력 단계마다 +3%, 이동 속도 31단계까지 0.5%씩 그 뒤 0.1%씩 → 100단계 +21.9%)
export function trainingGain(stat,level){const n=Math.max(1,Math.floor(Number(level)||1));return stat==='speed'?Math.min(.15,(n-1)*.005)+Math.max(0,n-31)*.001:(n-1)*.03;}
export function bonuses(p){
 const b={atkPct:trainingGain('attack',p.training.attack),hpPct:trainingGain('hp',p.training.hp)+(rainbowSet(p)?.05:0),speedPct:trainingGain('speed',p.training.speed),bossDmgPct:0,areaPct:0};
 const g=gearBonuses(p);for(const [k,v] of Object.entries(g.stats))b[k]=(b[k]||0)+v;
 b.gearSpecials=g.specials;b.gearSets=g.sets;return b;
}
// ---- 장비(2026-09-24, docs/34) ----
// 캐릭터(호야/민지): 모든 학생이 게임에 들어올 때 한 번 고르고 고정(heroLocked). 2026-09-24 사용자: "로그인 시에 1회 선택지, 바꿀 수 없으니 신중히 하라고 확인받아"
// → 전에 만든 계정도 한 판 했든 안 했든 한 번 고른다(바꾸기는 선생님 관리 페이지에서만).
export const heroLocked=p=>!!p?.heroLocked;
export const gearOf=(p,id)=>p?.gear?.[id]||null;
export function gearGrade(p,id){const g=gearOf(p,id);return g&&g.copies>0?clampInt(g.grade??0,0,GRADE_COPIES.length-1):-1;}
// 합성: 같은 장비를 모아 다음 등급 개수(3·7·25·80)에 닿으면 누를 수 있다. 모은 개수는 그대로 쌓인다(파츠와 같은 기준).
export function gearMergeReady(p,id){const g=gearOf(p,id),gr=gearGrade(p,id);return gr>=0&&gr<GRADE_COPIES.length-1&&g.copies>=GRADE_COPIES[gr+1];}
export function gearDrawPool(p){return gearIdsFor(p.hero).filter(id=>(gearOf(p,id)?.copies||0)<LEGEND_COPIES);}
// 장착 장비의 능력 합: 기본 능력 × 등급 배율 + 세트 효과(같은 세트 2·4·6개) + 특수 효과 단계(유니크 1 · 에픽 2 · 전설 3)
export function gearBonuses(p){
 const stats={},sets={},specials={};
 const add=(o,m=1)=>{for(const [k,v] of Object.entries(o||{}))stats[k]=(stats[k]||0)+v*m;};
 for(const slot of GEAR_SLOTS){
  const id=p?.equippedGear?.[slot],it=GEAR[id];if(!it||it.hero!==p.hero)continue;const gr=gearGrade(p,id);if(gr<0)continue;
  add(it.base,GEAR_GRADE_MULT[gr]);sets[it.set]=(sets[it.set]||0)+1;
  if(gr>=2)specials[it.special.key]=gr-1;
 }
 for(const [set,n] of Object.entries(sets))for(const size of GEAR_SET_SIZES)if(n>=size)add(GEAR_SET_BONUS[GEAR_SETS[set].type][size]);
 return {stats,sets,specials};
}
export function addGear(p,id,qty=1){
 if(!own(GEAR,id))throw new Error('없는 장비예요.');p.gear ||= {};
 const before=p.gear[id]?.copies||0,after=Math.min(LEGEND_COPIES,before+Math.max(1,Math.floor(qty)));
 p.gear[id]={copies:after,grade:p.gear[id]?.grade??0};
 return {id,qty,before,after,isNew:before===0,grade:p.gear[id].grade,mergeReady:gearMergeReady(p,id)};
}
// 받침 있으면 을/이, 없으면 를/가
export const josa=(w,a,b)=>{const c=String(w).charCodeAt(String(w).length-1);return w+(c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28>0?a:b);};
// 첫 장비(2026-09-24 사용자 "무료로 근거리 원거리 무기 1개 줘"): 내 캐릭터의 원거리·근거리 무기를 1개씩 무료로. 끼우는 것은 고른 것(없으면 지금 공격 방식).
export const firstWeapons=hero=>['ranged','melee'].map(t=>`${hero==='minji'?'minji':'hoya'}_${t}_weapon`);
function grantFirstWeapons(p,equip){
 const ids=firstWeapons(p.hero),pick=ids.includes(equip)?equip:ids.find(id=>GEAR[id].type===p.weaponMode)||ids[1];
 for(const id of ids)addGear(p,id,1);equipGearItem(p,pick);p.milestones ||= {};p.milestones.firstGear=true;
 return {id:pick,mode:'first',ids,qty:1,before:0,after:1,isNew:true,grade:0};
}
function equipGearItem(p,id){const it=GEAR[id];p.equippedGear ||= {};p.equippedGear[it.slot]=id;if(it.slot==='weapon')p.weaponMode=it.type;}
export function gearDrawMessage(d){const it=GEAR[d.id];return `${it.name}${d.qty>1?` ×${d.qty}`:''} ${d.isNew?'획득!':`· ${d.before}→${d.after}개`}${d.mergeReady?' · 합성할 수 있어요!':''}`;}
// 어려움 준비 권장치(2026-09-24 밤 사용자 "어려움 1번 실패하면 장비·능력치 업그레이드가 부족하다면서 권장치를 구체적으로"):
// 1장은 docs/28(훈련 40 + 유니크 파츠면 겨우 성공), 2장은 docs/34 모의(훈련 40 + 유니크 파츠에 유니크 장비 6세트가 있어야 2-3 성공이 보임)를 따른다.
// 항목: 훈련(공격·체력·이동 속도) · 유니크 이상 파츠 장착 수 · 장비 착용 칸 · 같은 세트 개수 · 유니크 이상 장비 수. 화면(실패 뒤 안내·출동 화면 한 줄)과 검사가 같이 쓴다.
export const HARD_READY={
 1:{attack:40,hp:40,speed:20,uniqueParts:3,gearWorn:6,gearSet:4,gearUnique:0},
 2:{attack:40,hp:40,speed:20,uniqueParts:3,gearWorn:6,gearSet:6,gearUnique:6},
};
export function stageChapter(stageId){const n=Number(String(stageId||'').replace(/\D/g,''))||1;return Math.floor((n-1)/5)+1;}
export function hardReadiness(p,stageId){
 const ch=Math.min(2,Math.max(1,stageChapter(stageId))),need=HARD_READY[ch],t=p?.training||{},eq=p?.equippedGear||{};
 const parts=runParts(p).filter(id=>grade(p.parts?.[id]?.copies||0)>=2).length;
 const worn=GEAR_SLOTS.map(s=>eq[s]).filter(id=>GEAR[id]&&GEAR[id].hero===p.hero&&gearGrade(p,id)>=0);
 const sets={};for(const id of worn)sets[GEAR[id].set]=(sets[GEAR[id].set]||0)+1;
 const bestSet=Math.max(0,...Object.values(sets)),uniqueGear=worn.filter(id=>gearGrade(p,id)>=2).length;
 const items=[
  {key:'attack',label:'훈련 · 공격력',now:t.attack||1,need:need.attack,unit:'단계',tab:'training'},
  {key:'hp',label:'훈련 · 체력',now:t.hp||1,need:need.hp,unit:'단계',tab:'training'},
  {key:'speed',label:'훈련 · 이동 속도',now:t.speed||1,need:need.speed,unit:'단계',tab:'training'},
  {key:'parts',label:'유니크 이상 파츠 장착(같은 파츠 7개)',now:parts,need:need.uniqueParts,unit:'개',tab:'parts'},
  {key:'gearWorn',label:'장비 착용 칸',now:worn.length,need:need.gearWorn,unit:'칸',tab:'gear'},
  {key:'gearSet',label:'같은 세트 장비',now:bestSet,need:need.gearSet,unit:'개',tab:'gear'},
 ];
 if(need.gearUnique)items.push({key:'gearUnique',label:'유니크 이상 장비(같은 장비 7개 모아 합성)',now:uniqueGear,need:need.gearUnique,unit:'개',tab:'gear'});
 for(const it of items)it.ok=it.now>=it.need;
 return {chapter:ch,items,ready:items.every(it=>it.ok),missing:items.filter(it=>!it.ok).length};
}
// 시험용 슈퍼 계정(2026-09-24 사용자 "테스트 목적의 슈퍼 계정"): 모든 단계 성공(별 3) · 훈련 · 파츠 10종 · 친구 4마리(파츠와 같은 카드 수) · 코인·보급권 넉넉히.
// 서버 관리 API(/api/admin/test-profile)가 'qa'로 시작하는 계정에만 쓴다. copies 80 = 전설, 25 = 에픽. 주인공·무기·난이도는 그대로 둔다.
export const TEST_ACCOUNT_RE=/^qa[a-z0-9_]{0,10}$/;
export function superTestProfile(base,{training=100,copies=80,level=10}={}){
 const p=clone(base||freshProfile()),t=clampInt(training,1,TRAINING_MAX);
 p.training={attack:t,hp:t,speed:t};p.coins=999999;p.gifts=99;
 for(const s of STAGES)p.stages[s.id]={...(p.stages[s.id]||{}),cleared:true,stars:3};
 p.parts=Object.fromEntries(Object.keys(PARTS).map(id=>[id,{copies:clampInt(copies,1,LEGEND_COPIES),level:clampInt(level,1,10)}]));
 p.equippedParts=Object.keys(PARTS).slice(0,3);
 const petN=clampInt(copies,1,LEGEND_COPIES);p.petCopies=Object.fromEntries(PET_IDS.map(id=>[id,petN]));p.pets=[...PET_IDS];p.petVersion=PET_VERSION;delete p.friendship;p.activePet=own(PETS,p.activePet)?p.activePet:'otter';
 p.milestones={...(p.milestones||{}),firstPart:true,firstPet:true,bossPet:true,firstGear:true};p.testAccount=true;
 // 장비(2026-09-24): 내 캐릭터 장비 12종을 같은 개수·그 개수의 등급으로, 원거리 세트 6개 장착
 p.heroLocked=true;p.gear=Object.fromEntries(gearIdsFor(p.hero).map(id=>[id,{copies:clampInt(copies,1,LEGEND_COPIES),grade:grade(clampInt(copies,1,LEGEND_COPIES))}]));
 p.equippedGear=Object.fromEntries(GEAR_SLOTS.map(s=>[s,`${p.hero}_ranged_${s}`]));p.weaponMode='ranged';
 return p;
}
// 개수 상한 없음(2차): 금 뒤에 남는 개수도 그대로 쌓는다. 금 파츠는 고르는 목록·원소 보급에서 빠지므로 "코인 60개" 낭비가 없다.
export function addPart(p,id,qty=1){
 if(!own(PARTS,id))throw new Error('없는 파츠예요.');
 const before=Math.max(0,Math.floor(Number(p.parts[id]?.copies)||0)),after=before+qty,isNew=!before;
 p.parts[id]=isNew?{copies:after,level:1}:{...p.parts[id],copies:after};
 p.equippedParts=(p.equippedParts||[]).filter(x=>PARTS[x]);   // 옛 체계의 파츠 ID는 장착 목록에서 제외
 const autoEquipped=!p.equippedParts.includes(id)&&p.equippedParts.length<3;if(autoEquipped)p.equippedParts.push(id);
 return {id,qty,before,after,gradeBefore:isNew?-1:grade(before),gradeAfter:grade(after),isNew,autoEquipped};
}
export function pendingPart(p){return p?.stages?.CH01?.cleared&&!p.milestones?.firstPart?{key:'firstPart',ids:Object.keys(PARTS)}:null;}
// 친구 고르기(카드는 보급권을 쓰지 않음): 1-3 첫 성공 → 4종 중 1마리 카드 1장, 1-5 첫 성공 → 4종 중 1마리 카드 3장(이미 있는 친구도 고를 수 있음).
export function pendingPet(p){if(!p)return null;if(maxClear(p)>=3&&!p.milestones?.firstPet)return {key:'firstPet',ids:[...PET_IDS],qty:1};if(p.stages?.CH05?.cleared&&!p.milestones?.bossPet)return {key:'bossPet',ids:[...PET_IDS],qty:3};return null;}
// 별 = 난이도(쉬움 1 · 보통 2 · 어려움 3). 난이도는 출동 전 settings로 프로필에 저장된 값을 서버가 그대로 읽는다(클라이언트가 보낸 값은 쓰지 않음).
// 환경 목표(쓰레기 줍기)는 별 대신 코인 +30. bossSeconds·hpFraction은 기록용으로만 받는다.
export function completeRun(profile,{stage,cleared,seconds,litter=0,hpFraction=0,bossSeconds=Infinity,skillIds=[],fusionIds=[],supportIds=[],equippedPartIds=null,pet=undefined,difficulty=difficultyOf(profile),day=null}) {
 const p=migratePets(profile),index=Number(stage.slice(2)),st=STAGES[index-1],diff=DIFFICULTIES[difficulty]||DIFFICULTIES.easy;
 if(!st)throw new Error('없는 단계예요.');
 const first=cleared&&!p.stages[stage]?.cleared,intro=['CH01','CH02'].includes(stage)&&!p.stages[stage]?.cleared;
 const goal=cleared&&litter>=st.target;
 const base=120+10*(index-1),mult=COIN_MULT[difficulty]??1;
 const baseCoins=cleared?Math.floor((Math.floor(base*(intro?.6:1))+(first?120:0)+(index%5===0?60:0)+(goal?30:0))*mult):Math.floor(base*.6*Math.min(seconds/300,1)*Math.min(mult,1));
 // 4번 친구(아기사슴) 코인 획득 +%: 출동할 때 함께한 친구(서버가 도전 시작 때 저장한 pet, 없으면 지금 친구)
 const petCoinPct=petBuffFor(p,pet===undefined?p.activePet:pet,'coinPct'),coins=Math.floor(baseCoins*(1+petCoinPct));
 // 성공 보급권: 난이도별(쉬움·보통 1, 어려움 2) + 대왕 단계(1-5·2-5) 첫 성공 보너스 1. 같은 단계는 하루 2번 성공까지만(day는 서버가 넣음, 코인·우정·별은 그대로).
 let stageGift=null,clearGifts=cleared?(CLEAR_GIFTS[difficulty]||1):0;
 if(cleared&&day){
  if(p.stageGifts?.day!==day)p.stageGifts={day,counts:{}};
  const used=p.stageGifts.counts[stage]||0;if(used>=STAGE_GIFT_CLEARS_PER_DAY)clearGifts=0;else p.stageGifts.counts[stage]=used+1;
  stageGift={left:STAGE_GIFT_CLEARS_PER_DAY-(p.stageGifts.counts[stage]||0),capped:!clearGifts,limit:STAGE_GIFT_CLEARS_PER_DAY};
 }
 let gifts=clearGifts+(first&&index%5===0?1:0);
 p.runs++;if(cleared)p.wins++;
 // 실패 격려(150초 이상 실패 2번): 보급권은 게임 날짜마다 1장까지(실패만 반복해 보급권을 모으지 못하게). day는 서버가 넣는다.
 if(!cleared&&seconds>=150){p.failRemainder++;if(p.failRemainder>=2){p.failRemainder-=2;if(!day||p.failGiftDay!==day){gifts++;if(day)p.failGiftDay=day;}}}
 p.coins+=coins;p.gifts+=gifts;
 // 일일 미션: 성공 횟수 · 환경 목표(보급권은 missionProgress가 바로 더함, reward.gifts와 따로 보여 준다)
 const missions=cleared?[...missionProgress(p,day,'wins'),...(goal?missionProgress(p,day,'goals'):[])]:[];
 const stars=cleared?diff.stars:0;
 if(cleared){const prev=p.stages[stage]||{};p.stages[stage]={cleared:true,stars:Math.max(prev.stars||0,stars),best:Math.min(prev.best??Infinity,seconds)};}
 p.skillUsage ||= {};p.fusionUsage ||= {};
 for(const id of new Set(skillIds))if(SKILLS[id])p.skillUsage[id]=(p.skillUsage[id]||0)+1;
 for(const id of new Set(fusionIds))if(COMBOS[id])p.fusionUsage[id]=(p.fusionUsage[id]||0)+1;
 p.supportUsage ||= {};for(const id of new Set(supportIds))if(SUPPORTS[id])p.supportUsage[id]=(p.supportUsage[id]||0)+1;
 const partActivity=[];
 if(Array.isArray(equippedPartIds)){
  p.partUsage ||= {};
  const used=new Set([...skillIds,...fusionIds.map(id=>COMBOS[id]?.skill)]);
  for(const id of [...new Set(equippedPartIds)].filter(id=>own(PARTS,id)).slice(0,3)){
   const active=used.has(PARTS[id].skill),old=p.partUsage[id]||{};
   p.partUsage[id]={equipped:(old.equipped||0)+1,active:(old.active||0)+(active?1:0)};
   partActivity.push({id,active});
  }
 }
 return {profile:p,reward:{coins,petCoinPct,gifts,missions,stars,first,partActivity,stageGift,difficulty:own(DIFFICULTIES,difficulty)?difficulty:'easy',goal,notes:first?[st.unlock]:[]}};
}
// ctx.day = 서버가 넣는 게임 날짜(아침 8시 기준). 코인 교환처럼 하루 한 번인 작업에 쓴다.
export function action(profile,a,rng=Math.random,ctx={}){
 const p=migratePets(profile);let message='저장했어요.',draw=null;
 const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
 const pickIndex=n=>Math.min(n-1,Math.max(0,Math.floor(rng()*n)));
 if(a.kind==='train'){
  check(Object.hasOwn(SLOTS,a.stat),'훈련을 골라 주세요.');const cost=trainingCost(p.training[a.stat]);check(cost!==null,'이미 최고 단계예요.');check(p.coins>=cost,'코인을 더 모아 주세요.');p.coins-=cost;p.training[a.stat]++;message=`${SLOTS[a.stat]} ${p.training[a.stat]}단계! 두 주인공에게 함께 적용돼요.`+missionNote(missionProgress(p,ctx.day,'grows'));
 }else if(a.kind==='equip-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');p.equippedParts=(p.equippedParts||[]).filter(x=>PARTS[x]);
  // 칸이 가득 차면 replace로 바꿀 파츠를 받는다(뺀 파츠의 레벨·개수는 그대로 남음)
  if(!p.equippedParts.includes(a.id)){
   if(p.equippedParts.length>=3){check(own(PARTS,a.replace)&&p.equippedParts.includes(a.replace),'파츠는 세 개까지 장착해요. 바꿀 파츠를 골라 주세요.');p.equippedParts=p.equippedParts.map(x=>x===a.replace?a.id:x);message=`${PARTS[a.replace].name} 대신 ${PARTS[a.id].name} 장착!`;}
   else{p.equippedParts.push(a.id);message='파츠를 장착했어요.';}
  }else message='파츠를 장착했어요.';
 }else if(a.kind==='unequip-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');p.equippedParts=p.equippedParts.filter(id=>id!==a.id);message='파츠를 보관했어요.';
 }else if(a.kind==='upgrade-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');const cost=partUpgradeCost(p.parts[a.id].level);check(cost!==null,'이미 최고 단계예요.');check(p.coins>=cost,'코인을 더 모아 주세요.');p.coins-=cost;p.parts[a.id].level++;message=`${PARTS[a.id].name} Lv.${p.parts[a.id].level}! 이 스킬 피해 +${Math.round((p.parts[a.id].level-1)*PART_LEVEL_STEP*100)}%`+missionNote(missionProgress(p,ctx.day,'grows'));
 }else if(a.kind==='reset-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');const refund=partResetRefund(p.parts[a.id].level);p.parts[a.id].level=1;p.coins+=refund;message=`레벨을 1로 되돌리고 코인 ${refund}개를 돌려받았어요. 메달과 개수는 그대로예요.`;
 }else if(a.kind==='choose-part'){
  const pending=pendingPart(p);check(pending?.ids.includes(a.id),'첫 파츠를 이미 받았거나 아직 받을 수 없어요.');check(selectableParts(p).includes(a.id),'이미 전설인 파츠예요. 다른 파츠를 골라 주세요.');p.milestones[pending.key]=true;draw={...addPart(p,a.id),mode:'first'};message=drawMessage(draw);
 }else if(a.kind==='draw-part'){
  check(!!p.stages.CH01?.cleared,'1-1을 성공하면 보급이 열려요.');check(p.gifts>0,'보급권이 더 필요해요.');p.giftCounts ||= {part:0,pet:0};
  const mode=drawMode(p);check(mode,'모든 파츠가 전설이에요!');
  // 옛 화면(원소 고르기·5번째 선택)이 보낸 요청은 아무것도 바꾸지 않고 새로고침을 안내한다(보급권 그대로).
  if(a.mode!==mode){const e=new Error('보급 규칙이 새로워졌어요. 화면을 새로고침해 주세요.');e.code='DRAW_MODE';e.mode=mode;throw e;}
  // 고르는 것 없음: 전설이 아닌 10종 중 무작위 1종, 개수는 운(1·3·7개). 화면이 보낸 id·element는 무시한다.
  const pool=selectableParts(p),selected=pool[pickIndex(pool.length)],qty=bundleFor(Math.max(0,Math.min(.999999999,rng())));
  draw={...addPart(p,selected,qty),mode};p.gifts--;p.giftCounts.part=(p.giftCounts.part||0)+1;message=drawMessage(draw);
 }else if(a.kind==='buy-supply'){
  check(!!p.stages.CH01?.cleared,'1-1을 성공하면 보급이 열려요.');check(typeof ctx.day==='string'&&ctx.day,'서버에서만 바꿀 수 있어요.');
  const n=supplyBuysToday(p,ctx.day),cost=supplyExchangeCost(p,ctx.day),max=SUPPLY_EXCHANGE_COSTS.length;
  check(cost!==null,`오늘은 ${max}번 다 바꿨어요. 내일 아침 8시에 다시 바꿀 수 있어요.`);check(p.coins>=cost,`코인 ${cost}개가 필요해요.`);
  p.coins-=cost;p.gifts++;p.supplyBuy={day:ctx.day,count:n+1};p.supplyBuyDay=ctx.day;message=`코인 ${cost}개로 보급권 1장을 받았어요! (오늘 ${n+1}/${max}번)`;
 }else if(a.kind==='pet'){check(hasPet(p,a.id),'아직 만나지 못한 친구예요.');p.activePet=a.id;message=`${PETS[a.id].name}와 함께 출동해요!`;}   // 네 친구 이름 모두 받침 없음
 else if(a.kind==='choose-pet'){
  const pending=pendingPet(p);check(pending&&pending.ids.includes(a.id),'지금 고를 수 있는 친구가 아니에요.');p.milestones[pending.key]=true;
  draw={...addPetCards(p,a.id,pending.qty),mode:'choose-pet'};p.activePet=a.id;message=draw.isNew?`${PETS[a.id].name}와 친구가 되었어요!${pending.qty>1?` 친구 카드 ${pending.qty}장`:''}`:petDrawMessage(draw);
 }else if(a.kind==='gift'){
  // 옛 화면의 "친구 만나기"(우정) 요청: 아무것도 바꾸지 않고 새로고침 안내
  const e=new Error('친구 보급이 새로워졌어요. 화면을 새로고침해 주세요.');e.code='DRAW_MODE';e.mode='pet';throw e;
 }else if(a.kind==='draw-pet'){
  // 친구 보급: 보급권 1장 → 전설이 아닌 친구 중 무작위 1마리의 카드, 장수는 파츠·장비와 같은 운(1·3·7장). 고르는 것 없음.
  check(!!p.stages.CH01?.cleared,'1-1을 성공하면 보급이 열려요.');check(p.gifts>0,'보급권이 더 필요해요.');
  const pool=petDrawPool(p);check(pool.length,'모든 친구가 전설이에요!');p.giftCounts ||= {part:0,pet:0};
  const id=pool[pickIndex(pool.length)],qty=bundleFor(Math.max(0,Math.min(.999999999,rng())));
  draw=addPetCards(p,id,qty);p.gifts--;p.giftCounts.pet=(p.giftCounts.pet||0)+1;message=petDrawMessage(draw);
 }else if(a.kind==='choose-hero'){
  // 가입할 때 한 번만: 호야/민지 고정(장비 뽑기는 이 성별 장비만)
  check(!heroLocked(p),'캐릭터는 이미 정해졌어요. 바꾸려면 선생님께 부탁해 주세요.');check(['hoya','minji'].includes(a.hero),'캐릭터를 골라 주세요.');
  p.hero=a.hero;p.heroLocked=true;message=`${a.hero==='minji'?'민지':'호야'}와 함께해요!`;   // 민지·호야 모두 받침 없음
  // 고르면서 첫 무기 2개(원거리·근거리)를 준다. 이미 받은 학생(선생님이 바꿔 준 경우 등)은 그대로.
  if(!p.milestones?.firstGear){draw=grantFirstWeapons(p);message+=` 무기 2개를 받았어요.`;}
 }else if(a.kind==='choose-first-gear'){
  // 첫 장비: 캐릭터를 고를 때 받지 못한 학생(캐릭터가 이미 정해진 계정)용. 원거리·근거리 무기 1개씩 무료, a.id를 끼운다.
  p.milestones ||= {};check(heroLocked(p),'먼저 캐릭터를 골라 주세요.');check(!p.milestones.firstGear,'첫 장비를 이미 받았어요.');
  check(!a.id||firstWeapons(p.hero).includes(a.id),'고를 수 있는 무기가 아니에요.');
  draw=grantFirstWeapons(p,a.id);message=`무기 2개를 받았어요! ${josa(GEAR[draw.id].name,'을','를')} 끼웠어요.`;
 }else if(a.kind==='draw-gear'){
  check(!!p.stages.CH01?.cleared,'1-1을 성공하면 보급이 열려요.');check(heroLocked(p),'먼저 캐릭터를 골라 주세요.');check(p.gifts>0,'보급권이 더 필요해요.');
  const pool=gearDrawPool(p);check(pool.length,'모든 장비가 전설이에요!');p.giftCounts ||= {part:0,pet:0};
  const id=pool[pickIndex(pool.length)],qty=bundleFor(Math.max(0,Math.min(.999999999,rng())));
  draw={...addGear(p,id,qty),mode:'gear'};p.gifts--;p.giftCounts.gear=(p.giftCounts.gear||0)+1;message=gearDrawMessage(draw);
 }else if(a.kind==='merge-gear'){
  check(own(GEAR,a.id)&&gearGrade(p,a.id)>=0,'아직 없는 장비예요.');check(gearMergeReady(p,a.id),`같은 장비를 ${GRADE_COPIES[gearGrade(p,a.id)+1]??''}개 모으면 합성할 수 있어요.`);
  p.gear[a.id].grade++;message=`${GEAR[a.id].name} ${GRADE_NAMES[p.gear[a.id].grade]} 등급으로 합성!`;draw={id:a.id,mode:'merge',grade:p.gear[a.id].grade};
 }else if(a.kind==='equip-gear'){
  const it=GEAR[a.id];check(it&&gearGrade(p,a.id)>=0,'아직 없는 장비예요.');check(it.hero===p.hero,'내 캐릭터 장비가 아니에요.');
  equipGearItem(p,a.id);message=`${it.name} 장착!${it.slot==='weapon'?` ${it.type==='ranged'?'원거리':'근거리'}로 싸워요.`:''}`;
 }else if(a.kind==='unequip-gear'){
  check(GEAR_SLOTS.includes(a.slot)&&p.equippedGear?.[a.slot],'빈 칸이에요.');delete p.equippedGear[a.slot];message=`${GEAR_SLOT_NAMES[a.slot]} 칸을 비웠어요.`;
 }else if(a.kind==='settings'){
  // 무기 원소 설정은 없앴다(2026-09-23 사용자: "무기는 근거리·원거리만"). 옛 프로필의 weaponElement 키는 지운다.
  const settings={difficulty:a.difficulty??p.difficulty,hero:a.hero??p.hero,weaponMode:a.weaponMode??p.weaponMode};
  check(own(DIFFICULTIES,settings.difficulty),'난이도를 골라 주세요.');check(['hoya','minji'].includes(settings.hero),'주인공을 골라 주세요.');check(['melee','ranged'].includes(settings.weaponMode),'공격 방식을 골라 주세요.');
  // 장비(2026-09-24): 캐릭터는 가입 때 고정, 무기 장비를 끼면 그 무기가 근거리/원거리를 정한다
  check(!(heroLocked(p)&&settings.hero!==p.hero),'캐릭터는 가입할 때 정해져요. 바꾸려면 선생님께 부탁해 주세요.');
  const weapon=GEAR[p.equippedGear?.weapon];check(!(weapon&&settings.weaponMode!==weapon.type),`${josa(weapon?.name||'무기','은','는')} ${weapon?.type==='ranged'?'원거리':'근거리'} 무기예요. 무기 장비를 바꾸면 공격 방식이 바뀌어요.`);
  Object.assign(p,settings);delete p.weaponElement;
 }else throw new Error('할 수 없는 작업이에요.');
 return {profile:p,message,...(draw?{draw}:{})};
}
// ---------- 판 안 카드 규칙 (탕탕특공대 방식): 스킬 4칸(Lv.5) + 지원품 4칸(Lv.3), 스킬 Lv.5 + 짝 지원품 → 진화 ----------
function validState(state){state.consumed ||= [];state.fusionCount ||= 0;state.supports ||= {};state.partnerOffers ||= {};return state;}
const evoReady=(skills,state,skillId)=>{const evo=EVO_OF[skillId];if(!evo||!skills[skillId]||skills[skillId].lv<RUN_RULES.maxSkillLevel)return null;const need=COMBOS[evo].support;return state.supports[need]?evo:null;};
export function cardPool(p,skills,state={}){
 validState(state);const cards=[],count=Object.keys(skills).length,supports=state.supports,scount=Object.keys(supports).length;
 // 가진 스킬 키우기를 우선(5분 안에 진화 2~3회). 새 스킬은 2개까지는 잘 나오고 그 뒤로는 드물게
 for(const id of Object.keys(SKILLS)){
  const owned=skills[id];
  if(owned&&owned.lv<RUN_RULES.maxSkillLevel)cards.push({kind:'skill-up',id,weight:3.5});
  else if(!owned&&!skills[EVO_OF[id]]&&count<RUN_RULES.skillSlots)cards.push({kind:'skill-new',id,weight:(count<2?1.6:.5)*(hasPart(p,id)?1.4:1)});
 }
 // 짝 지원품은 가진 스킬이 있으면 훨씬 자주 나온다
 const wanted=new Set(Object.keys(skills).flatMap(id=>SKILL_PARTNERS[id]||[]));
 for(const id of Object.keys(SUPPORTS)){
  const lv=supports[id]?.lv;
  if(lv&&lv<RUN_RULES.maxSupportLevel)cards.push({kind:'support-up',id,weight:.8});
  else if(!lv&&scount<RUN_RULES.supportSlots)cards.push({kind:'support-new',id,weight:wanted.has(id)?3:.5});
 }
 for(const id of Object.keys(skills)){const evo=evoReady(skills,state,id);if(evo)cards.push({kind:'evolve',id:evo,weight:10});}
 return cards;
}
export function cardChoices(p,skills,state={},hpFraction=1,rng=Math.random){
 validState(state);const pool=cardPool(p,skills,state),selected=[];
 const take=card=>{if(card){selected.push(card);pool.splice(pool.indexOf(card),1);}};
 for(const c of pool.filter(c=>c.kind==='evolve').slice(0,2))take(c);          // 진화 카드는 운에 맡기지 않는다
 if(!Object.keys(skills).length){
  // 첫 선택·다시 뽑기에도 내 파츠 스킬 한 장. 파츠가 없으면 종전 난수 흐름 그대로.
  const owned=new Set(runParts(p).map(id=>PARTS[id].skill));
  const preferred=pool.filter(c=>c.kind==='skill-new'&&owned.has(c.id));
  if(preferred.length)take(preferred[Math.min(preferred.length-1,Math.max(0,Math.floor(rng()*preferred.length)))]);
  while(selected.length<3&&pool.some(c=>c.kind==='skill-new'))takeWeighted(pool.filter(c=>c.kind==='skill-new'),pool,selected,rng);
 }   // 첫 선택은 스킬만
 // 진화로 가는 길 보장: Lv.2 이상 스킬의 짝 지원품이 없으면 그 지원품 카드를 반드시 1장 넣는다
 if(selected.length<3){const need=Object.keys(skills).filter(id=>SKILLS[id]&&skills[id].lv>=2).flatMap(id=>SKILL_PARTNERS[id]).find(sid=>!state.supports[sid]);const card=need&&pool.find(c=>c.kind==='support-new'&&c.id===need);if(card)take(card);}
 // 키우던 스킬의 레벨업 카드도 1장 보장
 if(selected.length<3){const up=pool.filter(c=>c.kind==='skill-up').sort((a,b)=>skills[b.id].lv-skills[a.id].lv)[0];if(up)take(up);}
 while(pool.length&&selected.length<3){
  // 세 장이 모두 같은 종류가 되지 않게: 스킬 계열·지원품 계열을 섞는다
  const kinds=selected.map(c=>c.kind.split('-')[0]);
  let candidates=pool;
  if(selected.length===2&&kinds[0]===kinds[1])candidates=pool.filter(c=>c.kind.split('-')[0]!==kinds[0]);
  if(!candidates.length)candidates=pool;
  takeWeighted(candidates,pool,selected,rng);
 }
 if(hpFraction<.45){
  if(selected.length<3)selected.push({kind:'heal'});
  else{const replace=selected.findLastIndex(c=>c.kind!=='evolve');if(replace>=0)selected[replace]={kind:'heal'};}
 }else if(selected.length<3&&hpFraction<.99)selected.push({kind:'heal'});
 if(!selected.length)selected.push({kind:'shield'});
 return selected;
}
function takeWeighted(candidates,pool,selected,rng){
 if(!candidates.length)return;const total=candidates.reduce((n,c)=>n+c.weight,0);let roll=Math.max(0,Math.min(.999999999,rng()))*total,i=0;
 while(i<candidates.length-1&&(roll-=candidates[i].weight)>0)i++;
 const card=candidates[i];selected.push(card);pool.splice(pool.indexOf(card),1);
}
export function applyRunCard(skills,state,card){
 validState(state);
 if(card.kind==='heal')return {healed:.2,shielded:0};if(card.kind==='shield')return {healed:0,shielded:.12};
 if(card.kind==='skill-new'&&SKILLS[card.id]&&!skills[card.id]&&Object.keys(skills).length<RUN_RULES.skillSlots){skills[card.id]={lv:1,cd:0};return {skill:card.id};}
 if(card.kind==='skill-up'&&SKILLS[card.id]&&skills[card.id]?.lv<RUN_RULES.maxSkillLevel){skills[card.id].lv++;return {levelUp:card.id};}
 if(card.kind==='support-new'&&SUPPORTS[card.id]&&!state.supports[card.id]&&Object.keys(state.supports).length<RUN_RULES.supportSlots){state.supports[card.id]={lv:1};return {support:card.id};}
 if(card.kind==='support-up'&&SUPPORTS[card.id]&&state.supports[card.id]?.lv<RUN_RULES.maxSupportLevel){state.supports[card.id].lv++;return {support:card.id};}
 const combo=COMBOS[card.id];
 if(card.kind==='evolve'&&combo&&evoReady(skills,state,combo.skill)===card.id){
  delete skills[combo.skill];skills[combo.id]={lv:RUN_RULES.maxSkillLevel,cd:0,evolved:true};state.fusionCount++;return {fusion:combo.id};
 }
 throw new Error('지금 고를 수 없는 카드예요.');
}

