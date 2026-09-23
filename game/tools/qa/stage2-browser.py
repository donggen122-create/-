"""2차 개편(파츠 보급) 브라우저 확인: 실제 Worker 처리 코드 + 메모리 DB(node-server.mjs, 루프백 전용).
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
    page.locator('#btn-title-start').click(force=True);page.locator('#guardian-lobby .sg-nav').wait_for();page.wait_for_timeout(500)
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
        seed(page,uid,profile(coins=700,gifts=8,stages={'CH01':{'cleared':True,'stars':1}},milestones={'firstPart':True},parts={'PART_F1':{'copies':1,'level':1}},equippedParts=['PART_F1'],skillUsage={'L2':3}))
        lobby(page)
        # 1) 바뀐 이름 안내가 한 번 뜬다
        assert '파츠 보급이 새로워졌어요' in dialog_text(page);page.screenshot(path=str(OUT/f'notice-{w}.png'));close(page);checks.append('rename notice')
        page.locator('.sg-nav [data-tab="parts"]').click();page.wait_for_timeout(300)
        # 2) 처음 3종 고르기
        assert page.locator('.sg-supply[data-mode="new"]').count()==1;page.screenshot(path=str(OUT/f'parts-new-{w}.png'),full_page=True)
        assert page.locator('#sg-draw-part option').first.get_attribute('value')=='PART_L2','사용한 스킬 파츠가 먼저'
        page.locator('#sg-draw-part').select_option('PART_L2');page.locator('[data-do="draw-part"]').click()
        page.locator('dialog[open] .sg-flip').wait_for();page.wait_for_timeout(500);page.screenshot(path=str(OUT/f'card-flipping-{w}.png'))
        t=card(page);assert '새 파츠' in t and '빈 칸에 끼웠어요' in t,t;page.screenshot(path=str(OUT/f'card-new-{w}.png'));close(page)
        page.locator('#sg-draw-part').select_option('PART_W1');page.locator('[data-do="draw-part"]').click();card(page);close(page);checks.append('new-part picks')
        # 3) 원소 보급(1개)
        assert page.locator('.sg-supply[data-mode="element"]').count()==1
        page.locator('#sg-draw-element').select_option('fire');page.locator('[data-do="draw-part"]').click();t=card(page);assert '×1' in t,t
        page.screenshot(path=str(OUT/f'card-element-{w}.png'));close(page)
        s=state(page)['profile'];assert s['gifts']==5 and s['giftCounts']['part']==3 and s['coins']==700,s;checks.append('element supply one part')
        # 4) 코인 교환(하루 1번)
        page.locator('[data-do="buy-supply"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('보급권 1장')");close(page)
        assert page.locator('[data-do="buy-supply"]').is_disabled() and '오늘 교환 완료' in page.locator('[data-do="buy-supply"]').inner_text()
        s=state(page)['profile'];assert s['coins']==400 and s['gifts']==6,s;checks.append('coin exchange once')
        page.screenshot(path=str(OUT/f'parts-element-{w}.png'),full_page=True)
        # 5) 다른 기기에서 차례가 바뀐 경우: 서버 기록만 바꾸고 옛 화면에서 누르면 거절되고 새 차례로 바뀐다
        p1=profile(coins=400,gifts=6,stages={'CH01':{'cleared':True,'stars':1}},milestones={'firstPart':True},giftCounts={'part':4,'pet':0},parts={'PART_F1':{'copies':5,'level':1},'PART_W1':{'copies':1,'level':3},'PART_L2':{'copies':1,'level':1},'PART_V1':{'copies':1,'level':1}},equippedParts=['PART_F1','PART_L2','PART_W1'])
        seed(page,uid,p1);page.locator('#sg-draw-element').select_option('water');page.locator('[data-do="draw-part"]').click()
        page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('보급 차례가 바뀌었어요')");close(page)
        assert page.locator('.sg-supply[data-mode="pick"]').count()==1;assert state(page)['profile']['gifts']==6;checks.append('stale turn refused, no ticket used')
        # 6) 5번째: 고른 파츠 3개 → 5+3=8 금
        assert page.locator('#sg-draw-part option[value="PART_F1"]').count()==1
        page.screenshot(path=str(OUT/f'parts-pick-{w}.png'),full_page=True)
        page.locator('#sg-draw-part').select_option('PART_F1');page.locator('[data-do="draw-part"]').click();t=card(page)
        assert '×3' in t and '금 메달 달성' in t,t;assert page.locator('dialog[open] .sg-celebrate').count()==1;page.screenshot(path=str(OUT/f'card-gold-{w}.png'))
        page.locator('dialog[open] [data-do="flip-skip"]').click();close(page);checks.append('fifth gives three, gold celebration')
        s=state(page)['profile'];assert s['parts']['PART_F1']['copies']==8 and s['coins']==400,s
        # 7) 건너뛰기 기억 + 금 파츠는 원소 보급 목록에서 확정 표시
        page.locator('#sg-draw-element').select_option('fire');page.locator('[data-do="draw-part"]').click()
        page.locator('dialog[open] .sg-flip.sg-flip-skip').wait_for();t=dialog_text(page);assert '로켓 유도 날개' in t,t;close(page);checks.append('skip remembered, gold excluded')
        # 8) 칸이 가득 찼을 때 바꿔 끼우기(레벨 유지)
        page.locator('.sg-part-card:has-text("부메랑 회수 날개") [data-action="swap-part"]').click();page.locator('dialog[open] .sg-swap-list').wait_for()
        page.screenshot(path=str(OUT/f'swap-{w}.png'));page.locator('dialog[open] [data-swap="PART_W1"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('대신')");close(page)
        s=state(page)['profile'];assert 'PART_V1' in s['equippedParts'] and 'PART_W1' not in s['equippedParts'] and s['parts']['PART_W1']['level']==3,s;checks.append('swap keeps level')
        # 9) 자세히: 지금 → 다음 효과
        page.locator('[data-detail="PART_F1"]').click();t=dialog_text(page);assert '이 스킬 피해 112 → 115' in t and '금 메달 완성' in t,t;page.screenshot(path=str(OUT/f'detail-{w}.png'));close(page)
        page.locator('[data-do="supply-help"]').click();assert '누구나 10번 안에' in dialog_text(page);close(page);checks.append('details current/next')
        assert '3개는 총 +6%' not in page.locator('#guardian-lobby').inner_text() and '특급' not in page.locator('#guardian-lobby').inner_text()
        # 10) 친구: 못 만난 친구 먼저
        page.locator('.sg-nav [data-tab="friends"]').click();page.wait_for_timeout(300);assert '아직 못 만난 친구 6마리' in page.locator('#guardian-lobby').inner_text()
        page.locator('[data-do="pet-gift"]').click();page.wait_for_function("document.querySelector('dialog[open]')?.textContent.includes('친구가 되었어요')");close(page)
        page.screenshot(path=str(OUT/f'friends-{w}.png'),full_page=True);checks.append('unmet friend first')
        layout=page.evaluate("({w:innerWidth,doc:document.documentElement.scrollWidth})");assert layout['doc']<=w+1,layout
        results.append({'viewport':w,'passed':checks});ctx.close()
    b.close()
(OUT/'stage2-browser-results.json').write_text(json.dumps({'results':results,'pageErrors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'results':results,'pageErrors':errors},ensure_ascii=False))
assert not errors,errors
