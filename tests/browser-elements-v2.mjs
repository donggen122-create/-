import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined});
await fs.mkdir('work/v2-qa',{recursive:true});
const report={campaign:[],weapons:[],errors:[],mobile:{}}, attempts={};
const base=process.env.BASE||'http://127.0.0.1:8797';
assert.ok(new URL(base).hostname==='127.0.0.1','simulation hooks must remain local');
try{
const context=await browser.newContext({viewport:{width:1365,height:960}}),page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
await page.goto(base);await page.locator('#login-id').fill('v2play'+Date.now().toString().slice(-8));await page.locator('#login-pw').fill('local-v2-playtest');await page.locator('#btn-register').click();
await page.locator('#btn-title-start:not([disabled])').waitFor();await page.locator('#btn-title-start').click();
const close=async p=>{await p.locator('.sg-dialog[open] [data-close]').last().waitFor();await p.locator('.sg-dialog[open] [data-close]').last().click();};
if(process.env.UI_ONLY){
 await page.evaluate(async()=>{for(let i=1;i<=5;i++){const cloud=window.__cloud;const start=await cloud.request('/play/start',{method:'POST',body:JSON.stringify({stage:`CH0${i}`,clientVersion:2,requestId:crypto.randomUUID()})});await cloud.request('/play/finish',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),runId:start.runId,cleared:true,seconds:start.duration,litter:6,hpFraction:1,bossSeconds:30})});}});
 await page.reload();await page.locator('#btn-title-start:not([disabled])').click();
}
for(let stage=1;stage<=(process.env.UI_ONLY?0:5);stage++){
 await page.locator('.sg-nav [data-tab="adventure"]').click();await page.locator(`[data-stage="CH0${stage}"]`).click();
 await page.locator('#sg-weapon-mode').selectOption(stage%2?'melee':'ranged');await page.locator('#sg-weapon-element').selectOption(['neutral','fire','water','wind','lightning'][stage-1]);
 await page.locator('#sg-start').click();await page.locator('#levelup:not(.hidden)').waitFor();
 let last,firstFusion=null;
 for(let chunk=0;chunk<28;chunk++){
  last=await page.evaluate(()=>window.__debugPilot(15));const snap=await page.evaluate(()=>window.__sgSnapshot());
  if(!firstFusion&&snap.run.fusionCount)firstFusion=snap.runTime;
  if(stage===1&&chunk===0)await page.screenshot({path:'work/v2-qa/combat-desktop.png'});
  if(stage===5&&last.runTime>240&&last.runTime<270)await page.screenshot({path:'work/v2-qa/boss-desktop.png'});
  if(last.mode==='result')break;
 }
 await page.locator('#btn-continue:not([disabled])').waitFor({timeout:20000});const state=await page.evaluate(()=>window.__guardian());
 const row={stage,attempt:attempts[stage]=(attempts[stage]||0)+1,...last,firstFusion,won:state.cleared,passes:state.passes.remaining,skills:await page.evaluate(()=>window.__debugSkillState())};report.campaign.push(row);console.log('STAGE',JSON.stringify(row));
 if(!state.cleared){assert.equal(state.charged,0);assert.equal(state.passes.remaining,11-stage);assert.ok(attempts[stage]<3,`base growth stage${stage}failed three attempts`);await page.locator('#btn-continue').click();stage--;continue;}
 assert.equal(state.passes.remaining,10-stage);
 await page.locator('#btn-continue').click();
}
// Actual server-backed permanent growth and gacha via UI.
await page.locator('.sg-nav [data-tab="parts"]').click();await page.locator('#sg-first-part').selectOption('PART_F1');await page.locator('[data-do="choose-first-part"]').click();await close(page);
const before=(await page.evaluate(()=>window.__guardian())).profile;
await page.locator('[data-action="upgrade-part"][data-id="PART_F1"]').click();await close(page);
assert.equal((await page.evaluate(()=>window.__guardian())).profile.parts.PART_F1.level,2);
await page.locator('[data-reset="PART_F1"]').click();await page.locator('#sg-confirm-reset').click();await close(page);
assert.equal((await page.evaluate(()=>window.__guardian())).profile.coins,before.coins);
for(let n=1;n<=5;n++){
 if(n===5)await page.locator('#sg-draw-part').selectOption('PART_L2');else await page.locator('#sg-draw-element').selectOption(n%2?'fire':'earth');
 await page.locator('[data-do="draw-part"]').click();await close(page);
}
assert.ok((await page.evaluate(()=>window.__guardian())).profile.parts.PART_L2);
await page.locator('.sg-nav [data-tab="training"]').click();await page.locator('[data-action="train"][data-stat="attack"]').click();await close(page);
assert.equal((await page.evaluate(()=>window.__guardian())).profile.training.attack,2);
await page.locator('.sg-nav [data-tab="friends"]').click();await page.locator('[data-action="choose-pet"]').first().click();await close(page);
await page.screenshot({path:'work/v2-qa/friends.png'});
await page.locator('.sg-nav [data-tab="adventure"]').click();await page.screenshot({path:'work/v2-qa/lobby-desktop.png'});
// Four weapon presentations and all combat entities run in the browser.
await page.locator('[data-stage="CH01"]').click();await page.locator('#sg-start').click();await page.locator('#levelup:not(.hidden)').waitFor();await page.locator('#card-row .card').first().click();
await page.evaluate(()=>window.__debugGod=true);
for(const hero of ['hoya','minji'])for(const weaponMode of ['melee','ranged']){
 await page.evaluate(({hero,weaponMode})=>{window.__sgCombatLoad([],{hero,weaponMode,weaponElement:'neutral'});window.__debugSpawn('T1_SNACKBAG',20,50);window.__debugAutoPlay(1);window.__debugFreeze(.12);},{hero,weaponMode});
 report.weapons.push(await page.evaluate(()=>window.__sgSnapshot().weapon));await page.screenshot({path:`work/v2-qa/${hero}-${weaponMode}.png`});
}
for(const ids of [['F1','F2','F3','W1','W2'],['W3','V1','V2','V3','E1'],['E2','E3','L1','L2','L3'],...Array.from({length:5},(_,n)=>Array.from({length:3},(_,i)=>`COMBO_${String(n*3+i+1).padStart(2,'0')}`))]){
 const state=await page.evaluate(ids=>{window.__sgCombatLoad(ids);window.__debugSpawn('T1_SNACKBAG',65,130);window.__debugAutoPlay(5);return window.__sgSnapshot();},ids);
 assert.ok(Object.values(state.elements.casts).reduce((a,b)=>a+b,0)>0,ids.join(','));
}
await page.locator('#btn-pause').click();await page.locator('#btn-quit-lobby').click();await page.locator('#btn-continue:not([disabled])').waitFor();assert.equal((await page.evaluate(()=>window.__guardian())).charged,0);await page.locator('#btn-continue').click();
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:await context.storageState()}),m=await mobile.newPage();m.on('pageerror',e=>report.errors.push('mobile:'+e.message));
await m.goto(base);await m.locator('#btn-title-start:not([disabled])').click();
for(const tab of ['adventure','training','parts','friends','book']){
 await m.locator(`.sg-nav [data-tab="${tab}"]`).tap();await m.screenshot({path:`work/v2-qa/${tab}-mobile.png`});assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,tab+'mobile overflow');
}
await m.locator('[data-book-tab="combos"]').tap();assert.equal(await m.locator('.sg-recipes>article').count(),15);await m.screenshot({path:'work/v2-qa/combos-mobile.png'});
await m.locator('[data-do="passes"]').tap();assert.match(await m.locator('.sg-dialog').innerText(),/8시/);await close(m);
await m.locator('.sg-nav [data-tab="adventure"]').tap();await m.locator('[data-stage="CH01"]').tap();await m.locator('#sg-start').tap();await m.locator('#card-row .card').first().tap();
const cdp=await mobile.newCDPSession(m),pos=await m.evaluate(()=>window.__debugPlayerPos());
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:590}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:198,y:590}]});await m.waitForTimeout(600);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
report.mobile.moved=(await m.evaluate(()=>window.__debugPlayerPos())).x-pos.x;assert.ok(report.mobile.moved>10);
await m.evaluate(()=>{window.__debugGod=true;window.__sgCombatLoad(['COMBO_04','COMBO_12','E1','W3','F3'],{hero:'minji',weaponMode:'ranged'});window.__debugForceBoss();window.__debugAutoPlay(5);});await m.screenshot({path:'work/v2-qa/combat-mobile.png'});
await m.locator('#btn-pause').tap();await m.locator('#btn-quit-lobby').tap();await m.locator('#btn-continue:not([disabled])').waitFor();assert.equal((await m.evaluate(()=>window.__guardian())).passes.remaining,5);
report.mobile.noOverflow=true;assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile('work/v2-qa/browser-results.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
