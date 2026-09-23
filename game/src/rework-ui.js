import * as R from './rework-core.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=o=>Object.entries(o||{}),modern=id=>/^(element_|skill_|part_|combo_|mode_)/.test(id);
export const icon=(id,cls='')=>`<img class="sg-icon ${cls}" src="./assets/${modern(id)?'elements_v2':'seoho_v1'}/icons/${esc(id)}.svg" alt="" />`;
export const petImage=(id,cls='')=>`<img class="sg-pet ${cls}" src="./assets/seoho_v1/pets/${esc(id)}_idle.png" alt="${esc(R.PETS[id]?.name||id)}" />`;
const stars=n=>'★'.repeat(Math.max(0,Math.min(3,n)))+'☆'.repeat(Math.max(0,3-n));
// 스킬·지원품·진화·파츠 아이콘은 사용자 Gemini 그림(assets/sprites/skills)을 그대로 쓴다
const spriteImg=(d,cls='')=>d?.sprite?`<img class="sg-icon ${cls}" src="./assets/sprites/skills/${esc(d.sprite)}.png" alt="" />`:'';
const skillIcon=id=>spriteImg(R.SKILLS[id]||R.COMBOS[id])||icon(`skill_${id}`),partIcon=id=>spriteImg(R.PARTS[id])||icon(`part_${id}`),supportIcon=id=>spriteImg(R.SUPPORTS[id]),elementName=id=>R.ELEMENTS[id]?.name||'기본';
const elements=()=>entries(R.ELEMENTS).filter(([id])=>id!=='neutral');
const desc=d=>d.desc||d.behavior||'',ingredients=d=>d.ingredients||d.skills||[],partSkill=d=>d.skill||d.skillId;
const gradeName=c=>R.GRADE_NAMES[R.grade(c)];
// 메달(동·은·금) 표시와 남은 개수. 개수 상한이 없어 금 뒤에도 개수가 늘 수 있다.
const medal=c=>`<span class="sg-medal sg-medal-${R.grade(c)}">${gradeName(c)}</span>`;
const toGold=c=>Math.max(0,R.GOLD_COPIES-(c||0));
const ownedKinds=p=>Object.keys(R.PARTS).filter(id=>p.parts?.[id]?.copies>0);
// 받침에 맞는 목적격 조사(물대포를 · 불꽃병을)
const objJosa=s=>{const t=String(s||''),c=t.charCodeAt(t.length-1)-0xAC00;return c>=0&&c<11172&&c%28===0?'를':'을';};
const partBonus=d=>Math.round(((d?.level||1)-1)*R.PART_LEVEL_STEP*100+R.grade(d?.copies||1)*R.GRADE_STEP*100);
const partOptions=(p,preferUsed=false)=>entries(R.PARTS).sort(([ai,a],[bi,b])=>Number((p.parts?.[ai]?.copies||0)>=7)-Number((p.parts?.[bi]?.copies||0)>=7)||(preferUsed?(p.skillUsage?.[partSkill(b)]||0)-(p.skillUsage?.[partSkill(a)]||0):0)).map(([id,d])=>`<option value="${id}" ${(p.parts?.[id]?.copies||0)>=7?'disabled':''}>${(p.parts?.[id]?.copies||0)>=7?'금 · ':''}${preferUsed&&p.skillUsage?.[partSkill(d)]?'사용한 스킬 · ':''}${esc(d.name)}</option>`).join('');
// 기본 무기는 근거리·원거리만(무기 원소 설정은 2026-09-23에 없앰). 난이도는 쉬움 ★ · 보통 ★★ · 어려움 ★★★.
const weaponHelp=(mode,hero)=>`<b>${mode==='ranged'?'원거리':'근거리'} 기본 무기</b><span>${mode==='ranged'?(hero==='minji'?'피구공을 던져 떨어진 적을 공격해요.':'배트로 야구공을 쳐서 떨어진 적을 공격해요.'):'가까운 적을 넓게 휘둘러 공격해요.'} 원소 스킬은 판 안에서 카드로 골라요.</span>`;
const starText=n=>'★'.repeat(Math.max(0,Math.min(3,n)));
const difficultyHelp=id=>{const d=R.DIFFICULTIES[id]||R.DIFFICULTIES.easy;return `<b>${esc(d.name)} ${starText(d.stars)}</b><span>${esc(d.desc)}</span>`;};

export class GuardianUI {
  constructor(menu,callbacks){
    this.c=callbacks;this.tab='adventure';this.stage='CH01';this.element='fire';this.partFilter='all';this.bookFilter='all';this.bookTab='skills';this.busy=false;
    menu.classList.add('sg-mode');this.root=document.createElement('div');this.root.id='guardian-lobby';menu.append(this.root);
    this.dialog=document.createElement('dialog');this.dialog.className='sg-dialog';document.body.append(this.dialog);
    this.dialog.addEventListener('click',e=>{if(e.target===this.dialog)this.dialog.close();});
    this.root.addEventListener('click',e=>this.click(e));
    this.root.addEventListener('change',e=>{
      if(e.target.id==='sg-weapon-mode'){const help=this.root.querySelector('#sg-weapon-help');if(help)help.innerHTML=weaponHelp(e.target.value,this.state().profile.hero);}
      if(e.target.id==='sg-difficulty'){const help=this.root.querySelector('#sg-difficulty-help');if(help)help.innerHTML=difficultyHelp(e.target.value);}
    });
  }
  state(){return this.c.getState();}
  openDialog(markup){this.dialog.innerHTML=markup;this.dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>this.dialog.close());if(!this.dialog.open)this.dialog.showModal();}
  notify(title,text){this.openDialog(`<h2>${esc(title)}</h2><p>${esc(text||'서버에 저장했어요.')}</p><button class="sg-primary" data-close>확인</button>`);}
  render(){
    const {profile:p,passes,user,error,active}=this.state();
    if(!p){this.root.innerHTML=`<div class="sg-loading"><h1>수호대 기록을 불러오는 중</h1><p>${esc(error||'잠시만 기다려 주세요.')}</p><button data-do="refresh">다시 확인</button></div>`;return;}
    if(!R.stageUnlocked(p,this.stage))this.stage='CH01';
    const pendingPet=R.pendingPet(p),pendingPart=R.pendingPart(p);
    this.root.innerHTML=`<header class="sg-header"><div class="sg-brand">${icon('element_wind')}<span>서호팡팡<small>수호대</small></span></div><div class="sg-wallet"><button data-do="passes" aria-label="이용권 안내">${icon('pass')}<b>${passes?.remaining??'…'}</b><span>${passes?.event?'추석 2배':'이용권'}</span></button><div>${icon('coin')}<b>${p.coins.toLocaleString()}</b><span>코인</span></div><button data-tab="parts" aria-label="파츠 보급과 보급권">${icon('gift')}<b>${p.gifts}</b><span>보급권</span></button></div><button class="sg-account" data-do="account" aria-label="계정과 캐릭터 선택">${esc(user)} 님</button></header>
    <main class="sg-main" aria-live="polite">${active?'<div class="sg-notice">마무리하지 않은 도전이 있어요. <button data-do="abandon">이용권 차감 없이 정리하기</button></div>':''}${this.nextTask(p)}${this[this.tab](p,passes)}</main>
    <nav class="sg-nav" aria-label="수호대 메뉴">${[['adventure','map','모험'],['training','mode_melee','훈련'],['parts','part_PART_F1','파츠'],['friends','heart','친구'],['book','book','도감']].map(([id,im,label])=>`<button data-tab="${id}" class="${this.tab===id?'on':''}" aria-current="${this.tab===id?'page':'false'}">${icon(im)}<span>${label}${id==='parts'&&p.gifts>0?` <b class="sg-count-badge" aria-label="보급권 ${p.gifts}장">${p.gifts}</b>`:''}</span></button>`).join('')}</nav>`;
    if(this.busy)this.root.querySelectorAll('button,select').forEach(b=>b.disabled=true);
  }
  nextTask(p){
    const available=R.selectableParts(p).length;
    let task=null;
    if(R.pendingPart(p)&&available)task={tab:'parts',text:'첫 성공 보상 · 원하는 파츠 1개 받기',first:true};
    else if(R.pendingPet(p))task={tab:'friends',text:'함께 출동할 첫 친구 고르기'};
    else if(p.stages.CH01?.cleared&&p.gifts>0&&available)task={tab:'parts',text:`보급권 ${p.gifts}장이 있어요 · 파츠 보급 받으러 가기`};
    else if(R.runParts(p).length<3&&Object.keys(p.parts).some(id=>R.PARTS[id]&&!p.equippedParts.includes(id)))task={tab:'parts',text:'빈 파츠 칸에 가진 파츠 끼우기'};
    if(!task||(!task.first&&this.tab===task.tab))return '';
    return `<button class="sg-milestone sg-next-task" ${task.first?'data-do="first-part-dialog"':`data-tab="${task.tab}"`}>${icon('gift')}<span><small>다음 할 일</small><strong>${esc(task.text)} →</strong></span></button>`;
  }
  firstPartDialog(){
    const p=this.state().profile;if(!R.pendingPart(p))return;
    this.openDialog(`<div class="sg-first-heading"><h2>첫 파츠를 골라요</h2><button data-close>나중에</button></div><p>원하는 파츠 1개를 무료로 받아요. 빈 칸이 있으면 바로 장착해요.</p><div class="sg-first-grid">${entries(R.PARTS).map(([id,d])=>`<button data-first-part="${id}" ${(p.parts?.[id]?.copies||0)>=7?'disabled':''}>${partIcon(id)}<b>${esc(d.name)}</b><small>${esc(R.SKILLS[d.skill].name)} · 가짐 ${p.parts?.[id]?.copies||0}개</small><span>${esc(d.desc)}</span>${(p.parts?.[id]?.copies||0)>=7?'<small>이미 금이에요</small>':''}</button>`).join('')}</div><button data-close>나중에</button>`);
    this.dialog.querySelectorAll('[data-first-part]').forEach(button=>button.onclick=async()=>{
      if(this.busy)return;this.dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
      this.dialog.close();await this.perform({kind:'choose-part',id:button.dataset.firstPart});
    });
  }
  adventure(p,passes){
    const st=R.STAGES.find(s=>s.id===this.stage),duration=R.durationFor(p,st.id),done=R.STAGES.filter(s=>p.stages[s.id]?.cleared).length,pictures=['en_snackbag','en_buttbug','en_bottle','en_baggy','boss_calm'];
    const mode=p.weaponMode||'melee',difficulty=R.difficultyOf(p),weaponName=mode==='melee'?(p.hero==='minji'?'연필':'검'):(p.hero==='minji'?'피구공':'야구 배트');
    return `<div class="sg-heading"><div><span class="sg-eyebrow">CHAPTER 01 · 쓰레기 마을</span><h1>다섯 원소로 지키는 마을</h1><p>이동에 집중하세요. 공격은 자동으로, 스킬은 내 선택으로.</p></div><span class="sg-progress">${done} / 5 정화</span></div>
    <div class="sg-stage-map">${R.STAGES.map((s,i)=>{const open=R.stageUnlocked(p,s.id);return `<button class="sg-stage ${s.id===this.stage?'selected':''} ${p.stages[s.id]?.cleared?'cleared':''}" data-stage="${s.id}" ${open?'':'disabled'} aria-label="1-${i+1} ${esc(s.name)}${open?'':' 잠김'}"><span class="sg-stage-number">1-${i+1}</span><img src="./assets/sprites/t1/${pictures[i]}.png" alt=""/><strong>${esc(s.name)}</strong><span class="sg-stars">${open?stars(p.stages[s.id]?.stars||0):'앞 단계 성공 후'}</span>${open&&passes?.day&&R.stageGiftLeft(p,s.id,passes.day)<R.STAGE_GIFT_CLEARS_PER_DAY?`<small class="sg-stage-gift ${R.stageGiftLeft(p,s.id,passes.day)?'':'done'}">${R.stageGiftLeft(p,s.id,passes.day)?`오늘 보급권 ${R.stageGiftLeft(p,s.id,passes.day)}번 남음`:'오늘 보급권 끝'}</small>`:''}</button>`;}).join('')}</div>
    <div class="sg-departure"><div class="sg-hero-scene"><img class="sg-hero" src="./assets/sprites/heroes/${p.hero==='minji'?'minji':'hoya'}_idle_1.png" alt="${p.hero==='hoya'?'호야':'민지'}"/>${p.activePet?petImage(p.activePet):'<span class="sg-future-pet">1-3 성공 후<br/>친구 선택</span>'}<span>${esc(weaponName)} · ${mode==='ranged'?'원거리':'근거리'} <button data-do="account" class="sg-inline">캐릭터 바꾸기</button></span></div><div class="sg-brief"><span class="sg-eyebrow">선택한 모험 · 1-${Number(st.id.slice(2))}</span><h2>${esc(st.name)}</h2><p>${esc(st.story)}</p><div class="sg-goal">${icon('element_wind')} ${esc(st.goal)} <small>환경 목표 · 성공하면 코인 +30</small></div><div class="sg-options"><label>난이도<select id="sg-difficulty">${entries(R.DIFFICULTIES).map(([id,d])=>`<option value="${id}" ${difficulty===id?'selected':''}>${esc(d.name)} ${starText(d.stars)}</option>`).join('')}</select></label><label>기본 무기<select id="sg-weapon-mode"><option value="melee" ${mode==='melee'?'selected':''}>근거리 · ${p.hero==='minji'?'연필':'검'}</option><option value="ranged" ${mode==='ranged'?'selected':''}>원거리 · ${p.hero==='minji'?'피구공':'야구 배트'}</option></select></label></div><div id="sg-difficulty-help" class="sg-weapon-help" aria-live="polite">${difficultyHelp(difficulty)}</div><div id="sg-weapon-help" class="sg-weapon-help" aria-live="polite">${weaponHelp(mode,p.hero)}</div><small>성공하면 난이도만큼 별을 받아요: 쉬움 ★ · 보통 ★★ · 어려움 ★★★. 성공 보급권은 쉬움·보통 1장, <b>어려움 2장</b>. 같은 단계는 하루 2번 성공까지 받아요(아침 8시에 다시).</small>${passes?.day?`<div class="sg-goal sg-stage-gift-note">${icon('gift')} 오늘 이 단계 보급권: ${R.stageGiftLeft(p,st.id,passes.day)?`<b>${R.stageGiftLeft(p,st.id,passes.day)}번 더 받을 수 있어요</b>`:'<b>다 받았어요</b> · 다른 단계에 도전하면 또 받아요'}</div>`:''}<div class="sg-run-summary">${icon('mode_melee')} 기본 무기 1개 <span>+</span> ${skillIcon('F1')} 원소 스킬 4칸 <span>+</span> ${supportIcon('S4')} 지원품 4칸</div><button id="sg-start" class="sg-primary sg-start" data-do="start" ${passes?.remaining>0&&!this.state().active?'':'disabled'}>${passes?.remaining===0?'내일 아침 8시에 만나요':'출동하기'} ${icon('arrow')}</button><small class="sg-pass-hint">${duration===180?'첫 성공까지 3분':st.id==='CH05'?'4분 뒤 대장 등장 · 최대 6분':'5분 도전'} · 성공할 때 이용권 1장</small></div></div>
    <div class="sg-feature-strip"><div><b>원소 스킬 10 · 지원품 8</b><span>모든 스테이지에서 획득</span></div><div><b>스킬 3단계 + 짝 지원품</b><span>금색 카드로 진화 10종</span></div><div><b>실패해도 다시 도전</b><span>이용권은 성공할 때만 차감</span></div></div>`;
  }
  training(p){
    const defs={attack:{name:'공격력',icon:'mode_melee',base:30,rate:.03,desc:'기본 무기와 모든 공격 스킬이 강해져요.'},hp:{name:'체력',icon:'heart',base:260,rate:.03,desc:'더 오래 버티며 조합을 완성할 수 있어요.'},speed:{name:'이동 속도',icon:'mode_ranged',base:4.5,rate:.005,desc:'위험한 공격을 피하고 경험치를 모아요.'}};
    return `<div class="sg-heading"><div><span class="sg-eyebrow">CHARACTER TRAINING</span><h1>기본기를 단단하게</h1><p>훈련은 항상 성공해요. 호야와 민지가 훈련 단계를 함께 사용해요.</p></div></div><div class="sg-grid sg-training">${entries(defs).map(([id,d])=>{const lv=p.training[id],cost=(R.trainingCost||R.upgradeCost)(lv),gain=(lv-1)*d.rate*100,value=d.base*(1+gain/100);return `<article class="sg-panel"><div class="sg-panel-title">${icon(d.icon)}<span class="sg-eyebrow">${d.name}</span><b>Lv.${lv} <small>/ 20</small></b></div><h2>${id==='speed'?value.toFixed(2):Math.round(value)}</h2><span class="sg-stat-increase">기본 능력 +${Number(gain.toFixed(1))}%</span><p>${d.desc}</p><div class="sg-meter" role="meter" aria-label="${d.name} 훈련 단계" aria-valuemin="1" aria-valuemax="20" aria-valuenow="${lv}"><i style="width:${lv*5}%"></i></div><button data-action="train" data-stat="${id}" ${cost!==null&&p.coins>=cost?'':'disabled'}>${cost===null?'최고 단계':`훈련하기 · ${cost} 코인`}</button></article>`;}).join('')}</div><div class="sg-panel sg-help"><h3>훈련과 파츠, 이렇게 달라요</h3><p><strong>훈련</strong>은 캐릭터의 기본 능력을 높여요. <strong>파츠</strong>는 특정 스킬에 새 기능을 더해요. 스테이지 안에서 올린 스킬 단계는 새 도전마다 처음부터 시작해요.</p><button data-tab="parts">스킬에 기능을 더하는 파츠 보기 →</button></div>`;
  }
  elementFilter(current,attribute){return `<div class="sg-element-filter" aria-label="원소별 보기"><button data-${attribute}="all" class="${current==='all'?'on':''}">전체</button>${elements().map(([id,d])=>`<button data-${attribute}="${id}" class="${current===id?'on':''}">${icon(`element_${id}`)}${esc(d.name)}</button>`).join('')}</div>`;}
  parts(p,passes){
    const equipped=p.equippedParts||[],pending=R.pendingPart(p),counts=R.setCounts(p),runIds=R.runParts(p),distinct=new Set(runIds.map(id=>R.PARTS[id].element)).size,rainbow=R.rainbowSet(p);
    return `<div class="sg-heading"><div><span class="sg-eyebrow">SKILL PARTS</span><h1>나만의 공격을 만드는 파츠</h1><p>파츠 3개까지 장착할 수 있어요. 해당 스킬을 고르면 새 기능이 발동해요.</p></div><span class="sg-progress">장착 ${equipped.length} / 3</span></div>
    ${pending?`<div class="sg-panel sg-first-part"><span class="sg-eyebrow">1-1 첫 성공 보상</span><h2>원하는 파츠 1개를 선택하세요</h2><p>10종 중 하나를 바로 받아요. 사용했던 스킬의 파츠를 먼저 보여드려요. 보급권과 보급 횟수는 사용하지 않아요.</p><label>첫 파츠<select id="sg-first-part">${partOptions(p,true)}</select></label><button class="sg-primary" data-do="choose-first-part" ${R.selectableParts(p).length?'':'disabled'}>선택한 파츠 받기</button></div>`:''}
    <div class="sg-equipped-parts">${Array.from({length:3},(_,i)=>{const id=equipped[i],d=R.PARTS[id];return d?`<button data-action="unequip-part" data-id="${id}" title="장착 해제">${partIcon(id)}<span><b>${esc(d.name)}</b><small>Lv.${p.parts[id]?.level||1} · ${gradeName(p.parts[id]?.copies||1)} · 눌러서 해제</small></span><span aria-hidden="true">×</span></button>`:`<div class="sg-empty-slot"><span>＋</span> 파츠 ${i+1} 빈칸</div>`;}).join('')}</div>
    <div class="sg-set-row">${elements().map(([id,d])=>`<span class="${(counts[id]||0)>=2?'sg-set-active':''}">${icon(`element_${id}`)} ${esc(d.name)} ${counts[id]||0}/2${counts[id]>=2?' · 피해 +4%':''}</span>`).join('')}<span class="${rainbow?'sg-set-active':''}">서로 다른 원소 ${distinct}/3${rainbow?' · 최대 체력 +5%':''}</span></div><p class="sg-footnote">같은 원소 2개 → 그 원소 스킬 피해 +4% · 서로 다른 원소 3개 → 최대 체력 +5%. 파츠가 없어도 모든 스킬과 진화를 사용할 수 있어요.</p>
    ${this.supply(p,passes)}
    <div class="sg-section-heading"><h2>파츠 보관함</h2><small>${ownedKinds(p).length} / 10종 보유</small></div>${this.elementFilter(this.partFilter,'part-filter')}<div class="sg-grid sg-parts-grid">${entries(R.PARTS).filter(([,d])=>this.partFilter==='all'||d.element===this.partFilter).map(([id,d])=>{const item=p.parts[id],on=equipped.includes(id),cost=item?R.partUpgradeCost(item.level):null,sid=partSkill(d),full=equipped.length>=3;return `<article class="sg-panel sg-part-card ${on?'sg-equipped':''} ${item?'':'sg-unowned'}" style="--element:${R.ELEMENTS[d.element]?.color||'#4c91ae'}"><div class="sg-panel-title">${partIcon(id)}<div><span class="sg-eyebrow">${elementName(d.element)} · ${item?`${gradeName(item.copies)} 메달`:'미보유'}</span><h3>${esc(d.name)}</h3></div>${item?medal(item.copies):''}</div><p class="sg-part-skill">${skillIcon(sid)} ${esc(R.SKILLS[sid]?.name)} 파츠</p><p>${esc(desc(d))}</p>${item&&R.grade(item.copies)>=2?`<p class="sg-gold-feature">금 기능 · ${esc(d.gold)}</p>`:''}${item?`<div class="sg-part-stats"><b>Lv.${item.level} / 10</b><span>피해 +${partBonus(item)}%</span><small>${item.copies}개${toGold(item.copies)?` · 금까지 ${toGold(item.copies)}개`:''}</small></div><div class="sg-part-buttons"><button data-action="${on?'unequip-part':full?'swap-part':'equip-part'}" data-id="${id}">${on?'장착 해제':full?'바꿔 끼우기':'장착'}</button><button data-action="upgrade-part" data-id="${id}" ${cost!==null&&p.coins>=cost?'':'disabled'}>${cost===null?'최고 레벨':`레벨 올리기 · ${cost}`}</button></div>`:'<div class="sg-part-unowned">보급으로 받기 · 스킬은 지금도 사용 가능</div>'}<div class="sg-card-links"><button class="sg-inline" data-detail="${id}">기능·다음 효과</button>${item&&item.level>1?`<button class="sg-inline" data-reset="${id}">레벨 되돌리기</button>`:''}</div></article>`;}).join('')}</div><p class="sg-footnote">같은 파츠 3개 → 은 메달(피해 +6%), 7개 → 금 메달(+12%). 금이 된 파츠는 원소 보급에서 나오지 않고, 남는 개수도 버리지 않아요. 레벨 1단계마다 그 스킬 피해 +3%, 레벨 되돌리기를 하면 쓴 코인을 모두 돌려받아요.</p>`;
  }
  // 파츠 보급 칸(2차): 이번 차례(pick/new/element)에 맞는 고르기 하나만 보여 준다. 결과 전 힌트·"더 뽑기" 재촉 없음.
  supply(p,passes){
    const open=!!p.stages.CH01?.cleared,n=p.giftCounts.part||0,mode=R.drawMode(p),kinds=ownedKinds(p).length,left=5-n%5;
    const today=passes?.day,bought=!!today&&p.supplyBuyDay===today,canBuy=open&&!!today&&!bought&&p.coins>=R.SUPPLY_EXCHANGE_COST;
    const title=!mode?'모든 파츠가 금이에요!':mode==='pick'?'5번째 보급! 원하는 파츠 3개':mode==='new'?`처음 3종은 골라 받아요 · ${kinds}/3종`:`원소를 골라 보급 · ${left}번 더 받으면 원하는 파츠 3개`;
    const used=id=>p.skillUsage?.[R.PARTS[id].skill]||0,byUse=(a,b)=>used(b)-used(a);
    let control='';
    if(mode==='pick')control=`<label>원하는 파츠 3개 받기<select id="sg-draw-part">${R.selectableParts(p).sort(byUse).map(id=>{const c=p.parts[id]?.copies||0;return `<option value="${id}">${esc(R.PARTS[id].name)} · ${c}개 → ${c+3}개${c+3>=R.GOLD_COPIES?' 금!':''}</option>`;}).join('')}${Object.keys(R.PARTS).filter(id=>!R.selectableParts(p).includes(id)).map(id=>`<option value="${id}" disabled>금 · ${esc(R.PARTS[id].name)} (완성)</option>`).join('')}</select></label><p class="sg-footnote">금까지 모자란 만큼 채우고 남는 개수는 보관돼요. 금이 된 파츠는 고를 수 없어요.</p>`;
    else if(mode==='new')control=`<label>아직 없는 파츠 1개 고르기<select id="sg-draw-part">${Object.keys(R.PARTS).filter(id=>!(p.parts[id]?.copies>0)).sort(byUse).map(id=>`<option value="${id}">${used(id)?'사용한 스킬 · ':''}${esc(R.PARTS[id].name)} (${esc(R.SKILLS[R.PARTS[id].skill].name)})</option>`).join('')}</select></label><p class="sg-footnote">파츠를 3종 모을 때까지는 원하는 파츠를 골라 받아요.</p>`;
    else if(mode==='element')control=`<label>원하는 원소<select id="sg-draw-element">${elements().map(([id,d])=>{const pool=R.elementPool(p,id);return `<option value="${id}" ${id===this.element&&pool.length?'selected':''} ${pool.length?'':'disabled'}>${esc(d.name)} · ${pool.length===2?'파츠 2종 중 하나':pool.length===1?`${esc(R.PARTS[pool[0]].name)} 확정`:'완성'}</option>`;}).join('')}</select></label><p class="sg-footnote">두 파츠 중 하나가 반반으로 와요. 금이 된 파츠는 나오지 않아요.</p>`;
    return `<section class="sg-panel sg-draw-panel sg-supply" data-mode="${mode||'done'}"><div><span class="sg-eyebrow">파츠 보급 · 보급권 1장</span><h2>${title}</h2><p>${open?'보급 1번에 파츠 1개, 5번째마다 원하는 파츠 3개! 원소를 바꾸거나 다시 접속해도 횟수는 이어져요.':'1-1 첫 성공 후 열려요. 지금 모은 보급권은 보관돼요.'}</p><div class="sg-gift-dots" aria-label="원하는 파츠 3개까지 ${left}번">${Array.from({length:5},(_,i)=>`<i class="${i<n%5?'on':''}${i===4?' sg-dot-pick':''}" title="${i===4?'원하는 파츠 3개':''}">${i+1}</i>`).join('')}</div><button class="sg-inline" data-do="supply-help">자세히</button></div><div>${control}<button class="sg-primary" data-do="draw-part" data-mode="${mode||''}" ${open&&p.gifts>0&&mode?'':'disabled'}>${!mode?'모든 파츠가 금이에요':'보급 받기'} · 보급권 1장</button><div class="sg-exchange"><span>${icon('coin')} 코인 ${R.SUPPLY_EXCHANGE_COST} → 보급권 1장<small>하루 1번 · 아침 8시에 다시</small></span><button data-do="buy-supply" ${canBuy?'':'disabled'}>${bought?'오늘 교환 완료':'바꾸기'}</button></div></div></section>`;
  }
  supplyHelp(){
    this.openDialog(`<h2>파츠 보급 규칙</h2><div class="sg-rules"><p><b>보통 보급</b> 고른 원소의 두 파츠가 각각 50%로 1개 와요. 한쪽이 금이면 다른 쪽이 100%, 둘 다 금이면 그 원소는 "완성"이에요.</p><p><b>5번째 보급</b> 금이 아닌 파츠 중 원하는 파츠를 3개 받아요.</p><p><b>처음 3종</b> 가진 파츠가 3종보다 적으면 없는 파츠를 골라 1개 받아요.</p><p><b>메달</b> 같은 파츠 1개 동 · 3개 은(피해 +6%) · 7개 금(+12%, 파츠마다 새 금 기능 1개). 파츠 1개가 있으면 누구나 10번 안에 원하는 파츠가 금이 돼요.</p><p><b>보급권 받는 곳</b> 성공 보상(쉬움·보통 1장, 어려움 2장, 같은 단계는 하루 2번 성공까지), 실패 격려(하루 1장까지), 코인 ${R.SUPPLY_EXCHANGE_COST}개 교환(하루 1번). 결제·광고는 없어요.</p></div><button class="sg-primary" data-close>확인</button>`);
  }
  // 결과 카드: 모든 결과에 같은 1.2초 뒤집기, 결과 전 힌트 없음, 축하는 메달이 오를 때만. 건너뛰기는 기억한다.
  showDrawResult(d){
    const part=R.PARTS[d?.id];if(!part)return;
    let skip=false;try{skip=localStorage.getItem('seoho_supply_skip_flip')==='1';}catch(e){}
    const up=d.gradeAfter>Math.max(0,d.gradeBefore),skill=R.SKILLS[part.skill];
    const front=`<div class="sg-flip-front ${up?'sg-celebrate':''}">${partIcon(d.id)}<h2>${esc(part.name)} ×${d.qty}</h2>${d.isNew?`<p class="sg-flip-new">새 파츠! ${esc(skill?.name)}에 기능이 생겨요</p><p>${esc(desc(part))}</p>`:`<p class="sg-flip-count">${d.before}개 → <b>${d.after}개</b></p>`}<p>${medal(d.after)} ${up?`<b>${gradeName(d.after)} 메달 달성!</b>`:toGold(d.after)?`금까지 ${toGold(d.after)}개`:'금 메달'}</p>${up&&d.gradeAfter===2?`<p class="sg-flip-gold">금 기능이 열렸어요! ${esc(part.gold)}</p>`:''}${d.autoEquipped?'<p class="sg-flip-slot">빈 칸에 끼웠어요</p>':''}</div>`;
    this.openDialog(`<div class="sg-flip ${skip?'sg-flip-skip':''}"><div class="sg-flip-inner"><div class="sg-flip-back">${icon('gift')}<b>파츠 보급</b></div>${front}</div></div><div class="sg-flip-actions">${skip?'<button class="sg-inline" data-do="flip-on">뒤집기 연출 켜기</button>':'<button data-do="flip-skip">건너뛰기</button>'}<button class="sg-primary" data-close>확인</button></div>`);
    const box=this.dialog.querySelector('.sg-flip');
    const set=v=>{try{if(v)localStorage.setItem('seoho_supply_skip_flip','1');else localStorage.removeItem('seoho_supply_skip_flip');}catch(e){}};
    this.dialog.querySelector('[data-do="flip-skip"]')?.addEventListener('click',()=>{set(true);box.classList.add('sg-flip-skip');});
    this.dialog.querySelector('[data-do="flip-on"]')?.addEventListener('click',e=>{set(false);e.target.textContent='다음부터 뒤집기 연출을 보여 줘요';e.target.disabled=true;});
  }
  swapDialog(id){
    const p=this.state().profile,d=R.PARTS[id];if(!d||!p.parts[id])return;
    this.openDialog(`<h2>${esc(d.name)} 끼우기</h2><p>칸이 가득 찼어요. 뺄 파츠를 골라 주세요. 뺀 파츠의 레벨과 개수는 그대로 남아요.</p><div class="sg-swap-list">${(p.equippedParts||[]).filter(x=>R.PARTS[x]).map(x=>`<button data-swap="${x}">${partIcon(x)}<b>${esc(R.PARTS[x].name)}</b><small>Lv.${p.parts[x]?.level||1} · ${gradeName(p.parts[x]?.copies||1)}</small></button>`).join('')}</div><button data-close>돌아가기</button>`);
    this.dialog.querySelectorAll('[data-swap]').forEach(b=>b.onclick=async()=>{if(this.busy)return;this.dialog.close();await this.perform({kind:'equip-part',id,replace:b.dataset.swap});});
  }
  friends(p){
    const pending=R.pendingPet(p),lv=R.friendshipLevel(p),open=!!p.stages.CH01?.cleared,n=p.giftCounts.pet||0,unowned=Object.keys(R.PETS).filter(id=>!p.pets.includes(id)),choice=(n+1)%5===0&&unowned.length>0,locked=!unowned.length&&p.friendship>=28;
    return `<div class="sg-heading"><div><span class="sg-eyebrow">COMPANIONS</span><h1>함께 출동할 친구</h1><p>한 마리와 함께 출동해요. 함께 있는 동안 효과가 계속 붙어요. 모든 친구가 우정 단계를 공유해요.</p></div><span class="sg-progress">우정 ${lv}단계 · ${p.friendship}/28</span></div>${pending?`<div class="sg-notice">${pending.key==='firstPet'?'1-3 성공 보상! 처음 함께할 친구를 선택하세요.':'새 친구 한 마리를 선택할 수 있어요.'}</div>`:''}<div class="sg-grid sg-pets">${entries(R.PETS).map(([id,d])=>{const owned=p.pets.includes(id),choose=pending?.ids.includes(id);return `<article class="sg-panel ${p.activePet===id?'sg-equipped':''}" style="--pet-color:${d.color}">${petImage(id)}<span class="sg-eyebrow">${esc(d.role)}</span><h2>${esc(d.name)}</h2><p>${esc(d.desc)}</p><button ${owned||choose?'':'disabled'} data-action="${choose?'choose-pet':'pet'}" data-id="${id}">${choose?'이 친구 선택':p.activePet===id?'함께 출동 중':owned?'함께 출동하기':'아직 만나지 않았어요'}</button></article>`;}).join('')}</div><section class="sg-panel sg-draw-panel"><div><span class="sg-eyebrow">친구 만나기 · 보급권 1장 · 파츠와 따로 세요</span><h2>${locked?'친구를 모두 만났어요!':choice?'이번에는 새 친구를 직접 선택!':unowned.length?`아직 못 만난 친구 ${unowned.length}마리가 먼저 와요`:'다시 만나면 우정 +1'}</h2><p>${!open?'1-1 첫 성공 후 열려요.':locked?'우정도 가득해요! 보급권은 파츠에 써요.':unowned.length?'못 만난 친구 중 한 마리가 찾아와요. 누구나 6번이면 모두 만나요.':'모두 만났어요. 다시 만나면 우정 +1이에요.'}</p><small>5번째마다 만나고 싶은 친구를 직접 골라요. 이용권은 나오지 않아요.</small></div><div>${choice?`<label>새 친구<select id="sg-gift-pet">${unowned.map(id=>`<option value="${id}">${esc(R.PETS[id].name)}</option>`).join('')}</select></label>`:''}<button class="sg-primary" data-do="pet-gift" ${open&&p.gifts>0&&!locked?'':'disabled'}>${locked?'모두 만났어요':'친구 만나기 · 보급권 1장'}</button></div></section><div class="sg-panel sg-help"><h3>함께한 만큼 커지는 우정</h3><p>성공할 때 우정 +1. 150초 이상 도전하고 실패한 판도 두 번 모이면 우정 +1이에요. 우정 3단계부터 친구 효과가 20% 좋아져요. 친구는 스킬 진화 재료가 아니에요.</p></div>`;
  }
  book(p){
    const tab=['skills','supports','combos'].includes(this.bookTab)?this.bookTab:'skills',f=this.bookFilter;
    const skills=entries(R.SKILLS).filter(([,d])=>f==='all'||d.element===f).map(([id,d])=>`<article class="sg-panel sg-skill-card" style="--element:${R.ELEMENTS[d.element]?.color}"><div class="sg-panel-title">${skillIcon(id)}<div><span class="sg-eyebrow">${elementName(d.element)} · Lv.1–3</span><h2>${esc(d.name)}</h2></div></div><p>${esc(desc(d))}</p><ul class="sg-levels">${(d.levels||[]).map((t,i)=>`<li><b>Lv.${i+2}</b> ${esc(t)}</li>`).join('')}</ul><div class="sg-partners"><small>진화 짝 지원품</small>${entries(R.COMBOS).filter(([,c])=>c.skill===id).map(([,c])=>`<span>${supportIcon(c.support)} ${esc(R.SUPPORTS[c.support]?.name)} <b>→ ${esc(c.name)}</b></span>`).join('')}</div></article>`).join('');
    const supports=entries(R.SUPPORTS).filter(([,d])=>f==='all'||d.element===f).map(([id,d])=>`<article class="sg-panel sg-skill-card" style="--element:${d.color}"><div class="sg-panel-title">${supportIcon(id)}<div><span class="sg-eyebrow">지원품 · Lv.1–3</span><h2>${esc(d.name)}</h2></div></div><p>${esc(d.desc)}</p><ul class="sg-levels">${[1,2,3].map(lv=>`<li><b>Lv.${lv}</b> ${esc(d.label(lv))}</li>`).join('')}</ul><div class="sg-partners"><small>이 지원품으로 진화하는 스킬</small>${entries(R.COMBOS).filter(([,c])=>c.support===id).map(([,c])=>`<span>${skillIcon(c.skill)} ${esc(R.SKILLS[c.skill]?.name)} <b>→ ${esc(c.name)}</b></span>`).join('')}</div></article>`).join('');
    const combos=entries(R.COMBOS).filter(([,d])=>f==='all'||d.element===f).map(([id,d])=>`<article class="sg-panel sg-evo-card" style="--element:${d.color}"><div class="sg-recipe"><span>${skillIcon(d.skill)}<small>${esc(R.SKILLS[d.skill]?.name)}<br/>Lv.3</small></span><b>＋</b><span>${supportIcon(d.support)}<small>${esc(R.SUPPORTS[d.support]?.name)}</small></span><b>→</b><span>${skillIcon(id)}</span></div><h2>${esc(d.name)}</h2><p>${esc(desc(d))}</p></article>`).join('');
    return `<div class="sg-heading"><div><span class="sg-eyebrow">FIELD GUIDE</span><h1>원소 스킬 · 지원품 · 진화 도감</h1><p>원소 스킬 10종과 지원품 8종을 모든 스테이지에서 얻을 수 있어요.</p></div></div><div class="sg-book-rules"><b>기본 무기 1개 + 원소 스킬 4칸 + 지원품 4칸</b><span>스킬 3단계 + 짝 지원품 → 금색 진화 카드</span><small>진화하면 그 스킬이 훨씬 크고 강한 모습으로 바뀌어요. 지원품은 그대로 남아요. 한 판에 2~3번 진화할 수 있어요.</small></div><div class="sg-segment sg-book-tabs"><button data-book-tab="skills" class="${tab==='skills'?'on':''}">원소 스킬 10종</button><button data-book-tab="supports" class="${tab==='supports'?'on':''}">지원품 8종</button><button data-book-tab="combos" class="${tab==='combos'?'on':''}">진화 10종</button></div>${this.elementFilter(this.bookFilter,'book-filter')}<div class="sg-grid sg-recipes">${tab==='skills'?skills:tab==='supports'?supports:combos}</div><div class="sg-panel sg-help"><h3>진화를 완성하는 요령</h3><p>마음에 드는 원소 스킬을 3단계까지 키우고, 도감에서 짝 지원품을 확인해 챙기세요. 둘이 갖춰지면 다음 선택에 금색 진화 카드가 나와요. 기본 무기와 친구는 진화 재료가 아니에요.</p></div><h2 class="sg-section-title">어려움에 나오는 특별한 적</h2><div class="sg-panel sg-traits">${entries(R.SPECIAL_TRAITS).map(([,d])=>`<div class="sg-record"><span><i class="sg-trait-dot" style="background:${d.color}"></i><b>${esc(d.name)}</b></span><small>${esc(d.desc)}</small></div>`).join('')}<p class="sg-footnote">발밑의 색 고리와 머리 옆 표시로 알아볼 수 있어요. 원소 방패는 방패 색깔이 막는 원소예요(불 주황 · 물 파랑 · 바람 초록 · 흙 갈색 · 번개 노랑). 큰 적은 늘 원소 방패를 들고 나와요.</p></div><h2 class="sg-section-title">마을 정화 기록</h2><div class="sg-panel">${R.STAGES.map((s,i)=>`<div class="sg-record"><span>1-${i+1} ${esc(s.name)}</span><span class="sg-stars">${stars(p.stages[s.id]?.stars||0)}</span></div>`).join('')}<p class="sg-footnote">성공하면 난이도만큼 별을 받아요: 쉬움 ★ · 보통 ★★ · 어려움 ★★★(저항·특수 능력을 가진 적 등장). 별 하나만 받아도 다음 길이 열려요.</p></div>`;
  }
  details(id){
    const d=R.PARTS[id];if(!d)return;const skill=partSkill(d),combos=entries(R.COMBOS).filter(([,c])=>c.skill===skill),item=this.state().profile?.parts?.[id];
    // 지금 → 다음 효과를 나란히(2차): 레벨 1단계 = 이 스킬 피해 +3%, 메달 = 동 0 · 은 +6% · 금 +12%
    const now=item?100+partBonus(item):null,next=item&&item.level<10?now+Math.round(R.PART_LEVEL_STEP*100):null,goal=item?R.nextGradeAt(item.copies):null;
    const progress=item?`<div class="sg-next-effect"><p><b>레벨</b> Lv.${item.level}${next?` → Lv.${item.level+1} · 이 스킬 피해 ${now} → ${next}`:' · 최고 레벨'}</p><p><b>메달</b> ${medal(item.copies)} ${item.copies}개${goal?` · ${goal}개가 되면 ${R.GRADE_NAMES[R.grade(goal)]} 메달(피해 +${R.grade(goal)*Math.round(R.GRADE_STEP*100)}%)`:' · 금 메달 완성'}</p></div>`:'<p class="sg-footnote">아직 없는 파츠예요. 보급으로 받을 수 있어요.</p>';
    this.openDialog(`<div class="sg-dialog-icon">${partIcon(id)}</div><h2>${esc(d.name)}</h2><p>${esc(desc(d))}</p><p>첫 획득부터 기능이 열려요. 장착 후 <strong>${esc(R.SKILLS[skill]?.name)}</strong>${objJosa(R.SKILLS[skill]?.name)} 획득하면 적용돼요.</p><div class="sg-detail-recipes">${combos.map(([,c])=>`<p>${esc(R.SKILLS[skill]?.name)} Lv.3 + ${esc(R.SUPPORTS[c.support]?.name)}<br/><strong>→ ${esc(c.name)}</strong></p>`).join('')}</div><p class="sg-gold-feature"><b>금 메달 기능${item?(R.grade(item.copies)>=2?' · 사용 중':` · ${toGold(item.copies)}개 더 모으면`):''}:</b> ${esc(d.gold)}</p><p><b>진화한 뒤:</b> ${esc(({F1:'용암이 1초 더 오래 남아요.',F2:'불꽃놀이 로켓의 폭발 범위가 15% 넓어져요.',W1:'큰 풍선이 2번 더 튕겨요.',E1:'바위가 처음 맞을 때 작은 돌 2개로 갈라져요.',L1:'낙뢰마다 다른 적에게 피해 30%의 추가 번개가 떨어져요.'})[skill]||desc(d))}</p>${progress}<p class="sg-footnote">레벨 1단계마다 피해 +3%, 은 메달 +6%, 금 메달 +12%. 피해 증가와 파츠 기능 모두 진화 뒤에도 적용돼요.</p><button class="sg-primary" data-close>확인</button>`);
  }
  async click(e){
    const b=e.target.closest('button');if(!b||b.disabled||this.busy)return;
    for(const [data,field] of [['tab','tab'],['stage','stage'],['partFilter','partFilter'],['bookFilter','bookFilter'],['bookTab','bookTab']])if(b.dataset[data]){this[field]=b.dataset[data];this.render();return;}
    const {profile:p,passes}=this.state();
    if(b.dataset.detail){this.details(b.dataset.detail);return;}
    if(b.dataset.reset){const id=b.dataset.reset,item=p.parts[id],refund=R.partResetRefund?R.partResetRefund(item.level):60*(item.level-1)+10*(item.level-1)*(item.level-2);this.openDialog(`<h2>레벨 되돌리기</h2><p>${esc(R.PARTS[id].name)}${objJosa(R.PARTS[id].name)} Lv.1로 되돌리고, 레벨 올리기에 쓴 <strong>${refund} 코인</strong>을 모두 돌려받아요. 모은 개수와 메달은 그대로예요.</p><button class="sg-primary" id="sg-confirm-reset">${refund} 코인 돌려받기</button><button data-close>돌아가기</button>`);this.dialog.querySelector('#sg-confirm-reset').onclick=async()=>{this.dialog.close();await this.perform({kind:'reset-part',id});};return;}
    if(b.dataset.do==='passes'){const ev=passes?.event;this.notify(ev?`${ev.title} · 오늘 이용권 ${ev.dailyTotal}장`:'이용권은 매일 아침 8시에 10장',`${ev?ev.message+'\n':''}${R.PASS_NOTICE} 지금 기본 ${passes?.baseRemaining??0}장, 추가 ${passes?.bonusRemaining??0}장(${ev?`추석 이벤트 ${ev.bonus}장·`:''}선생님 지급)이 남았어요. 추가 이용권도 다음 아침 8시에 사라져요.`);return;}
    if(b.dataset.do==='account'){
      this.openDialog(`<h2>캐릭터 선택</h2><p>호야와 민지는 같은 능력으로 싸워요. 무기 연출만 달라요.</p><div class="sg-hero-choice">${[['hoya','호야','검 · 야구 배트'],['minji','민지','연필 · 피구공']].map(([id,name,detail])=>`<button data-hero="${id}" class="${p.hero===id?'on':''}"><img src="./assets/sprites/heroes/${id}_idle_1.png" alt=""/><b>${name}</b><small>${detail}</small></button>`).join('')}</div><button id="sg-logout">로그아웃</button><button data-close>닫기</button>`);this.dialog.querySelector('#sg-logout').onclick=()=>{this.dialog.close();this.c.logout();};this.dialog.querySelectorAll('[data-hero]').forEach(x=>x.onclick=async()=>{this.dialog.close();await this.perform({kind:'settings',hero:x.dataset.hero,difficulty:R.difficultyOf(p),weaponMode:p.weaponMode});});return;
    }
    if(b.dataset.do==='start'){
      const difficulty=this.root.querySelector('#sg-difficulty').value,weaponMode=this.root.querySelector('#sg-weapon-mode').value;this.busy=true;b.disabled=true;
      try{if(difficulty!==p.difficulty||weaponMode!==p.weaponMode)await this.c.action({kind:'settings',difficulty,weaponMode,hero:p.hero});await this.c.start(this.stage);}catch(err){this.notify('확인해 주세요',err.message);}finally{this.busy=false;this.render();}return;
    }
    if(b.dataset.do==='first-part-dialog'){this.firstPartDialog();return;}
    if(b.dataset.do==='choose-first-part'){await this.perform({kind:'choose-part',id:this.root.querySelector('#sg-first-part').value});return;}
    if(b.dataset.do==='draw-part'){this.element=this.root.querySelector('#sg-draw-element')?.value||this.element;await this.perform({kind:'draw-part',mode:b.dataset.mode,element:this.element,id:this.root.querySelector('#sg-draw-part')?.value});return;}
    if(b.dataset.do==='buy-supply'){await this.perform({kind:'buy-supply'});return;}
    if(b.dataset.do==='supply-help'){this.supplyHelp();return;}
    if(b.dataset.action==='swap-part'){this.swapDialog(b.dataset.id);return;}
    if(b.dataset.do==='pet-gift'){await this.perform({kind:'gift',type:'pet',pet:this.root.querySelector('#sg-gift-pet')?.value});return;}
    if(b.dataset.action){await this.perform({kind:b.dataset.action,id:b.dataset.id,stat:b.dataset.stat});return;}
    if(b.dataset.do==='refresh'||b.dataset.do==='abandon'){this.busy=true;try{await this.c[b.dataset.do==='refresh'?'refresh':'abandon']();}catch(err){this.notify('확인해 주세요',err.message);}finally{this.busy=false;this.render();}}
  }
  async perform(a){
    this.busy=true;this.render();
    try{const r=await this.c.action(a);if(r.draw)this.showDrawResult(r.draw);else this.notify(['gift','choose-pet'].includes(a.kind)?'새로운 만남!':'저장했어요',r.message);}
    catch(e){
      // 다른 기기·옛 화면 때문에 보급 차례가 어긋나면 서버가 아무것도 바꾸지 않고 거절한다 → 새로 불러와 맞는 칸을 보여 준다.
      if(e.data?.code==='DRAW_MODE'){try{await this.c.refresh();}catch(err){}this.notify('보급 차례가 바뀌었어요','화면을 새로 불러왔어요. 이번 차례에 맞게 다시 골라 주세요. 보급권은 그대로예요.');}
      else this.notify('확인해 주세요',e.message);
    }finally{this.busy=false;this.render();}
  }
}
