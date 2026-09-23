// Browser/Worker shared rules. No DOM, storage, clocks or network side effects.
import { ELEMENTS, SKILLS, PARTS, COMBOS, SUPPORTS, EVO_OF, SKILL_PARTNERS, LEVEL_DAMAGE, RUN_RULES } from './element-content.js';
export { ELEMENTS, SKILLS, PARTS, COMBOS, SUPPORTS, EVO_OF, SKILL_PARTNERS, RUN_RULES, LEVEL_DAMAGE };
export const VERSION = 2;
export const PASS_NOTICE = '매일 아침 8시에 기본 이용권이 10장으로 새로 채워져요. 성공하면 1장, 실패하면 0장! 기본 이용권으로 하루에 10번 성공할 수 있어요. 선생님이 추가로 지급한 이용권은 다음 아침 8시까지 사용할 수 있어요. 이용권은 미션이나 뽑기에서 나오지 않아요.';
export const TOOLS=SKILLS, SETS=ELEMENTS;
export const SLOTS={attack:'공격 훈련',hp:'체력 훈련',speed:'기동 훈련'};
export const GRADE_NAMES=['일반','강화','특급'];
// 동물 친구 = 함께 있는 동안 계속 붙는 버프(2026-09-23, 사용자: "펫은 무용지물 → 버프 효과로"). buffs 키는 main.js 통합 스탯 키. 우정 3단계부터 ×1.2
export const PETS = {
  cat: { name: '야옹이', role: '새싹 자석', desc: '새싹 줍기 범위 +80%, 새싹 경험치 +15%', color: '#efac6a', buffs: { magnetPct: .8, xpPct: .15 } },
  turtle: { name: '꼬북이', role: '든든한 방패', desc: '받는 피해 -15%, 시작할 때 체력 10% 보호막', color: '#82b876', buffs: { takenPct: -.15, shieldStart: .1 } },
  otter: { name: '수달이', role: '힘 도우미', desc: '모든 스킬 피해 +15%', color: '#70bdd1', buffs: { dmgPct: .15 } },
  sparrow: { name: '참새', role: '바람 도우미', desc: '이동 속도 +12%, 공격 간격 -10%', color: '#ceab81', buffs: { speedPct: .12, intervalPct: .10 } },
  deer: { name: '아기사슴', role: '치료 도우미', desc: '초당 체력 0.8% 회복, 최대 체력 +15%', color: '#a7be70', buffs: { regenPct: .008, hpPct: .15 } },
  seal: { name: '물범이', role: '범위 도우미', desc: '모든 스킬 범위 +20%', color: '#87c9db', buffs: { areaPct: .2 } },
};
export function petBuff(p,key){const pet=PETS[p?.activePet];if(!pet)return 0;const v=pet.buffs[key]||0;return v*(friendshipLevel(p)>=3?1.2:1);}
// 난이도 3단계(2026-09-23 사용자 요청): 성공하면 쉬움 ★ · 보통 ★★ · 어려움 ★★★. 배수는 main.js sgRunConfig가 쓰고, special은 "특별한 능력을 가진 적" 비율(어려움만).
export const DIFFICULTIES = {
  // density: 적 수 배수(STAGES.density에 곱함). hpGrowth·atkGrowth: 1분마다 새로 나오는 적의 체력·공격력 추가 증가율(스킬이 커져도 후반이 심심하지 않게)
  // contactCap: 1초에 부딪혀서 잃을 수 있는 최대 체력 비율(둘러싸여도 빠져나올 시간). 모든 난이도: 처음 1분은 적 공격이 55%→100%로 서서히 세진다(main.js takeDamage)
  easy:   { name: '쉬움',   stars: 1, desc: '적이 약하고 받는 피해가 적어요. 성공하면 별 1개.', enemyHp: .9,  enemySpd: .85, taken: .4,  density: 1,   hpGrowth: 0,   atkGrowth: 0,   contactCap: .25, special: 0 },
  normal: { name: '보통',   stars: 2, desc: '기본 난이도예요. 시간이 갈수록 적이 조금씩 강해져요. 성공하면 별 2개.', enemyHp: 1, enemySpd: 1, taken: 1, density: 1.1, hpGrowth: .12, atkGrowth: .06, contactCap: .3, special: 0 },
  hard:   { name: '어려움', stars: 3, desc: '적이 많고 튼튼하고 시간이 갈수록 더 강해져요. 원소 방패·단단 갑옷·날쌘이·회복이·쪼개지기 같은 특별한 적이 나와요. 성공하면 별 3개.', enemyHp: 1.2, enemySpd: 1.08, taken: 1.3, density: 1.2, hpGrowth: .3, atkGrowth: .1, contactCap: .35, special: .3 },
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
];

const stageCopy=[
 ['새싹을 모아 원소 스킬을 고르고 3단계까지 키워요.','첫 파츠 1개 선택 + 파츠·친구 뽑기 열림'],
 ['지원품은 나를 튼튼하게, 스킬의 짝 지원품은 진화의 열쇠예요.','첫 성공 코인 120개 추가'],
 ['스킬 3단계 + 짝 지원품이면 금색 진화 카드가 나와요.','처음 성공하면 첫 동물 친구 선택'],
 ['가까운 적·멀리 있는 적에 맞춰 스킬을 조합해요.','첫 성공 코인 120개 추가'],
 ['쓰레기를 5개 모으면 대장도 약해져요!','새 친구 선택 + 뽑기권 1장 추가'],
];
STAGES.forEach((s,i)=>{s.tip=stageCopy[i][0];s.unlock=stageCopy[i][1];});
const clone=x=>structuredClone(x);
const own=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
const clampInt=(n,min,max)=>Math.max(min,Math.min(max,Math.floor(Number(n)||min)));
export function freshProfile(legacy={}) {
 const stages={};
 for(const s of STAGES){const old=legacy.progress?.chapters?.[s.id];if(old?.cleared){const count=Array.isArray(old.stars)?old.stars.filter(Boolean).length:Number(old.stars)||1;stages[s.id]={cleared:true,stars:Math.min(3,Math.max(1,count)),best:old.bestClearS||300};}}
 return {version:VERSION,coins:0,gifts:0,training:{attack:1,hp:1,speed:1},parts:{},equippedParts:[],pets:[],activePet:null,friendship:0,stages,runs:0,wins:0,failRemainder:0,giftCounts:{part:0,pet:0},milestones:{},difficulty:'easy',weaponMode:'melee',hero:legacy.hero==='minji'?'minji':'hoya',skillUsage:{},fusionUsage:{},migratedAtVersion:VERSION};
}
export function maxClear(p){return Math.max(0,...STAGES.filter(s=>p.stages?.[s.id]?.cleared).map(s=>Number(s.id.slice(2))));}
export function stageUnlocked(p,id){const i=STAGES.findIndex(s=>s.id===id);return i===0||(i>0&&!!p.stages?.[STAGES[i-1].id]?.cleared);}
export function availableTools(){return Object.keys(SKILLS);}
export function durationFor(p,id){return ['CH01','CH02'].includes(id)&&!p.stages?.[id]?.cleared?180:id==='CH05'?240:300;}
export function trainingCost(level){return level>=20?null:100+25*(level-1);}
export const upgradeCost=trainingCost;
export function partUpgradeCost(level){return level>=10?null:60+20*(level-1);}
export function partResetRefund(level){const n=clampInt(level,1,10)-1;return 60*n+10*n*(n-1);}
export function grade(copies){return copies>=7?2:copies>=3?1:0;}
export function friendshipLevel(p){return [0,3,8,16,28].filter(n=>p.friendship>=n).length;}
export function setCounts(p){const counts=Object.fromEntries(Object.keys(ELEMENTS).map(e=>[e,0]));for(const id of new Set(p.equippedParts||[]))if(PARTS[id]&&p.parts?.[id]?.copies>0)counts[PARTS[id].element]++;return counts;}
export function hasPart(p,skillId){const id=skillId.startsWith('PART_')?skillId:`PART_${skillId}`;return !!(p.equippedParts?.includes(id)&&p.parts?.[id]?.copies>0);}
export function partBonus(p,skillId){if(!hasPart(p,skillId))return 0;const part=p.parts[skillId.startsWith('PART_')?skillId:`PART_${skillId}`];return (clampInt(part.level,1,10)-1)*.02+[0,.06,.12][grade(part.copies)];}
export function elementBonus(p,element){const n=setCounts(p)[element]||0;return n>=3?.06:n>=2?.04:0;}
export function skillDamageMultiplier(p,id){const combo=COMBOS[id];if(combo)return skillDamageMultiplier(p,combo.skill);return 1+partBonus(p,id)+elementBonus(p,SKILLS[id]?.element);}
export function levelMultiplier(lv){return LEVEL_DAMAGE[clampInt(lv,1,5)-1];}
export function supportValue(id,lv){const s=SUPPORTS[id];return s?s.values[clampInt(lv,1,3)-1]:0;}
export function bonuses(p){return {atkPct:(p.training.attack-1)*.03,hpPct:(p.training.hp-1)*.03,speedPct:Math.min(.15,(p.training.speed-1)*.005),bossDmgPct:0,areaPct:0};}
export function addPart(p,id){
 if(!own(PARTS,id))throw new Error('없는 파츠예요.');
 const owned=p.parts[id];if(owned?.copies>=7){p.coins+=60;return '이미 특급인 파츠 → 코인 60개';}
 if(owned)owned.copies++;else p.parts[id]={copies:1,level:1};
 p.equippedParts=(p.equippedParts||[]).filter(x=>PARTS[x]);   // 옛 체계의 파츠 ID는 장착 목록에서 제외
 if(!p.equippedParts.includes(id)&&p.equippedParts.length<3)p.equippedParts.push(id);
 return `${PARTS[id].name} 획득!`;
}
export function addPet(p,id){if(p.pets.includes(id)){if(p.friendship>=28){p.coins+=60;return '친구 도감 완성 보상: 코인 60개';}p.friendship=Math.min(28,p.friendship+1);return '다시 만난 친구 → 우정 +1';}p.pets.push(id);p.activePet ||= id;return `${PETS[id].name}와 친구가 되었어요!`;}
export function pendingPart(p){return p?.stages?.CH01?.cleared&&!p.milestones?.firstPart?{key:'firstPart',ids:Object.keys(PARTS)}:null;}
export function pendingPet(p){if(!p)return null;if(maxClear(p)>=3&&!p.milestones?.firstPet)return {key:'firstPet',ids:['cat','turtle','otter']};if(p.stages?.CH05?.cleared&&!p.milestones?.bossPet){const ids=Object.keys(PETS).filter(id=>!p.pets.includes(id));return {key:'bossPet',ids:ids.length?ids:['cat'],allOwned:!ids.length};}return null;}
// 별 = 난이도(쉬움 1 · 보통 2 · 어려움 3). 난이도는 출동 전 settings로 프로필에 저장된 값을 서버가 그대로 읽는다(클라이언트가 보낸 값은 쓰지 않음).
// 환경 목표(쓰레기 줍기)는 별 대신 코인 +30. bossSeconds·hpFraction은 기록용으로만 받는다.
export function completeRun(profile,{stage,cleared,seconds,litter=0,hpFraction=0,bossSeconds=Infinity,skillIds=[],fusionIds=[],supportIds=[],difficulty=difficultyOf(profile)}) {
 const p=clone(profile),index=Number(stage.slice(2)),st=STAGES[index-1],diff=DIFFICULTIES[difficulty]||DIFFICULTIES.easy;
 if(!st)throw new Error('없는 단계예요.');
 const first=cleared&&!p.stages[stage]?.cleared,intro=['CH01','CH02'].includes(stage)&&!p.stages[stage]?.cleared;
 const goal=cleared&&litter>=st.target;
 const base=120+10*(index-1),coins=cleared?Math.floor(base*(intro?.6:1))+(first?120:0)+(index===5?60:0)+(goal?30:0):Math.floor(base*.6*Math.min(seconds/300,1));
 let gifts=cleared?1+(first&&index===5?1:0):0,friendship=cleared?1:0;
 p.runs++;if(cleared)p.wins++;
 if(!cleared&&seconds>=150){p.failRemainder++;if(p.failRemainder>=2){p.failRemainder-=2;gifts++;friendship++;}}
 p.coins+=coins;p.gifts+=gifts;p.friendship=Math.min(28,p.friendship+friendship);
 const stars=cleared?diff.stars:0;
 if(cleared){const prev=p.stages[stage]||{};p.stages[stage]={cleared:true,stars:Math.max(prev.stars||0,stars),best:Math.min(prev.best??Infinity,seconds)};}
 p.skillUsage ||= {};p.fusionUsage ||= {};
 for(const id of new Set(skillIds))if(SKILLS[id])p.skillUsage[id]=(p.skillUsage[id]||0)+1;
 for(const id of new Set(fusionIds))if(COMBOS[id])p.fusionUsage[id]=(p.fusionUsage[id]||0)+1;
 p.supportUsage ||= {};for(const id of new Set(supportIds))if(SUPPORTS[id])p.supportUsage[id]=(p.supportUsage[id]||0)+1;
 return {profile:p,reward:{coins,gifts,friendship,stars,first,difficulty:own(DIFFICULTIES,difficulty)?difficulty:'easy',goal,notes:first?[st.unlock]:[]}};
}
export function action(profile,a,rng=Math.random){
 const p=clone(profile);let message='저장했어요.';
 const check=(ok,msg)=>{if(!ok)throw new Error(msg);};
 if(a.kind==='train'){
  check(Object.hasOwn(SLOTS,a.stat),'훈련을 골라 주세요.');const cost=trainingCost(p.training[a.stat]);check(cost!==null,'이미 최고 단계예요.');check(p.coins>=cost,'코인을 더 모아 주세요.');p.coins-=cost;p.training[a.stat]++;message=`${SLOTS[a.stat]} ${p.training[a.stat]}단계! 두 주인공에게 함께 적용돼요.`;
 }else if(a.kind==='equip-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');p.equippedParts=(p.equippedParts||[]).filter(x=>PARTS[x]);check(p.equippedParts.includes(a.id)||p.equippedParts.length<3,'파츠는 세 개까지 장착해요. 하나를 빼고 장착해 주세요.');if(!p.equippedParts.includes(a.id))p.equippedParts.push(a.id);message='파츠를 장착했어요.';
 }else if(a.kind==='unequip-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');p.equippedParts=p.equippedParts.filter(id=>id!==a.id);message='파츠를 보관했어요.';
 }else if(a.kind==='upgrade-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');const cost=partUpgradeCost(p.parts[a.id].level);check(cost!==null,'이미 최고 단계예요.');check(p.coins>=cost,'코인을 더 모아 주세요.');p.coins-=cost;p.parts[a.id].level++;message=`${PARTS[a.id].name} ${p.parts[a.id].level}단계!`;
 }else if(a.kind==='reset-part'){
  check(own(PARTS,a.id)&&p.parts[a.id]?.copies>0,'아직 없는 파츠예요.');const refund=partResetRefund(p.parts[a.id].level);p.parts[a.id].level=1;p.coins+=refund;message=`강화를 1단계로 되돌리고 코인 ${refund}개를 돌려받았어요. 등급은 그대로예요.`;
 }else if(a.kind==='choose-part'){
  const pending=pendingPart(p);check(pending?.ids.includes(a.id),'첫 파츠를 이미 받았거나 아직 받을 수 없어요.');p.milestones[pending.key]=true;message=addPart(p,a.id);
 }else if(a.kind==='draw-part'){
  check(!!p.stages.CH01?.cleared,'1-1을 성공하면 뽑기가 열려요.');check(p.gifts>0,'뽑기권이 더 필요해요.');const count=p.giftCounts.part+1,choice=count%5===0;let selected;
  if(choice){check(own(PARTS,a.id),'다섯 번째 뽑기예요. 원하는 파츠를 골라 주세요.');selected=a.id;}
  else{check(own(ELEMENTS,a.element),'원소를 골라 주세요.');const pool=Object.keys(PARTS).filter(id=>PARTS[id].element===a.element);selected=pool[Math.min(pool.length-1,Math.max(0,Math.floor(rng()*pool.length)))];}
  message=addPart(p,selected);p.gifts--;p.giftCounts.part=count;
 }else if(a.kind==='pet'){check(p.pets.includes(a.id),'아직 만나지 못한 친구예요.');p.activePet=a.id;message=`${PETS[a.id].name}와 함께 출동해요!`;}
 else if(a.kind==='choose-pet'){const pending=pendingPet(p);check(pending&&pending.ids.includes(a.id),'지금 고를 수 있는 친구가 아니에요.');p.milestones[pending.key]=true;if(pending.allOwned){p.coins+=60;message='친구를 모두 만났어요! 코인 60개';}else message=addPet(p,a.id);}
 else if(a.kind==='gift'){
  check(a.type==='pet','파츠 뽑기에서 원소를 골라 주세요.');check(!!p.stages.CH01?.cleared,'1-1을 성공하면 뽑기가 열려요.');check(p.gifts>0,'뽑기권이 더 필요해요.');
  const count=p.giftCounts.pet+1,choice=count%5===0,pool=Object.keys(PETS),unowned=pool.filter(id=>!p.pets.includes(id));check(!choice||!unowned.length||unowned.includes(a.pet),'아직 없는 친구를 골라 주세요.');
  if(choice&&!unowned.length){p.coins+=60;message='모든 친구를 만났어요! 코인 60개';}else message=addPet(p,choice?a.pet:pool[Math.min(5,Math.max(0,Math.floor(rng()*6)))]);p.gifts--;p.giftCounts.pet=count;
 }else if(a.kind==='settings'){
  // 무기 원소 설정은 없앴다(2026-09-23 사용자: "무기는 근거리·원거리만"). 옛 프로필의 weaponElement 키는 지운다.
  const settings={difficulty:a.difficulty??p.difficulty,hero:a.hero??p.hero,weaponMode:a.weaponMode??p.weaponMode};
  check(own(DIFFICULTIES,settings.difficulty),'난이도를 골라 주세요.');check(['hoya','minji'].includes(settings.hero),'주인공을 골라 주세요.');check(['melee','ranged'].includes(settings.weaponMode),'공격 방식을 골라 주세요.');Object.assign(p,settings);delete p.weaponElement;
 }else throw new Error('할 수 없는 작업이에요.');
 return {profile:p,message};
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
 if(!Object.keys(skills).length){for(let i=0;i<3;i++)takeWeighted(pool.filter(c=>c.kind==='skill-new'),pool,selected,rng);}   // 첫 선택은 스킬만
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

