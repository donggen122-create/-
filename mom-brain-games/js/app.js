(function(){
'use strict';
var app=document.getElementById('app');

var store={
  get:function(k,d){try{var v=window.localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}},
  set:function(k,v){try{window.localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
};

var saved=store.get('mbp:settings',null)||{};
var settings={font:saved.font==='large'?'large':'normal',sound:saved.sound!==false,pic:saved.pic==='photo'?'photo':'basic'};
var photo=null;
(function(){var p=store.get('mbp:photo',null);if(typeof p==='string'&&p.indexOf('data:image/')===0)photo=p;})();
if(!photo)settings.pic='basic';
function saveSettings(){store.set('mbp:settings',settings);}
function applySettings(){document.documentElement.classList.toggle('large',settings.font==='large');}
applySettings();

function todayKey(){var d=new Date();return 'mbp:done:'+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function doneToday(){var a=store.get(todayKey(),[]);return Array.isArray(a)?a:[];}
function markDone(id){var a=doneToday();if(a.indexOf(id)<0){a.push(id);store.set(todayKey(),a);}}

var canSpeak=('speechSynthesis' in window)&&(typeof window.SpeechSynthesisUtterance!=='undefined');
function speak(text){
  if(!canSpeak)return;
  try{window.speechSynthesis.cancel();var u=new window.SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=0.85;window.speechSynthesis.speak(u);}catch(e){}
}
function stopSpeaking(){if(!canSpeak)return;try{window.speechSynthesis.cancel();}catch(e){}}

var actx=null;
function chime(kind){
  if(!settings.sound)return;
  try{
    var AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    if(!actx)actx=new AC();
    if(actx.state==='suspended'&&actx.resume)actx.resume();
    var notes=kind==='done'?[523.25,659.25,783.99]:[659.25,880];
    var now=actx.currentTime;
    notes.forEach(function(f,i){
      var o=actx.createOscillator(),g=actx.createGain(),t=now+i*0.14;
      o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0.0001,t);
      g.gain.exponentialRampToValueAtTime(0.16,t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
      o.connect(g);g.connect(actx.destination);
      o.start(t);o.stop(t+0.55);
    });
  }catch(e){}
}

function shuffle(a){var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=b[i];b[i]=b[j];b[j]=t;}return b;}
function pick(a){return a[Math.floor(Math.random()*a.length)];}
function rnd(a,b){return a+Math.floor(Math.random()*(b-a+1));}
function show(html){app.innerHTML=html;try{window.scrollTo(0,0);}catch(e){}}
function setMsg(t){var m=document.getElementById('msg');if(m)m.textContent=t;}

/* ---------- 퍼즐 그림: 저작권 보호 기간이 끝난 명화 ---------- */
var PAINTINGS=window.PAINTINGS||[];
var jigCount=parseInt(store.get('mbp:jigcount',0),10)||0;
function currentPainting(){var n=PAINTINGS.length;return PAINTINGS[((jigCount%n)+n)%n];}
function nextPicture(){
  if(settings.pic==='photo'&&photo)return {src:photo,w:720,h:720,t:'',a:'',photo:true};
  return currentPainting();
}
function batchim(s){var c=s.charCodeAt(s.length-1);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28!==0;}
function nIga(n){return [1,1,0,1,0,0,1,1,1,0][n%10]?'이':'가';}
function nRo(n){return [1,0,0,1,0,0,1,0,0,0][n%10]?'으로':'로';}
function picLabel(p){return p.a+'의 「'+p.t+'」';}

/* ---------- 레벨 ---------- */
var LV={
  jigsaw:[{a:3,b:5,tol:.36},{a:4,b:5,tol:.34},{a:4,b:6,tol:.32},{a:5,b:6,tol:.3,hideThumb:true},{a:5,b:7,tol:.28,hideThumb:true},{a:6,b:7,tol:.26,hideThumb:true},{a:6,b:8,tol:.25,hideThumb:true},{a:7,b:8,tol:.24,hideThumb:true}],
  match:[{p:6},{p:8},{p:8,similar:true},{p:10,similar:true}],
  shop:[{n:4,t:9},{n:5,t:12},{n:5,t:12,mid:true},{n:6,t:12,mid:true},{n:7,t:12,mid:true},{n:8,t:12,mid:true}],
  proverb:[{k:3},{k:4},{k:3,rev:true},{k:4,rev:true}]
};
var levels=store.get('mbp:levels',null);
if(!levels||typeof levels!=='object')levels={};
function lv(id){
  var cap=LV[id].length,o=levels[id]||{};
  var cur=parseInt(o.cur,10)||1,max=parseInt(o.max,10)||1;
  cur=Math.min(Math.max(cur,1),cap);max=Math.min(Math.max(max,cur),cap);
  levels[id]={cur:cur,max:max};return levels[id];
}
function saveLevels(){store.set('mbp:levels',levels);}
function cfgOf(id){return LV[id][lv(id).cur-1];}
function unlockNext(id){var o=lv(id);if(o.cur<LV[id].length&&o.max<o.cur+1)o.max=o.cur+1;saveLevels();}

/* ---------- 데이터 ---------- */
var WD=['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
var GAMES=[
  {id:'jigsaw',title:'그림 조각 맞추기',desc:'흩어진 조각을 맞춰 그림을 완성해요',emo:'🧩',tone:'t4'},
  {id:'match',title:'짝 맞추기',desc:'같은 그림 두 장을 찾아요',emo:'🃏',tone:'t1'},
  {id:'shop',title:'장보기 기억',desc:'살 물건을 외웠다가 골라요',emo:'🧺',tone:'t2'},
  {id:'proverb',title:'속담 잇기',desc:'옛말의 앞뒤를 이어요',emo:'📜',tone:'t3'}
];
var PRAISE=['찾았어요! 잘하셨어요','맞아요! 기억력이 좋으세요','딩동댕! 한 쌍 찾으셨어요','좋아요! 이대로 계속해요'];
var MATCH_POOL=[
  {e:'🍎',n:'사과'},{e:'🍌',n:'바나나'},{e:'🍇',n:'포도'},{e:'🍉',n:'수박'},
  {e:'🍓',n:'딸기'},{e:'🍑',n:'복숭아'},{e:'🌻',n:'해바라기'},{e:'🐶',n:'강아지'},
  {e:'🐱',n:'고양이'},{e:'🌷',n:'튤립'},{e:'🐟',n:'물고기'},{e:'🌙',n:'달'}
];
var FRUITS=[
  {e:'🍎',n:'사과'},{e:'🍏',n:'풋사과'},{e:'🍐',n:'배'},{e:'🍊',n:'귤'},
  {e:'🍋',n:'레몬'},{e:'🍑',n:'복숭아'},{e:'🍒',n:'체리'},{e:'🍓',n:'딸기'},
  {e:'🍇',n:'포도'},{e:'🍈',n:'멜론'},{e:'🥝',n:'키위'},{e:'🍍',n:'파인애플'}
];
var SHOP_POOL=[
  {e:'🍎',n:'사과'},{e:'🥛',n:'우유'},{e:'🥚',n:'달걀'},{e:'🥕',n:'당근'},
  {e:'🥔',n:'감자'},{e:'🐟',n:'생선'},{e:'🍞',n:'식빵'},{e:'🍄',n:'버섯'},
  {e:'🌽',n:'옥수수'},{e:'🍅',n:'토마토'},{e:'🥒',n:'오이'},{e:'🥬',n:'배추'},
  {e:'🌶️',n:'고추'},{e:'🍊',n:'귤'},{e:'🍇',n:'포도'},{e:'🍌',n:'바나나'},
  {e:'🍓',n:'딸기'},{e:'🍠',n:'고구마'},{e:'🍤',n:'새우'},{e:'🍗',n:'닭고기'},
  {e:'🍋',n:'레몬'},{e:'🍐',n:'배'}
];
var PROVERBS=[
  ['가는 말이 고와야','오는 말이 곱다'],['낮말은 새가 듣고','밤말은 쥐가 듣는다'],
  ['발 없는 말이','천 리 간다'],['세 살 버릇','여든까지 간다'],
  ['소 잃고','외양간 고친다'],['원숭이도','나무에서 떨어진다'],
  ['티끌 모아','태산'],['백지장도','맞들면 낫다'],
  ['콩 심은 데 콩 나고','팥 심은 데 팥 난다'],['고래 싸움에','새우 등 터진다'],
  ['가는 날이','장날'],['등잔 밑이','어둡다'],
  ['호랑이도 제 말 하면','온다'],['윗물이 맑아야','아랫물이 맑다'],
  ['돌다리도','두들겨 보고 건너라'],['가랑비에','옷 젖는 줄 모른다'],
  ['빈 수레가','요란하다'],['우물 안','개구리'],
  ['급할수록','돌아가라'],['개구리','올챙이 적 생각 못 한다'],
  ['믿는 도끼에','발등 찍힌다'],['서당 개 삼 년이면','풍월을 읊는다'],
  ['하늘이 무너져도','솟아날 구멍이 있다'],['천 리 길도','한 걸음부터'],
  ['떡 줄 사람은 생각도 않는데','김칫국부터 마신다']
];

var current=null,screen='home',st={};

/* ---------- 공통 화면 ---------- */
function greeting(){
  var h=new Date().getHours();
  if(h>=5&&h<11)return '좋은 아침이에요. 오늘의 놀이를 골라 보세요.';
  if(h>=11&&h<17)return '오늘도 반가워요. 하고 싶은 놀이를 골라 보세요.';
  return '오늘 하루도 수고 많으셨어요. 편하게 한 판 해 볼까요?';
}
function seg(key,opts){
  return '<div class="seg" role="group">'+opts.map(function(o){
    var on=String(settings[key])===o[0];
    return '<button type="button" data-action="set" data-key="'+key+'" data-val="'+o[0]+'" aria-pressed="'+(on?'true':'false')+'">'+o[1]+'</button>';
  }).join('')+'</div>';
}
function topbar(title){
  return '<header class="topbar"><button type="button" class="home-btn" data-action="home">‹ 처음으로</button><h1 class="topbar-title">'+title+'</h1></header>';
}
function titleOf(id){for(var i=0;i<GAMES.length;i++){if(GAMES[i].id===id)return GAMES[i].title;}return '';}

function renderHome(){
  current=null;screen='home';st={};
  var d=new Date(),dow=d.getDay(),done=doneToday();
  var dayCls=dow===0?' sun':(dow===6?' sat':'');
  var acts=GAMES.map(function(g){
    var ok=done.indexOf(g.id)>=0;
    return '<button type="button" class="act" data-action="go" data-game="'+g.id+'">'+
      '<span class="swatch '+g.tone+'" aria-hidden="true">'+g.emo+'</span>'+
      '<span class="act-text"><span class="act-title">'+g.title+'<span class="lvpill">레벨 '+lv(g.id).cur+'</span></span><span class="act-desc">'+g.desc+'</span></span>'+
      (ok?'<span class="act-state">오늘 했어요</span>':'<span class="act-go" aria-hidden="true">›</span>')+
    '</button>';
  }).join('');
  var all=GAMES.every(function(g){return done.indexOf(g.id)>=0;});
  show(
    '<section class="ilryeok" aria-label="오늘 날짜">'+
      '<div class="binding" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>'+
      '<p class="ym">'+d.getFullYear()+'년 '+(d.getMonth()+1)+'월</p>'+
      '<p class="day'+dayCls+'">'+d.getDate()+'</p>'+
      '<p class="wd'+dayCls+'">'+WD[dow]+'</p>'+
    '</section>'+
    '<h1 class="greet">'+greeting()+'</h1>'+
    (all?'<p class="alldone" role="status">오늘의 놀이를 모두 마치셨어요. 내일 또 만나요!</p>':'')+
    '<nav aria-label="오늘의 놀이">'+acts+'</nav>'+
    '<section class="settings" aria-label="설정">'+
      '<div class="set-row"><span>글자 크기</span>'+seg('font',[['normal','보통'],['large','크게']])+'</div>'+
      '<div class="set-row"><span>효과음</span>'+seg('sound',[['true','켜기'],['false','끄기']])+'</div>'+
    '</section>'+
    '<p class="foot">레벨은 놀이를 잘 마칠 때마다 하나씩 열려요.<br>하루에 하나씩, 천천히 해도 괜찮아요.</p>'
  );
}

function levelInfo(id,c){
  if(id==='jigsaw')return '그림이 퍼즐 모양 조각 '+(c.a*c.b)+'개로 잘려 있어요. 조각을 끌어다 틀 안 제자리에 놓으면 딱 붙어요.'+(c.hideThumb?' 이 단계부터는 완성 그림이 숨겨져요.':' 작은 완성 그림을 보면서 맞출 수 있어요.');
  if(id==='match')return '카드 '+(c.p*2)+'장에서 같은 그림 '+c.p+'쌍을 찾아요.'+(c.similar?' 비슷하게 생긴 과일이 섞여 있어요.':'');
  if(id==='shop')return '물건 '+c.n+'개를 외웠다가 '+c.t+'개 중에서 골라요.'+(c.mid?' 시장 가는 길에 계산 문제도 하나 풀어요.':'');
  if(id==='proverb')return (c.rev?'속담의 뒷말을 보고 앞말을 골라요.':'속담의 앞말을 보고 뒷말을 골라요.')+' 보기는 '+c.k+'개, 모두 5문제예요.';
  return '';
}
function passRule(id,c){
  if(id==='jigsaw')return '그림을 완성하면';
  if(id==='match')return '짝을 모두 찾으면';
  if(id==='shop')return (c.n>=5?(c.n-1)+'개 이상':'모두')+' 기억하면';
  return '5문제 중 4문제 이상 맞히면';
}

function renderIntro(id){
  current=id;screen='intro';st={};
  var o=lv(id),cap=LV[id].length,c=cfgOf(id),extra='';
  if(id==='jigsaw'){
    var p=nextPicture();
    extra='<figure class="pic"><img src="'+p.src+'" alt="'+(p.photo?'내 사진':p.t)+'"><figcaption>'+
        (p.photo?'':'<span class="pic-title">'+picLabel(p)+'</span>')+
        '<span class="pic-hint">'+(c.hideThumb?'이 그림을 잘 봐 두세요':'이 그림을 완성해요')+'</span></figcaption></figure>'+
      (p.photo?'<div class="center"><button type="button" class="linkbtn" data-action="photo-pick">다른 사진 고르기</button></div>'
              :'<div class="center"><button type="button" class="linkbtn" data-action="pic-next">다른 그림으로 바꾸기</button></div>')+
      '<div class="picsrc"><span>그림</span>'+seg('pic',[['basic','명화'],['photo','내 사진']])+'</div>'+
      '<p class="note" id="photoNote">'+(p.photo?'사진은 이 폰 안에만 저장되고, 어디에도 올라가지 않아요.':'그림은 모두 저작권 보호 기간이 끝난 명화예요.')+'</p>'+
      '<input type="file" id="photoInput" accept="image/*" hidden>';
  }
  show(topbar(titleOf(id))+
    '<section class="intro">'+
    '<div class="stepper">'+
      '<button type="button" class="step" data-action="lv-prev" aria-label="이전 레벨"'+(o.cur<=1?' aria-disabled="true"':'')+'>‹</button>'+
      '<div class="lv"><span class="lv-num">레벨 '+o.cur+'</span><span class="lv-of">모두 '+cap+'단계</span></div>'+
      '<button type="button" class="step" data-action="lv-next" aria-label="다음 레벨"'+(o.cur>=o.max?' aria-disabled="true"':'')+'>›</button>'+
    '</div>'+
    '<p class="lv-info">'+levelInfo(id,c)+'</p>'+
    extra+
    '<div class="btn-row"><button type="button" class="btn" data-action="play">시작하기</button></div>'+
    (o.cur>=o.max&&o.cur<cap?'<p class="note">'+passRule(id,c)+' 레벨 '+(o.cur+1)+nIga(o.cur+1)+' 열려요.</p>':'')+
    '</section>');
}

function result(o){
  screen='result';chime('done');
  var L=lv(current),cap=LV[current].length,canNext=!!o.passed&&L.cur<cap&&L.max>L.cur;
  var note='';
  if(canNext)note='레벨 '+(L.cur+1)+nIga(L.cur+1)+' 열렸어요!';
  else if(o.passed&&L.cur>=cap)note='가장 높은 레벨이에요. 계속 새로운 문제로 즐길 수 있어요.';
  else if(!o.passed&&o.tip)note=o.tip;
  show(topbar(titleOf(current))+
    '<section class="result">'+
      (o.img?'<img class="result-img" src="'+o.img+'" alt="완성한 그림">':'<p class="result-emo" aria-hidden="true">'+(o.emo||'👏')+'</p>')+
      '<h2 class="result-title">'+o.title+'</h2><p class="result-detail">'+o.detail+'</p>'+
      (note?'<p class="result-note'+(canNext?' up':'')+'">'+note+'</p>':'')+
    '</section>'+(o.extra||'')+
    '<div class="btn-row">'+
      (canNext?'<button type="button" class="btn" data-action="next-level">레벨 '+(L.cur+1)+nRo(L.cur+1)+' 올라가기</button>':'')+
      '<button type="button" class="btn'+(canNext?' secondary':'')+'" data-action="again">'+(o.passed&&L.cur>=cap?'새 문제로 한 번 더':'같은 레벨 한 번 더')+'</button>'+
      '<button type="button" class="btn secondary" data-action="home">처음 화면으로</button>'+
    '</div>');
}

/* ---------- 그림 조각 맞추기 (진짜 퍼즐 모양) ---------- */
var JIG={pieces:[],W:0,bx:0,bw:0,bh:0,pw:0,ph:0,pad:0,sy:0,sh:0,playH:0,zTop:10,drag:null,resizeT:null};
function rj(j){return (Math.random()*2-1)*j;}
function mkEdge(){return {t:0.09+Math.random()*0.03,s:Math.random()<0.5?1:-1,a:rj(0.045),b:rj(0.045),c:rj(0.045),d:rj(0.045),e:rj(0.045)};}
function edgePts(x0,y0,x1,y1,E){
  var dx=x1-x0,dy=y1-y0,L=Math.sqrt(dx*dx+dy*dy),ux=dx/L,uy=dy/L,nx=-uy*E.s,ny=ux*E.s,t=E.t;
  var P=[[0,0],[0.2,E.a],[0.5+E.b+E.d,-t+E.c],[0.5-t+E.b,t+E.c],[0.5-2*t+E.b-E.d,3*t+E.c],[0.5+2*t+E.b-E.d,3*t+E.c],[0.5+t+E.b,t+E.c],[0.5+E.b+E.d,-t+E.c],[0.8,E.e],[1,0]];
  return P.map(function(p){return [x0+ux*p[0]*L+nx*p[1]*L,y0+uy*p[0]*L+ny*p[1]*L];});
}
function bez(ctx,pts,rev){var p=rev?pts.slice().reverse():pts;for(var i=1;i<10;i+=3)ctx.bezierCurveTo(p[i][0],p[i][1],p[i+1][0],p[i+1][1],p[i+2][0],p[i+2][1]);}
function piecePath(ctx,g,r,c,pw,ph,cols,rows){
  var x0=c*pw,y0=r*ph,x1=x0+pw,y1=y0+ph;
  ctx.beginPath();ctx.moveTo(x0,y0);
  if(r===0)ctx.lineTo(x1,y0);else bez(ctx,g.H[r][c],false);
  if(c===cols-1)ctx.lineTo(x1,y1);else bez(ctx,g.V[r][c+1],false);
  if(r===rows-1)ctx.lineTo(x0,y1);else bez(ctx,g.H[r+1][c],true);
  if(c===0)ctx.lineTo(x0,y0);else bez(ctx,g.V[r][c],true);
  ctx.closePath();
}
function startJigsaw(){
  var c=cfgOf('jigsaw'),img=nextPicture(),R=img.w/img.h,cols,rows,H=[],V=[],r,k;
  if(R>=1){cols=c.b;rows=c.a;}else{cols=c.a;rows=c.b;}
  for(r=0;r<rows;r++){H.push([]);V.push([]);for(k=0;k<cols;k++){H[r].push(r>0?mkEdge():null);V[r].push(k>0?mkEdge():null);}}
  st={cols:cols,rows:rows,N:cols*rows,pic:img,isPhoto:!!img.photo,done:false,peekTimer:null,edges:{H:H,V:V},placed:{},count:0,hideThumb:!!c.hideThumb,tol:c.tol,imgEl:null};
  JIG.pieces=[];JIG.drag=null;
  show(topbar('그림 조각 맞추기')+
    '<div class="jhead">'+
      (st.hideThumb?'':'<button type="button" class="jthumb-btn" data-action="peek" aria-label="완성 그림 크게 보기"><img src="'+img.src+'" alt=""></button>')+
      '<div class="jhead-text"><p class="lead" id="msg" aria-live="polite">그림을 조각내는 중이에요…</p><p class="sub" id="jprog"></p></div>'+
    '</div>'+
    '<div class="jplay" id="jplay"></div>'+
    '<div class="jtools">'+
      '<button type="button" class="btn secondary" data-action="peek">그림 보기</button>'+
      '<button type="button" class="btn secondary" data-action="hint">힌트</button>'+
      '<button type="button" class="btn secondary" data-action="scatter">다시 흩기</button>'+
    '</div>'+
    '<p class="note">조각을 손가락으로 끌어서 틀 안 제자리에 놓으면 딱 붙어요.</p>');
  var s=st,el=new Image();
  el.onload=function(){if(s!==st)return;s.imgEl=el;buildJigsaw();setMsg('조각을 끌어다 틀 안 제자리에 놓아 보세요');};
  el.onerror=function(){if(s!==st)return;setMsg('그림을 불러오지 못했어요. 처음 화면으로 돌아가 다시 시작해 주세요.');};
  el.src=img.src;
}
function setPos(p,x,y){p.x=x;p.y=y;p.el.style.left=Math.round(x)+'px';p.el.style.top=Math.round(y)+'px';}
function buildJigsaw(){
  var play=document.getElementById('jplay');if(!play||!st.imgEl)return;
  var s=st,cols=s.cols,rows=s.rows,R=s.pic.w/s.pic.h,W=play.clientWidth||320;
  var maxH=Math.max(200,Math.round((window.innerHeight||700)*0.4));
  var bw=Math.floor(Math.min(W,maxH*R)),bh=Math.floor(bw/R);
  var pw=bw/cols,ph=bh/rows,pad=Math.ceil(0.36*Math.max(pw,ph));
  var sh=Math.round(Math.max(bh*0.8,s.N*pw*ph*1.2/W)),gap=14;
  JIG.W=W;JIG.bx=Math.round((W-bw)/2);JIG.bw=bw;JIG.bh=bh;JIG.pw=pw;JIG.ph=ph;JIG.pad=pad;JIG.sy=bh+gap;JIG.sh=sh;JIG.playH=bh+gap+sh;
  play.style.height=JIG.playH+'px';
  play.innerHTML='<div class="jframe" style="left:'+JIG.bx+'px;width:'+bw+'px;height:'+bh+'px"></div>'+
    '<img class="jpeek" id="peek" alt="완성 그림" data-action="peek-hide" hidden style="left:'+JIG.bx+'px;width:'+bw+'px;height:'+bh+'px">';
  document.getElementById('peek').src=s.pic.src;
  var g={H:[],V:[]},r,c;
  for(r=0;r<rows;r++){g.H.push([]);g.V.push([]);for(c=0;c<cols;c++){
    g.H[r].push(r>0?edgePts(c*pw,r*ph,(c+1)*pw,r*ph,s.edges.H[r][c]):null);
    g.V[r].push(c>0?edgePts(c*pw,r*ph,c*pw,(r+1)*ph,s.edges.V[r][c]):null);
  }}
  var dpr=Math.min(window.devicePixelRatio||1,2.5),cw=pw+2*pad,ch=ph+2*pad;
  JIG.pieces=[];
  for(r=0;r<rows;r++)for(c=0;c<cols;c++){
    var id=r*cols+c,cv=document.createElement('canvas');
    cv.width=Math.ceil(cw*dpr);cv.height=Math.ceil(ch*dpr);
    cv.style.width=cw+'px';cv.style.height=ch+'px';cv.className='jp';
    var ctx=cv.getContext('2d');
    var p={id:id,el:cv,ctx:ctx,dpr:dpr,tx:JIG.bx+c*pw-pad,ty:r*ph-pad,x:0,y:0,cw:cw,ch:ch,placed:!!s.placed[id]};
    if(ctx){
      ctx.scale(dpr,dpr);ctx.translate(pad-c*pw,pad-r*ph);
      piecePath(ctx,g,r,c,pw,ph,cols,rows);ctx.save();ctx.clip();ctx.drawImage(s.imgEl,0,0,bw,bh);ctx.restore();
      piecePath(ctx,g,r,c,pw,ph,cols,rows);
      ctx.lineWidth=1.4;ctx.strokeStyle='rgba(255,255,255,.6)';ctx.stroke();
      ctx.lineWidth=0.7;ctx.strokeStyle='rgba(0,0,0,.35)';ctx.stroke();
    }
    play.appendChild(cv);JIG.pieces.push(p);
    if(p.placed){setPos(p,p.tx,p.ty);cv.classList.add('placed');cv.style.zIndex=1;}
  }
  scatterLoose(true);
  jprog();
}
function scatterLoose(quiet){
  if(current!=='jigsaw'||st.done)return;
  var loose=shuffle(JIG.pieces.filter(function(p){return !p.placed;}));
  if(!loose.length)return;
  var gc=Math.max(1,Math.floor(JIG.W/(JIG.pw*1.05))),gr=Math.ceil(loose.length/gc),cellW=JIG.W/gc,cellH=JIG.sh/gr;
  loose.forEach(function(p,i){
    var gx=i%gc,gy=Math.floor(i/gc);
    var cx=cellW*(gx+0.5)+rj(cellW*0.14),cy=JIG.sy+cellH*(gy+0.5)+rj(cellH*0.14);
    var x=Math.max(-JIG.pad*0.5,Math.min(JIG.W-p.cw+JIG.pad*0.5,cx-p.cw/2));
    var y=Math.max(JIG.sy-JIG.pad,Math.min(JIG.playH-p.ch+JIG.pad*0.5,cy-p.ch/2));
    setPos(p,x,y);p.el.style.zIndex=++JIG.zTop;
  });
  if(!quiet)setMsg('남은 조각을 다시 흩었어요');
}
function jprog(){var p=document.getElementById('jprog');if(p)p.textContent='맞춘 조각 '+st.count+' / '+st.N;}
function findPiece(el){for(var i=0;i<JIG.pieces.length;i++)if(JIG.pieces[i].el===el)return JIG.pieces[i];return null;}
function pieceAt(cx,cy){
  var els=document.elementsFromPoint?document.elementsFromPoint(cx,cy):[];
  for(var i=0;i<els.length;i++){
    var el=els[i];
    if(!el||!el.classList||!el.classList.contains('jp'))continue;
    var p=findPiece(el);if(!p||p.placed)continue;
    if(!p.ctx)return p;
    var rc=el.getBoundingClientRect(),lx=Math.floor((cx-rc.left)*p.dpr),ly=Math.floor((cy-rc.top)*p.dpr);
    try{if(p.ctx.getImageData(lx,ly,1,1).data[3]>16)return p;}catch(err){return p;}
  }
  return null;
}
function placePiece(p,viaHint){
  if(p.placed||st.done)return;
  p.placed=true;st.placed[p.id]=true;st.count++;
  setPos(p,p.tx,p.ty);p.el.classList.remove('drag');p.el.classList.add('placed');p.el.style.zIndex=1;
  chime('good');
  setMsg(viaHint?'힌트로 한 조각을 제자리에 놓았어요':pick(['딱 맞았어요!','제자리를 찾았어요!','잘하셨어요! 계속해 보세요']));
  jprog();
  if(st.count===st.N)finishJigsaw();
}
function hint(){
  if(current!=='jigsaw'||st.done||!JIG.pieces.length)return;
  var loose=JIG.pieces.filter(function(p){return !p.placed&&!p.flying;});
  if(!loose.length)return;
  var p=pick(loose),s=st;
  p.flying=true;p.el.style.zIndex=++JIG.zTop;p.el.classList.add('fly');
  setPos(p,p.tx,p.ty);
  setTimeout(function(){if(s!==st)return;p.flying=false;p.el.classList.remove('fly');placePiece(p,true);},480);
}
function peek(){
  var p=document.getElementById('peek');if(!p)return;
  p.style.zIndex=String(JIG.zTop+1000);p.hidden=false;
  var s=st;clearTimeout(s.peekTimer);
  s.peekTimer=setTimeout(function(){if(s!==st)return;var q=document.getElementById('peek');if(q)q.hidden=true;},3000);
}
function peekHide(){var p=document.getElementById('peek');if(p)p.hidden=true;}
function finishJigsaw(){
  st.done=true;
  var f=app.querySelector('.jframe');if(f)f.classList.add('done');
  setMsg('다 맞추셨어요! 그림이 완성됐어요');
  markDone('jigsaw');unlockNext('jigsaw');
  if(!st.isPhoto){jigCount++;store.set('mbp:jigcount',jigCount);}
  var s=st;
  setTimeout(function(){
    if(s!==st)return;
    var p=s.pic;
    result({passed:true,img:p.src,title:'레벨 '+lv('jigsaw').cur+' 완성!',detail:(p.photo?'':picLabel(p)+(batchim(p.t)?'을':'를')+' 완성하셨어요. ')+'조각 '+s.N+'개를 모두 맞추셨어요.'});
  },1800);
}
app.addEventListener('pointerdown',function(e){
  if(current!=='jigsaw'||!st||st.done||!JIG.pieces.length)return;
  var play=document.getElementById('jplay');
  if(!play||!play.contains(e.target)||e.target.id==='peek')return;
  var p=pieceAt(e.clientX,e.clientY);if(!p||p.flying)return;
  e.preventDefault();
  var pr=play.getBoundingClientRect();
  JIG.drag={p:p,id:e.pointerId,ox:e.clientX-pr.left-p.x,oy:e.clientY-pr.top-p.y};
  p.el.style.zIndex=++JIG.zTop;p.el.classList.add('drag');
  try{play.setPointerCapture(e.pointerId);}catch(err){}
});
app.addEventListener('pointermove',function(e){
  var d=JIG.drag;if(!d||e.pointerId!==d.id)return;
  var play=document.getElementById('jplay');if(!play){JIG.drag=null;return;}
  e.preventDefault();
  var pr=play.getBoundingClientRect(),p=d.p;
  var x=e.clientX-pr.left-d.ox,y=e.clientY-pr.top-d.oy;
  x=Math.max(-JIG.pad,Math.min(JIG.W-p.cw+JIG.pad,x));
  y=Math.max(-JIG.pad,Math.min(JIG.playH-p.ch+JIG.pad,y));
  setPos(p,x,y);
});
function endDrag(e){
  var d=JIG.drag;if(!d||e.pointerId!==d.id)return;
  JIG.drag=null;
  var p=d.p;p.el.classList.remove('drag');
  if(current!=='jigsaw'||st.done)return;
  var dx=p.x-p.tx,dy=p.y-p.ty,tol=st.tol*Math.min(JIG.pw,JIG.ph);
  if(Math.sqrt(dx*dx+dy*dy)<=tol)placePiece(p,false);
  else if(p.y+p.ch/2<JIG.bh)setMsg('여기는 자리가 아니에요. 조금 옮겨 보세요');
}
app.addEventListener('pointerup',endDrag);
app.addEventListener('pointercancel',endDrag);
window.addEventListener('resize',function(){
  if(current!=='jigsaw'||screen!=='play'||!st||st.done||!st.imgEl)return;
  clearTimeout(JIG.resizeT);
  JIG.resizeT=setTimeout(function(){
    var play=document.getElementById('jplay');
    if(play&&Math.abs(play.clientWidth-JIG.W)>30){JIG.drag=null;buildJigsaw();}
  },300);
});

/* ---------- 짝 맞추기 ---------- */
function startMatch(){
  var c=cfgOf('match'),pool=c.similar?FRUITS:MATCH_POOL;
  var chosen=shuffle(pool).slice(0,c.p);
  var cards=shuffle(chosen.concat(chosen)).map(function(x,i){return {e:x.e,n:x.n,v:(i%3)+1};});
  st={cards:cards,open:[],matched:[],tries:0,lock:false};
  show(topbar('짝 맞추기')+
    '<p class="lead" id="msg" aria-live="polite">같은 그림 두 장을 찾아보세요</p>'+
    '<div class="board'+(cards.length>6?' c4':'')+'">'+cards.map(function(x,i){
      return '<button type="button" class="card v'+x.v+'" data-action="flip" data-i="'+i+'" aria-label="'+(i+1)+'번 카드 뒤집기">'+
        '<span class="inner"><span class="back" aria-hidden="true"><i></i><i></i><i></i><i></i></span>'+
        '<span class="face" aria-hidden="true"><span class="emo">'+x.e+'</span><span class="nm">'+x.n+'</span></span></span></button>';
    }).join('')+'</div>'+
    '<p class="sub center">틀려도 괜찮아요. 자리를 천천히 기억해 보세요.</p>');
}
function cardEl(i){return app.querySelector('.card[data-i="'+i+'"]');}
function flip(i){
  var s=st;
  if(current!=='match'||s.lock||s.open.indexOf(i)>=0||s.matched.indexOf(i)>=0)return;
  s.open.push(i);
  var el=cardEl(i);
  if(el){el.classList.add('open');el.setAttribute('aria-label',s.cards[i].n);}
  if(s.open.length<2)return;
  s.tries++;
  var a=s.open[0],b=s.open[1];
  if(s.cards[a].n===s.cards[b].n){
    s.matched.push(a,b);s.open=[];
    [a,b].forEach(function(k){var x=cardEl(k);if(x){x.classList.add('matched');x.setAttribute('aria-disabled','true');}});
    chime('good');
    if(s.matched.length===s.cards.length){
      markDone('match');unlockNext('match');setMsg('모두 찾으셨어요!');
      setTimeout(function(){
        if(s!==st)return;
        var pairs=s.cards.length/2;
        result({passed:true,title:'다 찾으셨어요!',detail:s.tries+'번 만에 '+pairs+'쌍을 모두 찾으셨어요. '+(s.tries<=pairs+2?'기억력이 정말 좋으세요!':'끝까지 차근차근 해내셨어요.')});
      },900);
    }else{setMsg(pick(PRAISE));}
  }else{
    s.lock=true;setMsg('그림이 달라요. 자리를 기억해 두세요');
    setTimeout(function(){
      if(s!==st)return;
      [a,b].forEach(function(k){var x=cardEl(k);if(x){x.classList.remove('open');x.setAttribute('aria-label',(k+1)+'번 카드 뒤집기');}});
      s.open=[];s.lock=false;setMsg('같은 그림 두 장을 찾아보세요');
    },1500);
  }
}

/* ---------- 장보기 기억 ---------- */
function startShop(){
  var c=cfgOf('shop'),items=shuffle(SHOP_POOL).slice(0,c.t);
  st={c:c,n:c.n,targets:items.slice(0,c.n),options:shuffle(items),selected:[],math:null};
  renderShopMem();
}
function renderShopMem(){
  show(topbar('장보기 기억')+
    '<h2 class="lead">오늘 장바구니에 담을 물건이에요</h2>'+
    '<p class="sub">천천히 외워 보세요. 다 외우면 아래 버튼을 눌러 주세요.</p>'+
    '<ul class="list">'+st.targets.map(function(t){return '<li><span class="emo" aria-hidden="true">'+t.e+'</span><span>'+t.n+'</span></li>';}).join('')+'</ul>'+
    '<div class="btn-row">'+(canSpeak?'<button type="button" class="btn secondary" data-action="speak-list">소리 내어 읽기</button>':'')+
    '<button type="button" class="btn" data-action="memorized">다 외웠어요</button></div>');
}
function renderShopPause(){
  show(topbar('장보기 기억')+
    '<section class="pause"><p class="result-emo" aria-hidden="true">🧺</p>'+
    '<h2 class="lead center">시장에 도착했어요</h2>'+
    '<p class="sub center">아까 외운 물건을 찾아볼까요?</p>'+
    '<div class="btn-row"><button type="button" class="btn" data-action="to-pick">물건 고르러 가기</button></div></section>');
}
function renderShopMath(){
  var f=pick(['귤','사과','감','배','자두']),a=rnd(2,8),b=rnd(2,7),ans=a+b;
  var ch=shuffle([ans,ans+1,ans-1]);
  st.math={ans:ans,ch:ch,done:false};
  show(topbar('장보기 기억')+
    '<h2 class="lead">시장 가는 길에 문제 하나!</h2>'+
    '<div class="qbox">'+f+' '+a+'개가 있는데 '+b+'개를 더 샀어요.<br>모두 몇 개일까요?</div>'+
    '<div class="choices">'+ch.map(function(x,i){return '<button type="button" class="choice" data-action="math" data-i="'+i+'">'+x+'개</button>';}).join('')+'</div>'+
    '<p class="feedback" id="fb" role="status"></p>'+
    '<div class="btn-row" id="nextRow" hidden><button type="button" class="btn" data-action="to-pick">이제 물건 고르러 가기</button></div>');
}
function mathAnswer(i){
  var m=st.math;if(!m||m.done)return;m.done=true;
  var ok=m.ch[i]===m.ans,btns=app.querySelectorAll('.choice');
  for(var k=0;k<btns.length;k++){
    btns[k].setAttribute('aria-disabled','true');
    if(m.ch[k]===m.ans)btns[k].classList.add('correct');else if(k===i)btns[k].classList.add('chosen-wrong');
  }
  var fb=document.getElementById('fb');
  if(ok){chime('good');if(fb)fb.textContent='맞아요! 모두 '+m.ans+'개예요. 아까 외운 물건, 아직 기억나시죠?';}
  else if(fb){fb.textContent='정답은 '+m.ans+'개예요. 괜찮아요, 이제 아까 외운 물건을 찾아봐요.';}
  var nr=document.getElementById('nextRow');if(nr)nr.hidden=false;
}
function renderShopPick(){
  stopSpeaking();
  show(topbar('장보기 기억')+
    '<h2 class="lead">살 물건 '+st.n+'개를 골라 주세요</h2>'+
    '<p class="sub" id="pickCount">고른 물건 0 / '+st.n+'</p>'+
    '<div class="tiles">'+st.options.map(function(o,i){
      return '<button type="button" class="tile" data-action="pick" data-i="'+i+'" aria-pressed="false"><span class="emo" aria-hidden="true">'+o.e+'</span><span class="nm">'+o.n+'</span></button>';
    }).join('')+'</div>'+
    '<p class="hint" id="pickHint" role="status"></p>'+
    '<div class="btn-row"><button type="button" class="btn" data-action="check-pick">다 골랐어요</button></div>');
}
function pickTile(i){
  var k=st.selected.indexOf(i),hint=document.getElementById('pickHint'),el=app.querySelector('.tile[data-i="'+i+'"]');
  if(k>=0){
    st.selected.splice(k,1);
    if(el)el.setAttribute('aria-pressed','false');
    if(hint)hint.textContent='';
  }else{
    if(st.selected.length>=st.n){if(hint)hint.textContent=st.n+'개까지 고를 수 있어요. 고른 물건을 한 번 더 누르면 빠져요.';return;}
    st.selected.push(i);
    if(el)el.setAttribute('aria-pressed','true');
    if(hint)hint.textContent='';
  }
  var c=document.getElementById('pickCount');
  if(c)c.textContent='고른 물건 '+st.selected.length+' / '+st.n;
}
function checkPick(){
  if(st.selected.length===0){var h=document.getElementById('pickHint');if(h)h.textContent='물건을 하나 이상 골라 주세요.';return;}
  var right=0;
  var tiles=st.options.map(function(o,i){
    var sel=st.selected.indexOf(i)>=0,tgt=st.targets.indexOf(o)>=0,cls='',tag='';
    if(sel&&tgt){right++;cls=' ok';tag='맞아요';}
    else if(!sel&&tgt){cls=' missed';tag='살 물건이었어요';}
    else if(sel&&!tgt){cls=' wrong';tag='목록에 없었어요';}
    return '<div class="tile'+cls+'"><span class="emo" aria-hidden="true">'+o.e+'</span><span class="nm">'+o.n+'</span>'+(tag?'<span class="tag">'+tag+'</span>':'')+'</div>';
  }).join('');
  var n=st.n,need=n>=5?n-1:n,passed=right>=need;
  markDone('shop');if(passed)unlockNext('shop');
  var title=right===n?'모두 기억하셨어요!':(passed?'거의 다 기억하셨어요!':(right*2>=n?'잘하셨어요!':'괜찮아요, 다시 해 봐요'));
  result({passed:passed,emo:'🧺',title:title,detail:n+'개 중 '+right+'개를 기억하셨어요.',tip:(need===n?'모두':need+'개 이상')+' 기억하면 다음 레벨이 열려요.',extra:'<div class="tiles">'+tiles+'</div>'});
}

/* ---------- 속담 잇기 ---------- */
function startProverb(){
  st={c:cfgOf('proverb'),qs:shuffle(PROVERBS).slice(0,5),idx:0,score:0,answered:false,choices:[]};
  renderQ();
}
function renderQ(){
  stopSpeaking();
  var q=st.qs[st.idx],c=st.c,ai=c.rev?0:1;
  var others=shuffle(PROVERBS.filter(function(p){return p!==q;})).slice(0,c.k-1).map(function(p){return p[ai];});
  st.choices=shuffle([q[ai]].concat(others));st.answered=false;
  show(topbar('속담 잇기')+
    '<p class="progress">'+(st.idx+1)+'번째 문제 (모두 '+st.qs.length+'문제)</p>'+
    '<div class="proverb">'+(c.rev?'<p class="blank" aria-hidden="true">…</p><p class="first">'+q[1]+'</p>':'<p class="first">'+q[0]+'</p><p class="blank" aria-hidden="true">…</p>')+'</div>'+
    (canSpeak?'<button type="button" class="btn secondary slim" data-action="speak-q">소리 내어 읽기</button>':'')+
    '<h2 class="lead">'+(c.rev?'앞에 오는 말을 골라 주세요':'이어지는 말을 골라 주세요')+'</h2>'+
    '<div class="choices">'+st.choices.map(function(x,i){return '<button type="button" class="choice" data-action="answer" data-i="'+i+'">'+x+'</button>';}).join('')+'</div>'+
    '<p class="feedback" id="fb" role="status"></p>'+
    '<div class="btn-row" id="nextRow" hidden><button type="button" class="btn" data-action="next-q">'+(st.idx===st.qs.length-1?'결과 보기':'다음 문제')+'</button></div>');
}
function answer(i){
  if(st.answered)return;
  st.answered=true;
  var q=st.qs[st.idx],ai=st.c.rev?0:1,ok=st.choices[i]===q[ai],full=q[0]+' '+q[1];
  var btns=app.querySelectorAll('.choice');
  for(var k=0;k<btns.length;k++){
    btns[k].setAttribute('aria-disabled','true');
    if(st.choices[k]===q[ai])btns[k].classList.add('correct');
    else if(k===i)btns[k].classList.add('chosen-wrong');
  }
  var fb=document.getElementById('fb');
  if(ok){st.score++;chime('good');if(fb)fb.textContent='맞아요! “'+full+'”';}
  else if(fb){fb.textContent='아쉬워요. 이렇게 이어져요. “'+full+'”';}
  var nr=document.getElementById('nextRow');if(nr)nr.hidden=false;
}
function nextQ(){
  st.idx++;
  if(st.idx>=st.qs.length){
    stopSpeaking();
    var s=st.score,t=st.qs.length,passed=s>=4;
    markDone('proverb');if(passed)unlockNext('proverb');
    result({passed:passed,emo:'📜',title:t+'문제 중 '+s+'문제 맞히셨어요',detail:s===t?'모두 맞히셨어요! 속담 박사님이세요.':(s>=3?'정말 잘하셨어요. 옛말을 많이 기억하고 계시네요.':'괜찮아요. 다시 하면 더 잘 떠오르실 거예요.'),tip:'4문제 이상 맞히면 다음 레벨이 열려요.'});
  }else{renderQ();}
}

/* ---------- 사진 ---------- */
function openPicker(){var inp=document.getElementById('photoInput');if(inp){inp.value='';inp.click();}}
function loadPhoto(file,cb){
  try{
    var r=new FileReader();
    r.onload=function(){
      var img=new Image();
      img.onload=function(){
        try{
          var w=img.naturalWidth,h=img.naturalHeight,s=Math.min(w,h),cv=document.createElement('canvas');
          cv.width=720;cv.height=720;
          cv.getContext('2d').drawImage(img,(w-s)/2,(h-s)/2,s,s,0,0,720,720);
          cb(cv.toDataURL('image/jpeg',0.85));
        }catch(e){cb(null);}
      };
      img.onerror=function(){cb(null);};
      img.src=r.result;
    };
    r.onerror=function(){cb(null);};
    r.readAsDataURL(file);
  }catch(e){cb(null);}
}
app.addEventListener('change',function(e){
  var t=e.target;
  if(!t||t.id!=='photoInput'||!t.files||!t.files[0])return;
  var note=document.getElementById('photoNote');
  if(note)note.textContent='사진을 불러오는 중이에요…';
  loadPhoto(t.files[0],function(uri){
    if(!uri){var n=document.getElementById('photoNote');if(n)n.textContent='사진을 불러오지 못했어요. 다른 사진을 골라 주세요.';return;}
    photo=uri;store.set('mbp:photo',uri);settings.pic='photo';saveSettings();
    if(current==='jigsaw'&&screen==='intro')renderIntro('jigsaw');
  });
});

/* ---------- 동작 연결 ---------- */
function play(){
  stopSpeaking();screen='play';
  if(current==='jigsaw')startJigsaw();
  else if(current==='match')startMatch();
  else if(current==='shop')startShop();
  else if(current==='proverb')startProverb();
  else renderHome();
}
function setOpt(t){
  var k=t.getAttribute('data-key'),v=t.getAttribute('data-val');
  if(k==='pic'){
    if(v==='photo'&&!photo){openPicker();return;}
    settings.pic=v;saveSettings();renderIntro('jigsaw');return;
  }
  if(k==='sound')settings.sound=(v==='true');else settings[k]=v;
  saveSettings();applySettings();
  var sib=t.parentNode.querySelectorAll('button');
  for(var i=0;i<sib.length;i++)sib[i].setAttribute('aria-pressed',sib[i]===t?'true':'false');
  if(k==='sound'&&settings.sound)chime('good');
}
function stepLevel(d){
  var o=lv(current),n=o.cur+d;
  if(n<1||n>o.max)return;
  o.cur=n;saveLevels();renderIntro(current);
}

app.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[data-action]'):null;
  if(!t||!app.contains(t))return;
  if(t.getAttribute('aria-disabled')==='true')return;
  var a=t.getAttribute('data-action'),i=parseInt(t.getAttribute('data-i'),10);
  switch(a){
    case 'go':renderIntro(t.getAttribute('data-game'));break;
    case 'home':stopSpeaking();renderHome();break;
    case 'play':play();break;
    case 'again':play();break;
    case 'next-level':var o=lv(current);if(o.cur<o.max){o.cur++;saveLevels();}renderIntro(current);break;
    case 'lv-prev':stepLevel(-1);break;
    case 'lv-next':stepLevel(1);break;
    case 'set':setOpt(t);break;
    case 'photo-pick':openPicker();break;
    case 'pic-next':jigCount++;store.set('mbp:jigcount',jigCount);renderIntro('jigsaw');break;
    case 'scatter':scatterLoose(false);break;
    case 'hint':hint();break;
    case 'peek':peek();break;
    case 'peek-hide':peekHide();break;
    case 'flip':flip(i);break;
    case 'speak-list':speak(st.targets.map(function(x){return x.n;}).join(', '));break;
    case 'memorized':stopSpeaking();if(st.c.mid)renderShopMath();else renderShopPause();break;
    case 'math':mathAnswer(i);break;
    case 'to-pick':renderShopPick();break;
    case 'pick':pickTile(i);break;
    case 'check-pick':checkPick();break;
    case 'speak-q':var q=st.qs[st.idx];speak(st.answered?q[0]+' '+q[1]:q[st.c.rev?1:0]);break;
    case 'answer':answer(i);break;
    case 'next-q':nextQ();break;
  }
});

renderHome();
})();
