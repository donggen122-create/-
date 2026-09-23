import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
await fs.mkdir('work',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||undefined}),page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:8797');await page.locator('#login-id').waitFor({state:'visible'});
const id='bt'+Date.now().toString().slice(-8);await page.locator('#login-id').fill(id);await page.locator('#login-pw').fill('local-balance-only');await page.locator('#btn-register').click();await page.locator('#btn-title-start:not([disabled])').waitFor();await page.locator('#btn-title-start').click();
for(let stage=1;stage<=5;stage++){
  await page.locator('.sg-nav [data-tab="adventure"]').click();await page.locator(`[data-stage="CH0${stage}"]`).click();await page.locator('#sg-start').click();await page.waitForFunction(()=>window.__sgSnapshot().mode==='playing');
  let r;for(let i=0;i<21;i++){r=await page.evaluate(()=>window.__debugPilot(20));if(r.mode==='result')break;}
  await page.locator('#btn-continue:not([disabled])').waitFor({timeout:20000});const won=await page.evaluate(()=>window.__guardian().cleared);results.push({stage,won,...r});
  await page.locator('#btn-continue').click();
  if(stage===3&&won){await page.locator('[data-action="choose-pet"][data-id="otter"]').click();await page.locator('.sg-dialog [data-close]').click();}
  if(!won)break;
}
// Result response is deliberately lost AFTER server commit, then retried with the same run ID.
await page.locator('.sg-nav [data-tab="adventure"]').click();await page.locator('[data-stage="CH01"]').click();await page.locator('#sg-start').click();await page.waitForFunction(()=>window.__sgSnapshot().mode==='playing');
const winsBefore=await page.evaluate(()=>window.__guardian().profile.wins),passesBefore=await page.evaluate(()=>window.__guardian().passes.remaining);
let losses=0;
await page.route('**/api/play/finish',async route=>{if(losses++<2){await route.fetch();await route.abort('failed');}else await route.continue();});
await page.evaluate(()=>{window.__debugGod=true;window.__debugAutoPlay(310);});
await page.locator('#sg-retry-result').waitFor({state:'visible',timeout:20000});
assert.equal(await page.locator('#btn-continue').isDisabled(),true);
await page.reload();await page.locator('#btn-title-start:not([disabled])').waitFor({timeout:20000});
const recovered=await page.evaluate(()=>window.__guardian());assert.equal(recovered.profile.wins,winsBefore+1);assert.equal(recovered.passes.remaining,passesBefore-1);assert.equal(recovered.active,null);
const admin=await browser.newPage({viewport:{width:1365,height:900}});admin.on('pageerror',e=>errors.push('admin '+e.message));await admin.goto('http://127.0.0.1:8797/admin/');await admin.locator('#key').fill('local-only-test-key');await admin.locator('#login-form button').click();await admin.locator('#main').waitFor({state:'visible'});assert.ok((await admin.locator('#main').innerText()).includes('이용권'));await admin.screenshot({path:'work/admin-local.png'});
await fs.writeFile('work/balance-and-retry-results.json',JSON.stringify({id,results,retryRecovery:true,errors},null,2));console.log(JSON.stringify({results,retryRecovery:true,errors}));await browser.close();
