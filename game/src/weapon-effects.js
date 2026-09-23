// Main weapon owns body animation; elemental attacks never change hero frames.
// 2026-09-23: 무기 원소 설정을 없앴다(사용자: "무기는 근거리·원거리만"). 원소 부가 효과(잔열·느림·관통·보호막·연쇄)는 제거.
// damage()의 5번째 인자 'weapon'은 어려움 난이도의 특별한 적(튼튼이: 스킬 피해 50%, 기본 무기 100%) 판정에 쓴다.
export const WEAPON_RULES={melee:{interval:.85,reach:2.5,coefficient:1.15,contact:.16},ranged:{interval:.75,reach:9,coefficient:.85,contact:.17}};
const COLOR='#c1efff';
export function createWeaponCombat({U,getPlayer,getEnemies,getBoss,getProfile,damage,images={},sound=()=>{},getMods=()=>({})}){
 let cooldown=0,attack=null,time=0,shots=[],sparks=[],hits=0,casts=0;
 const targets=()=>[...getEnemies(),...(getBoss()?[getBoss()]:[])].filter(e=>e.hp>0);
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const hit=(e,value,origin)=>{
  if(!e||e.hp<=0)return;
  damage(e,value,{x:e.x-origin.x,y:e.y-origin.y},.12,'weapon');hits++;
  sparks.push({x:e.x,y:e.y,life:.22});
 };
 function update(dt){
  const p=getPlayer(),profile=getProfile();if(!p||!profile)return;
  time+=dt;cooldown-=dt;
  const mode=profile.weaponMode||'melee',rule=WEAPON_RULES[mode];
  if(attack){
   attack.age+=dt;p.attackT=Math.max(0,.3-attack.age);
   if(!attack.fired&&attack.age>=rule.contact){
    attack.fired=true;const angle=attack.angle,value=p.atk*rule.coefficient*(getMods()?.dmgMul||1);
    if(mode==='melee'){
     for(const e of targets()){
      const a=Math.atan2(e.y-p.y,e.x-p.x),difference=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));
      if(distance(p,e)<=rule.reach*U+(e.radiusU||.4)*U&&Math.abs(difference)<1.15)hit(e,value,p);
     }
    }else shots.push({x:p.x+Math.cos(angle)*.5*U,y:p.y+Math.sin(angle)*.5*U,angle,life:rule.reach/14,speed:14*U,value,hero:profile.hero,seen:new Set()});
    sound(mode==='melee'?'swing':'shoot');
   }
   if(attack.age>=.3)attack=null;
  }
  if(!attack&&cooldown<=0){
   const e=targets().filter(e=>distance(e,p)<=rule.reach*U+(mode==='melee'?(e.radiusU||0)*U:0)).sort((a,b)=>distance(a,p)-distance(b,p))[0];
   if(e){const angle=Math.atan2(e.y-p.y,e.x-p.x);attack={angle,age:0,fired:false};p.aimAngle=angle;p.facing=Math.cos(angle)>=0?1:-1;p.attackT=.3;cooldown=rule.interval*(getMods()?.intervalMul||1);casts++;}
  }
  for(const s of shots){
   const ox=s.x,oy=s.y;s.x+=Math.cos(s.angle)*s.speed*dt;s.y+=Math.sin(s.angle)*s.speed*dt;s.life-=dt;
   const contacts=targets().map(e=>{
    const dx=e.x-ox,dy=e.y-oy,ux=Math.cos(s.angle),uy=Math.sin(s.angle),along=dx*ux+dy*uy,perp=dx*uy-dy*ux,r=(e.radiusU||.4)*U+.18*U;
    return {e,entry:along-Math.sqrt(Math.max(0,r*r-perp*perp))};
   }).sort((a,b)=>a.entry-b.entry);
   for(const {e} of contacts){
    const vx=s.x-ox,vy=s.y-oy,t=Math.max(0,Math.min(1,((e.x-ox)*vx+(e.y-oy)*vy)/(vx*vx+vy*vy||1)));
    if(s.seen.has(e)||Math.hypot(e.x-ox-vx*t,e.y-oy-vy*t)>(e.radiusU||.4)*U+.18*U)continue;
    hit(e,s.value,{x:ox,y:oy});s.seen.add(e);s.life=0;break;    // 공은 처음 맞은 적에서 멈춘다
   }
  }
  shots=shots.filter(s=>s.life>0);
  for(const s of sparks)s.life-=dt;sparks=sparks.filter(s=>s.life>0).slice(-80);
 }
 function sprite(ctx,id,x,y,width,height,angle=0,anchor=.5){
  const img=images[id];if(!img?.complete||!img.naturalWidth)return false;
  const b=img.assetBounds||{x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=true;
  ctx.drawImage(img,b.x,b.y,b.w,b.h,-width*anchor,-height/2,width,height);ctx.restore();return true;
 }
 function draw(ctx,toScreen){
  const p=getPlayer(),profile=getProfile();if(!p||!profile)return;
  const s=toScreen(p.x,p.y),mode=profile.weaponMode;
  for(const b of shots){
   const q=toScreen(b.x,b.y);ctx.save();ctx.strokeStyle=COLOR;ctx.lineWidth=3;ctx.globalAlpha=.5;
   ctx.beginPath();ctx.moveTo(q.x-Math.cos(b.angle)*19,q.y-Math.sin(b.angle)*19);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.globalAlpha=1;
   const size=b.hero==='minji'?18:12;if(!sprite(ctx,b.hero==='minji'?'dodgeball':'baseball',q.x,q.y,size,size,time*8)){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(q.x,q.y,5,0,7);ctx.fill();}ctx.restore();
  }
  // 무기(검·연필·배트·손에 든 공)는 따로 덧그리지 않는다 — 주인공 그림(원본 공격 프레임·원거리 전용 프레임)이 무기까지 담고 있다(사용자 결정 2026-09-22).
  // 여기서는 날아가는 공(위 shots)과 근거리 휘두름 궤적, 타격 불꽃만 그린다.
  const age=attack?.age||0,a=attack?.angle??((p.facing||1)===1?0:Math.PI);
  if(mode==='melee'&&attack&&age>=.12&&age<.27){
   ctx.save();ctx.translate(s.x,s.y);ctx.strokeStyle=COLOR;ctx.lineCap='round';ctx.lineWidth=profile.hero==='minji'?3:7;ctx.globalAlpha=.72*(1-(age-.12)/.15);
   ctx.beginPath();ctx.arc(0,0,2.1*U,a-1.05,a+1.05);ctx.stroke();
   ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,2.25*U,a-.8,a+.85);ctx.stroke();ctx.restore();
  }
  for(const f of sparks){const q=toScreen(f.x,f.y);ctx.save();ctx.strokeStyle=COLOR;ctx.globalAlpha=f.life/.22;ctx.lineWidth=2;const r=5+(1-f.life/.22)*12;for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;ctx.beginPath();ctx.moveTo(q.x+Math.cos(a)*r*.5,q.y+Math.sin(a)*r*.5);ctx.lineTo(q.x+Math.cos(a)*r,q.y+Math.sin(a)*r);ctx.stroke();}ctx.restore();}
 }
 return {update,draw,reset(){cooldown=0;attack=null;time=0;shots=[];sparks=[];hits=0;casts=0;},bodyLean(){return attack?Math.sin(attack.age/.3*Math.PI)*.055*(getPlayer().facing||1):0;},snapshot(){return {casts,hits,shots:shots.length,attack:attack?{...attack}:null,mode:getProfile()?.weaponMode,hero:getProfile()?.hero};}};
}
