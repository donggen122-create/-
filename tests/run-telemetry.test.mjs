import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validatePerf,validateCause} from '../server/src/run-telemetry.js';
import {perfDevice,perfSummary,freshProfile,nextRunAdvice} from '../game/src/rework-core.js';
const perf={v:'guardian-2-test',fps:60,p1:30,long33:.02,long50:.01,q:2,qmax:3,ratio:.85,dev:'tablet',w:1024,h:768,dpr:1.5,sec:180};
test('always-on collector excludes pauses/hidden-tab transitions and stays bounded over 100,000 frames',()=>{
 const source=fs.readFileSync(new URL('../game/src/main.js',import.meta.url),'utf8');
 const snippet=source.slice(source.indexOf('let sgFramePerf='),source.indexOf('function sgDamageSource'));
 let visibility;
 const ctx={renderQuality:{level:0},document:{addEventListener(name,fn){assert.equal(name,'visibilitychange');visibility=fn;}}};vm.createContext(ctx);vm.runInContext(snippet+";globalThis.reset=()=>{sgFramePerf={n:0,ms:0,long33:0,long50:0,qmax:0,hist:new Uint32Array(2049)};sgPerfActive=false};globalThis.sample=sgPerfSample;globalThis.state=()=>sgFramePerf;",ctx);
 ctx.reset();ctx.sample(10000,true);assert.equal(ctx.state().n,0,'first active interval skipped');
 ctx.sample(16,true);ctx.sample(10000,false);ctx.sample(10000,true);assert.equal(ctx.state().n,1,'hidden and resume intervals skipped');
 ctx.renderQuality.level=4;ctx.sample(80,true);assert.equal(ctx.state().qmax,4);assert.equal(ctx.state().long50,1);
 for(let i=0;i<100000;i++)ctx.sample(16,true);
 assert.equal(ctx.state().n,100002);assert.equal(ctx.state().hist.length,2049);assert.ok(ctx.state().hist.byteLength<9000);
 ctx.sample(NaN,true);ctx.sample(Infinity,true);ctx.sample(-1,true);assert.equal(ctx.state().n,100002);
 visibility();ctx.sample(60000,true);assert.equal(ctx.state().n,100002,'resume is skipped even if no RAF ran while hidden');
});
test('perf: all fields validated; bounded JSON; no identifying fields',()=>{
 assert.deepEqual(validatePerf(perf),perf);assert.ok(Buffer.byteLength(JSON.stringify(perf))<600);
 for(const [key,val] of Object.entries(perf)){
  const missing={...perf};delete missing[key];assert.equal(validatePerf(missing),null,key+' missing');
  assert.equal(validatePerf({...perf,[key]:typeof val==='number'?NaN:null}),null,key+' type');
 }
 for(const patch of [{fps:Infinity},{fps:-1},{fps:1001},{p1:1001},{long33:1.01},{long50:.03},{q:1.1},{q:9},{qmax:1},{ratio:.49},{dev:'ipad'},{w:800},{h:0},{dpr:1.555},{dpr:11},{sec:361},{v:'x'.repeat(65)},{v:'<script>'},{ua:'identifier'},{v:'x'.repeat(1200)}])assert.equal(validatePerf({...perf,...patch}),null,JSON.stringify(patch));
 for(const x of [null,[],{},'bad'])assert.equal(validatePerf(x),null);
 const cycle={...perf};cycle.self=cycle;assert.equal(validatePerf(cycle),null);
});
test('cause: safe id, permitted kind, finite bounded time, exact fields',()=>{
 const c={id:'T4_BOSS:p0:follow',kind:'boss',at:192};assert.deepEqual(validateCause(c),c);
 for(const p of [{id:'한글'},{id:'<script>'},{id:''},{id:'a'.repeat(41)},{kind:'unknown'},{at:-1},{at:361},{at:Infinity},{at:'20'},{student:'identifier'}])assert.equal(validateCause({...c,...p}),null);
 for(const kind of ['enemy','boss','hazard','shot'])assert.ok(validateCause({...c,kind}));
});
test('read-only perf summary: average, percentile, ratios, bucket/DPR privacy and constant histogram',()=>{
 const hist=new Uint32Array(2049);hist[17]=98;hist[40]=1;hist[80]=1;
 const state={n:100,ms:98*16.5+40+80,long33:2,long50:1,qmax:3};state.hist=hist;
 const summary=perfSummary(state,{w:820,h:1180,dpr:1.567,dev:'tablet',q:2,ratio:.85,sec:192});
 assert.equal(summary.fps,57.57);assert.equal(summary.p1,25);assert.equal(summary.long50,.01);assert.equal(summary.long33,.02);assert.equal(summary.w,768);assert.equal(summary.h,1024);assert.equal(summary.dpr,1.57);
 assert.ok(validatePerf(summary));assert.equal(hist.length,2049);assert.equal(hist[17],98);assert.equal(perfSummary({n:0},{}),null);
});
test('device categories use UA/coarse/size without retaining UA',()=>{
 for(const [input,expected] of [[{ua:'iPad'},'tablet'],[{ua:'Android',w:800},'tablet'],[{ua:'Android Mobile'},'phone'],[{ua:'Macintosh',coarse:true},'tablet'],[{coarse:true,w:375,h:667},'phone'],[{coarse:true,w:1024,h:768},'tablet'],[{},'pc']])assert.equal(perfDevice(input),expected);
});
test('99th percentile is not clamped to the average when fewer than 1% frames are extreme outliers',()=>{
 const hist=new Uint32Array(2049);hist[16]=999;hist[1000]=1;
 const p=perfSummary({hist,n:1000,ms:999*16+1000,long33:1,long50:1,qmax:0},{w:1280,h:720,dpr:1,dev:'pc',q:0,ratio:1,sec:180});
 assert.equal(p.p1,62.5);assert.ok(p.p1>p.fps);assert.ok(validatePerf(p));
});
test('failure advice is prioritized and leaves profile unchanged',()=>{
 const p=freshProfile(),before=structuredClone(p);
 assert.equal(nextRunAdvice(p,{kind:'boss'}),'대왕 기술은 빨간 표시 밖으로 피해요');assert.equal(nextRunAdvice(p),'친구 꼬북이 끼기');
 assert.equal(nextRunAdvice({...p,coins:50}),'훈련 공격력 올리기(코인 OK)');
 assert.equal(nextRunAdvice({...p,coins:100,training:{attack:5,hp:2}}),'훈련 체력 올리기(코인 OK)');
 for(const difficulty of ['normal','hard'])assert.equal(nextRunAdvice({...p,difficulty}),'쉬움으로 한 번');
 assert.equal(nextRunAdvice({...p,coins:49,difficulty:'normal'}),'쉬움으로 한 번');
 assert.equal(nextRunAdvice({...p,coins:99999,training:{attack:100,hp:100},activePet:'turtle'}),'빨간 표시를 피해 다시 도전해요');assert.deepEqual(p,before);
});
