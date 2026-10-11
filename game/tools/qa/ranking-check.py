"""F loopback-only ranking / nickname / anomaly E2E. No production connections.

12 qa registrations are cloned into memory-only synthetic aliases so TEST_ACCOUNT_RE
exclusion is genuinely exercised, without whitelisting QA accounts in production.
"""
import argparse, copy, json, subprocess, uuid, runpy, sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from PIL import Image
from browser import local_url, chrome_path

ROOT=Path(__file__).resolve().parents[3]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://localhost:8799');ap.add_argument('--pilot-only',action='store_true');ap.add_argument('--layout-reference');args=ap.parse_args()
BASE=local_url(args.url)
if urlsplit(BASE).port!=8799:raise ValueError('F uses port 8799 only')
OUT=ROOT/'docs/codex/preview';OUT.mkdir(parents=True,exist_ok=True)
secrets=dict(line.split('=',1) for line in (ROOT/'game/tools/qa/.dev.vars').read_text().splitlines() if '=' in line)
fresh=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"],cwd=ROOT))
checks=[];captures=[]
def ok(label,condition):
 assert condition,label
 checks.append(label);print('PASS '+label,flush=True)
def shot(page,name,locator=None):
 file=OUT/name
 (locator or page).screenshot(path=str(file))
 im=Image.open(file);im.save(file,optimize=True)
 if file.stat().st_size>400000:im.convert('RGB').quantize(colors=128).save(file,optimize=True)
 ok(name+' <=400KB',file.stat().st_size<=400000)
 captures.append({'file':name,'bytes':file.stat().st_size})

with sync_playwright() as pw:
 request=pw.request.new_context()
 def api(path,body=None,token=None,admin=None,expected=200):
  headers={'Content-Type':'application/json'}
  if token:headers['Authorization']='Bearer '+token
  if admin:headers['X-Admin-Token']=admin
  r=request.post(BASE+path,data=body,headers=headers) if body is not None else request.get(BASE+path,headers=headers)
  assert r.status==expected,(path,r.status,r.text())
  return r.json()
 owner=api('/api/admin/login',{'id':secrets['ADMIN_ID'],'pw':secrets['ADMIN_PW']})['token']
 teacher=api('/api/admin/login',{'id':secrets['TEACHER_ID'],'pw':secrets['TEACHER_PW']})['token']
 request.post(BASE+'/_qa/reset-attempts')
 if args.layout_reference:
  old_argv=sys.argv;sys.argv=['responsive-audit.py','--url',BASE+'/?ui=2','--out',str(ROOT/'game/tools/qa/out/F-layout-reference')]
  audit=runpy.run_path(str(ROOT/'game/tools/qa/responsive-audit.py'));sys.argv=old_argv
  names=subprocess.check_output(['git','ls-tree','-r','--name-only',args.layout_reference,'game/src'],cwd=ROOT,text=True).splitlines()
  sources={name.removeprefix('game/'):subprocess.check_output(['git','show',args.layout_reference+':'+name],cwd=ROOT) for name in names if name.endswith(('.js','.css'))}
  browser=pw.chromium.launch(headless=True,executable_path=chrome_path())
  class ReferenceBrowser:
   def __init__(self,reference):self.reference=reference
   def new_context(self,**kwargs):
    context=browser.new_context(**kwargs)
    context.route('**/*',lambda r:r.fallback() if urlsplit(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort())
    if self.reference:
     for name,body in sources.items():context.route(BASE+'/'+name+'*',lambda r,req,body=body,name=name:r.fulfill(body=body,content_type='text/css' if name.endswith('.css') else 'application/javascript'))
    return context
  comparisons={}
  for label,reference in [('before',True),('after',False)]:
   report={}
   for w,h in [(320,568),(844,390),(1920,1080)]:
    try:audit['audit_size'](ReferenceBrowser(reference),w,h,report)
    except Exception as e:report.setdefault(f'{w}x{h}',{})['_error']=str(e)
    print('layout '+label+' '+str(w)+' done',flush=True)
   comparisons[label]=report
   (ROOT/'docs/codex/F-layout-reference.json').write_text(json.dumps(comparisons,ensure_ascii=False,indent=2),encoding='utf-8')
  browser.close();request.dispose();raise SystemExit(0)
 if args.pilot_only:
  browser=pw.chromium.launch(headless=True,executable_path=chrome_path())
  context=browser.new_context(viewport={'width':1280,'height':720})
  context.route('**/*',lambda r:r.fallback() if urlsplit(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort())
  context.add_init_script('window.requestAnimationFrame=(cb)=>0;')
  page=context.new_page();page.goto(BASE+'/?ui=2',wait_until='networkidle')
  r=request.post(BASE+'/api/register',data={'id':'qafpilot','pw':'qa_local_1234'})
  if r.status==409:r=request.post(BASE+'/api/login',data={'id':'qafpilot','pw':'qa_local_1234'})
  assert r.ok
  page.locator('#login-id').fill('qafpilot');page.locator('#login-pw').fill('qa_local_1234');page.locator('#btn-login').click();page.locator('#btn-title-start').wait_for(state='visible')
  maximum=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile,superTestProfile} from './game/src/rework-core.js';console.log(JSON.stringify(superTestProfile(freshProfile(),{training:100,copies:80,level:10})));"],cwd=ROOT))
  maximum.update(heroLocked=True,milestones={'firstPart':True,'firstPet':True,'bossPet':True,'firstGear':True},difficulty='hard',weaponMode='ranged')
  measurements=[]
  for n in range(1,21):
   for seed in [10808,10809]:
    assert page.request.post(BASE+'/_qa/profile',data={'id':'qafpilot','profile':maximum}).ok
    page.reload(wait_until='networkidle');page.wait_for_function("!document.querySelector('#btn-title-start').disabled");page.evaluate("document.querySelector('#btn-title-start').click()");page.locator('.sg-nav').wait_for()
    for _ in range(4):page.wait_for_timeout(100);page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    page.evaluate("n=>{window.__sgUI.chapterPicked=true;window.__sgUI.chapter=String(Math.ceil(n/5));window.__sgUI.stage='CH'+String(n).padStart(2,'0');window.__sgUI.render();}",n)
    page.evaluate("seed=>{let s=seed;Math.random=()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}",seed)
    page.evaluate("document.querySelector('[data-do=\"start\"]').click()");page.locator('#levelup:not(.hidden)').wait_for()
    page.evaluate('window.__pilotGod=true;window.__pilotAvoid=2;window.__debugPilot(365)')
    outcome=page.evaluate('()=>{const o=window.__debugOutcome();return {seconds:o.seconds,kills:o.kills,litter:o.litter,hp:o.hp,choices:o.choices}}')
    if page.locator('#result').is_hidden():page.evaluate('window.__debugEnd(false)')
    page.locator('#btn-continue:enabled').wait_for()
    stored=page.request.get(BASE+'/_qa/runs?id=qafpilot').json()[-1]
    event=json.loads(stored['result'])
    assert stored['stage']==f'CH{n:02d}',stored
    measurements.append({'stage':f'CH{n:02d}','seed':seed,'outcome':outcome,'eventKills':event.get('kills'),'held':event.get('held',False),'flags':event.get('flags',[])})
    (ROOT/'docs/codex/F-pilot-max.json').write_text(json.dumps(measurements,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'pilot CH{n:02d} seed {seed}: kills={outcome["kills"]} held={event.get("held",False)}',flush=True)
  context.close();browser.close();request.dispose();raise SystemExit(0)
 qa=[];aliases=[];tokens=[]
 profile=copy.deepcopy(fresh);profile.update(heroLocked=True,runs=2,hero='hoya',milestones={'firstPart':True,'firstPet':True,'bossPet':True,'firstGear':True},stages={f'CH{i:02d}':{'cleared':True,'stars':1} for i in range(1,21)})
 api('/api/admin/ranking-settings',{'stage':'CH03','goal':300},admin=teacher)
 for i in range(12):
  qa_id=f'qafrank{i:02d}'
  r=request.post(BASE+'/api/register',data={'id':qa_id,'pw':'qa_local_1234'})
  if r.status==409:r=request.post(BASE+'/api/login',data={'id':qa_id,'pw':'qa_local_1234'})
  assert r.ok;r=r.json();qa.append(r['token'])
  assert request.post(BASE+'/_qa/profile',data={'id':qa_id,'profile':profile}).ok
  result={'cleared':True,'kills':120-i,'litter':5}
  runs=[{'stage':'CH03','status':'won','result':result}, {'stage':'CH05','status':'won','result':{'cleared':True,'kills':50,'litter':5}}]
  if i==0:runs.extend([{'stage':'CH03','status':'won','result':{'cleared':True,'kills':90000,'litter':5,'held':True}}, {'stage':'CH03','status':'won','result':{'cleared':True,'kills':80000,'flags':[{'code':'kills','value':80000,'limit':1000}]}}])
  fixture=request.post(BASE+'/_qa/runs',data={'qaId':qa_id,'index':i,'runs':runs},headers={'X-Admin-Key':secrets['ADMIN_KEY']})
  assert fixture.ok,(fixture.status,fixture.text())
  alias=fixture.json()['syntheticId'];aliases.append(alias)
  tokens.append(api('/api/login',{'id':alias,'pw':'qa_local_1234'})['token'])
 ranking=api('/api/ranking',token=tokens[-1])
 ok('top 10 only and own rank 12',len(ranking['top'])==10 and ranking['me']['rank']==12)
 ok('held/impossible records excluded',ranking['top'][0]['kills']==120)
 ok('student payload has no IDs',not any(a in json.dumps(ranking,ensure_ascii=False) for a in aliases))
 ok('all four halls and anonymous count',len(ranking['hall'])==4 and ranking['hall'][0]['others']==12)
 ok('cooperation success count goal',ranking['cooperation']=={'successes':24,'goal':300})
 # QA score must stay out of the ranking even after a real settlement.
 start=api('/api/play/start',{'requestId':str(uuid.uuid4()),'stage':'CH03','clientVersion':2},token=qa[0])
 api('/api/play/finish',{'requestId':str(uuid.uuid4()),'runId':start['runId'],'cleared':True,'seconds':300,'litter':5,'hpFraction':1,'kills':1000},token=qa[0])
 ok('test-account excluded',api('/api/ranking',token=tokens[-1])['top'][0]['kills']==120)
 api('/api/nickname',{'nickname':'바람지기'},token=tokens[0])
 pending=next(u for u in api('/api/admin/nicknames',admin=teacher)['users'] if u['id']==aliases[0])
 ok('nickname pending remains anonymous',api('/api/ranking',token=tokens[0])['member']['status']=='pending')
 decide={'id':pending['id'],'nickname':pending['nickname'],'setAt':pending['nickname_set_at'],'status':'approved'}
 api('/api/admin/nicknames/decide',decide,admin=teacher)
 d=api('/api/ranking',token=tokens[0]);ok('approved name shown immediately',d['top'][0]['name']=='바람지기' and d['hall'][0]['names']==['바람지기'])
 api('/api/nickname',{'nickname':'햇살지기'},token=tokens[1])
 pending=next(u for u in api('/api/admin/nicknames',admin=teacher)['users'] if u['id']==aliases[1])
 api('/api/admin/nicknames/decide',{'id':pending['id'],'nickname':pending['nickname'],'setAt':pending['nickname_set_at'],'status':'rejected','note':'다른 별명을 골라 주세요'},admin=teacher)
 ok('rejected reason and anonymous display',api('/api/ranking',token=tokens[1])['member']['status']=='rejected')
 api('/api/title',{'title':'village'},token=tokens[0]);ok('earned cosmetic title displayed',api('/api/ranking',token=tokens[0])['top'][0]['title']=='쓰레기 마을 수호대')
 api('/api/title',{'title':'forest'},token=tokens[0],expected=400)
 # Normal flags retain rewards; only impossible values hold currency.
 for litter,held in [(7,False),(13,True)]:
  start=api('/api/play/start',{'requestId':str(uuid.uuid4()),'stage':'CH01','clientVersion':2},token=qa[0])
  event=api('/api/play/finish',{'requestId':str(uuid.uuid4()),'runId':start['runId'],'cleared':True,'seconds':300,'litter':litter,'hpFraction':1,'kills':1},token=qa[0])
  ok('anomaly '+str(litter)+' held='+str(held),bool(event.get('held'))==held and bool(event['flags']) and (event['reward']['coins']==0 if held else event['reward']['coins']>0))
  if held:held_id=start['runId'];held_event=event
 api('/api/admin/anomalies/release',{'runId':held_id,'decision':'release'},admin=teacher,expected=403)
 api('/api/admin/anomalies/release',{'runId':held_id,'decision':'keep'},admin=teacher,expected=403)
 before=api('/api/guardian',token=qa[0])['profile']
 api('/api/admin/anomalies/release',{'runId':held_id,'decision':'release'},admin=owner)
 again=api('/api/admin/anomalies/release',{'runId':held_id,'decision':'release'},admin=owner)
 after=api('/api/guardian',token=qa[0])['profile']
 ok('release exactly once',again['already'] and after['coins']==before['coins']+held_event['heldAmounts']['coins'] and after['gifts']==before['gifts']+held_event['heldAmounts']['gifts'])
 # Keep one pending nickname and one held run for administrator captures.
 api('/api/nickname',{'nickname':'새싹지기'},token=tokens[2])
 start=api('/api/play/start',{'requestId':str(uuid.uuid4()),'stage':'CH01','clientVersion':2},token=qa[0])
 api('/api/play/finish',{'requestId':str(uuid.uuid4()),'runId':start['runId'],'cleared':True,'seconds':300,'litter':13,'hpFraction':1,'kills':1},token=qa[0])
 browser=pw.chromium.launch(headless=True,executable_path=chrome_path())
 for ui,width,height,name in [(2,1280,720,'F_rank_1280x720.png'),(2,375,667,'F_rank_375x667.png'),(1,1280,720,'F_rank_ui1_1280x720.png')]:
  context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<600)
  context.route('**/*',lambda r:r.fallback() if urlsplit(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort())
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+f'/?ui={ui}',wait_until='networkidle')
  page.locator('#login-id').fill(aliases[-1]);page.locator('#login-pw').fill('qa_local_1234');page.locator('#btn-login').click()
  page.locator('#btn-title-start').wait_for(state='visible');page.wait_for_function("!document.querySelector('#btn-title-start').disabled");page.locator('#btn-title-start').click();page.locator('.sg-nav').wait_for()
  for _ in range(5):page.wait_for_timeout(150);page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
  page.locator('[data-do="ranking"]').click();page.locator('#sg-rank-panel .sg-rank-me').wait_for()
  ok(f'UI {ui} {width} own rank shown','12등' in page.locator('.sg-rank-me').inner_text())
  shot(page,name)
  for tab in ['hall','profile','goal']:
   page.locator('[data-rank-tab="'+tab+'"]').click()
   ok(f'UI {ui} {width} {tab} fits',page.evaluate("()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('dialog[open]').getBoundingClientRect().right<=innerWidth"))
  page.locator('[data-rank-tab="profile"]').click();page.locator('#sg-rank-nickname').fill('숲속지기');page.locator('#sg-rank-nickname-form button').click();page.wait_for_function("document.querySelector('.sg-rank-message').textContent.includes('저장')")
  ok(f'UI {ui} {width} nickname form','승인 기다리는 중' in page.locator('#sg-rank-panel').inner_text())
  ok(f'UI {ui} {width} private names',not any(a in page.locator('body').inner_text() for a in aliases))
  ok(f'UI {ui} {width} no script errors',not errors)
  if ui==1:
   page.locator('dialog[open] [data-close]').first.click()
   page.evaluate("()=>{window.__sgUI.chapterPicked=true;window.__sgUI.chapter='1';window.__sgUI.stage='CH01';window.__sgUI.render();}")
   def hold_input(route):
    b=route.request.post_data_json;b['litter']=1000;route.continue_(post_data=json.dumps(b))
   page.route('**/api/play/finish',hold_input)
   page.locator('[data-do="start"]:visible').click();page.locator('#levelup:not(.hidden)').wait_for();page.evaluate('window.__debugEnd(false)');page.locator('#btn-continue:enabled').wait_for()
   page.locator('#sg-rank-held').wait_for();ok('student neutral held notice',page.locator('#sg-rank-held').inner_text()=='기록 확인 중')
  context.close()
 context=browser.new_context(viewport={'width':1280,'height':720});page=context.new_page()
 context.route('**/*',lambda r:r.fallback() if urlsplit(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort())
 page.goto(BASE+'/admin/',wait_until='networkidle');page.locator('#aid').fill(secrets['ADMIN_ID']);page.locator('#apw').fill(secrets['ADMIN_PW']);page.locator('#login-form button').click();page.locator('#nicknames-body [data-nick]').first.wait_for()
 shot(page,'F_admin_nicknames.png',page.locator('#nicknames-panel'))
 page.locator('#anomalies-body [data-decision="release"]').first.wait_for();shot(page,'F_admin_anomalies.png',page.locator('#anomalies-panel'))
 # Exercise the actual review buttons as well as the API.
 page.locator('#nicknames-body [data-status="approved"]').first.click();page.wait_for_timeout(400)
 pending_count=page.locator('#nicknames-body [data-status="rejected"]').count()
 if pending_count:
  page.locator('#nicknames-body input').first.fill('다른 별명을 골라 주세요');page.locator('#nicknames-body [data-status="rejected"]').first.click();page.wait_for_timeout(400)
 release=page.locator('#anomalies-body [data-decision="release"]');count=release.count();release.first.click();page.wait_for_function('(n)=>document.querySelectorAll("#anomalies-body [data-decision=release]").length<n',arg=count)
 ok('admin release button',page.locator('#anomalies-body [data-decision="release"]').count()<count)
 # Real maximum runs: use original deterministic pilot on every stage, 2 seeds.
 # This is opt-in separately through --mode replay in tablet-perf; read its outcomes.
 replay=ROOT/'game/tools/qa/out/tablet/F-replay-replay.json'
 measured={}
 if replay.exists():
  for r in json.loads(replay.read_text(encoding='utf-8')):
   stage=r['stage'];measured[stage]=max(measured.get(stage,0),r['after']['outcome']['kills'])
 report={'checks':checks,'captures':captures,'maxKills':measured,'qaRegistrations':12,'syntheticAliases':12}
 (ROOT/'docs/codex/F-ranking-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'passed':len(checks),'captures':len(captures)},ensure_ascii=False),flush=True)
 context.close();browser.close();request.dispose()
