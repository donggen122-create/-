"""Loopback-only story interactions, real departure/result flows, and screenshots.

Run: python game/tools/qa/story-check.py --url http://localhost:8798
Requires the isolated in-memory node-server, QA accounts only. No live services.
"""
import argparse
import copy
import json
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright
from browser import chrome_path, local_url

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url', default='http://localhost:8798')
ap.add_argument('--layout-only', action='store_true', help='Repeat layout/automation probes, keeping prior real-flow evidence')
args = ap.parse_args()
BASE = local_url(args.url)
OUT = ROOT / 'docs/codex/preview'
LOG = ROOT / 'docs/codex/qa/E-story-check.json'
OUT.mkdir(parents=True, exist_ok=True)
LOG.parent.mkdir(parents=True, exist_ok=True)
FRESH = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))
results = [r for r in json.loads(LOG.read_text(encoding='utf-8')) if 'ui' in r] if args.layout_only and LOG.exists() else []


def setup(browser, size, ui, account, query='story=1'):
    ctx = browser.new_context(viewport={'width': size[0], 'height': size[1]},
                              has_touch=size[0] < 700, device_scale_factor=1)
    ctx.route('**/*', lambda r: r.fallback() if urlsplit(r.request.url).hostname in
              ('localhost', '127.0.0.1') else r.abort())
    # Existing __sgSnapshot assumes a battle already exists; add a read-only QA probe.
    main = (ROOT / 'game/src/main.js').read_text(encoding='utf-8')
    main += '\nwindow.__storyState=()=>({mode,runTime,chapter:chapter?.id,cleared:sgState.cleared});\n'
    ctx.route(BASE + '/src/main.js*', lambda r: r.fulfill(body=main, content_type='application/javascript'))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.request.post(BASE + '/_qa/reset-attempts')
    page.goto(f'{BASE}/?ui={ui}&{query}', wait_until='networkidle')
    page.locator('#login-id').fill(account)
    page.locator('#login-pw').fill('qa_local_1234')
    page.locator('#btn-register').click()
    page.wait_for_timeout(350)
    if page.locator('#btn-title-start').is_hidden():
        page.locator('#btn-login').click()
    page.locator('#btn-title-start').wait_for(state='visible')
    profile = copy.deepcopy(FRESH)
    profile.update(hero='hoya', heroLocked=True, difficulty='normal',
                   training={'attack': 40, 'hp': 40, 'speed': 20},
                   milestones={'firstPart': True, 'firstPet': True, 'bossPet': True, 'firstGear': True},
                   stages={f'CH{i:02d}': {'cleared': True, 'stars': 2} for i in range(1, 21)})
    assert page.request.post(BASE + '/_qa/profile', data={'id': account, 'profile': profile}).ok
    page.reload(wait_until='networkidle')
    enter_lobby(page)
    return ctx, page, errors


def enter_lobby(page):
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
    page.evaluate("document.getElementById('btn-title-start').click()")
    page.locator('#guardian-lobby .sg-nav').wait_for()
    for _ in range(4):
        page.wait_for_timeout(150)
        page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")


def depart(page, stage):
    page.evaluate("document.querySelector('.sg-chapter-chip[data-chapter=\"3\"]').click()")
    page.locator(f'[data-stage="{stage}"]').click()
    page.locator('[data-do="start"]:visible').click()


def check_layout(page):
    issue = page.locator('.story-scene').evaluate("""e=>{
      const issues=[];
      for(const n of e.querySelectorAll('button,.story-box,.story-face,.story-speaker,.story-text')){
        const r=n.getBoundingClientRect();
        if(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)issues.push(n.className+' offscreen');
      }
      const t=e.querySelector('.story-text'),range=document.createRange();
      range.selectNodeContents(t);
      const lines=new Set([...range.getClientRects()].map(r=>Math.round(r.top)));
      if(lines.size>2)issues.push('more than two text lines: '+t.textContent);
      if(t.scrollWidth>t.clientWidth+1)issues.push('text overflow');
      return issues;
    }""")
    assert not issue, issue
    page.wait_for_function("[...document.querySelectorAll('.story-face')].every(i=>i.complete&&i.naturalWidth===160)")
    src = page.locator('.story-face').get_attribute('src')
    assert '/assets/story/' in src and '?v=' in src, src


def screenshot(page, scene, size, suffix=''):
    file = OUT / f'E_story_{scene}_{size[0]}x{size[1]}{suffix}.png'
    page.screenshot(path=str(file))
    im = Image.open(file)
    im.save(file, optimize=True)
    if file.stat().st_size > 400_000:
        im.convert('RGB').quantize(colors=128).save(file, optimize=True)
    assert file.stat().st_size <= 400_000
    return {'file': str(file.relative_to(ROOT)), 'bytes': file.stat().st_size}


def finish_battle(page, win):
    page.locator('#levelup:not(.hidden)').wait_for()
    if win:
        # Synthetic success via existing local debug hook, after valid stage duration.
        # This verifies settlement/story timing; it is not a gameplay/balance claim.
        page.evaluate('window.__pilotGod=true;window.__pilotAvoid=2;window.__debugPilot(245);window.__debugEnd(true)')
    else:
        page.evaluate('window.__debugEnd(false)')
    page.locator('#btn-continue:enabled').wait_for(timeout=30_000)
    assert page.locator('#result-title').inner_text() == ('우리 마을이 반짝반짝!' if win else '멋진 도전이었어요!')


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=chrome_path())
    for ui, size in ([] if args.layout_only else [(2, (1280, 720)), (2, (375, 667)), (1, (1280, 720))]):
        account = f'qast{ui}{size[0]}'
        ctx, page, errors = setup(browser, size, ui, account)
        starts = []
        page.on('request', lambda req: starts.append(req.post_data_json) if req.url.endswith('/api/play/start') else None)
        assert page.evaluate('navigator.webdriver') is True
        depart(page, 'CH11')
        page.locator('.story-scene[data-scene="ch3-start"]').wait_for()
        assert not starts, 'No timer/start request before story finishes'
        check_layout(page)
        captures = [screenshot(page, 'start', size, '_ui1' if ui == 1 else '')]
        # Both mouse/touch and keyboard advance without changing the game mode/time.
        for index, action in enumerate(['tap', 'space', 'enter', 'tap'], 1):
            if action == 'tap':
                if size[0] < 700: page.locator('.story-box').tap()
                else: page.locator('.story-box').click()
            else: page.keyboard.press('Space' if action == 'space' else 'Enter')
            assert page.locator('.story-scene').get_attribute('data-line') == str(index)
            assert page.evaluate('window.__storyState().mode') == 'menu'
            assert not starts
            check_layout(page)
        page.keyboard.press('Enter')
        finish_battle(page, False)
        page.locator('#btn-continue').click()
        depart(page, 'CH11')
        page.locator('#levelup:not(.hidden)').wait_for()
        assert not page.locator('.story-scene').count(), 'Seen scene must not reopen'
        finish_battle(page, False)
        page.locator('#btn-continue').click()
        depart(page, 'CH15')
        page.locator('.story-scene[data-scene="ch3-boss"]').wait_for()
        check_layout(page)
        if ui == 2: captures.append(screenshot(page, 'boss', size))
        page.locator('.story-skip').click()
        assert page.evaluate('(id)=>localStorage.getItem(`seoho_v1_story-seen:ch3-boss_${id}`)', account) == '1'
        # Failed CH15 never shows the clear scene.
        finish_battle(page, False)
        page.locator('#btn-continue').click()
        assert not page.locator('.story-scene').count()
        depart(page, 'CH15')
        finish_battle(page, True)
        assert not page.locator('.story-scene').count(), 'Wait for result close, not settlement'
        page.locator('#btn-continue').click()
        page.locator('.story-scene[data-scene="ch3-clear"]').wait_for()
        assert page.locator('#result').is_hidden() and page.locator('#menu').is_hidden()
        assert page.evaluate('window.__storyState().mode') == 'result'
        check_layout(page)
        if ui == 2: captures.append(screenshot(page, 'clear', size))
        page.locator('.story-skip').click()
        page.wait_for_function("window.__storyState().mode==='menu'")
        # Reload persistence, same account/device.
        page.reload(wait_until='networkidle')
        enter_lobby(page)
        depart(page, 'CH11')
        page.locator('#levelup:not(.hidden)').wait_for()
        assert not page.locator('.story-scene').count()
        finish_battle(page, False)
        page.locator('#btn-continue').click()
        # Reset on a normal browser (override automation flag for this local test).
        page.add_init_script("Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false})")
        page.goto(f'{BASE}/?ui={ui}&story=reset', wait_until='networkidle')
        enter_lobby(page)
        depart(page, 'CH11')
        page.locator('.story-scene[data-scene="ch3-start"]').wait_for()
        assert page.evaluate('(id)=>localStorage.getItem(`seoho_v1_story-seen:ch3-boss_${id}`)', account) is None
        page.locator('.story-skip').click()
        finish_battle(page, False)
        page.locator('#btn-continue').click()
        assert not errors, errors
        results.append({'ui': ui, 'size': size, 'captures': captures, 'interactions': 'PASS', 'errors': errors})
        LOG.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
        print(f'UI {ui} {size}: real triggers, input, skip, seen, reload, reset PASS', flush=True)
        ctx.close()

    # Every dialogue line at landscape/portrait/desktop; isolated presentation probe.
    ctx, page, errors = setup(browser, (667, 375), 2, 'qastlayout')
    page.evaluate("async()=>{window.storyProbe=await import('./src/story.js');window.storyData=await import('./src/story.data.js')}")
    for size in [(667, 375), (375, 667), (1280, 720)]:
        page.set_viewport_size({'width': size[0], 'height': size[1]})
        for scene in [('CH11', 'before-start'), ('CH15', 'before-start'), ('CH15', 'after-clear')]:
            page.evaluate("([stage,when,suffix])=>{window.storyTask=window.storyProbe.playStory(stage,when,k=>'qa_layout_'+suffix+'_'+k)}", [*scene, str(size)])
            page.locator('.story-scene').wait_for()
            for _ in range(5):
                check_layout(page)
                page.keyboard.press('Enter')
            assert not page.locator('.story-scene').count()
    assert not errors, errors
    results.append({'layout': '45 lines across desktop/portrait/landscape PASS'})
    ctx.close()

    # Default WebDriver skips before-start and after-clear without writing seen flags.
    ctx, page, errors = setup(browser, (1280, 720), 2, 'qastauto', '')
    assert page.evaluate('navigator.webdriver') is True
    for stage in ['CH11', 'CH15']:
        depart(page, stage)
        finish_battle(page, stage == 'CH15')
        page.locator('#btn-continue').click()
        page.wait_for_function("window.__storyState().mode==='menu'")
        assert not page.locator('.story-scene').count()
    assert page.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('seoho_v1_story-seen:')).length") == 0
    assert not errors, errors
    results.append({'webdriverAutoSkip': 'CH11 / CH15 before + successful after-clear PASS; seen flags remain empty'})
    ctx.close()
    browser.close()
LOG.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8', newline='\n')
print('Story checks PASS; seven captures <=400 KB', flush=True)
