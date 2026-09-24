"""파츠 보급(무작위·5등급, docs/27) 브라우저 확인: 실제 Worker 처리 코드 + 메모리 DB(node-server.mjs, 루프백 전용).
실서버 계정을 만들지 않는다. 스크린샷은 --out(기본 game/tools/qa/out/stage2, git 제외).
사용: node game/tools/qa/node-server.mjs 를 켠 뒤  python game/tools/qa/stage2-browser.py
"""
import argparse,json,os,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://localhost:8797');ap.add_argument('--out',default=str(ROOT/'game/tools/qa/out/stage2'));args=ap.parse_args()
OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
BASE=args.url.rstrip('/');assert BASE.startswith(('http://localhost:','http://127.0.0.1:')),'QA mutations are loopback only'
fresh=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"],cwd=ROOT))
def profile(**c):
    p=json.loads(json.dumps(fresh));p.update(c);return p
errors=[];results=[]
def seed(page,uid,p):
    r=page.request.post(BASE+'/_qa/profile',data={'id':uid,'profile':p});assert r.ok,r.text()
def dialog_text(page):return page.locator('dialog[open]').inner_text()
def close(page):
    page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())");page.wait_for_timeout(150)
def lobby(page):
    page.locator('#btn-title-start').wait_for(state='visible');page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
    page.locator('#btn-title-start').click(force=True);page.wait_for_timeout(400)
    # 헤드리스에서 시작 화면 요소가 버튼 위를 덮어 좌표 클릭이 빗나갈 때가 있어, 시작 화면이 안 닫혔으면 버튼을 직접 누른다
    if not page.evaluate("document.getElementById('title').classList.contains('hidden')"):page.evaluate("document.getElementById('btn-title-start').click()")
    page.wait_for_function("document.getElementById('title').classList.contains('hidden')");page.locator('#guardian-lobby .sg-nav').wait_for();page.wait_for_timeout(500)
def card(page):
    page.locator('dialog[open] .sg-flip').wait_for();page.wait_for_timeout(1400);return dialog_text(page)
def state(page):return page.evaluate("async()=>await(await fetch('/api/guardian',{headers:{Authorization:'Bearer '+localStorage.lumen_token}})).json()")

with sync_playwright() as pw:
    exe=os.environ.get('CHROME_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    b=pw.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    for w,h in [(1280,850),(375,812)]:
        uid=f'qa{w}s{int(time.time())%10000}';checks=[]
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=w<1200);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE,wait_until='networkidle');page.locator('#login-id').fill(uid);page.locator('#login-pw').fill('qa_local_1234');page.locator('#btn-register').click()
        page.locator('#btn-title-start').wait_for(state='visible')
        seed(page,uid,profile(coins=700,gifts=8,stages={'CH01':{'cleared':True,'stars':1}},milestones={'firstPart':True},parts={'PART_F1':{'copies':1,'level':1}},equippedParts=['PART_F1'],skillUsage={'L2':3},training={'attack':100,'hp':100,'speed':50}))   # 어려움 재조정(docs/28) 뒤 1-1 어려움 성공 확인용 훈련
        lobby(page)
        # 1) 새 규칙 안내가 한 번 뜬다
        assert '파츠 보급이 바뀌었어요' in dialog_text(page) and '전설(80개)' in dialog_text(page);page.screenshot(path=str(OUT/f'notice-{w}.png'));close(page);checks.append('rules notice')
        page.locator('.sg-nav [data-tab="parts"]').click();page.wait_for_timeout(300)
        # 2) 고르는 칸 없이 무작위 보급, 등급 사다리 표시
        assert page.locator('.sg-supply[data-mode="random"]').count()==1 and page.locator('#sg-draw-part, #sg-draw-element').count()==0
        ladder=page.locator('.sg-grade-ladder').inner_text();assert all(x in ladder for x in ['노말','레어','유니크','에픽','전설','80개']),ladder
        page.screenshot(path=str(OUT/f'parts-random-{w}.png'),full_page=True)
        before=state(page)['profile']
        page.locator('[data-do="draw-part"]').click();page.locator('dialog[open] .sg-flip').wait_for();page.wait_for_timeout(500);page.screenshot(path=str(OUT/f'card-flipping-{w}.png'))
        t=card(page);assert '×' in t,t;page.screenshot(path=str(OUT/f'card-{w}.png'));close(page)
        after=state(page)['profile'];got=sum(v['copies'] for v in after['parts'].values())-sum(v['copies'] for v in before['parts'].values())
        assert after['gifts']==before['gifts']-1 and got in (1,3,7) and after['giftCounts']['part']==1,(after['gifts'],got);checks.append('random draw 1/3/7')
        for i in range(3):page.locator('[data-do="draw-part"]').click();card(page);close(page)
        assert state(page)['profile']['gifts']==before['gifts']-4;checks.append('repeat draws')
        # 3) 코인 교환(하루 1번)
        page.locator('[data-do="buy-supply"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('보급권 1장')");close(page)
        assert page.locator('[data-do="buy-supply"]').is_disabled() and '오늘 교환 완료' in page.locator('[data-do="buy-supply"]').inner_text()
        s=state(page)['profile'];assert s['coins']==400 and s['gifts']==before['gifts']-3,s;checks.append('coin exchange once')
        # 4) 옛 화면(원소 고르기·5번째 선택)이 보내는 요청은 거절되고 보급권 그대로
        r=page.evaluate("async()=>{const x=await fetch('/api/guardian/action',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.lumen_token},body:JSON.stringify({clientVersion:2,requestId:'qa_old_screen_'+Date.now(),kind:'draw-part',element:'fire'})});return {status:x.status,...await x.json()};}")
        assert r['status']==409 and r['code']=='DRAW_MODE' and '새로고침' in r['error'],r;assert state(page)['profile']['gifts']==s['gifts'];checks.append('old screen refused, no ticket used')
        # 5) 등급 5단계 표시(보관함·자세히)
        p1=profile(coins=400,gifts=6,stages={'CH01':{'cleared':True,'stars':1}},milestones={'firstPart':True},parts={'PART_F1':{'copies':80,'level':1},'PART_F2':{'copies':25,'level':1},'PART_W1':{'copies':7,'level':3},'PART_L2':{'copies':3,'level':1},'PART_V1':{'copies':1,'level':1}},equippedParts=['PART_F1','PART_L2','PART_W1'])
        seed(page,uid,p1);page.reload(wait_until='networkidle');lobby(page);close(page);page.locator('.sg-nav [data-tab="parts"]').click();page.wait_for_timeout(300)
        cards=page.locator('.sg-parts-grid').inner_text();assert all(x in cards for x in ['전설','에픽','유니크','레어','노말','최고 등급','유니크 기능','전설 능력','에픽 강화']),cards
        page.locator('.sg-parts-grid').screenshot(path=str(OUT/f'grades-{w}.png'));checks.append('five grades shown')
        # 8) 칸이 가득 찼을 때 바꿔 끼우기(레벨 유지)
        page.locator('.sg-part-card:has-text("부메랑 회수 날개") [data-action="swap-part"]').click();page.locator('dialog[open] .sg-swap-list').wait_for()
        page.screenshot(path=str(OUT/f'swap-{w}.png'));page.locator('dialog[open] [data-swap="PART_W1"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('대신')");close(page)
        s=state(page)['profile'];assert 'PART_V1' in s['equippedParts'] and 'PART_W1' not in s['equippedParts'] and s['parts']['PART_W1']['level']==3,s;checks.append('swap keeps level')
        # 9) 자세히: 지금 → 다음 효과
        page.locator('[data-detail="PART_F1"]').click();t=dialog_text(page);assert '이 스킬 피해 180 → 183' in t and '최고 등급(전설)' in t and '한 번 더 발동' in t,t;page.screenshot(path=str(OUT/f'detail-{w}.png'));close(page)
        page.locator('[data-detail="PART_F2"]').click();t=dialog_text(page);assert '80개가 되면 전설' in t and '피해 +80%' in t,t;page.screenshot(path=str(OUT/f'detail-epic-{w}.png'));close(page)
        page.locator('[data-do="supply-help"]').click();t=dialog_text(page);assert '1개 80%' in t and '7개 2%' in t and '고를 수는 없어요' in t,t;close(page);checks.append('details current/next')
        txt=page.locator('#guardian-lobby').inner_text();assert all(x not in txt for x in ['3개는 총 +6%','특급','금 메달','5번째'])
        # 10) 친구: 못 만난 친구 먼저
        page.locator('.sg-nav [data-tab="friends"]').click();page.wait_for_timeout(300);assert '아직 못 만난 친구 6마리' in page.locator('#guardian-lobby').inner_text()
        page.locator('[data-do="pet-gift"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('친구가 되었어요')");close(page)
        page.screenshot(path=str(OUT/f'friends-{w}.png'),full_page=True);checks.append('unmet friend first')
        # 11) 성공 보급권: 어려움 2장, 같은 단계는 하루 2번 성공까지
        day=state(page)['passes']['day']
        seed(page,uid,profile(coins=0,gifts=0,difficulty='hard',stages={'CH01':{'cleared':True,'stars':1},'CH02':{'cleared':True,'stars':1}},milestones={'firstPart':True},stageGifts={'day':day,'counts':{'CH01':1}}))
        page.reload(wait_until='networkidle');lobby(page);close(page)
        assert '오늘 보급권 1번 남음' in page.locator('[data-stage="CH01"]').inner_text()
        page.screenshot(path=str(OUT/f'stage-gift-{w}.png'),full_page=True)
        def clear_ch01():
            page.locator('[data-stage="CH01"]').click();page.locator('#sg-start').click();page.locator('#levelup:not(.hidden)').wait_for()
            page.evaluate('window.__pilotGod=true');page.evaluate('window.__debugPilot(301)');page.locator('#btn-continue:enabled').wait_for(timeout=30000)
            t=page.locator('#result-table').inner_text();page.screenshot(path=str(OUT/f'stage-gift-result-{w}.png'));page.locator('#btn-continue').click();page.wait_for_timeout(400);close(page);return t
        t=clear_ch01();assert '+2' in t and '여기까지' in t,t
        assert '오늘 보급권 끝' in page.locator('[data-stage="CH01"]').inner_text()
        t=clear_ch01();assert '+0' in t and '2번 다 받았어요' in t,t
        s=state(page)['profile'];assert s['gifts']==2,s['gifts'];checks.append('hard 2 tickets, 2 clears per stage per day')
        layout=page.evaluate("({w:innerWidth,doc:document.documentElement.scrollWidth})");assert layout['doc']<=w+1,layout
        results.append({'viewport':w,'passed':checks});ctx.close()
    b.close()
(OUT/'stage2-browser-results.json').write_text(json.dumps({'results':results,'pageErrors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'results':results,'pageErrors':errors},ensure_ascii=False))
assert not errors,errors
