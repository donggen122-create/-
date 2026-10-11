"""Local battle art, notice persistence, failed load/retry and chapter reuse checks."""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser import chrome_path, local_url

ROOT=Path(__file__).resolve().parents[3]
BASE=local_url('http://localhost:8797')
OUT=ROOT/'docs/codex/measurements/B/chapter-loading.json'
p=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"],cwd=ROOT))
p.update(hero='minji',heroLocked=True,milestones={'firstPart':True,'firstGear':True,'firstPet':True},stages={f'CH{i:02}':{'cleared':True,'stars':3} for i in range(1,21)})
def quiet(page):
    for _ in range(4):
        page.wait_for_timeout(150);page.evaluate("document.querySelectorAll('dialog[open] [data-close]').forEach(b=>b.click())")
def lobby(page):
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled",polling=50)
    page.evaluate("document.getElementById('btn-title-start').click()");page.locator('#guardian-lobby .sg-nav').wait_for();quiet(page)
def stage(page,ch):
    page.evaluate('ch=>{window.__sgUI.chapter=String(ch);window.__sgUI.stage="CH"+String(ch*5).padStart(2,"0");window.__sgUI.chapterPicked=true;window.__sgUI.render()}',ch)
def departure(page):
    page.evaluate("(document.querySelector('#sg-start-dock')||document.querySelector('#sg-start')).click()")
    page.locator('#levelup:not(.hidden)').wait_for()

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,executable_path=chrome_path(),args=['--no-sandbox','--disable-gpu'])
    ctx=b.new_context(viewport={'width':1280,'height':720})
    # Prevent real-time gameplay while examining art. The autopilot uses fixed ticks.
    ctx.add_init_script("window.requestAnimationFrame=()=>0;window.__missingDraw=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(src,...a){if(src instanceof HTMLImageElement&&!src.naturalWidth)window.__missingDraw.push(src.src);return draw.call(this,src,...a)}")
    ctx.route('**/*',lambda r:r.fallback() if r.request.url.startswith(BASE+'/') else r.abort())
    page=ctx.new_page();errors=[];bad=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:bad.append(r.url) if r.status>=400 and '/api/register' not in r.url else None)
    page.on('request',lambda r:requests.append(r.url))
    page.goto(BASE+'/?ui=2',wait_until='networkidle');page.request.post(BASE+'/_qa/reset-attempts')
    page.locator('#login-id').fill('qachapter');page.locator('#login-pw').fill('qa_local_1234');page.locator('#btn-register').click();page.wait_for_timeout(350)
    if page.locator('#btn-title-start').is_hidden():page.locator('#btn-login').click()
    page.locator('#btn-title-start').wait_for(state='visible')
    assert page.request.post(BASE+'/_qa/profile',data={'id':'qachapter','profile':p},max_retries=2).ok
    page.reload(wait_until='networkidle');lobby(page)
    # Closing is persisted; reload and open again through news.
    hidden=page.evaluate("localStorage.getItem('seoho_v1_ch4-notice-hide_qachapter')")
    assert hidden=='1'
    page.reload(wait_until='networkidle');lobby(page)
    assert not page.locator('.sg-update-ch4:visible').count()
    page.evaluate("document.querySelector('[data-do=news]').click()");assert page.locator('.sg-update-ch4:visible').count()==1;quiet(page)
    records=[]
    # Missing chapter art: no run should be registered, and the next attempt can succeed.
    stage(page,1);before=len([u for u in requests if '/api/play/start' in u])
    ctx.route('**/assets/sprites/t1/floor_dirt.png*',lambda r:r.fulfill(status=404,body='QA missing art'))
    page.evaluate("document.querySelector('#sg-start').click()")
    page.wait_for_function("document.querySelector('dialog[open]')?.innerText.includes('불러오지')",polling=50)
    page.wait_for_timeout(500)
    assert len([u for u in requests if '/api/play/start' in u])==before
    assert not page.locator('#sg-start').is_disabled()
    ctx.unroute('**/assets/sprites/t1/floor_dirt.png*');quiet(page)
    intentional=bad.copy();bad.clear()
    for ch in range(1,5):
        stage(page,ch);departure(page)
        ready=page.evaluate("""async ch=>{const m=await import('./src/assets.js');return [...m.COMMON_SPRITE_KEYS,...m.CHAPTER_SPRITE_KEYS[ch]].filter(k=>!m.SPRITES[k]?.naturalWidth)}""",ch)
        assert not ready,ready
        if ch==1:
            assert not any('/assets/sprites/t4/' in u for u in requests), 'Chapter-1 downloaded chapter-4 combat art'
            assert not page.evaluate("import('./src/assets.js').then(m=>m.HEROES.hoya.frames.attack.some(i=>i.naturalWidth))")
        result=page.evaluate("()=>{window.__pilotGod=true;window.__pilotAvoid=2;return window.__debugPilot(365)}")
        page.locator('#btn-continue:enabled').wait_for()
        missing=page.evaluate('window.__missingDraw');assert not missing,missing
        records.append({'chapter':ch,'unreadySprites':ready,'missingDraw':missing,'outcome':result})
        page.evaluate("document.getElementById('btn-continue').click()");quiet(page)
    # The cached chapter manifest makes zero new sprite requests on a second departure.
    stage(page,1);n=len(requests);departure(page)
    new=[u for u in requests[n:] if '/assets/sprites/t1/' in u]
    assert not new,new
    report={'chapters':records,'noticeClosePersisted':hidden,'newsReopens':True,'failureDoesNotStartRun':True,'retrySucceeded':True,'reuseChapterRequests':new,'intentional404':intentional,'unexpected404':bad,'pageErrors':errors}
    assert not errors and not bad,report
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False),flush=True);ctx.close();b.close()
