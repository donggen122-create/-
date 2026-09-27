(function(){
'use strict';
var app=document.getElementById('app');

var store={
  get:function(k,d){try{var v=window.localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}},
  set:function(k,v){try{window.localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
};

var saved=store.get('mbp:settings',null)||{};
var settings={sound:saved.sound!==false};
function saveSettings(){store.set('mbp:settings',settings);}

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
function show(html){app.innerHTML=html;try{window.scrollTo(0,0);}catch(e){}}
function setMsg(t){var m=document.getElementById('msg');if(m)m.textContent=t;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

/* ---------- 스테이지: 1~200, 스테이지마다 그림을 무작위로 골라요 ---------- */
var PAINTINGS=window.PAINTINGS||[];
var STAGES=200;
var TOL=0.3; // 제자리에서 이만큼(조각 짧은 변 기준) 가까이 놓으면 딱 붙어요
// 그림 순서를 한 번 섞어 저장해 두고 스테이지 번호대로 꺼내요. 200스테이지 동안 같은 그림이 두 번 나오지 않아요.
function newOrder(){var a=[];for(var i=0;i<PAINTINGS.length;i++)a.push(i);return shuffle(a);}
var stage=parseInt(store.get('mbp:stage',1),10)||1;
if(stage<1||stage>STAGES)stage=1;
var order=store.get('mbp:order',null);
if(!Array.isArray(order)||order.length!==PAINTINGS.length){order=newOrder();store.set('mbp:order',order);}
function currentPainting(){return PAINTINGS[order[(stage-1)%order.length]]||PAINTINGS[0];}
function nextStage(){
  stage++;
  if(stage>STAGES){stage=1;order=newOrder();store.set('mbp:order',order);}
  store.set('mbp:stage',stage);
}
// 조각은 늘 20~25개: 가로 그림 5×4, 세로 그림 4×5, 정사각형에 가까우면 5×5
function gridFor(p){var R=p.w/p.h;return R>=1.15?{cols:5,rows:4}:R<=0.87?{cols:4,rows:5}:{cols:5,rows:5};}

var screen='home',st={};

/* ---------- 소리 버튼: 어느 화면에서나 오른쪽 위에 떠 있어요 ---------- */
var soundBtn=document.createElement('button');
soundBtn.type='button';soundBtn.id='soundBtn';soundBtn.className='sound-btn';
function renderSound(){
  soundBtn.textContent=settings.sound?'🔊 소리':'🔇 소리 끔';
  soundBtn.setAttribute('aria-pressed',settings.sound?'false':'true');
  soundBtn.setAttribute('aria-label',settings.sound?'소리 끄기':'소리 켜기');
}
soundBtn.addEventListener('click',function(){
  settings.sound=!settings.sound;saveSettings();renderSound();
  if(settings.sound)chime('good');
});
renderSound();
document.body.appendChild(soundBtn);

/* ---------- 처음 화면: 스테이지 번호, 그림, 시작하기 ---------- */
function renderHome(){
  screen='home';st={};
  var p=currentPainting();
  show('<section class="home">'+
    '<p class="stage">스테이지 '+stage+'</p>'+
    '<img class="home-pic" src="'+p.src+'" alt="'+esc(p.t)+'">'+
    '<button type="button" class="btn start" data-action="play">시작하기</button>'+
  '</section>');
}

/* ---------- 완성 화면 ---------- */
function result(){
  screen='result';chime('done');
  show('<section class="result">'+
      '<img class="result-img" src="'+st.pic.src+'" alt="'+esc(st.pic.t)+'">'+
      '<h2 class="result-title">스테이지 '+st.stage+' 완성!</h2>'+
      '<p class="result-detail">'+(st.stage>=STAGES?'스테이지 '+STAGES+'개를 모두 마치셨어요. 정말 대단하세요!':'조각 '+st.N+'개를 모두 맞추셨어요.')+'</p>'+
    '</section>'+
    '<div class="btn-row"><button type="button" class="btn" data-action="home">다음 스테이지</button></div>');
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
  var img=currentPainting(),gr=gridFor(img),cols=gr.cols,rows=gr.rows,H=[],V=[],r,k;
  for(r=0;r<rows;r++){H.push([]);V.push([]);for(k=0;k<cols;k++){H[r].push(r>0?mkEdge():null);V[r].push(k>0?mkEdge():null);}}
  st={stage:stage,cols:cols,rows:rows,N:cols*rows,pic:img,done:false,peekTimer:null,edges:{H:H,V:V},placed:{},count:0,imgEl:null};
  JIG.pieces=[];JIG.drag=null;
  show('<header class="topbar"><button type="button" class="home-btn" data-action="home">‹ 처음으로</button></header>'+
    '<div class="jhead-text"><p class="lead" id="msg" aria-live="polite">그림을 조각내는 중이에요…</p><p class="sub" id="jprog"></p></div>'+
    '<div class="jplay" id="jplay"></div>'+
    '<div class="jtools">'+
      '<button type="button" class="btn secondary" data-action="peek">그림 보기</button>'+
      '<button type="button" class="btn secondary" data-action="hint">힌트</button>'+
      '<button type="button" class="btn secondary" data-action="scatter">다시 흩기</button>'+
    '</div>');
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
  if(screen!=='play'||st.done)return;
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
  if(screen!=='play'||st.done||!JIG.pieces.length)return;
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
  nextStage();
  var s=st;
  setTimeout(function(){if(s===st)result();},1800);
}

/* ---------- 끌기 ---------- */
app.addEventListener('pointerdown',function(e){
  if(screen!=='play'||!st||st.done||!JIG.pieces.length)return;
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
  if(screen!=='play'||st.done)return;
  var dx=p.x-p.tx,dy=p.y-p.ty,tol=TOL*Math.min(JIG.pw,JIG.ph);
  if(Math.sqrt(dx*dx+dy*dy)<=tol)placePiece(p,false);
  else if(p.y+p.ch/2<JIG.bh)setMsg('여기는 자리가 아니에요. 조금 옮겨 보세요');
}
app.addEventListener('pointerup',endDrag);
app.addEventListener('pointercancel',endDrag);
window.addEventListener('resize',function(){
  if(screen!=='play'||!st||st.done||!st.imgEl)return;
  clearTimeout(JIG.resizeT);
  JIG.resizeT=setTimeout(function(){
    var play=document.getElementById('jplay');
    if(play&&Math.abs(play.clientWidth-JIG.W)>30){JIG.drag=null;buildJigsaw();}
  },300);
});

/* ---------- 동작 연결 ---------- */
app.addEventListener('click',function(e){
  var t=e.target&&e.target.closest?e.target.closest('[data-action]'):null;
  if(!t||!app.contains(t))return;
  switch(t.getAttribute('data-action')){
    case 'home':renderHome();break;
    case 'play':screen='play';startJigsaw();break;
    case 'scatter':scatterLoose(false);break;
    case 'hint':hint();break;
    case 'peek':peek();break;
    case 'peek-hide':peekHide();break;
  }
});

renderHome();
})();
