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
// 화질 단계(2026-09-28 태블릿 후반 "엄청 느려짐"): 해상도(ratio)와 효과량(fx)을 함께 내린다.
//  fx 0 = 모든 효과, 1 = 장식 줄임(빛 번짐·가장자리 어둡게·겹쳐 그리기 끔, 효과·숫자 개수 줄임), 2 = 최소(숫자 테두리도 끔, 더 적게).
//  느리면(평균 35화면/초 미만) 한 단계, 아주 느리면(20화면/초 미만) 두 단계씩 내려간다. 해상도는 0.7배까지(화면 크기는 그대로, 조금 흐려짐).
export function qualityLevels(deviceRatio=1){
 const cap=Math.max(.5,Math.min(2,Number(deviceRatio)||1));
 const fxFor=r=>r>=1.5?0:r>=1?1:2,levels=[{ratio:cap,fx:0}];
 if(cap<=1.25)levels.push({ratio:cap,fx:1});   // 해상도가 이미 낮은 기기는 같은 해상도에서 효과부터 줄인다
 for(const r of [1.5,1.25,1,.85,.7])if(r<cap)levels.push({ratio:r,fx:Math.max(fxFor(r),levels[levels.length-1].fx)});
 return levels;
}
export function createRenderQuality(deviceRatio=1){
 const levels=qualityLevels(deviceRatio),slowThreshold=1/35,verySlow=1/20;
 let index=0,elapsed=0,frames=0,stable=0,cooldown=0;
 return {
  get ratio(){return levels[index].ratio;},
  get fx(){return levels[index].fx;},
  get level(){return index;},
  force(i){index=Math.max(0,Math.min(levels.length-1,i|0));elapsed=0;frames=0;stable=0;cooldown=4;},   // QA(로컬 측정) 전용
  sample(dt,active=true){
   if(!active||!Number.isFinite(dt)||dt<=0||dt>.5){elapsed=0;frames=0;stable=0;return false;}
   elapsed+=dt;frames++;cooldown=Math.max(0,cooldown-dt);
   if(elapsed<2)return false;
   const mean=elapsed/frames,window=elapsed;elapsed=0;frames=0;
   if(mean>slowThreshold){stable=0;if(!cooldown&&index<levels.length-1){index=Math.min(levels.length-1,index+(mean>verySlow?2:1));cooldown=4;return true;}}
   else if(mean<1/55){stable+=window;if(stable>=30&&!cooldown&&index>0){index--;stable=0;cooldown=8;return true;}}
   else stable=0;
   return false;
  }
 };
}
export function setText(node,value){if(!node)return false;const text=String(value);if(node.textContent===text)return false;node.textContent=text;return true;}
export function setWidth(node,value){if(!node)return;const width=String(value);if(node.style.width!==width)node.style.width=width;}

// Presentation only. Bound native bitmap memory, coalesce async resizing and close stale results.
// Failed/unsupported resizing retains the original. Never changes simulation data or random calls.
export function createSpriteScaleCache(limit=96,makeBitmap=globalThis.createImageBitmap?.bind(globalThis)){
 const entries=new Map(),sources=new WeakMap();let newest=null;
 const capacity=Math.max(1,limit|0),close=e=>e.bitmap?.close?.();
 return {
  get(source,deviceHeight){
   if(!source||typeof makeBitmap!=='function'||!Number.isFinite(deviceHeight)||deviceHeight<=0)return source;
   const h=source.naturalHeight||source.height,w=source.naturalWidth||source.width;
   if(!h||!w)return source;
   const bucket=Math.max(16,Math.ceil(deviceHeight/16)*16);
   if(h<=bucket*1.25)return source;
   // Nested numeric maps avoid allocating a string key on every sprite draw.
   let sizes=sources.get(source);if(!sizes){sizes=new Map();sources.set(source,sizes);}
   let entry=sizes.get(bucket);
   if(entry){if(entry!==newest){entries.delete(entry);entries.set(entry,true);newest=entry;}return entry.bitmap||source;}
   entry={bitmap:null,sizes,bucket};sizes.set(bucket,entry);entries.set(entry,true);newest=entry;
   while(entries.size>capacity){const e=entries.keys().next().value;entries.delete(e);e.sizes.delete(e.bucket);close(e);}
   try{Promise.resolve(makeBitmap(source,{resizeHeight:bucket,resizeWidth:Math.max(1,Math.round(bucket*w/h)),resizeQuality:'high'}))
    .then(bitmap=>{if(sizes.get(bucket)===entry)entry.bitmap=bitmap;else bitmap.close?.();}).catch(()=>{});}catch{/* Original remains usable. */}
   return source;
  },
  clear(){for(const e of entries.keys()){e.sizes.delete(e.bucket);close(e);}entries.clear();newest=null;},
  get size(){return entries.size;}
 };
}
