# 계산·그리기 반복 측정(로컬 전용, 2026-09-24 최적화): 후반 난전(진화 4개·범위 최대·적 120마리 이상)을 만들고
# 같은 판에서 계산 5초(틱당 ms)와 같은 장면 60번 그리기(한 번당 ms)를 여러 번 재어 중앙값을 낸다. 헤드리스 소프트웨어 그리기라 비교용.
# 사용: python game/tools/qa/bench.py --url http://localhost:8797 --label after [--devices tablet,phone,pc] [--reps 5]
import argparse, json, random, statistics, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8797')
ap.add_argument('--devices', default='tablet,phone,pc')
ap.add_argument('--reps', type=int, default=9)
ap.add_argument('--stage', default='CH08')
ap.add_argument('--label', default='run')
args = ap.parse_args()
EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
DEVICES = {'tablet': (1180, 820, 2, True), 'phone': (375, 812, 3, True), 'pc': (1280, 720, 1, False)}
fresh = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))

def profile():
    p = json.loads(json.dumps(fresh)); parts = ['PART_F1', 'PART_W1', 'PART_L1']
    p.update(difficulty='normal', weaponMode='ranged', training={'attack': 60, 'hp': 60, 'speed': 40}, milestones={'firstPart': True, 'firstPet': True, 'bossPet': True},
             pets=['otter'], activePet='otter', friendship=28, stages={f'CH{i:02d}': {'cleared': True, 'stars': 2} for i in range(1, 11)},
             parts={x: {'copies': 25, 'level': 5} for x in parts}, equippedParts=parts)
    return p

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, executable_path=EXE, args=['--no-sandbox', '--disable-dev-shm-usage'])
    out = {}
    for dev in args.devices.split(','):
        W, H, dsf, touch = DEVICES[dev]
        ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=dsf, is_mobile=W < 700, has_touch=touch)
        page = ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
        uid = f'qabench{random.randint(100, 999)}'
        page.goto(args.url, wait_until='networkidle')
        page.locator('#login-id').fill(uid); page.locator('#login-pw').fill('qa_local_1234'); page.locator('#btn-register').click()
        page.locator('#btn-title-start').wait_for(state='visible'); assert page.request.post(args.url + '/_qa/profile', data={'id': uid, 'profile': profile()}).ok
        page.wait_for_function("!document.querySelector('#btn-title-start').disabled"); page.evaluate("document.getElementById('btn-title-start').click()")
        page.locator('#guardian-lobby .sg-nav').wait_for()
        for _ in range(6): page.wait_for_timeout(400); page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        page.locator(f'.sg-chapter-chip[data-chapter="{(int(args.stage[2:]) - 1) // 5 + 1}"]').click(); page.wait_for_timeout(300)
        page.locator(f'[data-stage="{args.stage}"]').click(); page.wait_for_timeout(300); page.locator('#sg-start').click(); page.locator('#levelup:not(.hidden)').wait_for()
        page.evaluate("""()=>{window.__pilotAvoid=2;window.__pilotGod=true;window.__sgCombatLoad(['EVO_F1','EVO_W1','EVO_L1','EVO_V2'],{},{S5:3,S1:3});window.__debugPilot(120);window.__debugGod=true;}""")
        page.evaluate("()=>{const t=Object.keys(window.__sgSnapshot().enemyTypes);window.__debugSpawn(t[0]||'T2_DUST',130,420);window.__debugBench(1,10,true,%s);}" % (1.5 if dsf > 1.5 else dsf))
        page.wait_for_timeout(1500)   # 미리 줄여 둔 그림(ImageBitmap)이 준비될 시간
        ticks, draws = [], []
        for r in range(args.reps):
            res = page.evaluate("""()=>{const DSF_RATIO=%s;const t=Object.keys(window.__sgSnapshot().enemyTypes);if(window.__sgSnapshot().enemies<130)window.__debugSpawn(t[0]||'T2_DUST',130-window.__sgSnapshot().enemies,420);
              return window.__debugBench(5,60,true,DSF_RATIO);}""" % (1.5 if dsf > 1.5 else dsf))
            ticks.append(res['tickMs']); draws.append(res['drawMs'])
        out[dev] = {'tickMs': statistics.median(ticks), 'drawMs': statistics.median(draws), 'last': res, 'errors': errs}
        print(f"{args.label:8s} {dev:6s} 계산 {statistics.median(ticks):5.2f}ms/틱  그리기 {statistics.median(draws):6.2f}ms/번  (적 {res['enemies']} 숫자 {res['texts']} 맞음 {res['hitFx']} 정화 {res['deathFx']}) 오류 {len(errs)}", flush=True)
        ctx.close()
    b.close()
