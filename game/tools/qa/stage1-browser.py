"""Browser verification with actual Worker account/game handlers on the loopback QA adapter.
Never creates production accounts. Screenshots under qa/out (git ignored).
"""
import argparse,json,os,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://localhost:8797');ap.add_argument('--out',default=str(ROOT/'game/tools/qa/out/stage1'));ap.add_argument('--perf-only',action='store_true');ap.add_argument('--label',default='after');args=ap.parse_args()
OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
BASE=args.url.rstrip('/')
assert BASE.startswith(('http://localhost:','http://127.0.0.1:')), 'QA mutations are loopback only'
fresh=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"],cwd=ROOT))
results=[];errors=[]

def profile(**changes):
    p=json.loads(json.dumps(fresh));p.update(changes);return p

def seed(ctx,uid,p):
    r=ctx.request.post(BASE+'/_qa/profile',data={'id':uid,'profile':p});assert r.ok,r.text()

def setup(browser,w,h,uid,p,dsf=1):
    ctx=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=dsf,has_touch=w<1200)
    page=ctx.new_page();page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto(BASE,wait_until='networkidle');page.locator('#login-id').fill(uid);page.locator('#login-pw').fill('qa_local_1234')
    page.locator('#btn-register').click();page.locator('#btn-title-start').wait_for(state='visible');seed(ctx,uid,p)
    enter_lobby(page);page.locator('#guardian-lobby .sg-nav').wait_for();page.wait_for_timeout(500)
    return ctx,page

def enter_lobby(page):
    # The title button pulses continuously; wait for readiness, then issue a real pointer click without a stability wait.
    page.locator('#btn-title-start').wait_for(state='visible')
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
    page.locator('#btn-title-start').click(force=True)

def screen(page,name):
    page.screenshot(path=str(OUT/f'{name}.png'),full_page=True)

def close_dialog(page):
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");page.wait_for_timeout(100)

with sync_playwright() as pw:
    executable=os.environ.get('CHROME_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=pw.chromium.launch(headless=True,executable_path=executable,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
    if not args.perf_only:
        for width,height in [(1280,850),(375,812)]:
            uid=f'qa_{width}_{int(time.time())%10000}'
            p=profile(coins=400,gifts=5,stages={'CH01':{'cleared':True,'stars':1}},parts={'PART_F1':{'copies':7,'level':1}},equippedParts=['PART_F1'])
            ctx,page=setup(browser,width,height,uid,p)
            page.locator('dialog[open] [data-first-part="PART_W1"]').wait_for()
            assert page.locator('[data-first-part="PART_F1"]').is_disabled()
            screen(page,f'local-first-part-{width}')
            page.locator('[data-first-part="PART_W1"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('획득')")
            close_dialog(page);page.reload(wait_until='networkidle');enter_lobby(page);page.wait_for_timeout(500)
            assert page.locator('dialog[open] [data-first-part]').count()==0,'first reward repeated'
            screen(page,f'local-lobby-{width}')
            p=profile(coins=400,gifts=5,stages={'CH01':{'cleared':True,'stars':1}},parts={'PART_F1':{'copies':7,'level':1},'PART_W1':{'copies':1,'level':2},'PART_E1':{'copies':1,'level':1}},equippedParts=['PART_F1','PART_W1','PART_E1'],giftCounts={'part':4,'pet':0},milestones={'firstPart':True})
            seed(ctx,uid,p);page.reload(wait_until='networkidle');enter_lobby(page);page.wait_for_timeout(400)
            page.locator('.sg-nav [data-tab="parts"]').click();assert page.locator('#sg-draw-part option[value="PART_F1"]').evaluate('(option)=>option.disabled')
            assert '3개는 총 +6%' not in page.locator('#guardian-lobby').inner_text()
            page.locator('#sg-draw-part').select_option('PART_W1');screen(page,f'local-parts-{width}')
            page.locator('[data-do="draw-part"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('획득')");close_dialog(page)
            state=page.evaluate("async()=>await(await fetch('/api/guardian',{headers:{Authorization:'Bearer '+localStorage.lumen_token}})).json()")
            assert state['profile']['gifts']==4 and state['profile']['giftCounts']['part']==5,state
            page.locator('.sg-nav [data-tab="adventure"]').click();page.locator('#sg-start').click();page.locator('#levelup:not(.hidden)').wait_for();assert page.locator('.sg-my-part').count()>=1
            page.wait_for_function("document.querySelector('#sg-run-tools').childElementCount===0")
            screen(page,f'local-first-cards-{width}');page.locator('#card-row .sg-my-part').first.locator('..').click()
            page.wait_for_timeout(300);page.evaluate('window.__debugGod=true');page.evaluate('window.__debugPilot(20)');close_dialog(page)
            if page.locator('#levelup:not(.hidden)').count():page.locator('#card-row .card').first.click()
            page.locator('#btn-pause').click();page.locator('#btn-quit-lobby').click();page.locator('#btn-continue:enabled').wait_for();screen(page,f'local-result-{width}')
            assert '이번 판에는' in page.locator('#result-table').inner_text() or '발동' in page.locator('#result-table').inner_text()
            layout=page.evaluate("({w:innerWidth,doc:document.documentElement.scrollWidth,dialog:document.querySelector('dialog')?.getBoundingClientRect().width})")
            assert layout['doc']<=width+1,layout
            results.append({'viewport':width,'result':'passed','checks':['first reward once','full part disabled','draw cost/counter','equipped first skill','result usage','no horizontal overflow']});ctx.close()
        # Genuine introductory clear -> continue -> first reward modal (not just a seeded eligible account).
        ctx,page=setup(browser,1280,850,f'qa_new_{int(time.time())%10000}',profile())
        page.locator('#sg-start').click();page.locator('#levelup:not(.hidden)').wait_for();page.evaluate('window.__debugGod=true');page.evaluate('window.__debugPilot(181)')
        page.locator('#btn-continue:enabled').wait_for(timeout=30000);page.locator('#btn-continue').click();page.locator('dialog[open] [data-first-part]').first.wait_for()
        close_dialog(page);page.reload(wait_until='networkidle');enter_lobby(page);page.wait_for_timeout(500)
        assert page.locator('dialog[open] [data-first-part]').count()==0
        results.append({'intro_clear':'passed','guide_after_clear':'once'});ctx.close()
    else:
        # Repeatable headless comparison, not physical-tablet FPS. Baseline and changed source use same adapter.
        p=profile(coins=0,stages={'CH01':{'cleared':True,'stars':1},'CH02':{'cleared':True,'stars':1}},milestones={'firstPart':True},parts={},equippedParts=[])
        ctx,page=setup(browser,1180,820,f'qa_perf_{int(time.time())%10000}',p,2)
        page.add_script_tag(content="window.__qaPerf={calls:{},hud:0}; for(const k of ['drawImage','fillRect','createRadialGradient','fillText','strokeText']){const orig=CanvasRenderingContext2D.prototype[k];CanvasRenderingContext2D.prototype[k]=function(...args){window.__qaPerf.calls[k]=(window.__qaPerf.calls[k]||0)+1;return orig.apply(this,args);};} new MutationObserver(records=>window.__qaPerf.hud+=records.length).observe(document.querySelector('#hud'),{subtree:true,childList:true,characterData:true,attributes:true});")
        page.locator('#sg-start').click();page.locator('#levelup:not(.hidden)').wait_for();page.evaluate('window.__debugGod=true');page.evaluate('window.__debugPilot(200)')
        page.evaluate("window.__sgCombatLoad(['EVO_F1','EVO_L1','EVO_V2','EVO_W1']);")
        if page.locator('#levelup:not(.hidden)').count():page.locator('#card-row .card').first.click()
        session=ctx.new_cdp_session(page);session.send('Emulation.setCPUThrottlingRate',{'rate':4})
        page.wait_for_timeout(24000)
        data=page.evaluate("""async()=>{window.__qaPerf.calls={};window.__qaPerf.hud=0;const frames=[];let last=performance.now();const begin=last;await new Promise(resolve=>{function f(t){frames.push(t-last);last=t;if(t-begin<6000)requestAnimationFrame(f);else resolve();}requestAnimationFrame(f);});frames.shift();const sorted=[...frames].sort((a,b)=>a-b),sum=frames.reduce((a,b)=>a+b,0),snap=window.__sgSnapshot();return {fps:1000*frames.length/sum,meanMs:sum/frames.length,p90:sorted[Math.floor(sorted.length*.9)],frames:frames.length,canvasRatio:document.querySelector('#game').width/innerWidth,calls:window.__qaPerf.calls,hudMutations:window.__qaPerf.hud,mode:snap.mode,runTime:snap.runTime,enemies:snap.enemies,skills:Object.keys(snap.skills)};}""")
        session.send('Emulation.setCPUThrottlingRate',{'rate':1});screen(page,f'local-tablet-{args.label}');results.append({'label':args.label,**data});ctx.close()
    browser.close()
(OUT/f'{args.label}-browser-results.json').write_text(json.dumps({'results':results,'pageErrors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'results':results,'pageErrors':errors},ensure_ascii=False))
assert not errors,errors
