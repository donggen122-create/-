import * as R from './rework-core.js';
import { isUI2, art2, preloadUI2 } from './ui2-art.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=o=>Object.entries(o||{}),modern=id=>/^(element_|skill_|part_|combo_|mode_)/.test(id);
const legacyIcon=(id,cls='')=>`<img class="sg-icon ${cls}" src="./assets/${modern(id)?'elements_v2':'seoho_v1'}/icons/${esc(id)}.svg" alt="" />`;
export const icon2=(name,fallbackSvgId,cls='')=>isUI2()?art2(name,cls):legacyIcon(fallbackSvgId,cls);
export const icon=(id,cls='')=>{
  const name={pass:'cur_pass',coin:'cur_coin',gift:'cur_gift'}[id] || (/^element_(fire|water|earth|wind|lightning)$/.test(id)?id.replace('element_','el_'):null);
  return name?icon2(name,id,cls):legacyIcon(id,cls);
};
export const petImage=(id,cls='')=>`<img class="sg-pet ${cls}" src="./assets/seoho_v1/pets/${esc(id)}_idle.png" alt="${esc(R.PETS[id]?.name||id)}" />`;
const stars=n=>'★'.repeat(Math.max(0,Math.min(3,n)))+'☆'.repeat(Math.max(0,3-n));
// 스킬·지원품·진화·파츠 아이콘은 사용자 Gemini 그림(assets/sprites/skills)을 그대로 쓴다
const spriteImg=(d,cls='')=>d?.sprite?`<img class="sg-icon ${cls}" src="./assets/sprites/skills/${esc(d.sprite)}.png" alt="" />`:'';
const skillIcon=id=>spriteImg(R.SKILLS[id]||R.COMBOS[id])||icon(`skill_${id}`),partIcon=id=>spriteImg(R.PARTS[id])||icon(`part_${id}`),supportIcon=id=>spriteImg(R.SUPPORTS[id]),elementName=id=>R.ELEMENTS[id]?.name||'기본';
const elements=()=>entries(R.ELEMENTS).filter(([id])=>id!=='neutral');
const desc=d=>d.desc||d.behavior||'',ingredients=d=>d.ingredients||d.skills||[],partSkill=d=>d.skill||d.skillId;
const gradeName=c=>R.GRADE_NAMES[R.grade(c)];
// 등급(노말·레어·유니크·에픽·전설) 표시와 다음 등급까지 남은 개수
const medal=c=>`<span class="sg-medal sg-medal-${R.grade(c)}">${gradeName(c)}</span>`;
const toNext=c=>{const n=R.nextGradeAt(c||0);return n?{left:n-(c||0),name:R.GRADE_NAMES[R.grade(n)]}:null;};
const gradeLadder=()=>`<div class="sg-grade-ladder" aria-label="등급">${R.GRADE_NAMES.map((n,i)=>`<span class="sg-medal sg-medal-${i}">${n}<small>${R.GRADE_COPIES[i]}개</small></span>`).join('<i>›</i>')}</div>`;
const ownedKinds=p=>Object.keys(R.PARTS).filter(id=>p.parts?.[id]?.copies>0);
// 받침에 맞는 목적격 조사(물대포를 · 불꽃병을)
const subjJosa=s=>{const t=String(s||''),c=t.charCodeAt(t.length-1)-0xAC00;return c>=0&&c<11172&&c%28===0?'가':'이';};   // 전설이 · 레어가
const objJosa=s=>{const t=String(s||''),c=t.charCodeAt(t.length-1)-0xAC00;return c>=0&&c<11172&&c%28===0?'를':'을';};
const partBonus=d=>Math.round(((d?.level||1)-1)*R.PART_LEVEL_STEP*100+R.GRADE_DAMAGE[R.grade(d?.copies||1)]*100);
// 등급 능력 한 줄(노말~전설). 숫자는 rework-core의 GRADE_DAMAGE·GRADE_INTERVAL·LEGEND_EXTRA_CAST를 그대로 쓴다.
const gradeAbility=g=>{const dmg=Math.round(R.GRADE_DAMAGE[g]*100),fast=Math.round((1-R.GRADE_INTERVAL[g])*100);return [dmg?`피해 +${dmg}%`:'기본 파츠 기능',fast?`발동 ${fast}% 빠르게`:'',g>=2?(g>=3?'유니크 기능 강화(추가 공격 피해 2배)':'유니크 기능'):'',g>=4?`${Math.round(R.LEGEND_EXTRA_CAST*100)}% 확률로 한 번 더 발동(팽이·벌은 +2개)`:''].filter(Boolean).join(' · ');};
const partOptions=(p,preferUsed=false)=>entries(R.PARTS).sort(([ai,a],[bi,b])=>Number((p.parts?.[ai]?.copies||0)>=R.LEGEND_COPIES)-Number((p.parts?.[bi]?.copies||0)>=R.LEGEND_COPIES)||(preferUsed?(p.skillUsage?.[partSkill(b)]||0)-(p.skillUsage?.[partSkill(a)]||0):0)).map(([id,d])=>`<option value="${id}" ${(p.parts?.[id]?.copies||0)>=R.LEGEND_COPIES?'disabled':''}>${(p.parts?.[id]?.copies||0)>=R.LEGEND_COPIES?'전설 · ':''}${preferUsed&&p.skillUsage?.[partSkill(d)]?'사용한 스킬 · ':''}${esc(d.name)}</option>`).join('');
// ---- 장비(2026-09-24, docs/34) ----
// 아이콘: 사용자 Gemini 그림(2026-09-24, game/tools/cut_gear.py → assets/sprites/gear/gear_<id>.png) 24개. GEAR_ART에 없는 id는 칸 모양 임시 그림(세트 색 바탕).
const GEAR_ART=new Set(Object.keys(R.GEAR));
const GEAR_PATHS={helm:'<path d="M4 15a8 8 0 0 1 16 0z"/><rect x="2" y="15" width="20" height="3" rx="1.5"/>',armor:'<path d="M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
 shoes:'<path d="M3 16V8h5l2 4 8 1.5a3 3 0 0 1 3 2.5z"/><rect x="3" y="17" width="18" height="3" rx="1.5"/>',gloves:'<path d="M7 21v-7l-3-3 1.5-1.5L8 12V5.5a1.5 1.5 0 0 1 3 0V11V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-2 4.5V21z"/>',
 necklace:'<path d="M5 3c0 6 3 9 7 9s7-3 7-9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="16" r="4"/>',ranged:'<circle cx="12" cy="12" r="8"/><path d="M8 5.5c2.6 3.4 2.6 9.6 0 13M16 5.5c-2.6 3.4-2.6 9.6 0 13" fill="none" stroke="#0005" stroke-width="1.4"/>',
 melee:'<path d="M20 2v3l-9 9 2 2-1.5 1.5-2-2-3 3L5 17l3-3-2-2L7.5 10.5l2 2 9-9z"/>'};
const gearSvg=key=>`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${GEAR_PATHS[key]}</svg>`;
export const gearIcon=(id,cls='')=>{const it=R.GEAR[id];if(!it)return '';if(GEAR_ART.has(id))return `<span class="sg-gear-icon has-art ${cls}" style="--set:${it.color}"><img src="./assets/sprites/gear/${esc(it.icon)}.png" alt="" loading="lazy" /></span>`;return `<span class="sg-gear-icon ${cls}" style="--set:${it.color}">${gearSvg(it.slot==='weapon'?it.type:it.slot)}</span>`;};
const slotIcon=s=>`<span class="sg-gear-icon sg-gear-empty">${ui2()?art2('slot_'+s):gearSvg(s==='weapon'?'melee':s)}</span>`;
const GEAR_STAT={critPct:'치명타 확률',hpPct:'최대 체력',speedPct:'이동 속도',intervalPct:'공격 간격',atkSpeedPct:'공격 속도',dmgPct:'모든 피해',weaponDmgPct:'기본 무기 피해',weaponRangePct:'기본 무기 사거리',weaponArcPct:'휘두르기 범위',takenPct:'받는 피해',regenPct:'초당 체력 회복',critDmgPct:'치명타 피해',searchRangePct:'스킬이 적 찾는 거리',contactCapPct:'부딪혀 잃는 체력 상한'};
const pctText=v=>{const x=Math.round(v*1000)/10;return `${x>0?'+':''}${x}%`;};
const gearStat=(k,v)=>GEAR_STAT[k]?`${GEAR_STAT[k]} ${pctText(k==='intervalPct'?-v:v)}`:'';
const gearBase=(it,g)=>entries(it.max).map(([k,v])=>gearStat(k,R.gearValue(v,Math.max(0,g)))).join(' · ');
// 특수 효과 한 줄: 유니크(등급 2) 기본 → 에픽 강화 → 전설 추가
const gearSpecialLines=(it,g)=>['유니크','에픽','전설'].map((n,i)=>({name:n,text:it.special.text[i],on:g>=i+2}));
const typeName=t=>t==='ranged'?'원거리':'근거리';
const heroName=h=>h==='minji'?'민지':'호야';
// 보급 결과 등급 색(노말 회색 · 레어 파랑 · 유니크 보라 · 에픽 주황 · 전설 금색) — 결과가 보인 뒤에만 쓴다
const SUPPLY_COLORS=['#9aa8b1','#4f95d6','#9a6bd6','#ec8a3a','#e0b53c'];
// 보급 상자 그림(사용자 Gemini 2026-09-24, cut_gear.py): 파츠 = 선물 상자(닫힘·뚜껑·열림), 장비 = 보물 상자(닫힘·열림). 첫 보급 때 비어 보이지 않게 미리 불러 둔다.
const SUPPLY_BOX=(box,kind)=>`./assets/sprites/ui/supply_${box==='gear'?'gear':'part'}_${kind}.png`;
let supplyPreloaded=false;const preloadSupply=()=>{if(supplyPreloaded||typeof Image==='undefined')return;supplyPreloaded=true;for(const b of ['part','gear'])for(const k of ['closed','open','lid'])if(!(b==='gear'&&k==='lid'))new Image().src=SUPPLY_BOX(b,k);};   // 파츠·장비 탭을 처음 열 때
const starText=n=>'★'.repeat(Math.max(0,Math.min(3,n)));

// 모험 장(챕터) — 2026-09-23 밤 사용자 "챕터 이동 버튼, 스테이지 UI 색감도 테마 분위기에 맞게". 1장은 지금 단계(R.STAGES),
// 2장 대기오염 공장 지대는 그림이 오면 연다(이미지 에셋/테마2_대기오염_프롬프트.md). 색은 rework.css의 .sg-theme-1 ~ .sg-theme-4.
// short = 휴대폰(760px 이하)·세로 태블릿 장 단추 이름. 좁은 화면(920px 이하)에서는 장 단추를 2개씩 보여 주고 ‹ › 로 넘긴다(2026-10-07 사용자, chapterBar).
const CHAPTERS=[
 {n:'1',from:0,eyebrow:'CHAPTER 01',name:'쓰레기 마을',short:'쓰레기 마을',title:'다섯 원소로 지키는 마을',sub:'이동에 집중하세요. 공격은 자동으로, 스킬은 내 선택으로.',art:'t1',pictures:['en_snackbag','en_buttbug','en_bottle','en_baggy','boss_calm']},
 {n:'2',from:5,eyebrow:'CHAPTER 02',name:'대기오염 공장 지대',short:'대기오염',title:'매연을 걷어 내는 공장 지대',sub:'굴뚝마다 시커먼 매연! 먼지몬·가스몬·세균몬을 정화하고 맑은 공기를 되찾아요.',art:'t2',pictures:['en_dust','en_gas','en_germ','en_raincloud','boss_calm']},
 {n:'3',from:10,eyebrow:'CHAPTER 03',name:'오염된 하천',short:'오염된 하천',title:'물고기가 돌아오는 맑은 개울',sub:'세제 거품·기름·버려진 그물로 개울이 아파요! 우리 학교 친구들이 만든 하천 몬스터를 정화하고 걸린 물고기를 구해요.',art:'t3',pictures:['en_bubble','en_petri','en_net','en_netmon','boss_calm']},
 {n:'4',from:15,eyebrow:'CHAPTER 04',name:'불타는 숲',short:'불타는 숲',title:'새싹이 다시 돋는 초록 숲',sub:'버려진 캠핑 쓰레기·벌목·외래종·산불로 숲이 아파요! 우리 학교 친구들이 만든 숲 몬스터를 정화하고 타는 불씨를 꺼요.',art:'t4',pictures:['en_burner_m','en_saw','en_dozer','en_bulki','boss_calm']},
];
const chapterStages=c=>R.STAGES.slice(c.from,c.from+5);
const ui2=isUI2;   // UI v2 미리 보기(index.html ?ui=2)
export class GuardianUI {
  constructor(menu,callbacks){
    preloadUI2();
    this.c=callbacks;this.tab='adventure';this.stage='CH01';this.chapter='1';this.element='fire';this.partFilter='all';this.bookFilter='all';this.bookTab='skills';this.busy=false;
    menu.classList.add('sg-mode');this.root=document.createElement('div');this.root.id='guardian-lobby';menu.append(this.root);
    this.dialog=document.createElement('dialog');this.dialog.className='sg-dialog';document.body.append(this.dialog);
    this.dialog.addEventListener('click',e=>{if(e.target===this.dialog&&!this.dialog.dataset.lock)this.dialog.close();});
    this.dialog.addEventListener('cancel',e=>{if(this.dialog.dataset.lock)e.preventDefault();});
    this.root.addEventListener('click',e=>this.click(e));
    this.root.addEventListener('change',e=>{
      if(e.target.id==='sg-difficulty')this.setDifficulty(e.target.value);
    });
  }
  state(){return this.c.getState();}
  // UI v2(ui-v2.css): 지금 탭·장을 root에 적어 두면 화면 뒤 장 그림을 CSS가 고른다(장 5단계를 정화했으면 맑은 그림)
  markRoot(p){const ch=CHAPTERS.find(c=>c.n===String(this.chapter))||CHAPTERS[0];this.root.dataset.tab=this.tab;this.root.dataset.chapter=ch.n;this.root.dataset.cleared=p?.stages?.[chapterStages(ch)[4].id]?.cleared?'1':'0';}
  setDifficulty(id){
    if(!R.DIFFICULTIES[id])return;this.diffPick=id;
    this.root.querySelectorAll('.sg-diff-btn').forEach(x=>{const on=x.dataset.diff===id;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});
    const inp=this.root.querySelector('#sg-difficulty');if(inp)inp.value=id;
    const hr=this.root.querySelector('#sg-hard-ready');if(hr)hr.innerHTML=this.hardArea(this.state().profile,this.stage,id);
  }
  openDialog(markup,lock=false){this.dialog.classList.remove('sg-wide');if(lock)this.dialog.dataset.lock='1';else delete this.dialog.dataset.lock;this.dialog.innerHTML=markup;this.dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>this.dialog.close());if(!this.dialog.open)this.dialog.showModal();this.dialog.scrollTop=0;}   // 긴 창이 아래 버튼으로 스크롤돼 제목이 잘리지 않게
  notify(title,text){this.openDialog(`<h2>${esc(title)}</h2><p>${esc(text||'서버에 저장했어요.')}</p><button class="sg-primary" data-close>확인</button>`);}
  render(){
    const {profile:p,passes,user,error}=this.state();
    if(!p){this.root.innerHTML=`<div class="sg-loading"><h1>수호대 기록을 불러오는 중</h1><p>${esc(error||'잠시만 기다려 주세요.')}</p><button data-do="refresh">다시 확인</button></div>`;return;}
    if(p.testMode){this.renderTest(p,passes,user);return;}   // 밸런스 시험 계정: 전용 로비(친구 등급 바꾸기 · 1-5 어려움 출동만)
    if(!R.stageUnlocked(p,this.stage))this.stage='CH01';
    const pendingPet=R.pendingPet(p),pendingPart=R.pendingPart(p);
    this.markRoot(p);
    this.root.innerHTML=`<header class="sg-header"><div class="sg-brand">${ui2()?'<img class="sg-ui2-emblem" src="./assets/ui2/emblem.png" alt=""/>':icon('element_wind')}<span>서호팡팡<small>수호대</small></span></div><div class="sg-wallet"><button data-do="passes" aria-label="이용권 안내">${icon('pass')}<b>${passes?.remaining??'…'}</b><span>${passes?.event?'추석 2배':'이용권'}</span></button><div>${icon('coin')}<b>${p.coins.toLocaleString()}</b><span>코인</span></div><button data-tab="parts" aria-label="파츠 보급과 보급권">${icon('gift')}<b>${p.gifts}</b><span>보급권</span></button></div><button class="sg-account" data-do="account" aria-label="계정과 캐릭터 선택">${ui2()?`${art2('fn_settings','sg-account-settings')}<img class="sg-ui2-avatar" src="./assets/ui/title_${p.hero==='minji'?'minji':'hoya'}.png" alt=""/><span>${p.hero==='minji'?'민지':'호야'}<small>${esc(user)}</small></span>`:`${esc(user)} 님`}</button></header>
    <main class="sg-main" aria-live="polite">${this.nextTask(p)}${this[this.tab](p,passes)}</main>
    <nav class="sg-nav" aria-label="수호대 메뉴">${[['adventure','map','모험'],['training','mode_melee','훈련'],['parts','part_PART_F1','파츠'],['gear','shield','장비'],['friends','heart','친구'],['book','book','도감']].map(([id,im,label])=>`<button data-tab="${id}" class="${this.tab===id?'on':''}" aria-current="${this.tab===id?'page':'false'}">${icon2('nav_'+id,im)}<span>${label}${id==='parts'&&p.gifts>0?` <b class="sg-count-badge" aria-label="보급권 ${p.gifts}장">${p.gifts}</b>`:''}${id==='gear'&&this.gearAlert(p)?' <b class="sg-count-badge" aria-label="장비 할 일">!</b>':''}${id==='friends'&&pendingPet?' <b class="sg-count-badge" aria-label="친구 고르기">!</b>':''}</span></button>`).join('')}</nav>`;
    if(this.busy)this.root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
  }
  // 밸런스 시험 계정 로비(2026-09-29): 친구 1마리의 등급만 바꾸고 1-5 어려움만 출동. 다른 조작은 서버도 막는다(rework-core action).
  renderTest(p,passes,user){
    if(p.testMode.kind==='gear'){this.renderGearTest(p,passes,user);return;}
    const pet=p.testMode.pet,d=R.PETS[pet],g=R.testGrade(p),rate=R.PET_GRADE_RATE[Math.max(0,g)];this.stage=p.testMode.stage;
    this.root.innerHTML=`<header class="sg-header"><div class="sg-brand">${icon('element_wind')}<span>서호팡팡<small>시험 계정</small></span></div><div class="sg-wallet"><button data-do="passes" aria-label="시험 이용권 안내">${icon('pass')}<b>${passes?.remaining??'…'}</b><span>${passes?.test?`/ ${passes.total} 시험 이용권`:'이용권'}</span></button></div><button class="sg-account" data-do="account" aria-label="계정">${esc(user)} 님</button></header>
    <main class="sg-main sg-test" aria-live="polite">
      <div class="sg-heading"><div><span class="sg-eyebrow">밸런스팀 시험 계정</span><h1>친구 등급별 성공률 조사</h1><p>1-5 쓰레기 대장 구출 · 어려움만 할 수 있어요. 등급을 고르고 5판씩 해요.</p></div></div>
      <section class="sg-test-card">
        <div class="sg-test-pet">${petImage(pet)}<div><small>내가 맡은 친구</small><h2>${esc(d.name)}</h2><span>${esc(d.role)}</span></div></div>
        <div class="sg-test-grade"><small>지금 등급</small><b class="sg-grade-${g}">${esc(R.GRADE_NAMES[g]??'없음')}</b><span>전설의 ${Math.round(rate*100)}% 힘 · ${esc(R.petBuffText(pet,g))}</span><button class="sg-primary" data-do="test-grade">등급 바꾸기</button></div>
      </section>
      <section class="sg-test-rules"><h3>모든 시험 계정이 같은 조건</h3><ul><li>1-5 어려움만 출동 · 6:00 안에 대왕을 정화하면 성공</li><li>시험 이용권 ${passes?.total??25}장 · 출동할 때마다 1장(중간에 끝내도 1장) · 다시 채워지지 않아요</li><li>훈련 공격·체력·이동 속도 ${p.training.attack}단계</li><li>근거리 장비 6칸 ${esc(R.GRADE_NAMES[R.gearGrade(p,p.equippedGear?.weapon)]??'')} · 파츠 없음</li><li>훈련·보급·장비·파츠는 바꿀 수 없어요. 친구 등급만 바꿔요.</li></ul></section>
      <select id="sg-difficulty" style="display:none" aria-hidden="true"><option value="hard" selected>어려움</option></select><select id="sg-weapon-mode" style="display:none" aria-hidden="true"><option value="melee" selected>근거리</option></select>
      <button class="sg-primary sg-start sg-test-start" data-do="start">1-5 어려움 출동 · ${esc(d.name)} ${esc(R.GRADE_NAMES[g]??'')}</button>
    </main>`;
    if(this.busy)this.root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
  }
  // 장비 시험 계정 로비(2026-10-02 사용자 "친구 없이 장비만 · 근거리 10판 + 원거리 10판 · 등급은 계정마다 고정"): 세트(근거리/원거리)만 바꾸고 정해진 단계만 출동. 세트마다 10판(서버가 셈).
  renderGearTest(p,passes,user){
    const t=p.testMode,type=p.weaponMode==='ranged'?'ranged':'melee',g=Math.max(0,R.testGrade(p)),per=passes?.perType??t.perType??10,by=passes?.byType||{},done=by[type]?.n||0,left=Math.max(0,per-done);this.stage=t.stage;
    const names={melee:'근거리',ranged:'원거리'},other=type==='melee'?'ranged':'melee',heroName=p.hero==='minji'?'민지':'호야',diffName=({easy:'쉬움',normal:'보통',hard:'어려움'})[t.difficulty]||'어려움';
    const label=R.stageLabel(t.stage),stageName=R.STAGES.find(s=>s.id===t.stage)?.name||'',allDone=['melee','ranged'].every(k=>(by[k]?.n||0)>=per),set=R.GEAR_SETS[`${p.hero}_${type}`];
    this.root.innerHTML=`<header class="sg-header"><div class="sg-brand">${icon('element_wind')}<span>서호팡팡<small>시험 계정</small></span></div><div class="sg-wallet"><button data-do="passes" aria-label="시험 이용권 안내">${icon('pass')}<b>${passes?.remaining??'…'}</b><span>${passes?.test?`/ ${passes.total} 시험 이용권`:'이용권'}</span></button></div><button class="sg-account" data-do="account" aria-label="계정">${esc(user)} 님</button></header>
    <main class="sg-main sg-test" aria-live="polite">
      <div class="sg-heading"><div><span class="sg-eyebrow">밸런스팀 시험 계정</span><h1>장비 성공률 조사</h1><p>친구 없이 장비만! ${label} ${esc(stageName)} · ${diffName}만 할 수 있어요. 근거리 ${per}판, 원거리 ${per}판을 해요.</p></div></div>
      <section class="sg-test-card">
        <div class="sg-test-grade"><small>내가 맡은 장비 등급</small><b class="sg-grade-${g}">${esc(R.GRADE_NAMES[g])}</b><span>전설의 ${Math.round(R.GEAR_GRADE_RATE[g]*100)}% 힘 · 등급은 바꿀 수 없어요</span></div>
        <div class="sg-test-gear"><small>지금 낀 장비</small><h2>${esc(heroName)} · ${esc(set?.name??'')}</h2><span>${names[type]} 6칸 · 친구 없음</span><div class="sg-test-gear-icons">${R.GEAR_SLOTS.map(s=>gearIcon(p.equippedGear?.[s])).join('')}</div></div>
      </section>
      <section class="sg-test-types" aria-label="장비 종류 고르기">${['melee','ranged'].map(k=>{const b=by[k]||{n:0,won:0};return `<button data-test-type="${k}" class="${k===type?'on':''} ${b.n>=per?'done':''}" ${k===type?'aria-pressed="true"':''}><b>${names[k]}</b><span>${b.n} / ${per}판</span><small>성공 ${b.won}</small></button>`;}).join('')}</section>
      <section class="sg-test-rules"><h3>모든 시험 계정이 같은 조건(장비 등급만 달라요)</h3><ul><li>${label} ${diffName}만 출동 · 6:00 안에 대왕을 정화하면 성공</li><li>근거리 ${per}판 + 원거리 ${per}판 · 시험 이용권 ${passes?.total??20}장(출동할 때마다 1장, 중간에 끝내도 1장) · 다시 채워지지 않아요</li><li>훈련 공격·체력·이동 속도 ${p.training.attack}단계 · 친구 없음 · 파츠 없음</li><li>근거리·원거리만 바꿀 수 있어요. 위 단추를 눌러 바꿔요.</li></ul></section>
      <select id="sg-difficulty" style="display:none" aria-hidden="true"><option value="${esc(t.difficulty)}" selected>${diffName}</option></select><select id="sg-weapon-mode" style="display:none" aria-hidden="true"><option value="${type}" selected>${names[type]}</option></select>
      ${left>0?`<button class="sg-primary sg-start sg-test-start" data-do="start">${label} ${diffName} 출동 · ${names[type]} (${done+1} / ${per}판째)</button>`:allDone?`<button class="sg-primary sg-start sg-test-start" data-do="passes">${per*2}판을 모두 했어요. 수고했어요!</button>`:`<button class="sg-primary sg-start sg-test-start" data-test-type="${other}">${names[type]} ${per}판 끝! ${names[other]}로 바꿔요</button>`}
    </main>`;
    if(this.busy)this.root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
  }
  testGradeDialog(){
    const p=this.state().profile;if(!p?.testMode)return;const pet=p.testMode.pet,now=R.testGrade(p);
    this.openDialog(`<h2>${esc(R.PETS[pet].name)} 등급 고르기</h2><p>고르면 바로 바뀌어요. 기록표에 적은 등급과 같은지 꼭 확인해요.</p><div class="sg-test-grades">${R.GRADE_NAMES.map((n,i)=>`<button data-test-grade="${i}" class="sg-grade-${i} ${i===now?'on':''}"><b>${esc(n)}</b><small>카드 ${R.CARD_COPIES[i]}장 · 힘 ${Math.round(R.PET_GRADE_RATE[i]*100)}%</small></button>`).join('')}</div><button data-close>닫기</button>`);
    this.dialog.querySelectorAll('[data-test-grade]').forEach(b=>b.onclick=async()=>{this.dialog.close();await this.perform({kind:'test-pet-grade',grade:Number(b.dataset.testGrade)});});
  }
  nextTask(p){
    const available=R.selectableParts(p).length;
    let task=null;
    if(!R.heroLocked(p))task={tab:'gear',text:'함께할 캐릭터 고르기(호야 · 민지)',hero:true};
    else if(R.pendingPart(p)&&available)task={tab:'parts',text:'첫 성공 보상 · 원하는 파츠 1개 받기',first:true};
    else if(!p.milestones?.firstGear)task={tab:'gear',text:'첫 장비 · 원거리·근거리 무기 1개씩 무료로 받기'};
    else if(R.pendingPet(p))task={tab:'friends',text:'함께 출동할 첫 친구 고르기'};
    else if(p.stages.CH01?.cleared&&p.gifts>0&&available)task={tab:'parts',text:`보급권 ${p.gifts}장이 있어요 · 파츠 보급 받으러 가기`,gifts:true};
    else if(R.runParts(p).length<3&&Object.keys(p.parts).some(id=>R.PARTS[id]&&!p.equippedParts.includes(id)))task={tab:'parts',text:'빈 파츠 칸에 가진 파츠 끼우기'};
    else if(R.gearIdsFor(p.hero).some(id=>R.gearMergeReady(p,id)))task={tab:'gear',text:'장비를 합성해 등급을 올릴 수 있어요'};
    if(!task||(!task.first&&!task.hero&&(this.tab===task.tab||(['gear','friends'].includes(this.tab)&&task.gifts))))return '';   // 장비·친구 탭에는 보급 줄이 바로 있어 보급권 안내는 숨긴다
    return `<button class="sg-milestone sg-next-task" ${task.hero?'data-do="hero-dialog"':task.first?'data-do="first-part-dialog"':`data-tab="${task.tab}"`}>${icon('gift')}<span><small>다음 할 일</small><strong>${esc(task.text)} →</strong></span></button>`;
  }
  firstPartDialog(){
    const p=this.state().profile;if(!R.pendingPart(p))return;
    this.openDialog(`<div class="sg-first-heading"><h2>첫 파츠를 골라요</h2><button data-close>나중에</button></div><p>원하는 파츠 1개를 무료로 받아요. 빈 칸이 있으면 바로 장착해요.</p><div class="sg-first-grid">${entries(R.PARTS).map(([id,d])=>`<button data-first-part="${id}" ${(p.parts?.[id]?.copies||0)>=R.LEGEND_COPIES?'disabled':''}>${partIcon(id)}<b>${esc(d.name)}</b><small>${esc(R.SKILLS[d.skill].name)}${p.parts?.[id]?.copies?` · ${p.parts[id].copies}개`:''}</small><span>${esc(d.desc)}</span>${(p.parts?.[id]?.copies||0)>=R.LEGEND_COPIES?'<small>이미 전설이에요</small>':''}</button>`).join('')}</div><button data-close>나중에</button>`);
    this.dialog.querySelectorAll('[data-first-part]').forEach(button=>button.onclick=async()=>{
      if(this.busy)return;this.dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
      this.dialog.close();await this.perform({kind:'choose-part',id:button.dataset.firstPart});
    });
  }
  // 장 이동 막대: ‹ [1장 쓰레기 마을] [2장 대기오염 공장 지대] ›
  // 좁은 화면(rework.css 920px 이하)은 지금 장이 든 2개 묶음만 보인다(sg-page-off는 숨김) — ‹ › 로 장을 옮기면 다음 묶음이 보인다.
  chapterBar(p,cur){
    const i=CHAPTERS.indexOf(cur),prev=CHAPTERS[i-1],next=CHAPTERS[i+1],page=Math.floor(i/2);
    const state=c=>{const st=chapterStages(c);return R.stageUnlocked(p,st[0].id)?`${st.filter(s=>p.stages[s.id]?.cleared).length} / 5 정화`:`${Number(c.n)-1}-5 정화 후 열림`;};
    return `<nav class="sg-chapter-bar" aria-label="장 이동"><button class="sg-chapter-arrow" ${prev?`data-chapter="${prev.n}"`:'disabled'} aria-label="이전 장">‹</button><div class="sg-chapter-chips">${CHAPTERS.map((c,k)=>`<button class="sg-chapter-chip sg-chip-${c.n} ${c===cur?'on':''} ${Math.floor(k/2)!==page?'sg-page-off':''}" data-chapter="${c.n}" aria-current="${c===cur?'true':'false'}"><b>${c.n}장</b><span><i class="sg-long">${esc(c.name)}</i><i class="sg-short">${esc(c.short)}</i></span><small>${state(c)}</small></button>`).join('')}</div><button class="sg-chapter-arrow" ${next?`data-chapter="${next.n}"`:'disabled'} aria-label="다음 장">›</button></nav>`;
  }
  lockedChapter(p,c,stages){
    return `${this.titleBar(c.title,'data-info="adventure"','<span class="sg-progress">잠김</span>')}
    <div class="sg-stage-map">${stages.map((s,i)=>`<button class="sg-stage" disabled aria-label="${c.n}-${i+1} ${esc(s.name)} 잠김"><span class="sg-stage-number">${c.n}-${i+1}</span><img src="./assets/sprites/${c.art}/${c.pictures[i]}.png" alt=""/><strong>${esc(s.name)}</strong><span class="sg-stars">앞 장 정화 후</span></button>`).join('')}</div>
    <div class="sg-departure"><div class="sg-hero-scene sg-chapter-art" aria-hidden="true"></div><div class="sg-brief"><div class="sg-brief-title"><span class="sg-stage-tag">${c.n}장</span><h2>${esc(c.name)}</h2></div><p class="sg-story">${esc(stages[0].story)}</p><div class="sg-goal">${icon2('fn_clean','element_wind')} ${esc(stages[0].goal)}</div><button class="sg-primary sg-start" disabled>${Number(c.n)-1}-5 대왕을 정화하면 열려요</button></div></div>`;
  }
  adventure(p,passes){
    // 처음 로비에 오면 열린 가장 뒤 장을 보여 준다(장 단추를 누르면 그 장). 장을 바꾸면 그 장에서 열린 가장 뒤 단계를 고른다.
    if(!this.chapterPicked)this.chapter=[...CHAPTERS].reverse().find(c=>R.stageUnlocked(p,chapterStages(c)[0].id))?.n||'1';
    const chapter=CHAPTERS.find(c=>c.n===String(this.chapter))||CHAPTERS[0],stages=chapterStages(chapter);
    if(!stages.some(s=>s.id===this.stage))this.stage=[...stages].reverse().find(s=>R.stageUnlocked(p,s.id))?.id||stages[0].id;
    const body=R.stageUnlocked(p,stages[0].id)?this.chapterView(p,passes,chapter,stages):this.lockedChapter(p,chapter,stages);
    return `<div class="sg-adventure sg-theme-${chapter.n}">${this.chapterBar(p,chapter)}${body}</div>`;
  }
  chapterView(p,passes,chapter,stages){
    const st=R.STAGES.find(s=>s.id===this.stage),duration=R.durationFor(p,st.id),done=stages.filter(s=>p.stages[s.id]?.cleared).length,pictures=chapter.pictures,label=`${chapter.n}-${stages.indexOf(st)+1}`;
    const weaponGear=R.GEAR[p.equippedGear?.weapon],mode=weaponGear?weaponGear.type:(p.weaponMode||'melee'),gate=R.hardGate(p,st.id),difficulty=this.pickDifficulty(p,gate);
    const left=passes?.day?R.stageGiftLeft(p,st.id,passes.day):null;
    // 난이도: 단추 3개(잠긴 어려움은 🔒 — 누르면 여는 조건 창). 출동 때 읽는 값은 숨은 칸 #sg-difficulty
    const diffs=entries(R.DIFFICULTIES).map(([id,d])=>{const lock=id==='hard'&&!gate.open;return `<button class="sg-diff-btn ${difficulty===id?'on':''}" data-diff="${id}" ${lock?'data-locked="1"':''} aria-pressed="${difficulty===id}">${esc(d.name)}<i>${lock?'🔒':starText(d.stars)}</i></button>`;}).join('');
    // 기본 무기: 무기 장비가 있으면 그 장비 한 줄(바꾸기 → 장비 탭), 없으면 고르는 칸
    const weapon=weaponGear?`<div class="sg-brief-row sg-weapon-chip">${gearIcon(p.equippedGear.weapon)}<span><small>기본 무기 · ${typeName(mode)}</small><b>${esc(weaponGear.name)}</b></span><button class="sg-inline" data-tab="gear">바꾸기</button><input type="hidden" id="sg-weapon-mode" value="${mode}"/></div>`
      :`<label class="sg-brief-row sg-weapon-select"><span class="sg-field-label">기본 무기</span><select id="sg-weapon-mode"><option value="melee" ${mode==='melee'?'selected':''}>근거리 · ${p.hero==='minji'?'연필':'검'}</option><option value="ranged" ${mode==='ranged'?'selected':''}>원거리 · ${p.hero==='minji'?'피구공':'야구 배트'}</option></select></label>`;
    return `${this.titleBar(chapter.title,'data-info="adventure"',`<span class="sg-progress">${done} / 5 정화</span>${this.missionButton(p,passes)}`)}
    <div class="sg-stage-map">${stages.map((s,i)=>{const open=R.stageUnlocked(p,s.id);return `<button class="sg-stage ${s.id===this.stage?'selected':''} ${p.stages[s.id]?.cleared?'cleared':''}" data-stage="${s.id}" ${open?'':'disabled'} aria-label="${chapter.n}-${i+1} ${esc(s.name)}${open?'':' 잠김'}"><span class="sg-stage-number">${chapter.n}-${i+1}</span><img src="./assets/sprites/${chapter.art}/${pictures[i]}.png" alt=""/><strong>${esc(s.name)}</strong><span class="sg-stars">${open?stars(p.stages[s.id]?.stars||0):'앞 단계 성공 후'}</span>${open&&passes?.day&&R.stageGiftLeft(p,s.id,passes.day)<R.STAGE_GIFT_CLEARS_PER_DAY?`<small class="sg-stage-gift ${R.stageGiftLeft(p,s.id,passes.day)?'':'done'}">${R.stageGiftLeft(p,s.id,passes.day)?`오늘 보급권 ${R.stageGiftLeft(p,s.id,passes.day)}번 남음`:'오늘 보급권 끝'}</small>`:''}</button>`;}).join('')}</div>
    <div class="sg-departure"><div class="sg-hero-scene ${chapter.n!=='1'?`sg-chapter-art ${p.stages[stages[4].id]?.cleared?'clean':''}`:''}"><img class="sg-hero" src="./assets/sprites/heroes/${p.hero==='minji'?'minji':'hoya'}_idle_1.png" alt="${p.hero==='hoya'?'호야':'민지'}"/>${p.activePet?petImage(p.activePet):'<span class="sg-future-pet">1-3 성공 후<br/>친구 선택</span>'}<span>${R.heroLocked(p)?'':'<button data-do="hero-dialog" class="sg-inline">캐릭터 고르기</button>'}</span></div><div class="sg-brief">
      <div class="sg-brief-title"><span class="sg-stage-tag">${label}</span><h2>${esc(st.name)}</h2></div><p class="sg-story">${esc(st.story)}</p>
      <div class="sg-goal">${icon2('fn_clean','element_wind')} ${esc(st.goal)}</div>
      <div class="sg-brief-row sg-diff-row"><span class="sg-field-label">난이도</span><div class="sg-diff" role="group" aria-label="난이도">${diffs}</div><button class="sg-info-btn" data-info="difficulty" aria-label="난이도 설명">?</button></div><input type="hidden" id="sg-difficulty" value="${difficulty}"/><div id="sg-hard-ready">${this.hardArea(p,st.id,difficulty)}</div>
      ${weapon}
      <div class="sg-brief-row sg-reward-row">${icon('gift')}<span>${left===null?'성공하면 별과 보급권을 받아요':left?`오늘 보급권 <b>${left}번 더</b> 받아요`:'오늘 보급권은 <b>다 받았어요</b>'}</span><button class="sg-info-btn" data-info="reward" aria-label="보상 설명">?</button></div>
      <button id="sg-start" class="sg-primary sg-start" data-do="start" ${passes?.remaining>0?'':'disabled'}>${passes?.remaining===0?'내일 아침 8시에 만나요':'출동하기'} ${icon('arrow')}</button><small class="sg-pass-hint">${duration===180?'첫 성공까지 3분':R.isBossStage(st.id)?'4분 뒤 대장 등장 · 최대 6분':'5분 도전'} · 성공할 때 이용권 1장</small></div></div>`;
  }
  // 2026-09-30 로비 정리(사용자 "텍스트 뭉텅이가 너무 많아, 버튼 클릭하면 필요한 정보가 뜨게"): 탭 제목 한 줄 + ? 도움말 단추. infoAttr = 'data-info="…"' 또는 'data-do="…"'
  titleBar(title,infoAttr,side=''){return `<div class="sg-titlebar"><h1>${esc(title)}</h1>${infoAttr?`<button class="sg-info-btn" ${infoAttr} aria-label="${esc(title)} 도움말">?</button>`:''}${side?`<div class="sg-titlebar-side">${side}</div>`:''}</div>`;}
  // 고른 난이도는 이 화면에 있는 동안 기억한다(단계를 바꿔도). 어려움이 잠긴 단계면 보통으로
  pickDifficulty(p,gate){const want=R.DIFFICULTIES[this.diffPick]?this.diffPick:R.difficultyOf(p);return want==='hard'&&!gate.open?'normal':want;}
  info(key){
    const ch=CHAPTERS.find(c=>c.n===String(this.chapter))||CHAPTERS[0];
    const T={
      adventure:['게임 방법',`<p>${esc(ch.sub)}</p><p><b>조작</b> 이동만 하면 돼요. 공격은 저절로 나가요. 새싹을 모으면 카드가 떠서 원소 스킬·지원품을 골라요.</p><p><b>한 판의 칸</b> 기본 무기 1개 + 원소 스킬 4칸 + 지원품 4칸</p><p><b>진화</b> 스킬 3단계 + 짝 지원품 → 금색 진화 카드(10종). 원소 스킬 10종과 지원품 8종은 모든 단계에서 나와요.</p><p><b>이용권</b> 성공할 때만 1장 써요. 실패해도 괜찮아요.</p>`],
      reward:['성공 보상',`<p><b>별</b> 난이도만큼 받아요. 쉬움 ★ · 보통 ★★ · 어려움 ★★★. 별 하나만 받아도 다음 단계가 열려요.</p><p><b>보급권</b> 쉬움·보통 1장, 어려움 2장. 같은 단계는 하루 2번 성공까지 받아요(아침 8시에 다시).</p><p><b>코인</b> 단계 목표를 해내고 성공하면 코인 +30.</p><p><b>이용권</b> 성공할 때만 1장 써요. 실패해도 격려 보급권을 받을 수 있어요(하루 1장).</p>`],
      difficulty:['난이도',entries(R.DIFFICULTIES).map(([,d])=>`<p><b>${esc(d.name)} ${starText(d.stars)}</b> ${esc(d.desc)}</p>`).join('')+'<p class="sg-footnote">어려움은 그 단계를 보통 이상으로 성공하고 훈련을 채우면 열려요. 🔒 단추를 누르면 무엇이 더 필요한지 보여요.</p>'],
      training:['훈련',`<p><b>공격력</b> 기본 무기와 모든 공격 스킬이 강해져요.</p><p><b>체력</b> 더 오래 버티며 조합을 완성할 수 있어요.</p><p><b>이동 속도</b> 위험한 공격을 피하고 새싹을 모아요.</p><p>훈련은 항상 성공해요. 호야와 민지가 훈련 단계를 함께 써요.</p><p><b>파츠와 차이</b> 훈련은 캐릭터의 기본 능력을 높이고, 파츠는 특정 스킬에 새 기능을 더해요. 판 안에서 올린 스킬 단계는 새 도전마다 처음부터 시작해요.</p>`],
      parts:['파츠',`<p><b>장착</b> 파츠 3개까지 끼워요. 그 파츠의 스킬을 판 안에서 고르면 새 기능이 붙어요. 파츠가 없어도 모든 스킬과 진화를 쓸 수 있어요.</p><p><b>원소 짝</b> 같은 원소 2개 → 그 원소 스킬 피해 +4% · 서로 다른 원소 3개 → 최대 체력 +5%.</p><p><b>등급</b> 같은 파츠를 모으면 올라가요.</p>${gradeLadder()}${R.GRADE_NAMES.map((n,i)=>`<p class="sg-grade-row"><span class="sg-medal sg-medal-${i}">${n}</span> ${gradeAbility(i)}</p>`).join('')}<p><b>레벨</b> 1단계마다 그 스킬 피해 +3%. 파츠 이름을 누르면 자세한 효과와 레벨 되돌리기(쓴 코인을 모두 돌려받기)가 있어요.</p>`],
      book:['도감',`<p><b>한 판의 칸</b> 기본 무기 1개 + 원소 스킬 4칸 + 지원품 4칸.</p><p><b>진화</b> 원소 스킬을 3단계까지 키우고 짝 지원품을 챙기면 다음 선택에 금색 진화 카드가 나와요. 진화하면 그 스킬이 훨씬 크고 강해지고, 지원품은 그대로 남아요. 한 판에 2~3번 진화할 수 있어요.</p><p>기본 무기와 친구는 진화 재료가 아니에요. 카드를 누르면 자세한 효과가 보여요.</p>`],
    };
    const t=T[key];if(!t)return;
    this.openDialog(`<div class="sg-slot-head"><h2>${esc(t[0])}</h2><button class="sg-x" data-close aria-label="닫기">×</button></div><div class="sg-rules">${t[1]}</div><button class="sg-primary" data-close>확인</button>`);
  }
  training(p){
    const defs={attack:{name:'공격력',icon:'mode_melee',base:30,rate:.03,desc:'기본 무기와 모든 공격 스킬이 강해져요.'},hp:{name:'체력',icon:'heart',base:260,rate:.03,desc:'더 오래 버티며 조합을 완성할 수 있어요.'},speed:{name:'이동 속도',icon:'mode_ranged',base:4.5,rate:.005,desc:'위험한 공격을 피하고 경험치를 모아요.'}};
    return `${this.titleBar('훈련','data-info="training"')}<div class="sg-grid sg-training">${entries(defs).map(([id,d])=>{const lv=p.training[id],cost=(R.trainingCost||R.upgradeCost)(lv),gain=R.trainingGain(id,lv)*100,value=d.base*(1+gain/100);
      if(ui2())return `<article class="sg-panel sg-training-card" data-training="${id}">
        <div class="sg-training-stripe" aria-hidden="true"></div>
        ${art2('stat_'+id,'sg-training-art')}
        <b class="sg-training-level">Lv.${lv}<small> / ${R.TRAINING_MAX}</small></b>
        <div class="sg-training-body"><h2 class="sg-training-name">${d.name}</h2>
          <div class="sg-training-numbers"><strong class="sg-training-value">${id==='speed'?value.toFixed(2):Math.round(value)}</strong><span class="sg-training-bonus" aria-label="기본 능력 +${Number(gain.toFixed(1))}%">+${Number(gain.toFixed(1))}%</span></div>
          ${cost===null?'<div class="sg-training-max">최고 단계</div>':`<div class="sg-meter" role="meter" aria-label="${d.name} 훈련 단계" aria-valuemin="1" aria-valuemax="${R.TRAINING_MAX}" aria-valuenow="${lv}"><i style="width:${lv/R.TRAINING_MAX*100}%"></i></div>`}
          <button data-action="train" data-stat="${id}" ${cost!==null&&p.coins>=cost?'':'disabled'}>${cost===null?'최고 단계':`${art2('cur_coin')}훈련하기 · ${cost} 코인`}</button>
        </div></article>`;
      return `<article class="sg-panel"><div class="sg-panel-title">${icon(d.icon)}<span class="sg-eyebrow">${d.name}</span><b>Lv.${lv} <small>/ ${R.TRAINING_MAX}</small></b></div><h2>${id==='speed'?value.toFixed(2):Math.round(value)}</h2><span class="sg-stat-increase">기본 능력 +${Number(gain.toFixed(1))}%</span><div class="sg-meter" role="meter" aria-label="${d.name} 훈련 단계" aria-valuemin="1" aria-valuemax="${R.TRAINING_MAX}" aria-valuenow="${lv}"><i style="width:${lv/R.TRAINING_MAX*100}%"></i></div><button data-action="train" data-stat="${id}" ${cost!==null&&p.coins>=cost?'':'disabled'}>${cost===null?'최고 단계':`훈련하기 · ${cost} 코인`}</button></article>`;}).join('')}</div>`;
  }
  elementFilter(current,attribute){return `<div class="sg-element-filter" aria-label="원소별 보기"><button data-${attribute}="all" class="${current==='all'?'on':''}">전체</button>${elements().map(([id,d])=>`<button data-${attribute}="${id}" class="${current===id?'on':''}">${icon(`element_${id}`)}${esc(d.name)}</button>`).join('')}</div>`;}
  parts(p,passes){
    preloadSupply();
    const equipped=p.equippedParts||[],pending=R.pendingPart(p),counts=R.setCounts(p),runIds=R.runParts(p),distinct=new Set(runIds.map(id=>R.PARTS[id].element)).size,rainbow=R.rainbowSet(p);
    const card=([id,d])=>{const item=p.parts[id],on=equipped.includes(id),cost=item?R.partUpgradeCost(item.level):null,sid=partSkill(d),full=equipped.length>=3,nx=item?toNext(item.copies):null;
      return `<article class="sg-panel sg-part-card ${on?'sg-equipped':''} ${item?'':'sg-unowned'}" style="--element:${R.ELEMENTS[d.element]?.color||'#4c91ae'}"><button class="sg-part-head" data-detail="${id}" aria-label="${esc(d.name)} 자세히">${partIcon(id)}<span><b>${esc(d.name)}</b><small>${elementName(d.element)} · ${esc(R.SKILLS[sid]?.name)}</small></span>${item?medal(item.copies):''}</button>${item?`<div class="sg-part-stats"><b>Lv.${item.level}</b><span>피해 +${partBonus(item)}%</span><small>${item.copies}개${nx?` · ${nx.name}까지 ${nx.left}개`:' · 최고 등급'}</small></div><div class="sg-part-buttons"><button data-action="${on?'unequip-part':full?'swap-part':'equip-part'}" data-id="${id}">${on?'장착 해제':full?'바꿔 끼우기':'장착'}</button><button data-action="upgrade-part" data-id="${id}" ${cost!==null&&p.coins>=cost?'':'disabled'}>${cost===null?'최고 레벨':`레벨 올리기 · ${cost}`}</button></div>`:'<p class="sg-part-unowned">보급으로 받아요</p>'}</article>`;};
    return `${this.titleBar('파츠','data-info="parts"',`<span class="sg-progress">장착 ${equipped.length} / 3</span>`)}
    ${pending?`<div class="sg-panel sg-first-part"><h2>첫 성공 보상 · 파츠 1개 고르기</h2><div class="sg-first-pick"><select id="sg-first-part" aria-label="첫 파츠">${partOptions(p,true)}</select><button class="sg-primary" data-do="choose-first-part" ${R.selectableParts(p).length?'':'disabled'}>받기</button></div></div>`:''}
    <div class="sg-equipped-parts">${Array.from({length:3},(_,i)=>{const id=equipped[i],d=R.PARTS[id];return d?`<button data-action="unequip-part" data-id="${id}" title="장착 해제">${partIcon(id)}<span><b>${esc(d.name)}</b><small>Lv.${p.parts[id]?.level||1} · ${gradeName(p.parts[id]?.copies||1)}</small></span><span aria-hidden="true">×</span></button>`:`<div class="sg-empty-slot"><span>＋</span> 빈칸</div>`;}).join('')}</div>
    <div class="sg-set-row">${elements().filter(([id])=>(counts[id]||0)>0).map(([id,d])=>`<span class="${(counts[id]||0)>=2?'sg-set-active':''}">${icon(`element_${id}`)} ${esc(d.name)} ${counts[id]}/2${counts[id]>=2?' · 피해 +4%':''}</span>`).join('')}<span class="${rainbow?'sg-set-active':''}">다른 원소 ${distinct}/3${rainbow?' · 체력 +5%':''}</span></div>
    ${this.supply(p,passes)}
    <div class="sg-section-heading"><h2>보관함</h2><small>${ownedKinds(p).length} / 10종</small></div>${this.elementFilter(this.partFilter,'part-filter')}<div class="sg-grid sg-parts-grid">${entries(R.PARTS).filter(([,d])=>this.partFilter==='all'||d.element===this.partFilter).map(card).join('')}</div>`;
  }
  supply(p,passes){
    const open=!!p.stages.CH01?.cleared,mode=R.drawMode(p);
    const today=passes?.day,buys=R.supplyBuysToday(p,today),max=R.SUPPLY_EXCHANGE_COSTS.length,cost=R.supplyExchangeCost(p,today),done=!!today&&cost===null,canBuy=open&&!!today&&!done&&p.coins>=cost;
    const odds=R.SUPPLY_BUNDLES.map(b=>`${b.qty}개 ${Math.round(b.chance*100)}%`).join(' · ');
    return `<section class="sg-supply sg-part-supply" data-mode="${mode||'done'}"><div class="sg-gear-bar-supply">${icon('gift')}<span><b>파츠 보급 · 보급권 ${p.gifts}장</b><small>${open?(mode?`10종 중 무작위 · ${odds}`:'모든 파츠가 전설이에요!'):'1-1 첫 성공 후 열려요'}</small></span><button class="sg-info-btn" data-do="supply-help" aria-label="보급 규칙">?</button><button class="sg-primary sg-supply-go" data-do="draw-part" data-mode="${mode||''}" ${open&&p.gifts>0&&mode?'':'disabled'}>보급 받기</button><button class="sg-supply-go5" data-do="draw-part" data-mode="${mode||''}" data-times="5" ${open&&p.gifts>=5&&mode?'':'disabled'}>5번</button></div><div class="sg-exchange">${icon('coin')}<span>코인 ${cost??R.SUPPLY_EXCHANGE_COSTS[max-1]} → 보급권 1장 <small>오늘 ${buys}/${max}</small></span><button data-do="buy-supply" ${canBuy?'':'disabled'}>${done?'오늘 교환 완료':'바꾸기'}</button></div></section>`;
  }
  supplyHelp(){
    this.openDialog(`<h2>파츠 보급 규칙</h2><div class="sg-rules"><p><b>보급</b> 보급권 1장으로 10종 중 무작위 파츠를 받아요(전설이 된 파츠는 빼고, 남은 파츠는 모두 같은 확률). 고를 수는 없어요.</p><p><b>개수</b> ${R.SUPPLY_BUNDLES.map(b=>`${b.qty}개 ${Math.round(b.chance*100)}%`).join(' · ')} — 운이 좋으면 한 번에 여러 개!</p><p><b>등급</b> 같은 파츠를 모으면 올라가요.</p>${gradeLadder()}${R.GRADE_NAMES.map((n,i)=>`<p class="sg-grade-row">${`<span class="sg-medal sg-medal-${i}">${n}</span>`} ${gradeAbility(i)}</p>`).join('')}<p><p><b>전설</b> 아주 오래 모아야 해요. 매일 열심히 해도 두 달쯤 걸려요.</p><p><b>보급권 받는 곳</b> 성공 보상(쉬움·보통 1장, 어려움 2장, 같은 단계는 하루 2번 성공까지), 실패 격려(하루 1장까지), 코인 교환(하루 ${R.SUPPLY_EXCHANGE_COSTS.length}번, ${R.SUPPLY_EXCHANGE_COSTS.join(' → ')}코인). 결제·광고는 없어요.</p></div><button class="sg-primary" data-close>확인</button>`);
  }
  // 결과 카드: 모든 결과에 같은 1.2초 뒤집기, 결과 전 힌트 없음, 축하는 등급이 오르거나 3·7개일 때만. 건너뛰기는 기억한다.
  // ---- 보급 연출(2026-09-24 사용자 "뽑기가 너무 밋밋해"): 상자가 떨어져 흔들리다 뚜껑이 펑! → 카드가 튀어나옴 → 결과에 맞는 축하 ----
  // 아이 보호 원칙(docs/23·26)은 그대로: 결과가 보이기 전(떨어짐·흔들림·열림·빛)은 모든 결과가 똑같다(힌트 없음). 등급 색·색종이·팡파르는 결과가 보인 뒤에만.
  // 크게 축하하는 것은 3·7개 운과 등급이 오를 때뿐. 건너뛰기는 기억(다음부터 바로 결과), "더 뽑기" 재촉 없음. 움직임 줄이기 설정이면 바로 결과.
  // level: 0 조용히(등급 색 빛만) · 1 행운 3개 · 2 대박 7개·등급 오름 · 3 에픽·전설 달성
  supplyShow({box='part',label='보급',front,grade=0,level=0,banner='',noBox=false}){
    let skip=false;try{skip=localStorage.getItem('seoho_supply_skip_flip')==='1';}catch(e){}
    let reduce=false;try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
    const fast=skip||reduce||noBox,g=Math.max(0,Math.min(4,grade|0)),lv=Math.max(0,Math.min(3,level|0));
    const pal=g>=4?['#ff6b6b','#ffd166','#06d6a0','#4cc9f0','#b388ff','#ff9ecd']:[SUPPLY_COLORS[g],'#ffd76a','#ffffff',SUPPLY_COLORS[Math.min(4,g+1)]],n=[0,16,28,44][lv];
    const conf=Array.from({length:n},(_,i)=>{const a=Math.random()*Math.PI*2,d=(70+Math.random()*100)*(lv>=3?1.3:1);
      return `<i style="--x:${Math.round(Math.cos(a)*d)}px;--y:${Math.round(Math.sin(a)*d*.8-50)}px;--r:${Math.round(Math.random()*720-360)}deg;--c:${pal[i%pal.length]};--d:${Math.round(Math.random()*140)}ms;--s:${(.6+Math.random()*.7).toFixed(2)}"></i>`;}).join('');
    this.openDialog(`<div class="sg-sup sg-sup-${box} sg-sup-lv${lv}${g>=4?' sg-sup-legend':''}" data-state="${fast?'party':'drop'}" style="--gc:${SUPPLY_COLORS[g]}"><div class="sg-sup-stage">
      <div class="sg-sup-rays"></div><div class="sg-sup-glow"></div>
      ${noBox?'':`<button class="sg-sup-box" aria-label="${esc(label)} 상자 열기"><img class="sg-sup-closed" src="${SUPPLY_BOX(box,'closed')}" alt=""/><img class="sg-sup-open" src="${SUPPLY_BOX(box,'open')}" alt=""/>${box==='part'?`<img class="sg-sup-lidimg" src="${SUPPLY_BOX(box,'lid')}" alt=""/>`:''}</button><small class="sg-sup-tap">${esc(label)} 상자 · 누르면 바로 열려요</small>`}
      <div class="sg-sup-flash"></div><div class="sg-sup-card sg-grade-${g}">${front}</div>${banner?`<div class="sg-sup-banner">${esc(banner)}</div>`:''}<div class="sg-sup-confetti">${conf}</div>
    </div><div class="sg-flip-actions">${noBox?'':skip?'<button class="sg-inline" data-do="flip-on">상자 연출 다시 켜기</button>':'<button data-do="flip-skip">건너뛰기</button>'}<button class="sg-primary" data-close>확인</button></div></div>`);
    const root=this.dialog.querySelector('.sg-sup'),timers=[],sfx=k=>{try{this.c.sfx?.(k);}catch(e){}};
    const cheer=()=>{if(lv)sfx(lv>=3?'supGrand':lv>=2?'supBig':'supLuck');};
    const set=st=>{root.dataset.state=st;};
    const relabel=()=>{const b=this.dialog.querySelector('[data-do="flip-skip"]');if(b&&!b.disabled){b.textContent='다음부터 바로 결과 보기';b.classList.add('sg-inline');}};   // 결과가 나온 뒤에는 '건너뛸' 것이 없다
    const reveal=()=>{set('reveal');sfx('supReveal');timers.push(setTimeout(()=>{set('party');cheer();relabel();},520));};
    const open=()=>{if(root.dataset.state!=='drop')return;timers.forEach(clearTimeout);timers.length=0;set('open');sfx('supOpen');timers.push(setTimeout(reveal,380));};
    const done=()=>{timers.forEach(clearTimeout);timers.length=0;if(root.dataset.state!=='party'){set('party');cheer();}};
    if(fast){sfx('supReveal');timers.push(setTimeout(cheer,120));}
    else{sfx('supDrop');timers.push(setTimeout(()=>sfx('supShake'),640),setTimeout(open,1250));root.querySelector('.sg-sup-box').onclick=open;}
    this.dialog.addEventListener('close',()=>timers.forEach(clearTimeout),{once:true});
    const remember=v=>{try{if(v)localStorage.setItem('seoho_supply_skip_flip','1');else localStorage.removeItem('seoho_supply_skip_flip');}catch(e){}};
    this.dialog.querySelector('[data-do="flip-skip"]')?.addEventListener('click',e=>{remember(true);done();e.target.textContent='다음부터 바로 결과를 보여 줘요';e.target.disabled=true;});
    this.dialog.querySelector('[data-do="flip-on"]')?.addEventListener('click',e=>{remember(false);e.target.textContent='다음부터 상자 연출을 보여 줘요';e.target.disabled=true;});
  }
  showDrawResult(d){
    if(d?.mode==='multi'){this.showMultiResult(d);return;}
    if(d?.mode==='pet'||d?.mode==='choose-pet'){this.showPetResult(d);return;}
    if(R.GEAR[d?.id]){this.showGearResult(d);return;}
    const part=R.PARTS[d?.id];if(!part)return;
    const up=d.gradeAfter>Math.max(0,d.gradeBefore),skill=R.SKILLS[part.skill],next=toNext(d.after);
    const front=`${partIcon(d.id)}<h2>${esc(part.name)} ×${d.qty}</h2>${d.isNew?`<p class="sg-flip-new">새 파츠! ${esc(skill?.name)}에 기능이 생겨요</p><p>${esc(desc(part))}</p>`:`<p class="sg-flip-count">${d.before}개 → <b>${d.after}개</b></p>`}<p>${medal(d.after)} ${up?`<b>${gradeName(d.after)} 달성!</b>`:next?`${next.name}까지 ${next.left}개`:'최고 등급'}</p>${up&&d.gradeAfter>=2?`<p class="sg-flip-gold">${d.gradeAfter===2?`유니크 기능이 열렸어요! ${esc(part.gold)}`:`${gradeName(d.after)} 능력: ${gradeAbility(d.gradeAfter)}`}</p>`:''}${d.autoEquipped?'<p class="sg-flip-slot">빈 칸에 끼웠어요</p>':''}`;
    // 개수 운·등급은 결과가 보인 뒤(카드 위 띠)에만
    const level=up?(d.gradeAfter>=3?3:2):d.qty>=7?2:d.qty>=3?1:0;
    const banner=up?`${gradeName(d.after)} 달성!`:d.qty>=7?'대박! 7개':d.qty>=3?'행운! 3개':d.isNew?'새 파츠!':'';
    this.supplyShow({box:'part',label:'파츠 보급',front,grade:d.gradeAfter,level,banner});
  }
  // 5번 연속 보급 결과(2026-09-24 밤): 상자 연출은 한 번, 카드 안에 5개를 한꺼번에. 아이 보호 원칙 그대로 — 열리기 전 모습은 모두 같고,
  // 크게 축하하는 것은 등급이 오르거나 3·7개 운이 나온 것만(가장 좋은 것 하나로 띠를 정함). "더 뽑기" 재촉 없음.
  showMultiResult(m){
    const items=(m.items||[]).filter(Boolean);if(!items.length)return;const kind=m.kind;
    const info=d=>{
      if(kind==='gear'){const it=R.GEAR[d.id];return {icon:gearIcon(d.id),name:it?.name||'',grade:d.grade??0,up:false,ready:!!d.mergeReady};}
      if(kind==='pet'){const pet=R.PETS[d.id];return {icon:petImage(d.id,'sg-multi-pet'),name:pet?.name||'',grade:d.gradeAfter,up:d.gradeAfter>Math.max(0,d.gradeBefore)};}
      const part=R.PARTS[d.id];return {icon:partIcon(d.id),name:part?.name||'',grade:d.gradeAfter,up:d.gradeAfter>Math.max(0,d.gradeBefore)};
    };
    const rows=items.map(d=>({d,...info(d)}));
    const unit=kind==='pet'?'장':'개';
    const cards=rows.map(r=>`<div class="sg-multi-item sg-grade-${r.grade} ${r.up?'up':''}">${r.icon}<b>${esc(r.name)}</b><small>×${r.d.qty} · <span class="sg-medal sg-medal-${r.grade}">${R.GRADE_NAMES[r.grade]}</span></small>${r.up?`<em>${R.GRADE_NAMES[r.grade]} 달성!</em>`:r.ready?'<em>합성 가능</em>':r.d.isNew?'<em class="new">새로!</em>':r.d.qty>=3?`<em class="luck">${r.d.qty}${unit}!</em>`:''}</div>`).join('');
    const best=rows.filter(r=>r.up).sort((a,b)=>b.grade-a.grade)[0],lucky=rows.reduce((q,r)=>Math.max(q,r.d.qty),1);
    const level=best?(best.grade>=3?3:2):lucky>=7?2:lucky>=3?1:0,grade=Math.max(...rows.map(r=>r.grade));
    const banner=best?`${best.name} ${R.GRADE_NAMES[best.grade]} 달성!`:lucky>=7?`대박! 7${unit}`:lucky>=3?`행운! 3${unit}`:'';
    const label=kind==='gear'?'장비':kind==='pet'?'친구':'파츠';
    this.supplyShow({box:kind==='gear'?'gear':'part',label:`${label} 5번 보급`,grade,level,banner,
      front:`<h2>${label} ${items.length}번 보급</h2><div class="sg-multi">${cards}</div>${kind==='gear'&&rows.some(r=>r.ready)?'<p class="sg-flip-gold">합성할 수 있는 장비가 있어요! 장비 탭에서 [합성]</p>':''}`});
    this.dialog.classList.add('sg-wide');   // PC에서는 넓게(5개가 한 줄에 여유 있게)
  }
  swapDialog(id){
    const p=this.state().profile,d=R.PARTS[id];if(!d||!p.parts[id])return;
    this.openDialog(`<h2>${esc(d.name)} 끼우기</h2><p>칸이 가득 찼어요. 뺄 파츠를 골라 주세요. 뺀 파츠의 레벨과 개수는 그대로 남아요.</p><div class="sg-swap-list">${(p.equippedParts||[]).filter(x=>R.PARTS[x]).map(x=>`<button data-swap="${x}">${partIcon(x)}<b>${esc(R.PARTS[x].name)}</b><small>Lv.${p.parts[x]?.level||1} · ${gradeName(p.parts[x]?.copies||1)}</small></button>`).join('')}</div><button data-close>돌아가기</button>`);
    this.dialog.querySelectorAll('[data-swap]').forEach(b=>b.onclick=async()=>{if(this.busy)return;this.dialog.close();await this.perform({kind:'equip-part',id,replace:b.dataset.swap});});
  }
  // ---- 장비 탭(2026-09-24, docs/34): 가운데 캐릭터 둘레 6칸 · 세트 2/4/6 막대 · 장비 보급(파츠와 같은 보급권) · 보관함(합성·끼우기) ----
  gearAlert(p){return !R.heroLocked(p)||!p.milestones?.firstGear||R.gearIdsFor(p.hero).some(id=>R.gearMergeReady(p,id));}
  heroPick(){const p=this.state().profile,now=(p?.runs||0)>0?p.hero:null;return `<div class="sg-hero-choice sg-hero-pick">${[['hoya','호야','야구복 세트 · 교복 세트'],['minji','민지','피구복 세트 · 교복 세트']].map(([id,name,detail])=>`<button data-pick-hero="${id}">${now===id?'<span class="sg-hero-now-tag">지금 쓰는 캐릭터</span>':''}<img src="./assets/sprites/heroes/${id}_idle_1.png" alt=""/><b>${name}</b><small>${detail}</small></button>`).join('')}</div>`;}
  // 장비 탭(2026-09-24 밤 사용자 "장비창 편의성이 떨어진다. 장비 누르면 인벤토리 창이 뜨고 보유 아이템 보이는 형식, 스크롤 많이 안 내려도 되게"):
  // 한 화면 = 캐릭터 둘레 6칸 · 세트 요약(세트당 한 줄) · 보급/보관함 한 줄. 칸을 누르면 그 칸의 내 장비 창(끼우기·빼기·합성), 세트 줄을 누르면 세트 효과 창, 보관함은 12개 아이콘 격자.
  gear(p,passes){
    preloadSupply();
    const hero=p.hero==='minji'?'minji':'hoya';
    if(!R.heroLocked(p))return `${this.titleBar('먼저 함께할 캐릭터를 골라요')}<p class="sg-lead">한 번 고르면 바꿀 수 없어요. 호야와 민지는 능력이 똑같아요.</p><div class="sg-panel">${this.heroPick()}</div>`;
    const eq=p.equippedGear||{},gb=R.gearBonuses(p),sets=[`${hero}_ranged`,`${hero}_melee`],first=!p.milestones?.firstGear,open=!!p.stages.CH01?.cleared,pool=R.gearDrawPool(p).length,worn=R.GEAR_SLOTS.filter(s=>R.GEAR[eq[s]]).length;
    const ids=R.gearIdsFor(hero),owned=ids.filter(id=>R.gearGrade(p,id)>=0).length,readyN=ids.filter(id=>R.gearMergeReady(p,id)).length;
    // 칸: 눌러서 그 칸 장비 창. 배지: 합성 가능 · 빈 칸인데 낄 장비가 있음
    const slot=s=>{const id=eq[s],it=R.GEAR[id],g=it?R.gearGrade(p,id):-1,mine=ids.filter(x=>R.GEAR[x].slot===s),ready=mine.some(x=>R.gearMergeReady(p,x)),canWear=!it&&mine.some(x=>R.gearGrade(p,x)>=0);
      const badge=ready?'<i class="sg-slot-badge">합성!</i>':canWear?'<i class="sg-slot-badge">끼우기</i>':'';
      return `<button class="sg-gear-slot ${it?'on':''} ${this.justSlot===s?'sg-just':''}" data-gear-slot="${s}" style="${it?`--set:${it.color};`:''}grid-area:${s}" aria-label="${R.GEAR_SLOT_NAMES[s]} 칸 · ${it?esc(it.name):'빈칸'}">${badge}${it?gearIcon(id):slotIcon(s)}<span><small>${R.GEAR_SLOT_NAMES[s]}${it?`<i class="sg-medal sg-medal-${g}">${R.GRADE_NAMES[g]}</i>`:''}</small><b>${it?esc(it.name):'빈칸'}</b></span></button>`;};
    if(!this.busy)this.justSlot=null;   // 작업 중(busy) 렌더에서는 남겨 두었다가 끝난 뒤 렌더에서 반짝
    const weapon=R.GEAR[eq.weapon],mode=weapon?weapon.type:(p.weaponMode||'melee');
    const doll=`<div class="sg-gear-doll">${R.GEAR_SLOTS.map(slot).join('')}<div class="sg-gear-hero" style="grid-area:hero"><img src="./assets/sprites/heroes/${hero}_idle_1.png" alt="${heroName(hero)}"/><small>${typeName(mode)} · ${worn}/6</small></div></div>`;
    // 세트 한 줄: 이름 · 6칸 점 · 2/4/6 켜짐(누르면 자세히)
    const setRow=set=>{const d=R.GEAR_SETS[set],n=gb.sets[set]||0;return `<button class="sg-gear-setrow ${n>=2?'on':''}" data-gear-set="${set}" style="--set:${d.color}"><span class="sg-gear-setname"><b>${esc(d.name)}</b><small>${typeName(d.type)} · ${d.type==='ranged'?'사거리·공격':'체력·방어'}</small></span><span class="sg-gear-pips" aria-label="${n}개 착용">${Array.from({length:6},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}</span><span class="sg-gear-tiers">${R.GEAR_SET_SIZES.map(k=>`<i class="${n>=k?'on':''}">${k}</i>`).join('')}</span></button>`;};
    const base=R.GEAR_SLOTS.map(s=>eq[s]).filter(id=>R.GEAR[id]&&R.GEAR[id].hero===hero).flatMap(id=>entries(R.GEAR[id].max).map(([k,v])=>[k,R.gearValue(v,R.gearGrade(p,id))]));
    const sum={};for(const [k,v] of base)sum[k]=(sum[k]||0)+v;
    const total=entries(sum).map(([k,v])=>gearStat(k,v)).filter(Boolean).join(' · ');
    const firstPanel=first?`<section class="sg-panel sg-first-part sg-gear-first"><span class="sg-eyebrow">첫 장비 · 무료</span><h2>원거리·근거리 무기를 1개씩 받아요</h2><p>둘 다 받아요. 먼저 끼울 무기를 눌러 주세요.</p><div class="sg-gear-first-grid">${sets.map(set=>{const id=`${set}_weapon`,it=R.GEAR[id];return `<button data-first-gear="${id}" style="--set:${it.color}">${gearIcon(id)}<b>${esc(it.name)}</b><small>${typeName(it.type)} · ${it.type==='ranged'?'멀리서 공을 던져요':'가까이서 휘둘러요'} · ${esc(it.setName)}</small><span>${esc(gearBase(it,0))}</span><em>이 무기 먼저 끼우기</em></button>`;}).join('')}</div></section>`:'';
    const odds=R.SUPPLY_BUNDLES.map(b=>`${b.qty}개 ${Math.round(b.chance*100)}%`).join(' · ');
    const bar=`<div class="sg-gear-bar"><div class="sg-gear-bar-supply">${icon('gift')}<span><b>장비 보급 · 보급권 ${p.gifts}장</b><small>${open?(pool?`${heroName(hero)} 장비 12종 중 무작위 · ${odds}`:'모든 장비가 전설이에요!'):'1-1 첫 성공 후 열려요'}</small></span><button class="sg-primary" data-do="draw-gear" ${open&&p.gifts>0&&pool?'':'disabled'}>보급 받기</button><button class="sg-supply-go5" data-do="draw-gear" data-times="5" ${open&&p.gifts>=5&&pool?'':'disabled'}>5번</button></div>
</div>`;
    return `${this.titleBar(`${heroName(hero)}의 장비`,'data-do="gear-help"',`<button class="sg-gear-bagbtn ${readyN?'sg-merge-ready':''}" data-do="gear-bag">${icon('gift')}<span><b>보관함 ${owned}/12</b><small>${readyN?`합성 가능 ${readyN}개`:'한눈에 보기'}</small></span></button>`)}
    ${firstPanel}<div class="sg-gear-top">${doll}<div class="sg-gear-sets">${sets.map(setRow).join('')}<p class="sg-footnote">${total?`지금 장비 능력: ${esc(total)}`:'장비를 끼우면 여기에 능력이 모여요.'}</p></div></div>${bar}`;
  }
  // 칸 보관함 창: 그 칸에 낄 수 있는 내 장비(원거리 세트 · 근거리 세트) — 끼우기 · 빼기 · 합성 · 자세히
  gearSlotDialog(slot){
    const p=this.state().profile;if(!p||!R.GEAR_SLOTS.includes(slot))return;const hero=p.hero==='minji'?'minji':'hoya',eq=p.equippedGear||{},gb=R.gearBonuses(p);
    const row=id=>{const it=R.GEAR[id],g=R.gearGrade(p,id),item=p.gear?.[id],on=eq[slot]===id,ready=R.gearMergeReady(p,id),next=g>=0&&g<R.CARD_COPIES.length-1?R.CARD_COPIES[g+1]:null;
      const n=gb.sets[it.set]||0,after=on?n:n+1;   // 끼우면 그 세트 개수
      const sp=g>=2?gearSpecialLines(it,g).filter(x=>x.on).map(x=>x.text).join(' · '):`유니크부터 · ${it.special.text[0]}`;
      return `<div class="sg-slot-item ${on?'on':''} ${g<0?'sg-unowned':''} ${ready?'sg-merge-ready':''}" style="--set:${it.color}">${gearIcon(id)}<div class="sg-slot-info"><p class="sg-slot-name"><b>${esc(it.name)}</b>${g>=0?`<span class="sg-medal sg-medal-${g}">${R.GRADE_NAMES[g]}</span>`:'<span class="sg-slot-none">없음</span>'}</p><small>${esc(it.setName)} · ${typeName(it.type)}${g>=0&&!on?` · 끼우면 세트 ${after}/6`:''}</small><small>${esc(gearBase(it,Math.max(0,g)))}</small><small class="sg-gear-special ${g>=2?'on':''}"><b>${esc(it.special.name)}</b> ${esc(sp)}</small>${g>=0?`<div class="sg-gear-progress"><div class="sg-meter"><i style="width:${next?Math.min(100,item.copies/next*100):100}%"></i></div><small>${item.copies}개${next?` / ${next}개면 ${R.GRADE_NAMES[g+1]} 합성`:' · 최고 등급'}</small></div>`:''}</div>
        <div class="sg-slot-acts">${ready?`<button class="sg-primary sg-merge" data-slot-act="merge-gear" data-id="${id}">합성 → ${R.GRADE_NAMES[g+1]}</button>`:''}${g<0?'<small>보급으로 받아요</small>':on?`<span class="sg-on-tag">착용 중</span><button data-slot-act="unequip-gear">빼기</button>`:`<button class="sg-primary" data-slot-act="equip-gear" data-id="${id}">끼우기</button>`}<button class="sg-inline" data-slot-detail="${id}">자세히</button></div></div>`;};
    this.openDialog(`<div class="sg-slot-dlg"><div class="sg-slot-head">${eq[slot]&&R.GEAR[eq[slot]]?gearIcon(eq[slot]):slotIcon(slot)}<h2>${R.GEAR_SLOT_NAMES[slot]} 칸</h2><button class="sg-x" data-close aria-label="닫기">×</button></div>${slot==='weapon'?'<p class="sg-footnote">끼운 무기가 공격 방식(원거리·근거리)을 정해요.</p>':''}<div class="sg-slot-list">${[`${hero}_ranged_${slot}`,`${hero}_melee_${slot}`].map(row).join('')}</div><p class="sg-footnote">같은 장비를 모으면 [합성]으로 등급이 올라요. 장비는 장비 보급에서 받아요.</p></div>`);
    this.dialog.querySelectorAll('[data-slot-detail]').forEach(b=>b.onclick=()=>this.gearDetail(b.dataset.slotDetail));
    this.dialog.querySelectorAll('[data-slot-act]').forEach(b=>b.onclick=async()=>{if(this.busy)return;const k=b.dataset.slotAct;this.dialog.close();this.justSlot=slot;await this.perform(k==='unequip-gear'?{kind:k,slot}:{kind:k,id:b.dataset.id});});
  }
  // 세트 효과 창: 2·4·6 효과와 이 세트 6칸의 내 장비
  gearSetDialog(set){
    const p=this.state().profile,d=R.GEAR_SETS[set];if(!p||!d)return;const n=R.gearBonuses(p).sets[set]||0,eq=p.equippedGear||{};
    const items=R.GEAR_SLOTS.map(sl=>{const id=`${set}_${sl}`,g=R.gearGrade(p,id),on=eq[sl]===id;return `<button class="sg-bag-cell ${g<0?'sg-unowned':''} ${on?'on':''}" data-bag-id="${id}" style="--set:${d.color}">${gearIcon(id)}<small>${R.GEAR_SLOT_NAMES[sl]}</small>${g>=0?`<span class="sg-medal sg-medal-${g}">${R.GRADE_NAMES[g]}</span>`:'<span class="sg-slot-none">없음</span>'}${on?'<i class="sg-bag-on">착용</i>':''}</button>`;}).join('');
    this.openDialog(`<div class="sg-slot-head"><span class="sg-gear-setdot" style="--set:${d.color}"></span><h2>${esc(d.name)} <small>${typeName(d.type)}</small></h2><button class="sg-x" data-close aria-label="닫기">×</button></div><p>같은 세트를 끼운 개수만큼 효과가 켜져요. 지금 <b>${n}/6</b>.</p><div class="sg-rules sg-gear-rules">${R.GEAR_SET_SIZES.map(k=>`<p class="sg-grade-row ${n>=k?'on':''}"><b class="sg-tier ${n>=k?'on':''}" style="--set:${d.color}">${k}세트</b> ${esc(R.GEAR_SET_TEXT[d.type][k])}${n>=k?' ✓':''}</p>`).join('')}</div><div class="sg-bag-grid sg-bag-6">${items}</div>`);
    this.dialog.classList.add('sg-wide');
    this.dialog.querySelectorAll('[data-bag-id]').forEach(b=>b.onclick=()=>this.gearDetail(b.dataset.bagId));
  }
  // 보관함: 내 캐릭터 장비 12개를 세트별 아이콘 격자로(누르면 자세히 — 끼우기·합성은 자세히에서)
  gearBagDialog(){
    const p=this.state().profile;if(!p)return;const hero=p.hero==='minji'?'minji':'hoya',eq=p.equippedGear||{};
    const cell=id=>{const it=R.GEAR[id],g=R.gearGrade(p,id),on=eq[it.slot]===id,ready=R.gearMergeReady(p,id);return `<button class="sg-bag-cell ${g<0?'sg-unowned':''} ${on?'on':''} ${ready?'sg-merge-ready':''}" data-bag-id="${id}" style="--set:${it.color}">${gearIcon(id)}<small>${esc(it.name)}</small>${g>=0?`<span class="sg-medal sg-medal-${g}">${R.GRADE_NAMES[g]} ${p.gear[id].copies}</span>`:'<span class="sg-slot-none">없음</span>'}${on?'<i class="sg-bag-on">착용</i>':''}${ready?'<i class="sg-bag-ready">합성!</i>':''}</button>`;};
    this.openDialog(`<div class="sg-slot-head">${icon('gift')}<h2>장비 보관함</h2><button class="sg-x" data-close aria-label="닫기">×</button></div>${[`${hero}_ranged`,`${hero}_melee`].map(set=>`<p class="sg-bag-title" style="--set:${R.GEAR_SETS[set].color}"><b>${esc(R.GEAR_SETS[set].name)}</b> <small>${typeName(R.GEAR_SETS[set].type)}</small></p><div class="sg-bag-grid sg-bag-6">${R.GEAR_SLOTS.map(sl=>cell(`${set}_${sl}`)).join('')}</div>`).join('')}<p class="sg-footnote">장비를 누르면 자세히 보고 끼우거나 합성할 수 있어요. 숫자는 모은 개수예요.</p>`);
    this.dialog.classList.add('sg-wide');
    this.dialog.querySelectorAll('[data-bag-id]').forEach(b=>b.onclick=()=>this.gearDetail(b.dataset.bagId));
  }
  // 어려움 최소 기준(HARD_MIN): 못 채우면 어려움이 잠기고 모자란 것을 한 줄로. 열렸으면 어려움을 골랐을 때 권장치 한 줄.
  hardArea(p,stageId,value){
    const g=R.hardGate(p,stageId);
    if(!g.open)return '';   // 잠긴 어려움은 난이도 단추의 🔒로 알려 주고, 누르면 여는 조건 창(hardGateDialog)
    return value==='hard'?this.hardLine(p,stageId):'';
  }
  hardGateDialog(stageId){
    const p=this.state().profile;if(!p)return;const g=R.hardGate(p,stageId),need=R.HARD_MIN[g.chapter];
    const rows=g.items.map(it=>it.key==='stage'?`<tr class="${it.ok?'ok':'short'}"><td>${R.stageLabel(stageId)} 성공</td><td><b>${it.ok?'성공':'아직'}</b></td><td>보통 이상</td><td>${it.ok?'✓':'먼저 도전'}</td></tr>`:`<tr class="${it.ok?'ok':'short'}"><td>${esc(it.label)}</td><td><b>${it.now}</b>${esc(it.unit)}</td><td>${it.need}${esc(it.unit)}</td><td>${it.ok?'✓':`${it.need-it.now}${esc(it.unit)} 더`}</td></tr>`).join('');
    const training=g.items.some(it=>!it.ok&&it.tab==='training');
    this.openDialog(`<div class="sg-slot-head"><span class="sg-ready-icon">🔒</span><h2>${R.stageLabel(stageId)} 어려움 열기</h2><button class="sg-x" data-close aria-label="닫기">×</button></div><p>어려움은 적이 아주 튼튼해요(체력 5배 넘게). 아래를 모두 채우면 어려움이 열려요. ${g.chapter}장은 공격력·체력 훈련 <b>${need.attack}단계</b>부터예요.</p><table class="sg-ready"><thead><tr><th>조건</th><th>지금</th><th>필요</th><th></th></tr></thead><tbody>${rows}</tbody></table><p class="sg-footnote">열린 뒤에도 권장치(훈련·파츠·장비)를 채울수록 성공하기 쉬워요. 코인은 쉬움·보통에서도 모여요.</p><div class="sg-ready-acts">${training?'<button class="sg-primary" data-gate-train>훈련하러 가기</button>':''}<button data-close>확인</button></div>`);
    this.dialog.querySelector('[data-gate-train]')?.addEventListener('click',()=>{this.dialog.close();this.tab='training';this.render();});
  }
  // 어려움 준비 표: 항목 · 지금 · 권장 · 남은 것(부족한 것은 주황)
  hardLine(p,stageId){
    const r=R.hardReadiness(p,stageId);
    return r.ready?`<p class="sg-hard-line ok">✓ ${r.chapter}장 어려움 권장치를 모두 채웠어요!</p>`:`<p class="sg-hard-line">어려움 권장치까지 <b>${r.missing}가지</b> 부족해요 · ${r.items.filter(it=>!it.ok).slice(0,2).map(it=>`${esc(it.label.replace(/\(.*\)/,''))} ${it.now}/${it.need}`).join(' · ')}${r.missing>2?' …':''} <button class="sg-inline" data-do="hard-ready">자세히</button></p>`;
  }
  hardReadyDialog(stageId){
    const p=this.state().profile;if(!p)return;const r=R.hardReadiness(p,stageId);
    this.openDialog(`<div class="sg-slot-head"><span class="sg-ready-icon">💪</span><h2>${r.chapter}장 어려움 권장치</h2><button class="sg-x" data-close aria-label="닫기">×</button></div><p>어려움은 적 체력이 5배 넘게 튼튼해요. 아래를 채우면 성공이 보여요.</p>${this.hardReadyTable(r)}<button class="sg-primary" data-close>확인</button>`);
  }
  hardReadyTable(r){
    return `<table class="sg-ready"><thead><tr><th>항목</th><th>지금</th><th>권장</th><th></th></tr></thead><tbody>${r.items.map(it=>`<tr class="${it.ok?'ok':'short'}"><td>${esc(it.label)}</td><td><b>${it.now}</b>${esc(it.unit)}</td><td>${it.need}${esc(it.unit)}</td><td>${it.ok?'✓':`${it.need-it.now}${esc(it.unit)} 더`}</td></tr>`).join('')}</tbody></table>`;
  }
  // 어려움 실패 뒤(2026-09-24 사용자 "어려움 1번 실패하면 장비·능력치 업그레이드가 부족하다면서 권장치를 구체적으로"): 부족한 것이 있을 때만 뜬다
  hardAdvice(stageId){
    const p=this.state().profile;if(!p)return false;const r=R.hardReadiness(p,stageId);if(r.ready)return false;
    let today='';try{today=new Date(Date.now()+9*3600e3-8*3600e3).toISOString().slice(0,10);if(localStorage.getItem('seoho_hard_advice_off')===today)return false;}catch(e){}
    const st=R.STAGES.find(s=>s.id===stageId),label=st?`${R.stageChapter(stageId)}-${(Number(stageId.slice(2))-1)%5+1}`:'';
    const tabs=[...new Set(r.items.filter(it=>!it.ok).map(it=>it.tab))],names={training:'훈련하러 가기',parts:'파츠 보러 가기',gear:'장비 보러 가기'};
    this.openDialog(`<div class="sg-slot-head"><span class="sg-ready-icon">💪</span><h2>아직 준비가 조금 부족해요</h2><button class="sg-x" data-close aria-label="닫기">×</button></div><p>${label} 어려움은 적이 아주 튼튼해요(체력 5배 넘게). <b>${R.HARD_READY[r.chapter]?`${r.chapter}장 어려움 권장치`:'권장치'}</b>를 채우면 성공이 보여요. 부족한 것 <b>${r.missing}가지</b>.</p>${this.hardReadyTable(r)}<p class="sg-footnote">코인은 쉬움·보통에서도 모여요 → 훈련. 보급권 → 파츠·장비 보급. 유니크는 파츠 같은 것 ${R.GRADE_COPIES[2]}개, 장비 같은 것 ${R.CARD_COPIES[2]}개(모아서 합성)예요.</p><div class="sg-ready-acts">${tabs.map(t=>`<button class="sg-primary" data-ready-tab="${t}">${names[t]}</button>`).join('')}<button data-ready-normal>보통으로 바꾸기</button></div><button class="sg-inline sg-ready-off" data-ready-off>오늘은 그만 보기</button>`);
    this.dialog.querySelectorAll('[data-ready-tab]').forEach(b=>b.onclick=()=>{this.dialog.close();this.tab=b.dataset.readyTab;this.render();});
    this.dialog.querySelector('[data-ready-normal]').onclick=async()=>{if(this.busy)return;this.dialog.close();this.busy=true;try{const q=this.state().profile;await this.c.action({kind:'settings',difficulty:'normal',weaponMode:q.weaponMode,hero:q.hero});this.toast('보통 난이도로 바꿨어요');}catch(e){this.notify('확인해 주세요',e.message);}finally{this.busy=false;this.render();}};
    this.dialog.querySelector('[data-ready-off]').onclick=()=>{try{localStorage.setItem('seoho_hard_advice_off',today);}catch(e){}this.dialog.close();};
    return true;
  }
  toast(text){
    if(typeof document==='undefined'||!text)return;let t=document.getElementById('sg-toast');
    if(!t){t=document.createElement('div');t.id='sg-toast';t.setAttribute('role','status');document.body.append(t);}
    t.textContent=text;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');clearTimeout(this.toastT);this.toastT=setTimeout(()=>t.classList.remove('show'),1900);
  }
  gearDetail(id){
    const p=this.state().profile,it=R.GEAR[id];if(!it||!p)return;const g=R.gearGrade(p,id),item=p.gear?.[id],set=R.GEAR_SETS[it.set],eq=p.equippedGear?.[it.slot]===id;
    const grades=R.GRADE_NAMES.map((n,i)=>`<p class="sg-grade-row ${i===g?'on':''}"><span class="sg-medal sg-medal-${i}">${n}</span><span>${esc(gearBase(it,i))}${i===g?' <b>← 지금</b>':''}</span></p>`).join('');
    const sp=gearSpecialLines(it,g).map(x=>`<p class="${x.on?'on':''}"><b>${x.name}</b> ${esc(x.text)}${x.on?' ✓':''}</p>`).join('');
    const own=p.hero===it.hero,next=g>=0&&g<R.CARD_COPIES.length-1?R.CARD_COPIES[g+1]:null;
    this.openDialog(`<div class="sg-dialog-icon">${gearIcon(id,'big')}</div><h2>${esc(it.name)}</h2><p>${esc(set.name)} · ${typeName(it.type)} · ${R.GEAR_SLOT_NAMES[it.slot]}${g>=0?` · ${item.copies}개 가짐${next?` (${next}개면 ${R.GRADE_NAMES[g+1]} 합성)`:''}`:' · 아직 없음'}</p>${it.slot==='weapon'?`<p>이 무기를 끼우면 <b>${typeName(it.type)}</b>으로 싸워요.</p>`:''}<div class="sg-rules sg-gear-rules"><h3>등급별 능력</h3>${grades}<h3>특수 효과 · ${esc(it.special.name)}</h3><div class="sg-gear-sp">${sp}</div><h3>${esc(set.name)} 효과(같은 세트 개수)</h3>${R.GEAR_SET_SIZES.map(k=>`<p><b>${k}세트</b> ${esc(R.GEAR_SET_TEXT[it.type][k])}</p>`).join('')}</div><div class="sg-gear-dialog-actions">${g>=0&&own?(R.gearMergeReady(p,id)?`<button class="sg-primary" data-gear-act="merge-gear">합성 → ${R.GRADE_NAMES[g+1]}</button>`:'')+(eq?`<button data-gear-act="unequip-gear">빼기</button>`:`<button class="sg-primary" data-gear-act="equip-gear">끼우기</button>`):''}<button data-close>닫기</button></div>`);
    this.dialog.querySelectorAll('[data-gear-act]').forEach(b=>b.onclick=async()=>{if(this.busy)return;this.dialog.close();const k=b.dataset.gearAct;await this.perform(k==='unequip-gear'?{kind:k,slot:it.slot}:{kind:k,id});});
  }
  gearHelp(){
    this.openDialog(`<h2>장비 규칙</h2><div class="sg-rules"><p><b>칸</b> 투구 · 갑옷 · 신발 · 장갑 · 목걸이 · 무기, 칸마다 1개씩 끼워요. 다른 세트를 섞어 끼워도 기본 능력은 다 받아요.</p><p><b>세트</b> 원거리 세트(호야 야구복 · 민지 피구복)는 사거리·공격, 근거리 세트(교복)는 체력·방어. 같은 세트를 2 · 4 · 6개 끼우면 세트 효과가 생겨요.</p><p><b>무기</b> 무기 칸 장비가 공격 방식(원거리·근거리)을 정해요.</p><p><b>보급</b> 보급권 1장으로 내 캐릭터 장비 12종 중 무작위(전설이 된 장비는 빼고). ${R.SUPPLY_BUNDLES.map(b=>`${b.qty}개 ${Math.round(b.chance*100)}%`).join(' · ')}. 파츠 보급과 같은 보급권이에요.</p><p><b>합성</b> 같은 장비를 ${R.GRADE_NAMES.map((n,i)=>`${n} ${R.CARD_COPIES[i]}개`).join(' → ')}만큼 모으면 [합성] 버튼으로 등급을 올려요. 등급이 오르면 능력이 전설(최대)의 ${R.GRADE_NAMES.map((n,i)=>`${n} ${Math.round(R.GEAR_GRADE_RATE[i]*100)}%`).join(' · ')}.</p><p><b>특수 효과</b> 유니크에서 열리고, 에픽에서 강해지고, 전설에서 하나 더 생겨요.</p><p><b>공평</b> 호야와 민지의 같은 역할 장비는 이름과 그림만 다르고 능력은 똑같아요.</p></div><button class="sg-primary" data-close>확인</button>`);
  }
  showGearResult(d){
    const it=R.GEAR[d?.id];if(!it)return;
    if(d.mode==='merge'){   // 합성: 운이 아니라 내가 누른 것 → 상자 없이 바로 축하
      const lines=gearSpecialLines(it,d.grade),newly=d.grade>=2?lines[d.grade-2]:null;
      this.supplyShow({box:'gear',noBox:true,grade:d.grade,level:d.grade>=3?3:2,banner:'합성 성공!',
        front:`${gearIcon(d.id,'big')}<h2>${esc(it.name)}</h2><p><span class="sg-medal sg-medal-${d.grade}">${R.GRADE_NAMES[d.grade]}</span> 등급이 되었어요</p><p>${esc(gearBase(it,d.grade))}</p>${newly?`<p class="sg-flip-gold">${newly.name} 특수 효과 · ${esc(newly.text)}</p>`:''}`});return;}
    if(d.mode==='first'&&Array.isArray(d.ids)){   // 첫 무기 2개(원거리·근거리) — 캐릭터를 고를 때 받는 선물
      const p=this.state().profile,row=d.ids.filter(id=>R.GEAR[id]).map(id=>`<div class="sg-first-weapon ${id===d.id?'on':''}">${gearIcon(id,'big')}<b>${esc(R.GEAR[id].name)}</b><small>${typeName(R.GEAR[id].type)}${id===d.id?' · 끼웠어요':''}</small></div>`).join('');
      this.supplyShow({box:'gear',label:'선물',grade:0,level:1,banner:p?`${heroName(p.hero)}와 함께해요!`:'선물!',
        front:`<h2>무기 2개를 받았어요</h2><div class="sg-first-weapons">${row}</div><p>끼운 무기가 공격 방식을 정해요. 장비 탭에서 바꿔 낄 수 있어요.</p>`});return;}
    const g=d.grade??0,next=R.CARD_COPIES[g+1];
    const front=`${gearIcon(d.id,'big')}<h2>${esc(it.name)} ×${d.qty}</h2><p>${esc(it.setName)} · ${R.GEAR_SLOT_NAMES[it.slot]}</p>${d.isNew?`<p class="sg-flip-new">새 장비! ${esc(gearBase(it,g))}</p>`:`<p class="sg-flip-count">${d.before}개 → <b>${d.after}개</b></p>`}${d.mergeReady?`<p class="sg-flip-gold">합성할 수 있어요! 장비 탭에서 [합성]을 눌러요</p>`:next?`<p>${next}개면 ${R.GRADE_NAMES[g+1]} 합성</p>`:''}${d.mode==='first'?'<p class="sg-flip-slot">무기 칸에 끼웠어요</p>':''}`;
    this.supplyShow({box:'gear',label:'장비 보급',front,grade:g,level:d.qty>=7?2:d.qty>=3?1:0,banner:d.qty>=7?'대박! 7개':d.qty>=3?'행운! 3개':d.isNew?'새 장비!':''});
  }
  // 캐릭터 고르기(2026-09-24 사용자 "로그인 시에 1회 선택지, 바꿀 수 없으니 신중히 하라고 메시지 띄우고 확인받아"):
  // 로그인해 로비에 오면 모든 학생에게 한 번(닫을 수 없음) → 한 번 더 확인. 고른 뒤에는 학생이 바꿀 수 없다(선생님 관리 페이지만).
  heroDialog(){
    const p=this.state().profile;if(!p||R.heroLocked(p))return;
    this.openDialog(`<h2>함께할 캐릭터를 골라요</h2><p class="sg-hero-warn"><b>딱 한 번만 고를 수 있어요.</b> 고른 뒤에는 다시 바꿀 수 없으니 신중하게 골라 주세요!</p><p>장비는 고른 캐릭터 것만 나와요. 호야와 민지는 능력이 똑같고 옷·무기 모습만 달라요.</p>${this.heroPick()}<p class="sg-footnote">캐릭터를 누르면 한 번 더 확인해요. <button class="sg-inline" id="sg-hero-logout">다른 아이디로 들어가기</button></p>`,true);
    this.dialog.querySelectorAll('[data-pick-hero]').forEach(b=>b.onclick=()=>this.heroConfirm(b.dataset.pickHero));
    this.dialog.querySelector('#sg-hero-logout').onclick=()=>{this.unlockDialog();this.dialog.close();this.c.logout();};
  }
  heroConfirm(hero){
    this.openDialog(`<div class="sg-dialog-icon"><img class="sg-hero-confirm" src="./assets/sprites/heroes/${hero}_idle_1.png" alt=""/></div><h2>정말 ${heroName(hero)}로 할까요?</h2><p class="sg-hero-warn">한 번 고르면 <b>다시 바꿀 수 없어요.</b> 신중하게 결정해 주세요.</p><p>고르면 ${heroName(hero)}의 원거리·근거리 무기를 1개씩 선물로 받아요.</p><button class="sg-primary" id="sg-hero-yes">네, ${heroName(hero)}로 정할게요</button><button id="sg-hero-back">다시 고르기</button>`,true);
    this.dialog.querySelector('#sg-hero-back').onclick=()=>this.heroDialog();
    this.dialog.querySelector('#sg-hero-yes').onclick=async()=>{if(this.busy)return;this.unlockDialog();this.dialog.close();await this.perform({kind:'choose-hero',hero});};
  }
  firstGearDialog(){
    const p=this.state().profile;if(!p||!R.heroLocked(p)||p.milestones?.firstGear)return;const hero=p.hero==='minji'?'minji':'hoya';
    this.openDialog(`<div class="sg-first-heading"><h2>장비가 생겼어요!</h2><button data-close>나중에</button></div><p>투구·갑옷·신발·장갑·목걸이·무기를 모아 끼워요. 첫 장비로 <b>원거리·근거리 무기를 1개씩 무료</b>로 받아요. 먼저 끼울 무기를 눌러 주세요.</p><div class="sg-gear-first-grid">${[`${hero}_ranged_weapon`,`${hero}_melee_weapon`].map(id=>{const it=R.GEAR[id];return `<button data-first-gear-dialog="${id}" style="--set:${it.color}">${gearIcon(id)}<b>${esc(it.name)}</b><small>${typeName(it.type)} · ${it.type==='ranged'?'멀리서 공을 던져요':'가까이서 휘둘러요'}</small><span>${esc(gearBase(it,0))}</span><em>이 무기 먼저 끼우기</em></button>`;}).join('')}</div>`);
    this.dialog.querySelectorAll('[data-first-gear-dialog]').forEach(b=>b.onclick=async()=>{if(this.busy)return;this.dialog.close();await this.perform({kind:'choose-first-gear',id:b.dataset.firstGearDialog});});
  }
  unlockDialog(){delete this.dialog.dataset.lock;}
  // ---- 동물 친구(2026-09-24 밤 사용자 "4종으로 줄이고 유니크부터 특수능력 추가. 보급권으로", docs/37) ----
  // 한 화면: 4종 카드(그림 · 등급 · 카드 막대 · 지금 버프 · 특수 능력) + 친구 보급 한 줄. 그림·[자세히]를 누르면 등급별 표.
  friends(p){
    preloadSupply();
    const pending=R.pendingPet(p),open=!!p.stages.CH01?.cleared,pool=R.petDrawPool(p).length,act=R.hasPet(p,p.activePet)?p.activePet:null;
    const odds=R.SUPPLY_BUNDLES.map(b=>`${b.qty}장 ${Math.round(b.chance*100)}%`).join(' · '),mig=p.petMigration;
    let seen=false;try{seen=localStorage.getItem('seoho_pet_mig_seen')==='1';}catch(e){}
    const migNote=mig&&!seen&&!this.petMigSeen?`<div class="sg-notice sg-pet-mig">친구가 4종으로 새로워졌어요! 꼬북이는 생존, 야옹이는 속도, 수달이는 공격, 아기사슴은 새싹 경험치·코인을 맡아요. 참새는 야옹이, 물범이는 수달이와 하나가 되었어요.${mig.bonus&&R.PETS[mig.to]?` 우정 ${mig.friendship}은 <b>${esc(R.PETS[mig.to].name)} 카드 ${mig.bonus}장</b>으로 바뀌었어요.`:''} <button class="sg-inline" data-do="pet-mig-ok">알겠어요</button></div>`:'';
    const card=id=>{
      const d=R.PETS[id],c=R.petCopies(p,id),g=R.petGrade(p,id),owned=c>0,choose=!!pending?.ids.includes(id),on=act===id,next=R.nextCardAt(c),lo=R.CARD_COPIES[Math.max(0,g)],pct=owned?(next?Math.round((c-lo)/(next-lo)*100):100):0,tier=g>=2?g-1:0,sp=d.special;
      const btn=choose?`이 친구 고르기${pending.qty>1?` · 카드 ${pending.qty}장`:''}`:on?'함께 출동 중':owned?'함께 출동하기':'보급에서 만나요';
      return `<article class="sg-panel sg-pet-card ${on?'sg-equipped':''} ${owned?'':'sg-unowned'} ${choose?'sg-pet-choose':''}" style="--pet-color:${d.color}"><button class="sg-pet-pic" data-pet-detail="${id}" aria-label="${esc(d.name)} 자세히">${petImage(id)}</button><div class="sg-pet-body"><div class="sg-pet-name"><h2>${esc(d.name)}</h2>${owned?`<span class="sg-medal sg-medal-${g}">${R.GRADE_NAMES[g]}</span>`:''}<small class="sg-pet-role"><b>${d.no}</b>${esc(d.role)}</small></div>${owned?`<div class="sg-pet-meter"><span><i style="width:${pct}%"></i></span><small>${c}장${next?` · ${R.GRADE_NAMES[R.cardGrade(next)]}까지 ${next-c}장`:' · 최고 등급'}</small></div>`:''}<p class="sg-pet-buff">${esc(R.petBuffText(id,Math.max(0,g)))}</p>${tier?`<p class="sg-pet-sp on"><b>${esc(sp.name)}</b></p>`:''}<div class="sg-pet-actions"><button class="${choose?'sg-primary':''}" ${owned||choose?'':'disabled'} data-action="${choose?'choose-pet':'pet'}" data-id="${id}">${btn}</button><button class="sg-inline" data-pet-detail="${id}">자세히</button></div></div></article>`;};
    return `${this.titleBar('친구','data-do="pet-help"',`<span class="sg-progress">${act?`함께 출동 · ${esc(R.PETS[act].name)}`:'1-3 성공 후'}</span>`)}
    ${pending?`<div class="sg-notice sg-pet-pending">${pending.key==='firstPet'?'1-3 성공 보상! 함께할 친구를 1마리 골라요(카드 1장).':'1-5 성공 보상! 친구를 1마리 골라 카드 3장을 받아요. 가진 친구도 고를 수 있어요.'}</div>`:''}${migNote}
    <div class="sg-pet-grid">${R.PET_IDS.map(card).join('')}</div>
    <div class="sg-gear-bar"><div class="sg-gear-bar-supply">${icon('gift')}<span><b>친구 보급 · 보급권 ${p.gifts}장</b><small>${open?(pool?`4종 중 무작위 · ${odds}`:'모든 친구가 전설이에요!'):'1-1 첫 성공 후 열려요'}</small></span><button class="sg-primary" data-do="draw-pet" ${open&&p.gifts>0&&pool?'':'disabled'}>보급 받기</button><button class="sg-supply-go5" data-do="draw-pet" data-times="5" ${open&&p.gifts>=5&&pool?'':'disabled'}>5번</button></div></div>`;
  }
  petDetail(id){
    const p=this.state().profile,d=R.PETS[id];if(!d||!p)return;const c=R.petCopies(p,id),g=R.petGrade(p,id),on=p.activePet===id;
    const grades=R.GRADE_NAMES.map((n,i)=>`<p class="sg-grade-row ${i===g?'on':''}"><span class="sg-medal sg-medal-${i}">${n}</span><span>${R.CARD_COPIES[i]}장 · ${esc(R.petBuffText(id,i))}</span></p>`).join('');
    const sp=['유니크','에픽','전설'].map((n,i)=>`<p class="${g>=i+2?'on':''}"><b>${g>=i+2?'✓ ':''}${n}</b> ${esc(d.special.text[i])}</p>`).join('');
    this.openDialog(`<div class="sg-dialog-icon">${petImage(id,'sg-pet-big')}</div><h2>${esc(d.name)}</h2><p>${d.no} ${esc(d.role)} · ${c?`카드 ${c}장${R.nextCardAt(c)?` (${R.nextCardAt(c)}장이면 ${R.GRADE_NAMES[R.cardGrade(R.nextCardAt(c))]})`:''}`:'아직 못 만났어요 · 친구 보급에서 만나요'}</p><div class="sg-rules sg-gear-rules"><h3>등급별 버프(함께 출동할 때)</h3>${grades}<h3>특수 능력 · ${esc(d.special.name)}</h3><div class="sg-gear-sp">${sp}</div></div><div class="sg-gear-dialog-actions">${c&&!on?`<button class="sg-primary" data-pet-go="${id}">함께 출동하기</button>`:''}<button data-close>닫기</button></div>`);
    this.dialog.querySelector('[data-pet-go]')?.addEventListener('click',async()=>{if(this.busy)return;this.dialog.close();await this.perform({kind:'pet',id});});
  }
  petHelp(){
    this.openDialog(`<h2>친구 규칙</h2><div class="sg-rules"><p><b>친구 4마리 = 네 방향</b> ① 꼬북이 생존(받는 피해·최대 체력·회복) ② 야옹이 이동·공격 속도 ③ 수달이 공격력·스킬 범위 ④ 아기사슴 새싹 경험치·코인 획득. 앞의 셋은 싸움을 강하게, 아기사슴은 더 빨리 크고 코인을 더 모아요. 한 마리와 함께 출동하면 그 친구 버프가 판 내내 붙어요(코인은 성공·실패 보상에 더해져요).</p><p><b>보급</b> 보급권 1장으로 4종 중 무작위 친구 카드(전설이 된 친구는 빼고). ${R.SUPPLY_BUNDLES.map(b=>`${b.qty}장 ${Math.round(b.chance*100)}%`).join(' · ')}. 파츠·장비 보급과 같은 보급권이에요.</p><p><b>등급</b> 같은 친구 카드를 모으면 저절로 올라가요. ${R.GRADE_NAMES.map((n,i)=>`${n} ${R.CARD_COPIES[i]}장`).join(' → ')}. 버프는 전설(최대)의 ${R.GRADE_NAMES.map((n,i)=>`${n} ${Math.round(R.PET_GRADE_RATE[i]*100)}%`).join(' · ')}.</p><p><b>특수 능력</b> 유니크에서 열리고, 에픽에서 강해지고, 전설에서 하나 더 생겨요.</p><p><b>친구 선물</b> 1-3 첫 성공 때 친구 1마리 카드 1장, 1-5 첫 성공 때 친구 1마리 카드 3장을 골라요(보급권을 쓰지 않아요).</p><p><b>바뀐 점</b> 참새는 야옹이, 물범이는 수달이와 하나가 되었고, 아기사슴은 새싹 경험치·코인, 야옹이는 속도 친구가 되었어요. 우정은 없어지고, 우정 4마다 함께 출동하던 친구 카드 1장으로 바뀌었어요.</p></div><button class="sg-primary" data-close>확인</button>`);
  }
  showPetResult(d){
    const pet=R.PETS[d?.id];if(!pet)return;const up=d.gradeAfter>Math.max(0,d.gradeBefore),nextAt=R.nextCardAt(d.after),next=nextAt?{left:nextAt-d.after,name:R.GRADE_NAMES[R.cardGrade(nextAt)]}:null,sp=pet.special,choice=d.mode==='choose-pet',gn=R.GRADE_NAMES[d.gradeAfter];
    const unlocked=up&&d.gradeAfter>=2?`<p class="sg-flip-gold">${d.gradeAfter===2?`특수 능력이 열렸어요! ${esc(sp.name)} · ${esc(sp.text[0])}`:`${R.GRADE_NAMES[d.gradeAfter]} 능력 · ${esc(sp.text[d.gradeAfter-2])}`}</p>`:'';
    const front=`${petImage(d.id,'sg-pet-big')}<h2>${esc(pet.name)} 카드 ×${d.qty}</h2>${d.isNew?`<p class="sg-flip-new">새 친구! ${esc(pet.role)}</p><p>${esc(R.petBuffText(d.id,d.gradeAfter))}</p>`:`<p class="sg-flip-count">${d.before}장 → <b>${d.after}장</b></p>`}<p><span class="sg-medal sg-medal-${d.gradeAfter}">${gn}</span> ${up?`<b>${gn} 달성!</b>`:next?`${next.name}까지 ${next.left}장`:'최고 등급'}</p>${unlocked}`;
    const level=up?(d.gradeAfter>=3?3:2):d.qty>=7?2:d.qty>=3?1:0;
    this.supplyShow({box:'part',label:choice?'친구 선물':'친구 보급',noBox:choice,front,grade:d.gradeAfter,level:choice?Math.max(1,level):level,banner:up?`${gn} 달성!`:d.qty>=7?'대박! 7장':d.qty>=3?'행운! 3장':d.isNew?'새 친구!':''});
  }
  // ---- 일일 미션(2026-09-24 밤 사용자 "보급권 수급을 위한 미션 시스템. 일일미션 깨면 하루에 10개씩 추가로", docs/37) ----
  // 5개 × 보급권 2장. 해내는 순간 서버가 보급권을 넣는다(받기 버튼 없음). 모험 화면 제목 옆 버튼 → 목록 창.
  missionButton(p,passes){
    const list=R.missionList(p,passes?.day),done=list.filter(m=>m.done),got=done.reduce((n,m)=>n+m.gifts,0);
    return `<button class="sg-mission-btn ${done.length===list.length?'all':''}" data-do="missions">${icon2('fn_mission','gift')}<span><b>오늘의 미션 ${done.length}/${list.length}</b><small>${done.length===list.length?'모두 해냈어요!':`보급권 ${got}/${R.MISSION_GIFTS}장 받음`}</small></span></button>`;
  }
  missionDialog(){
    const {profile:p,passes}=this.state();if(!p)return;const list=R.missionList(p,passes?.day);
    this.openDialog(`<h2>오늘의 미션</h2><p class="sg-mission-intro">해내면 바로 보급권! 다 하면 하루 <b>${R.MISSION_GIFTS}장</b>. 아침 8시에 새로 시작해요.</p><div class="sg-missions">${list.map(m=>`<div class="sg-mission ${m.done?'done':''}"><span class="sg-mission-check" aria-hidden="true">${m.done?'✓':''}</span><span class="sg-mission-text"><b>${esc(m.name)}</b>${m.hint?`<small>${esc(m.hint)}</small>`:''}<span class="sg-mission-bar"><i style="width:${Math.round(m.now/m.target*100)}%"></i></span></span><em>${m.done?'받았어요':`${m.now}/${m.target}`}<small>보급권 +${m.gifts}</small></em></div>`).join('')}</div><p class="sg-footnote sg-mission-foot">보급권은 파츠·장비·친구 보급에 써요. 이용권은 나오지 않아요.</p><button class="sg-primary" data-close>확인</button>`);
  }
  book(p){
    const tabs=[['skills','원소 스킬'],['supports','지원품'],['combos','진화'],['traits','특별한 적'],['records','정화 기록']];
    const tab=tabs.some(([id])=>id===this.bookTab)?this.bookTab:'skills',f=this.bookFilter,byEl=d=>f==='all'||d.element===f;
    const mini=(key,img,name,sub,text,color)=>`<button class="sg-panel sg-book-card" data-book-detail="${key}" style="--element:${color||'#769caf'}">${img}<span><small>${esc(sub)}</small><b>${esc(name)}</b><em>${esc(text)}</em></span></button>`;
    let body='';
    if(tab==='skills')body=`<div class="sg-book-grid">${entries(R.SKILLS).filter(([,d])=>byEl(d)).map(([id,d])=>mini(`skill:${id}`,skillIcon(id),d.name,`${elementName(d.element)} · Lv.1–3`,desc(d),R.ELEMENTS[d.element]?.color)).join('')}</div>`;
    else if(tab==='supports')body=`<div class="sg-book-grid">${entries(R.SUPPORTS).filter(([,d])=>byEl(d)).map(([id,d])=>mini(`support:${id}`,supportIcon(id),d.name,'지원품 · Lv.1–3',d.desc,d.color)).join('')}</div>`;
    else if(tab==='combos')body=`<div class="sg-book-grid">${entries(R.COMBOS).filter(([,d])=>byEl(d)).map(([id,d])=>mini(`combo:${id}`,skillIcon(id),d.name,`${R.SKILLS[d.skill]?.name||''} + ${R.SUPPORTS[d.support]?.name||''}`,desc(d),d.color)).join('')}</div>`;
    else if(tab==='traits')body=`<div class="sg-panel sg-traits">${entries(R.SPECIAL_TRAITS).map(([,d])=>`<div class="sg-record"><span><i class="sg-trait-dot" style="background:${d.color}"></i><b>${esc(d.name)}</b></span><small>${esc(d.desc)}</small></div>`).join('')}<p class="sg-footnote">어려움에서만 나와요. 발밑 색 고리와 머리 옆 표시로 알아봐요. 원소 방패의 색 = 막는 원소(불 주황 · 물 파랑 · 바람 초록 · 흙 갈색 · 번개 노랑).</p></div>`;
    else body=`<div class="sg-records">${CHAPTERS.map(c=>`<section class="sg-panel"><h3>${c.n}장 ${esc(c.name)}</h3>${chapterStages(c).map((s,i)=>`<div class="sg-record"><span>${c.n}-${i+1} ${esc(s.name)}</span><span class="sg-stars">${stars(p.stages[s.id]?.stars||0)}</span></div>`).join('')}</section>`).join('')}</div>`;
    return `${this.titleBar('도감','data-info="book"')}<div class="sg-segment sg-book-tabs">${tabs.map(([id,n])=>`<button data-book-tab="${id}" class="${tab===id?'on':''}">${n}</button>`).join('')}</div>${['skills','supports','combos'].includes(tab)?this.elementFilter(this.bookFilter,'book-filter'):''}${body}`;
  }
  // 도감 카드 자세히: 스킬(단계별 효과·진화 짝) · 지원품(단계별 효과·진화하는 스킬) · 진화(재료)
  bookDetail(key){
    const [kind,id]=String(key).split(':');let head='',body='';
    if(kind==='skill'&&R.SKILLS[id]){const d=R.SKILLS[id];head=`<div class="sg-dialog-icon">${skillIcon(id)}</div><h2>${esc(d.name)}</h2><p class="sg-footnote">${elementName(d.element)} 원소 스킬 · Lv.1–3</p>`;body=`<p>${esc(desc(d))}</p><ul class="sg-levels">${(d.levels||[]).map((t,i)=>`<li><b>Lv.${i+2}</b> ${esc(t)}</li>`).join('')}</ul><div class="sg-partners"><small>진화 짝 지원품</small>${entries(R.COMBOS).filter(([,c])=>c.skill===id).map(([,c])=>`<span>${supportIcon(c.support)} ${esc(R.SUPPORTS[c.support]?.name)} <b>→ ${esc(c.name)}</b></span>`).join('')}</div>`;}
    else if(kind==='support'&&R.SUPPORTS[id]){const d=R.SUPPORTS[id];head=`<div class="sg-dialog-icon">${supportIcon(id)}</div><h2>${esc(d.name)}</h2><p class="sg-footnote">지원품 · Lv.1–3</p>`;body=`<p>${esc(d.desc)}</p><ul class="sg-levels">${[1,2,3].map(lv=>`<li><b>Lv.${lv}</b> ${esc(d.label(lv))}</li>`).join('')}</ul><div class="sg-partners"><small>이 지원품으로 진화하는 스킬</small>${entries(R.COMBOS).filter(([,c])=>c.support===id).map(([,c])=>`<span>${skillIcon(c.skill)} ${esc(R.SKILLS[c.skill]?.name)} <b>→ ${esc(c.name)}</b></span>`).join('')}</div>`;}
    else if(kind==='combo'&&R.COMBOS[id]){const d=R.COMBOS[id];head=`<div class="sg-dialog-icon">${skillIcon(id)}</div><h2>${esc(d.name)}</h2><p class="sg-footnote">진화 스킬</p>`;body=`<div class="sg-recipe"><span>${skillIcon(d.skill)}<small>${esc(R.SKILLS[d.skill]?.name)}<br/>Lv.3</small></span><b>＋</b><span>${supportIcon(d.support)}<small>${esc(R.SUPPORTS[d.support]?.name)}</small></span><b>→</b><span>${skillIcon(id)}<small>${esc(d.name)}</small></span></div><p>${esc(desc(d))}</p>`;}
    else return;
    this.openDialog(`${head}<div class="sg-book-detail">${body}</div><button class="sg-primary" data-close>확인</button>`);
  }
  details(id){
    const d=R.PARTS[id];if(!d)return;const skill=partSkill(d),combos=entries(R.COMBOS).filter(([,c])=>c.skill===skill),item=this.state().profile?.parts?.[id];
    // 지금 → 다음 효과를 나란히: 레벨 1단계 = 이 스킬 피해 +3%, 등급 1단계 = +6%(노말 0 … 전설 +24%)
    const now=item?100+partBonus(item):null,next=item&&item.level<10?now+Math.round(R.PART_LEVEL_STEP*100):null,goal=item?R.nextGradeAt(item.copies):null;
    const progress=item?`<div class="sg-next-effect"><p><b>레벨</b> Lv.${item.level}${next?` → Lv.${item.level+1} · 이 스킬 피해 ${now} → ${next}`:' · 최고 레벨'}</p><p><b>등급</b> ${medal(item.copies)} ${item.copies}개${goal?` · ${goal}개가 되면 ${R.GRADE_NAMES[R.grade(goal)]}`:' · 최고 등급(전설)'}</p><p><b>지금 능력</b> ${gradeAbility(R.grade(item.copies))}</p>${goal?`<p><b>${R.GRADE_NAMES[R.grade(goal)]}${subjJosa(R.GRADE_NAMES[R.grade(goal)])} 되면</b> ${gradeAbility(R.grade(goal))}</p>`:''}</div>`:'<p class="sg-footnote">아직 없는 파츠예요. 보급으로 받을 수 있어요.</p>';
    this.openDialog(`<div class="sg-dialog-icon">${partIcon(id)}</div><h2>${esc(d.name)}</h2><p>${esc(desc(d))}</p><p>첫 획득부터 기능이 열려요. 장착하고 판에서 <strong class="sg-nw">${esc(R.SKILLS[skill]?.name)}</strong>${objJosa(R.SKILLS[skill]?.name)} 고르면 적용돼요.</p><div class="sg-detail-recipes">${combos.map(([,c])=>`<p>${esc(R.SKILLS[skill]?.name)} Lv.3 + ${esc(R.SUPPORTS[c.support]?.name)}<br/><strong>→ ${esc(c.name)}</strong></p>`).join('')}</div><p class="sg-gold-feature"><b>유니크 기능${item?(R.grade(item.copies)>=2?' · 사용 중':` · ${R.GOLD_COPIES-item.copies}개 더 모으면`):` · 유니크(${R.GOLD_COPIES}개)부터`}:</b> ${esc(d.gold)}</p><p><b>진화한 뒤:</b> ${esc(({F1:'용암이 1초 더 오래 남아요.',F2:'불꽃놀이 로켓의 폭발 범위가 15% 넓어져요.',W1:'큰 풍선이 2번 더 튕겨요.',E1:'바위가 처음 맞을 때 작은 돌 2개로 갈라져요.',L1:'낙뢰마다 다른 적에게 피해 30%의 추가 번개가 떨어져요.'})[skill]||desc(d))}</p>${progress}<p class="sg-footnote">레벨 1단계마다 피해 +3%. 등급 피해 레어 10 · 유니크 25 · 에픽 45 · 전설 80%. 피해 증가와 파츠 기능·등급 능력 모두 진화 뒤에도 적용돼요.</p><div class="sg-gear-dialog-actions">${item&&item.level>1?`<button data-reset-part="${id}">레벨 되돌리기</button>`:''}<button class="sg-primary" data-close>확인</button></div>`);
    this.dialog.querySelector('[data-reset-part]')?.addEventListener('click',()=>this.resetDialog(id));
  }
  resetDialog(id){
    const item=this.state().profile?.parts?.[id];if(!item)return;const refund=R.partResetRefund?R.partResetRefund(item.level):60*(item.level-1)+10*(item.level-1)*(item.level-2);
    this.openDialog(`<h2>레벨 되돌리기</h2><p>${esc(R.PARTS[id].name)}${objJosa(R.PARTS[id].name)} Lv.1로 되돌리고, 레벨 올리기에 쓴 <strong>${refund} 코인</strong>을 모두 돌려받아요. 모은 개수와 메달은 그대로예요.</p><button class="sg-primary" id="sg-confirm-reset">${refund} 코인 돌려받기</button><button data-close>돌아가기</button>`);this.dialog.querySelector('#sg-confirm-reset').onclick=async()=>{this.dialog.close();await this.perform({kind:'reset-part',id});};
  }
  async click(e){
    const b=e.target.closest('button');if(!b||b.disabled||this.busy)return;
    if(b.dataset.chapter)this.chapterPicked=true;   // 장 단추를 직접 누른 뒤에는 그 장을 계속 보여 준다
    for(const [data,field] of [['tab','tab'],['chapter','chapter'],['stage','stage'],['partFilter','partFilter'],['bookFilter','bookFilter'],['bookTab','bookTab']])if(b.dataset[data]){this[field]=b.dataset[data];this.render();return;}
    const {profile:p,passes}=this.state();
    if(b.dataset.info){this.info(b.dataset.info);return;}
    if(b.dataset.bookDetail){this.bookDetail(b.dataset.bookDetail);return;}
    if(b.dataset.diff){   // 난이도 단추: 잠긴 어려움은 여는 조건 창, 아니면 그 자리에서 바꾼다(다시 그리지 않아 화면이 튀지 않게)
      if(b.dataset.locked){this.hardGateDialog(this.stage);return;}
      this.setDifficulty(b.dataset.diff);return;
    }
    if(b.dataset.detail){this.details(b.dataset.detail);return;}
    if(b.dataset.gearDetail){this.gearDetail(b.dataset.gearDetail);return;}
    if(b.dataset.gearSlot){this.gearSlotDialog(b.dataset.gearSlot);return;}
    if(b.dataset.gearSet){this.gearSetDialog(b.dataset.gearSet);return;}
    if(b.dataset.do==='test-grade'){this.testGradeDialog();return;}
    if(b.dataset.testType){if(b.dataset.testType!==this.state().profile?.weaponMode)await this.perform({kind:'test-gear-type',type:b.dataset.testType});return;}
    if(b.dataset.do==='gear-bag'){this.gearBagDialog();return;}
    if(b.dataset.do==='hard-ready'){this.hardReadyDialog(this.stage);return;}
    if(b.dataset.do==='hard-gate'){this.hardGateDialog(this.stage);return;}
    if(b.dataset.pickHero){this.heroConfirm(b.dataset.pickHero);return;}
    if(b.dataset.firstGear){await this.perform({kind:'choose-first-gear',id:b.dataset.firstGear});return;}
    if(b.dataset.do==='hero-dialog'){this.heroDialog();return;}
    if(b.dataset.do==='draw-gear'){await this.perform({kind:'draw-gear',...(b.dataset.times==='5'?{times:5}:{})});return;}
    if(b.dataset.do==='gear-help'){this.gearHelp();return;}
    if(b.dataset.reset){this.resetDialog(b.dataset.reset);return;}
    if(b.dataset.do==='passes'&&passes?.test){this.notify(`시험 이용권 ${passes.remaining}장 남음`,`시험 계정은 모두 ${passes.total}장이에요(지금까지 ${passes.used}장 사용). 출동할 때마다 1장을 써요. 성공·실패·중간에 끝내기 모두 같아요. 다음 날이 되어도 다시 채워지지 않아요.`);return;}
    if(b.dataset.do==='passes'){const ev=passes?.event;this.notify(ev?`${ev.title} · 오늘 이용권 ${ev.dailyTotal}장`:'매일 아침 이용권 10장',`${ev?ev.message+'\n':''}${R.PASS_NOTICE} 지금 기본 ${passes?.baseRemaining??0}장, 추가 ${passes?.bonusRemaining??0}장(${ev?`추석 이벤트 ${ev.bonus}장·`:''}선생님 지급)이 남았어요. 추가 이용권도 다음 아침 8시에 사라져요.`);return;}
    if(b.dataset.do==='account'){
      if(!R.heroLocked(p)){this.openDialog(`<h2>계정</h2><p>${esc(this.state().user||'')} 님</p><button class="sg-primary" data-do-hero>캐릭터 고르기</button><button id="sg-logout">로그아웃</button><button data-close>닫기</button>`);this.dialog.querySelector('[data-do-hero]').onclick=()=>this.heroDialog();this.dialog.querySelector('#sg-logout').onclick=()=>{this.dialog.close();this.c.logout();};return;}
      this.openDialog(`<h2>계정</h2><div class="sg-hero-choice sg-hero-now"><div><img src="./assets/sprites/heroes/${p.hero==='minji'?'minji':'hoya'}_idle_1.png" alt=""/><b>${heroName(p.hero)}</b><small>가입할 때 고른 캐릭터</small></div></div><p class="sg-footnote">캐릭터는 바꿀 수 없어요. 잘못 골랐다면 선생님께 말씀해 주세요.</p><button id="sg-logout">로그아웃</button><button data-close>닫기</button>`);this.dialog.querySelector('#sg-logout').onclick=()=>{this.dialog.close();this.c.logout();};return;
    }
    if(b.dataset.do==='start'){
      if(!R.heroLocked(p)){this.heroDialog();return;}
      const difficulty=this.root.querySelector('#sg-difficulty').value,weaponMode=this.root.querySelector('#sg-weapon-mode').value;this.busy=true;b.disabled=true;
      try{if(this.state().active)await this.c.abandon();   // 다른 창·기기에 남은 도전은 새로 출동할 때 정리(이용권 그대로, 난이도도 바꿀 수 있게)
      if(difficulty!==p.difficulty||weaponMode!==p.weaponMode)await this.c.action({kind:'settings',difficulty,weaponMode,hero:p.hero});await this.c.start(this.stage);}catch(err){this.notify('확인해 주세요',err.message);}finally{this.busy=false;this.render();}return;
    }
    if(b.dataset.do==='first-part-dialog'){this.firstPartDialog();return;}
    if(b.dataset.do==='choose-first-part'){await this.perform({kind:'choose-part',id:this.root.querySelector('#sg-first-part').value});return;}
    if(b.dataset.do==='draw-part'){await this.perform({kind:'draw-part',mode:b.dataset.mode,...(b.dataset.times==='5'?{times:5}:{})});return;}
    if(b.dataset.do==='buy-supply'){await this.perform({kind:'buy-supply'});return;}
    if(b.dataset.do==='supply-help'){this.supplyHelp();return;}
    if(b.dataset.action==='swap-part'){this.swapDialog(b.dataset.id);return;}
    if(b.dataset.petDetail){this.petDetail(b.dataset.petDetail);return;}
    if(b.dataset.do==='draw-pet'){await this.perform({kind:'draw-pet',...(b.dataset.times==='5'?{times:5}:{})});return;}
    if(b.dataset.do==='pet-help'){this.petHelp();return;}
    if(b.dataset.do==='missions'){this.missionDialog();return;}
    if(b.dataset.do==='pet-mig-ok'){this.petMigSeen=true;try{localStorage.setItem('seoho_pet_mig_seen','1');}catch(e){}this.render();return;}
    if(b.dataset.action){await this.perform({kind:b.dataset.action,id:b.dataset.id,stat:b.dataset.stat,slot:b.dataset.slot});return;}
    if(b.dataset.do==='refresh'){this.busy=true;try{await this.c.refresh();}catch(err){this.notify('확인해 주세요',err.message);}finally{this.busy=false;this.render();}}
  }
  async perform(a){
    this.busy=true;this.render();
    try{const r=await this.c.action(a);if(r.draw)this.showDrawResult(r.draw);else if(['equip-gear','unequip-gear','pet'].includes(a.kind))this.toast(r.message);else this.notify(/미션 완료/.test(r.message)?'미션 완료!':'저장했어요',r.message);}
    catch(e){
      // 다른 기기·옛 화면 때문에 보급 차례가 어긋나면 서버가 아무것도 바꾸지 않고 거절한다 → 새로 불러와 맞는 칸을 보여 준다.
      if(e.data?.code==='DRAW_MODE'){try{await this.c.refresh();}catch(err){}this.notify('보급 규칙이 바뀌었어요','화면을 새로 불러왔어요. 다시 눌러 주세요. 보급권은 그대로예요.');}
      else this.notify('확인해 주세요',e.message);
    }finally{this.busy=false;this.render();}
  }
}
