// Rendering workload controls only. No rewards, random rolls, or account state.
export function createFrameClock(step=1/60,maxSteps=4){
 let remainder=0;
 return {
  reset(){remainder=0;},
  advance(seconds,active=true,speed=1){
   if(!active||!Number.isFinite(seconds)||seconds<0){remainder=0;return 0;}
   remainder+=Math.min(seconds,.25)*speed;
   const available=Math.floor((remainder+1e-10)/step),count=Math.min(available,maxSteps*speed);
   // Drop whole overdue ticks instead of a backlog avalanche; retain the fractional tick for 120Hz.
   remainder=Math.max(0,remainder-available*step);
   return count;
  }
 };
}
export function createRenderQuality(deviceRatio=1){
 const cap=Math.max(.5,Math.min(2,Number(deviceRatio)||1));
 const levels=[cap,...[1.5,1.25,1].filter(v=>v<cap)],slowThreshold=1/35;
 let index=0,elapsed=0,frames=0,stable=0,cooldown=0;
 return {
  get ratio(){return levels[index];},
  sample(dt,active=true){
   if(!active||!Number.isFinite(dt)||dt<=0||dt>.5){elapsed=0;frames=0;stable=0;return false;}
   elapsed+=dt;frames++;cooldown=Math.max(0,cooldown-dt);
   if(elapsed<2)return false;
   const mean=elapsed/frames,window=elapsed;elapsed=0;frames=0;
   if(mean>slowThreshold){stable=0;if(!cooldown&&index<levels.length-1){index++;cooldown=4;return true;}}
   else if(mean<1/55){stable+=window;if(stable>=30&&!cooldown&&index>0){index--;stable=0;cooldown=8;return true;}}
   else stable=0;
   return false;
  }
 };
}
export function setText(node,value){if(!node)return false;const text=String(value);if(node.textContent===text)return false;node.textContent=text;return true;}
export function setWidth(node,value){if(!node)return;const width=String(value);if(node.style.width!==width)node.style.width=width;}
