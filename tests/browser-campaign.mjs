import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
await fs.mkdir('work',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined});
const context=await browser.newContext({viewport:{width:1365,height:960},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8797');await page.locator('#login-id').waitFor({state:'visible'});
const id='cp'+Date.now().toString().slice(-8);await page.locator('#login-id').fill(id);await page.locator('#login-pw').fill('local-campaign-only');await page.locator('#btn-register').click();
await page.locator('#btn-title-start:not([disabled])').waitFor({timeout:20000});await page.locator('#btn-title-start').click();
for(let stage=1;stage<=5;stage++){
  await page.locator('.sg-nav [data-tab="adventure"]').click();await page.locator(`[data-stage="CH0${stage}"]`).click();await page.locator('#sg-start').click();await page.waitForFunction(()=>window.__sgSnapshot().mode==='playing');
  await page.evaluate(()=>window.__debugGod=true);
  let last;
  for(let chunk=0;chunk<25;chunk++){
    last=await page.evaluate(()=>window.__debugAutoPlay(20));
    if(last.mode==='result')break;
    if(stage===5&&last.runTime>242&&last.runTime<266){await page.screenshot({path:'work/boss-combat.png'});report.push({bossScreen:last});}
  }
  await page.locator('#btn-continue:not([disabled])').waitFor({state:'visible',timeout:20000});
  const state=await page.evaluate(()=>window.__guardian());
  report.push({stage,won:state.cleared,passes:state.passes.remaining,snapshot:await page.evaluate(()=>window.__sgSnapshot()),result:await page.locator('#result').innerText()});
  assert.equal(state.cleared,true,`stage ${stage} failed even with QA god mode`);
  await page.locator('#btn-continue').click();
  if(stage===3||stage===5){await page.locator('[data-action="choose-pet"]').first().click();await page.locator('.sg-dialog [data-close]').click();}
}
await page.locator('.sg-nav [data-tab="friends"]').click();await page.screenshot({path:'work/friends-desktop.png'});
await page.locator('.sg-nav [data-tab="gear"]').click();await page.locator('[data-action="upgrade"][data-slot="WPN"]').click();await page.locator('.sg-dialog [data-close]').click();
await page.locator('.sg-nav [data-tab="gifts"]').click();
for(let i=0;i<5;i++){
  if(i===4){assert.equal(await page.locator('#sg-gift-slot').count(),1);await page.locator('#sg-gift-slot').selectOption('ARM');}
  await page.locator('[data-do="gift"]').click();await page.locator('.sg-dialog [data-close]').click();
}
assert.ok((await page.evaluate(()=>window.__guardian())).profile.gear.seed_ARM>=1);
await page.locator('.sg-nav [data-tab="adventure"]').click();await page.locator('.sg-main').evaluate(e=>e.scrollTop=0);await page.screenshot({path:'work/lobby-complete-desktop.png'});
const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,storageState:await context.storageState()});
const m=await mobile.newPage();m.on('pageerror',e=>errors.push('mobile: '+e.message));await m.goto('http://127.0.0.1:8797');await m.locator('#btn-title-start:not([disabled])').waitFor({state:'visible'});await m.locator('#btn-title-start').tap();
await m.screenshot({path:'work/lobby-mobile.png'});await m.locator('[data-do="passes"]').tap();await m.screenshot({path:'work/passes-mobile.png'});await m.locator('.sg-dialog [data-close]').tap();
for(const tab of ['friends','gear','book','gifts']){await m.locator(`.sg-nav [data-tab="${tab}"]`).tap();await m.screenshot({path:`work/${tab}-mobile.png`});assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
await m.locator('.sg-nav [data-tab="adventure"]').tap();await m.locator('[data-stage="CH01"]').tap();await m.locator('#sg-start').tap();await m.waitForFunction(()=>window.__sgSnapshot().mode==='playing');
const cdp=await mobile.newCDPSession(m),before=await m.evaluate(()=>window.__debugPlayerPos());
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:140,y:590}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:590}]});await m.waitForTimeout(500);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
const after=await m.evaluate(()=>window.__debugPlayerPos());assert.ok(after.x>before.x+10,'mobile drag should move character');
await m.evaluate(()=>{window.__debugGod=true;window.__debugAutoPlay(42);});await m.screenshot({path:'work/combat-mobile.png'});
await m.locator('#btn-pause').tap();await m.locator('#btn-quit-lobby').tap();await m.locator('#btn-continue:not([disabled])').waitFor({state:'visible'});const failed=await m.evaluate(()=>window.__guardian());assert.equal(failed.charged,0);
report.push({mobileDrag:{before,after},mobileLossRemaining:failed.passes.remaining,errors});
await fs.writeFile('work/campaign-browser-results.json',JSON.stringify({id,report},null,2));
console.log(JSON.stringify({id,stages:report.filter(x=>x.stage).map(x=>({stage:x.stage,won:x.won,passes:x.passes,choices:x.snapshot.choices})),mobileDrag:after.x-before.x,errors}));
await browser.close();
