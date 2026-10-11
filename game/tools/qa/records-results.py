"""Loopback-only end-to-end A diagnostics, UI 1/2, QA account and synthetic admin fixtures."""
import argparse,copy,json,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from PIL import Image
from browser import local_url,chrome_path
ROOT=Path(__file__).resolve().parents[3]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://localhost:8797');ap.add_argument('--admin-only',action='store_true');ap.add_argument('--prefix',default='A');args=ap.parse_args();BASE=local_url(args.url)
OUT=ROOT/'docs/codex/preview';OUT.mkdir(parents=True,exist_ok=True)
LOG=ROOT/f'game/tools/qa/out/{args.prefix}-e2e.json'
fresh=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"],cwd=ROOT))
secrets=dict(line.split('=',1) for line in (ROOT/'game/tools/qa/.dev.vars').read_text().splitlines() if '=' in line)
results=[r for r in json.loads(LOG.read_text(encoding='utf-8')) if not r.get('admin')] if args.admin_only and LOG.exists() else []
def shot(locator,name):
 file=OUT/name;locator.screenshot(path=str(file));im=Image.open(file);im.save(file,optimize=True)
 if file.stat().st_size>400000:im.convert('RGB').quantize(colors=128).save(file,optimize=True)
 assert file.stat().st_size<=400000
 return {'file':name,'bytes':file.stat().st_size}
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path=chrome_path())
 before=pw.request.new_context();baseline=before.get(BASE+'/api/admin/stage-stats?days=all',headers={'X-Admin-Key':secrets['ADMIN_KEY']}).json();baseline_attempts=sum(s['attempts'] for s in baseline['stages']);before.dispose()
 for ui in (() if args.admin_only else (2,1)):
  for size in ((1280,800),(375,667)):
   ctx=b.new_context(viewport={'width':size[0],'height':size[1]},has_touch=size[0]<600)
   ctx.route('**/*',lambda r:r.fallback() if urlsplit(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort())
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(f'{BASE}/?ui={ui}',wait_until='networkidle');page.request.post(BASE+'/_qa/reset-attempts')
   page.locator('#login-id').fill('qa');page.locator('#login-pw').fill('qa_local_1234');page.locator('#btn-register').click();page.wait_for_timeout(350)
   if page.locator('#btn-title-start').is_hidden():page.locator('#btn-login').click()
   page.locator('#btn-title-start').wait_for(state='visible')
   for cleared in (False,True):
    profile=copy.deepcopy(fresh);profile.update(hero='hoya',heroLocked=True,difficulty='normal',coins=100,training={'attack':1,'hp':1,'speed':1},milestones={'firstPart':True,'firstPet':True,'bossPet':True,'firstGear':True})
    assert page.request.post(BASE+'/_qa/profile',data={'id':'qa','profile':profile}).ok
    page.reload(wait_until='networkidle');page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
    page.evaluate("document.getElementById('btn-title-start').click()");page.locator('#guardian-lobby .sg-nav').wait_for()
    for _ in range(4):page.wait_for_timeout(150);page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    page.locator('[data-stage="CH01"]').click();page.locator('[data-do="start"]:visible').click();page.locator('#levelup:not(.hidden)').wait_for()
    page.evaluate("window.__pilotGod=true;window.__debugPilot(.5)")
    page.wait_for_timeout(600)  # Real RAF samples before accelerated QA simulation.
    outcome=page.evaluate("window.__pilotGod=true;window.__pilotAvoid=2;window.__debugPilot(305)" if cleared else "window.__debugGod=false;window.__debugSpawn('T1_BAGGY',8,20);window.__debugBench(0,0,true);window.__debugAutoPlay(305)")
    page.locator('#btn-continue:enabled').wait_for(timeout=30000)
    stored=page.request.get(BASE+'/_qa/runs?id=qa').json()[-1];event=json.loads(stored['result'])
    assert event['cleared']==cleared,(outcome,event)
    assert event.get('perf'),event
    assert ('cause' in event)==(not cleared),event
    assert page.locator('#sg-result-cause').count()==(0 if cleared else 1)
    assert page.locator('#sg-result-next').count()==(0 if cleared else 1)
    if not cleared:
     assert '쓰러진 까닭:' in page.locator('#sg-result-cause').inner_text()
     assert '다음 할 일:' in page.locator('#sg-result-next').inner_text()
     for sel in ('#sg-result-cause','#sg-result-next'):
      bounds=page.locator(sel).evaluate('(e)=>({width:e.clientWidth,scroll:e.scrollWidth,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})')
      assert bounds['scroll']<=bounds['width']+1 and bounds['left']>=0 and bounds['right']<=size[0]+1,bounds
    capture=shot(page.locator('#result'),f'{args.prefix}_result_ui{ui}_{size[0]}_{"success" if cleared else "failure"}.png')
    results.append({'ui':ui,'width':size[0],'outcome':outcome,'stored':event,'capture':capture,'errors':list(errors)})
    LOG.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'UI {ui} width {size[0]} cleared={cleared}: PASS',flush=True)
   # QA records must be excluded even when they have valid performance data.
   stats=page.request.get(BASE+'/api/admin/stage-stats?days=all',headers={'X-Admin-Key':secrets['ADMIN_KEY']}).json()
   assert sum(s['attempts'] for s in stats['stages'])==baseline_attempts
   assert not errors,errors
   ctx.close()
 # Real local teacher login; seeded memory-only rows are synthetic, never actual student records.
 ctx=b.new_context(viewport={'width':1280,'height':900});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 assert page.request.post(BASE+'/_qa/stats-fixture').ok
 page.goto(BASE+'/admin/',wait_until='networkidle');page.locator('#aid').fill(secrets['TEACHER_ID']);page.locator('#apw').fill(secrets['TEACHER_PW']);page.locator('#login-form button').click()
 page.wait_for_function("document.querySelectorAll('#stage-stats-body tr').length===20")
 assert '선생님' in page.locator('#role-badge').inner_text()
 assert page.locator('#stage-stats-body tr').count()==20
 captures=[shot(page.locator('#stage-stats-panel'),f'{args.prefix}_admin_stages.png')]
 page.locator('#perf-stage').select_option('CH01');page.wait_for_function("document.querySelector('#device-stats-body tr td:nth-child(3)')?.textContent==='1-1'")
 captures.append(shot(page.locator('#device-stats-panel'),f'{args.prefix}_admin_devices.png'))
 for days in ('7','all','30'):
  page.locator('#stats-days').select_option(days);page.wait_for_function("!document.querySelector('#stage-stats-note').textContent.includes('읽는 중')")
 response=page.request.get(BASE+'/api/admin/stage-stats?days=30',headers={'X-Admin-Key':secrets['ADMIN_KEY']});data=response.json();size=len(response.body())
 assert response.ok and size<=50000 and sum(s['attempts'] for s in data['stages'])==5000
 assert 'user_id' not in response.text() and 'fixture' not in response.text()
 assert not errors,errors
 results.append({'admin':True,'rows':20,'bytes':size,'captures':captures,'errors':errors})
 ctx.close();b.close()
LOG.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(results),'captures':sum(2 if r.get('admin') else 1 for r in results),'statsBytes':size},ensure_ascii=False))
