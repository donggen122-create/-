import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePerf,validateCause} from '../server/src/run-telemetry.js';
import {perfDevice,perfSummary,freshProfile,nextRunAdvice} from '../game/src/rework-core.js';
const perf={v:'guardian-2-test',fps:60,p1:30,long33:.02,long50:.01,q:2,qmax:3,ratio:.85,dev:'tablet',w:1024,h:768,dpr:1.5,sec:180};
test('perf: all fields validated; bounded JSON; no identifying fields',()=>{
 assert.deepEqual(validatePerf(perf),perf);assert.ok(Buffer.byteLength(JSON.stringify(perf))<600);
 for(const [key,val] of Object.entries(perf)){
  const missing={...perf};delete missing[key];assert.equal(validatePerf(missing),null,key+' missing');
  assert.equal(validatePerf({...perf,[key]:typeof val==='number'?NaN:null}),null,key+' type');
 }
 for(const patch of [{fps:Infinity},{fps:-1},{fps:1001},{p1:100},{long33:1.01},{long50:.03},{q:1.1},{q:9},{qmax:1},{ratio:.49},{dev:'ipad'},{w:800},{h:0},{dpr:1.555},{dpr:11},{sec:361},{v:'x'.repeat(65)},{v:'<script>'},{ua:'identifier'},{v:'x'.repeat(1200)}])assert.equal(validatePerf({...perf,...patch}),null,JSON.stringify(patch));
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
test('failure advice is prioritized and leaves profile unchanged',()=>{
 const p=freshProfile(),before=structuredClone(p);
 assert.equal(nextRunAdvice(p,{kind:'boss'}),'대왕 기술은 빨간 표시 밖으로 피해요');assert.equal(nextRunAdvice(p),'친구 꼬북이 끼기');
 assert.equal(nextRunAdvice({...p,coins:50}),'훈련 공격력 올리기(코인 OK)');
 assert.equal(nextRunAdvice({...p,coins:100,training:{attack:5,hp:2}}),'훈련 체력 올리기(코인 OK)');
 for(const difficulty of ['normal','hard'])assert.equal(nextRunAdvice({...p,difficulty}),'쉬움으로 한 번');
 assert.equal(nextRunAdvice({...p,coins:49,difficulty:'normal'}),'쉬움으로 한 번');
 assert.equal(nextRunAdvice({...p,coins:99999,training:{attack:100,hp:100},activePet:'turtle'}),'빨간 표시를 피해 다시 도전해요');assert.deepEqual(p,before);
});
