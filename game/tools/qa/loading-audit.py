"""Cold/warm local loading and first-screen screenshots; CDP wire bytes, no production."""
import argparse, json, time, subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from browser import chrome_path, local_url
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8797/?ui=2')
ap.add_argument('--label', required=True)
ap.add_argument('--shots', action='store_true')
args = ap.parse_args()
BASE = local_url(args.url)
OUT = ROOT / 'docs/codex/measurements/B'
OUT.mkdir(parents=True, exist_ok=True)
PREVIEW = ROOT / 'docs/codex/preview'
PREVIEW.mkdir(parents=True, exist_ok=True)
fresh = json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))
fresh.update(hero='hoya', heroLocked=True, milestones={'firstPart':True,'firstGear':True,'firstPet':True}, stages={})

def close_notices(page):
    for _ in range(4):
        page.wait_for_timeout(150)
        page.evaluate("document.querySelectorAll('dialog[open] [data-close]').forEach(b=>b.click())")

def shot(page, size):
    dest = PREVIEW / f'B_lobby_{size}_{args.label}.png'
    page.screenshot(path=str(dest))
    with Image.open(dest) as im:
        im.quantize(colors=128).save(dest, optimize=True)
    assert dest.stat().st_size <= 400*1024

def run(browser, name, w, h, rate):
    ctx=browser.new_context(viewport={'width':w,'height':h}, has_touch=name!='pc', device_scale_factor=1)
    page=ctx.new_page(); cdp=ctx.new_cdp_session(page)
    cdp.send('Network.enable'); cdp.send('Emulation.setCPUThrottlingRate',{'rate':rate})
    # Block off-host traffic without Playwright routing (routing disables HTTP cache).
    cdp.send('Network.setBlockedURLs',{'urls':['https://*']})
    records={}; errors=[]; requests={}; responses={}; events=[]; wire={}; started=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def request(e):
        requests[e['requestId']]=e['request']['url']; started.append(e['requestId'])
    cdp.on('Network.requestWillBeSent',request)
    cdp.on('Network.responseReceived',lambda e:responses.update({e['requestId']:e['response']}))
    cdp.on('Network.dataReceived',lambda e:wire.update({e['requestId']:wire.get(e['requestId'],0)+e['encodedDataLength']}))
    def finished(e):
        wire[e['requestId']]=int(e['encodedDataLength']); events.append({**e,'url':requests.get(e['requestId'],''),'status':responses.get(e['requestId'],{}).get('status')})
    cdp.on('Network.loadingFinished',finished)
    def measure(kind, action):
        begin=len(started); old=wire.copy(); t=time.perf_counter(); action(); page.wait_for_load_state('networkidle'); page.wait_for_timeout(300)
        groups={}
        new=started[begin:]
        for rid in set(new)|{rid for rid,n in wire.items() if n>old.get(rid,0)}:
            path=urlsplit(requests.get(rid,'')).path.strip('/'); group='/'.join(path.split('/')[:2]) if path.startswith('assets/') else ('src' if path.startswith('src/') else 'other')
            g=groups.setdefault(group,{'requests':0,'bytes':0}); g['requests']+=new.count(rid); g['bytes']+=max(0,wire.get(rid,0)-old.get(rid,0))
        records[kind]={'ms':round((time.perf_counter()-t)*1000,1),'requests':sum(g['requests'] for g in groups.values()),'bytes':sum(g['bytes'] for g in groups.values()),'groups':groups}
    measure('title',lambda:page.goto(args.url,wait_until='networkidle'))
    def login():
        page.request.post(BASE+'/_qa/reset-attempts')
        page.locator('#login-id').fill('qa'); page.locator('#login-pw').fill('qa_local_1234'); page.locator('#btn-register').click()
        page.wait_for_timeout(300)
        if page.locator('#btn-title-start').is_hidden(): page.locator('#btn-login').click()
        page.locator('#btn-title-start').wait_for(state='visible')
        assert page.request.post(BASE+'/_qa/profile',data={'id':'qa','profile':fresh}).ok
        page.evaluate("import('./src/main.js').then(()=>{})")
        # Refresh profile through the UI callback without page reload/cache pollution.
        page.evaluate('window.__sgUI.c.refresh()')
        page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
        page.locator('#btn-title-start').click(); page.locator('#guardian-lobby .sg-nav').wait_for(); close_notices(page)
    measure('lobby',login)
    if args.shots: shot(page,f'{w}x{h}')
    def depart():
        page.locator('#sg-start').click(); page.locator('#levelup:not(.hidden)').wait_for()
        page.locator('#card-row button').first.click()
        page.wait_for_function("window.__sgSnapshot().mode==='playing'")
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    if not name.startswith('shot'):
        measure('battle',depart)
        measure('reload',lambda:page.reload(wait_until='networkidle'))
    records['errors']=errors
    records['failures']=[e for e in events if e.get('status',200)>=400 and '/api/register' not in e['url']]
    ctx.close(); print(name,json.dumps(records,ensure_ascii=False),flush=True); return records

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,executable_path=chrome_path(),args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    result={name:run(b,name,w,h,rate) for name,w,h,rate in [('pc',1280,720,1),('phone',375,667,1),('ipad',1024,768,4)]}
    if args.shots:
        for w,h in [(1280,800),(820,1180),(768,1024),(360,640)]: run(b,f'shot{w}',w,h,1)
    b.close()
(OUT/f'loading-{args.label}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
