# 성능 측정(로컬 전용, 2026-09-24 사용자 "뚝뚝 끊기거나 느려지는 현상이 최대한 없게"): 격리 서버에서 후반 난전을 만들고
# CPU를 느리게(태블릿·휴대폰 흉내) 한 채 실제 시간으로 돌려 프레임 간격·계산/그리기 시간·CPU 프로필(함수별 시간)을 잰다.
#  - 헤드리스 Chromium은 소프트웨어 그리기라 절대 숫자는 실제 기기와 다르다. 고치기 전후 **비교용**.
# 사용: python game/tools/qa/perf.py [--devices tablet,phone,pc] [--throttle 4] [--measure 10] [--label before] [--stage CH08]
import argparse, json, os, random, subprocess, time
from collections import defaultdict
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8797')
ap.add_argument('--devices', default='tablet,phone,pc')
ap.add_argument('--throttle', type=float, default=4)
ap.add_argument('--measure', type=float, default=10)
ap.add_argument('--stage', default='CH08')
ap.add_argument('--skills', default='EVO_F1,EVO_W1,EVO_L1,EVO_V2')
ap.add_argument('--extra', type=int, default=120)
ap.add_argument('--ff', type=float, default=150)
ap.add_argument('--label', default='run')
ap.add_argument('--out', default=str(ROOT / 'game/tools/qa/out/perf'))
ap.add_argument('--gpu', action='store_true', help='그림을 GPU 길(소프트웨어 SwiftShader)로 — 캔버스 그리기가 게임 스레드 밖으로 가서 실제 기기에 더 가깝다')
args = ap.parse_args()
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
EXE = os.environ.get('CHROME_PATH') or '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
DEVICES = {'tablet': (1180, 820, 2, True), 'phone': (375, 812, 3, True), 'pc': (1280, 720, 1, False)}
fresh = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))

def profile():
    p = json.loads(json.dumps(fresh)); parts = ['PART_F1', 'PART_W1', 'PART_L1']
    p.update(difficulty='normal', weaponMode='ranged', training={'attack': 60, 'hp': 60, 'speed': 40}, milestones={'firstPart': True, 'firstPet': True, 'bossPet': True},
             pets=['otter'], activePet='otter', friendship=28, stages={f'CH{i:02d}': {'cleared': True, 'stars': 2} for i in range(1, 11)},
             parts={x: {'copies': 25, 'level': 5} for x in parts}, equippedParts=parts)
    return p

def self_times(prof):
    nodes = {n['id']: n for n in prof['nodes']}; t = defaultdict(float)
    for sid, dt in zip(prof['samples'], prof['timeDeltas']):
        cf = nodes[sid]['callFrame']; name = cf['functionName'] or '(anonymous)'
        url = cf.get('url', '').rsplit('/', 1)[-1]
        t[f'{name} {url}:{cf.get("lineNumber", 0) + 1}' if url else name] += dt / 1000
    tot = sum(t.values()) or 1
    return tot, sorted(((k, v, v / tot * 100) for k, v in t.items()), key=lambda x: -x[1])[:25]

def run(b, dev):
    W, H, dsf, touch = DEVICES[dev]
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=dsf, is_mobile=W < 700, has_touch=touch)
    page = ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    uid = f'qaperf{random.randint(1000, 9999)}'
    page.goto(args.url, wait_until='networkidle')
    page.locator('#login-id').fill(uid); page.locator('#login-pw').fill('qa_local_1234'); page.locator('#btn-register').click()
    page.locator('#btn-title-start').wait_for(state='visible'); assert page.request.post(args.url + '/_qa/profile', data={'id': uid, 'profile': profile()}).ok
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled"); page.evaluate("document.getElementById('btn-title-start').click()")
    page.locator('#guardian-lobby .sg-nav').wait_for()
    for _ in range(6): page.wait_for_timeout(400); page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    ch = (int(args.stage[2:]) - 1) // 5 + 1
    page.locator(f'.sg-chapter-chip[data-chapter="{ch}"]').click(); page.wait_for_timeout(300)
    page.locator(f'[data-stage="{args.stage}"]').click(); page.wait_for_timeout(300); page.locator('#sg-start').click(); page.locator('#levelup:not(.hidden)').wait_for()
    page.evaluate(f"""()=>{{window.__pilotAvoid=2;window.__pilotGod=true;window.__sgCombatLoad({json.dumps(args.skills.split(','))},{{}},{{S5:3,S1:3}});
      window.__debugPilot({args.ff});window.__debugGod=true;
      const t=Object.keys(window.__sgSnapshot().enemyTypes);window.__debugSpawn(t[0]||'T2_DUST',{args.extra},420);
      window.__perfDrive=setInterval(()=>{{const lv=document.querySelector('#levelup');if(lv&&!lv.classList.contains('hidden'))document.querySelector('#card-row .card')?.click();
        const a=performance.now()/1500,k=[];if(Math.cos(a)>.3)k.push('d');else if(Math.cos(a)<-.3)k.push('a');if(Math.sin(a)>.3)k.push('s');else if(Math.sin(a)<-.3)k.push('w');window.__debugSetKeys(k);
        const s=window.__sgSnapshot();if(s.enemies<{args.extra})window.__debugSpawn(t[0]||'T2_DUST',20,420);}},200);}}""")
    cdp = ctx.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': args.throttle})
    page.wait_for_timeout(3000)   # 화질 자동 조절이 한 번 움직일 시간
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval', {'interval': 500}); cdp.send('Profiler.start')
    page.evaluate("window.__debugPerf(true)")
    page.wait_for_timeout(int(args.measure * 1000))
    perf = page.evaluate("window.__debugPerf(false)")
    prof = cdp.send('Profiler.stop')['profile']
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
    page.screenshot(path=str(OUT / f'{args.label}-{dev}.png'))
    (OUT / f'{args.label}-{dev}.cpuprofile').write_text(json.dumps(prof))
    tot, top = self_times(prof)
    ctx.close()
    return perf, tot, top, errs

def main():
    res = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, executable_path=EXE, args=['--no-sandbox', '--disable-dev-shm-usage'] + (['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-accelerated-2d-canvas'] if args.gpu else []))
        for dev in args.devices.split(','):
            perf, tot, top, errs = run(b, dev)
            res[dev] = {'perf': perf, 'top': top[:25], 'errors': errs}
            print(f"\n== {args.label} {dev} {DEVICES[dev][:3]} CPU x{args.throttle} ==")
            print(f"fps {perf['fps']:.1f}  frame p50 {perf['p50']:.0f}ms p95 {perf['p95']:.0f}ms  >50ms {perf['long50']}/{perf['frames']}  sim {perf['simMs']:.1f}ms draw {perf['drawMs']:.1f}ms hud {perf['hudMs']:.1f}ms  quality {perf['ratio']}  enemies {perf['enemies']} texts {perf['texts']} hitFx {perf['hitFx']} deathFx {perf['deathFx']} gems {perf['gems']}  errors {len(errs)}")
            for name, ms, pct in top[:14]: print(f"   {pct:5.1f}%  {ms:7.0f}ms  {name}")
        b.close()
    (OUT / f'{args.label}.json').write_text(json.dumps(res, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
