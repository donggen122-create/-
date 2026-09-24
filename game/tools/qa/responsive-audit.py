# 기기 화면 크기별 UI 점검(2026-09-24 사용자 "기기에 따라 UI가 가려지거나 글자가 밀린다"): 슈퍼 시험 프로필로
# 시작 화면 · 로비 5탭 · 보급 규칙 창 · 첫 카드 고르기 · 전투(대왕 예고) · 멈춤 · 결과를 여러 크기에서 열고 자동으로 찾는다.
#  - 가로 넘침: 화면 밖으로 나간 요소, 페이지 가로 스크롤
#  - 글자 잘림: 칸보다 긴 글자(넘침 숨김·한 줄 고정)
#  - 전투 표시 겹침: 체력·경험치·시간·버튼·기술 칸·예고 글·목표 글이 서로 겹침
#  - 세로 넘침: 카드·결과·창이 화면보다 커서 아래가 잘림(스크롤도 없음)
# 사용: python game/tools/qa/responsive-audit.py [--url http://localhost:8797] [--out 폴더] [--sizes 375x667,1280x720]
import argparse, json, os, random, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8797')
ap.add_argument('--out', default=str(ROOT / 'game/tools/qa/out/responsive'))
ap.add_argument('--sizes', default='320x568,360x640,375x667,390x844,412x915,667x375,844x390,768x1024,1024x768,820x1180,1180x820,1280x720,1366x768,1920x1080')
ap.add_argument('--shots', default='adventure,levelup,battle,result')
args = ap.parse_args()
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
EXE = os.environ.get('CHROME_PATH') or ('/opt/pw-browsers/chromium-1194/chrome-linux/chrome' if Path('/opt/pw-browsers/chromium-1194/chrome-linux/chrome').exists() else None)
fresh = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))

def super_profile():
    import copy
    p = copy.deepcopy(fresh)
    parts = ['PART_F1', 'PART_F2', 'PART_W1', 'PART_W2', 'PART_E1', 'PART_E2', 'PART_V1', 'PART_V2', 'PART_L1', 'PART_L2']
    p.update(difficulty='normal', weaponMode='ranged', coins=999999, gifts=99, training={'attack': 60, 'hp': 60, 'speed': 40},
             milestones={'firstPart': True, 'firstPet': True, 'bossPet': True}, pets=['otter', 'turtle', 'deer', 'cat'], petCopies={'otter': 8, 'turtle': 3, 'deer': 1, 'cat': 25}, activePet='otter',
             stages={f'CH{i:02d}': {'cleared': True, 'stars': 3} for i in range(1, 11)},
             parts={x: {'copies': [1, 3, 7, 25, 80][i % 5], 'level': 1 + i % 10} for i, x in enumerate(parts)}, equippedParts=parts[:3])
    # 장비(docs/34): 등급이 섞인 호야 장비, 원거리 세트 5칸 + 근거리 무기 없이, 합성 가능한 것 포함
    slots = ['helm', 'armor', 'shoes', 'gloves', 'necklace', 'weapon']
    p.update(hero='hoya', heroLocked=True, milestones={**p['milestones'], 'firstGear': True},
             gear={**{f'hoya_ranged_{s}': {'copies': [1, 3, 7, 25, 80, 9][i], 'grade': [0, 1, 1, 3, 4, 2][i]} for i, s in enumerate(slots)}, 'hoya_melee_armor': {'copies': 2, 'grade': 0}},
             equippedGear={s: f'hoya_ranged_{s}' for s in slots if s != 'gloves'})
    return p

AUDIT_JS = r"""(kind)=>{
  const W=innerWidth,H=innerHeight,out={hOverflow:[],clipped:[],overlap:[],vOverflow:[]};
  const vis=e=>{const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;const r=e.getBoundingClientRect();return r.width>1&&r.height>1;};
  const name=e=>(e.id?'#'+e.id:e.tagName.toLowerCase()+(e.classList[0]?'.'+e.classList[0]:''))+' '+(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,24);
  if(document.documentElement.scrollWidth>W+1)out.hOverflow.push('page scrollWidth '+document.documentElement.scrollWidth);
  const roots=[...document.querySelectorAll('#guardian-lobby, dialog[open], #levelup:not(.hidden), #result:not(.hidden), #pause:not(.hidden), #title:not(.hidden), #hud, #hpbar-wrap, #xpbar-wrap, #timer, #killcount, #btn-mute, #btn-pause, #boss-telegraph-label, #sg-run-tools, #sg-objective')];
  const seen=new Set();
  for(const root of roots)for(const e of [root,...root.querySelectorAll('*')]){
    if(seen.has(e)||!vis(e))continue;seen.add(e);
    // 스크롤되는 상자 안에 있으면 가로 넘침으로 치지 않는다
    let sc=e.parentElement,inScroll=false;while(sc&&sc!==document.body){const o=getComputedStyle(sc).overflowX;if(o==='auto'||o==='scroll'){inScroll=true;break;}sc=sc.parentElement;}
    const r=e.getBoundingClientRect();
    if(!inScroll&&(r.right>W+2||r.left<-2)&&r.width<W*3)out.hOverflow.push(name(e)+` [${Math.round(r.left)}..${Math.round(r.right)}]`);
    const s=getComputedStyle(e);
    if(e.children.length===0&&(e.innerText||'').trim()&&e.scrollWidth>e.clientWidth+2&&(s.overflowX==='hidden'||s.textOverflow==='ellipsis'||s.whiteSpace==='nowrap'))out.clipped.push(name(e)+` (${e.scrollWidth}>${e.clientWidth})`);
  }
  if(kind==='battle'){
    const ids=['hpbar-wrap','xpbar-wrap','lvl','timer','killcount','btn-mute','btn-pause','boss-telegraph-label','sg-run-tools','sg-objective'];
    const rs=ids.map(id=>{const e=document.getElementById(id);return e&&vis(e)&&(e.innerText||'').trim()!==''||['hpbar-wrap','xpbar-wrap','sg-run-tools'].includes(id)&&e&&vis(e)?[id,e.getBoundingClientRect()]:null;}).filter(Boolean);
    for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const [a,A]=rs[i],[b,B]=rs[j];const w=Math.min(A.right,B.right)-Math.max(A.left,B.left),h=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top);
      if(w>3&&h>3)out.overlap.push(`${a} × ${b} (${Math.round(w)}×${Math.round(h)})`);}
    for(const [id,r] of rs)if(r.bottom>H+1||r.top<-1)out.vOverflow.push(id+' off-screen');
    out.bossBarY=window.__bossBarY?window.__bossBarY():null;
  }
  for(const sel of ['#levelup:not(.hidden) .panel-inner, #levelup:not(.hidden) #card-row','#result:not(.hidden)','dialog[open]','#pause:not(.hidden)']){
    for(const e of document.querySelectorAll(sel)){if(!vis(e))continue;const r=e.getBoundingClientRect();
      // 자기나 바깥 상자가 스크롤되면(끝까지 볼 수 있음) 넘침으로 치지 않되, 한 화면에 안 들어오는 것은 따로 적는다
      let a=e,scroll=false;while(a&&a!==document.body){const s=getComputedStyle(a);if(['auto','scroll'].includes(s.overflowY)&&a.scrollHeight>a.clientHeight+2){scroll=true;break;}a=a.parentElement;}
      if(r.bottom>H+2||r.top<-2)(scroll?out.needsScroll=out.needsScroll||[]:out.vOverflow).push(name(e)+` [${Math.round(r.top)}..${Math.round(r.bottom)}] H=${H}`);}
  }
  return out;
}"""

def quiet(page):
    q = 0
    while q < 3:
        page.wait_for_timeout(400)
        if page.locator('dialog[open]').count():
            q = 0
            try: page.locator('dialog[open] [data-close], dialog[open] button').first.click(timeout=2000)
            except Exception: page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        else: q += 1

def audit_size(b, W, H, report):
    touch = W < 1100 or H < 600
    ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 700 and touch, has_touch=touch, device_scale_factor=1)
    page = ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    rec = report.setdefault(f'{W}x{H}', {})
    def check(kind, shot=None):
        rec[kind] = page.evaluate(AUDIT_JS, kind)
        if shot and shot in args.shots.split(','): page.screenshot(path=str(OUT / f'{W}x{H}-{shot}.png'))
    uid = f'qarsp{W}{random.randint(10, 99)}'[:12]
    page.request.post(args.url + '/_qa/reset-attempts')   # 격리 서버 가입 제한 비우기(여러 크기를 연달아 가입)
    page.goto(args.url, wait_until='networkidle'); check('title')
    page.locator('#login-id').fill(uid); page.locator('#login-pw').fill('qa_local_1234'); page.locator('#btn-register').click()
    page.locator('#btn-title-start').wait_for(state='visible')
    assert page.request.post(args.url + '/_qa/profile', data={'id': uid, 'profile': super_profile()}).ok
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
    page.evaluate("document.getElementById('btn-title-start').click()"); page.locator('#guardian-lobby .sg-nav').wait_for(); quiet(page)
    for tab in ['adventure', 'training', 'parts', 'gear', 'friends', 'book']:
        page.locator(f'.sg-nav [data-tab="{tab}"]').click(); page.wait_for_timeout(250); quiet(page); check('lobby-' + tab, tab)
    page.locator('.sg-nav [data-tab="parts"]').click(); page.wait_for_timeout(200)
    page.locator('[data-do="supply-help"]').first.click(); page.wait_for_timeout(300); check('dialog-supply-help', 'dialog'); quiet(page)
    page.locator('.sg-nav [data-tab="gear"]').click(); page.wait_for_timeout(200)
    page.locator('[data-do="gear-help"]').first.click(); page.wait_for_timeout(300); check('dialog-gear-help', 'dialog'); quiet(page)
    page.locator('[data-gear-slot="helm"]').click(); page.wait_for_timeout(300); check('dialog-gear-slot', 'dialog'); quiet(page)
    page.locator('[data-do="gear-bag"]').click(); page.wait_for_timeout(300); check('dialog-gear-bag', 'dialog')
    page.locator('dialog[open] [data-bag-id]').first.click(); page.wait_for_timeout(300); check('dialog-gear-detail', 'dialog'); quiet(page)
    page.locator('[data-gear-set]').first.click(); page.wait_for_timeout(300); check('dialog-gear-set', 'dialog'); quiet(page)
    page.locator('.sg-nav [data-tab="adventure"]').click(); page.wait_for_timeout(200); quiet(page)
    page.locator('[data-stage="CH10"]').click(); page.wait_for_timeout(200); page.locator('#sg-start').click(); page.locator('#levelup:not(.hidden)').wait_for()
    page.wait_for_timeout(300); check('levelup', 'levelup')
    page.evaluate("window.__sgCombatLoad(['F1','W1','E1','L2'])"); page.evaluate("window.__debugGod=true;window.__debugForceBoss()")
    page.evaluate("window.__debugSim(2.5)"); page.evaluate("window.__debugBossPattern('파이프 휘두르기')"); page.evaluate("window.__debugSim(0.3)")
    page.evaluate("window.__debugFreeze(5)"); page.wait_for_timeout(200); check('battle', 'battle'); page.evaluate("window.__debugFreeze(0)")
    page.locator('#btn-pause').click(); page.wait_for_timeout(250); check('pause', 'pause')
    page.locator('#btn-resume').click(); page.wait_for_timeout(150)
    page.evaluate("window.__debugEnd(false)"); page.locator('#result:not(.hidden) #btn-continue:enabled').wait_for(timeout=30000); page.wait_for_timeout(300); check('result', 'result')
    rec['_pageErrors'] = errs
    ctx.close()

def main():
    report = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, executable_path=EXE, args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
        for s in args.sizes.split(','):
            W, H = map(int, s.split('x'))
            try: audit_size(b, W, H, report)
            except Exception as e: report.setdefault(s, {})['_error'] = str(e)[:300]
        b.close()
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
    total = 0
    for size, rec in report.items():
        issues = [(k, kind, v) for k, r in rec.items() if isinstance(r, dict) for kind, v in r.items() if isinstance(v, list) and v]
        total += sum(len(v) for _, _, v in issues)
        print(f'{size}: ' + ('OK' if not issues and not rec.get('_error') and not rec.get('_pageErrors') else ''))
        if rec.get('_error'): print('   ERROR', rec['_error'])
        if rec.get('_pageErrors'): print('   pageErrors', rec['_pageErrors'][:2])
        for screen, kind, v in issues: print(f'   {screen} {kind}: ' + ' | '.join(v[:4]) + (f' (+{len(v)-4})' if len(v) > 4 else ''))
    print('total issues', total)

if __name__ == '__main__':
    main()
