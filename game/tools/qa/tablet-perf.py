"""Isolated repeatable tablet audit. No production URLs, credentials, or student data.

Examples (start node-server.mjs first):
 python game/tools/qa/tablet-perf.py --label before --stages CH05,CH10,CH13,CH15,CH17,CH18,CH19,CH20
 python game/tools/qa/tablet-perf.py --label after --stages CH18,CH19,CH20 --devices ipad,android,portrait --rates 4,6 --reps 2 --trace
 python game/tools/qa/tablet-perf.py --label after --mode repeat --stages CH19
 python game/tools/qa/tablet-perf.py --label invariant --mode replay --reference <measurement-commit>

Natural stages end at 300 seconds (boss appears at 240s, timeout 360), so
7-9 minute stages cannot be measured without changing the rules. We use
265s / 305s instead, holding only the QA boss HP in phase 2 for profiling.
CPU profiles and DevTools timelines include sampling overhead; compare like with like.
"""
import argparse
import copy
import json
import statistics
import subprocess
import time
import hashlib
import base64
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from browser import chrome_path, local_url

ROOT = Path(__file__).resolve().parents[3]
DEVICES = {'ipad': (1180, 820, 2), 'android': (1280, 800, 1.5), 'portrait': (820, 1180, 2), 'pc': (1280, 720, 1)}
STAGES = 'CH05,CH10,CH13,CH15,CH17,CH18,CH19,CH20'
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--url', default='http://localhost:8797/?ui=2')
ap.add_argument('--label', required=True)
ap.add_argument('--mode', choices=['scenes', 'repeat', 'lobby', 'replay', 'layers'], default='scenes')
ap.add_argument('--devices', default='ipad')
ap.add_argument('--stages', default=STAGES)
ap.add_argument('--rates', default='4')
ap.add_argument('--reps', type=int, default=1)
ap.add_argument('--warm', type=float, default=12)
ap.add_argument('--measure', type=float, default=15)
ap.add_argument('--seed', type=int, default=10808)
ap.add_argument('--trace', action='store_true')
ap.add_argument('--foam', action='store_true', help='QA holds the foam overlay on CH13; synthetic worst overlay')
ap.add_argument('--stress', action='store_true', help='QA adds 160 durable enemies, including the stage-specific threat; synthetic maximum crowd')
ap.add_argument('--threat-effects', action='store_true', help='Every 2 game seconds inject 8 native tracks or 1 native fireball (damage 0); synthetic visual load')
ap.add_argument('--reference', help='Read JS/CSS from this local git commit for before/after replay; no checkout')
ap.add_argument('--source', help='Read JS/CSS from this local git commit for performance measurement')
ap.add_argument('--out', default=str(ROOT / 'game/tools/qa/out/tablet'))
args = ap.parse_args()
BASE = local_url(args.url)
OUT = Path(args.out)
OUT.mkdir(parents=True, exist_ok=True)
fresh = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))


def profile():
    p = copy.deepcopy(fresh)
    parts = ['PART_F1', 'PART_W1', 'PART_L1']
    p.update(difficulty='normal', weaponMode='ranged', hero='hoya', heroLocked=True,
             training={'attack': 20, 'hp': 20, 'speed': 15},
             milestones={'firstPart': True, 'firstPet': True, 'bossPet': True, 'firstGear': True},
             petCopies={'otter': 40}, activePet='otter',
             stages={f'CH{i:02d}': {'cleared': True, 'stars': 2} for i in range(1, 21)},
             parts={x: {'copies': 80, 'level': 5} for x in parts}, equippedParts=parts)
    return p


def seed_js(seed):
    return f"""let s={seed};Math.random=()=>{{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;}};"""


def source_routes(ctx, ref):
    if not ref:
        return
    # Only repository source; assets are unchanged by this audit.
    names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', ref, 'game/src'], cwd=ROOT, text=True).splitlines()
    for name in names:
        if name.endswith(('.js', '.css')):
            content = subprocess.check_output(['git', 'show', f'{ref}:{name}'], cwd=ROOT)
            ctx.route(BASE + '/' + name.removeprefix('game/') + '*', lambda route, request, body=content, n=name: route.fulfill(body=body, content_type='text/css' if n.endswith('.css') else 'application/javascript'))


def context(b, dev, ref=None, replay=False):
    w, h, dsf = DEVICES[dev]
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, has_touch=dev != 'pc')
    source_routes(ctx, ref)
    # Reject every off-host request, including future API endpoints / external fonts.
    ctx.route('**/*', lambda route: route.fallback() if urlsplit(route.request.url).hostname in ('localhost', '127.0.0.1') else route.abort())
    if replay:
        ctx.add_init_script('window.requestAnimationFrame=(cb)=>0;')
        ctx.add_init_script("localStorage.setItem('lumen_muted','1');")
    ctx.add_init_script("""(()=>{const intervals=new Set(),timeouts=new Set(),si=window.setInterval,ci=window.clearInterval,st=window.setTimeout,ct=window.clearTimeout;
      window.setInterval=(...a)=>{const id=si(...a);intervals.add(id);return id;};window.clearInterval=id=>{intervals.delete(id);ci(id);};
      window.setTimeout=(cb,ms,...a)=>{let id;id=st(typeof cb==='function'?()=>{timeouts.delete(id);cb(...a);}:cb,ms);timeouts.add(id);return id;};
      window.clearTimeout=id=>{timeouts.delete(id);ct(id);};window.__qaTimers=()=>({intervals:intervals.size,timeouts:timeouts.size});})();""")
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.request.post(BASE + '/_qa/reset-attempts')
    page.goto(args.url, wait_until='networkidle')
    page.locator('#login-id').fill('qa')
    page.locator('#login-pw').fill('qa_local_1234')
    page.locator('#btn-register').click()
    page.wait_for_timeout(350)
    if page.locator('#btn-title-start').is_hidden():
        page.locator('#btn-login').click()
    page.locator('#btn-title-start').wait_for(state='visible')
    reset_profile(page)
    page.evaluate("document.getElementById('btn-title-start').click()")
    page.locator('#guardian-lobby .sg-nav').wait_for()
    quiet(page)
    return ctx, page, errors


def reset_profile(page):
    assert page.request.post(BASE + '/_qa/profile', data={'id': 'qa', 'profile': profile()}).ok
    page.reload(wait_until='networkidle')
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled")


def quiet(page):
    for _ in range(4):
        page.wait_for_timeout(150)
        page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")


def start(page, stage):
    page.evaluate(seed_js(args.seed))
    chapter = (int(stage[2:]) - 1) // 5 + 1
    # DOM click permits paging to chapter 1 even when the 3/4 chapter pair is displayed.
    page.evaluate(f"document.querySelector('.sg-chapter-chip[data-chapter=\"{chapter}\"]').click()")
    page.locator(f'[data-stage="{stage}"]').click()
    page.locator('#sg-start').click()
    page.locator('#levelup:not(.hidden)').wait_for()


def prepare(page, stage):
    seconds = 305 if int(stage[2:]) % 5 == 0 else 265
    # Evolved skills at end of a natural pilot, no extra enemies or immortal enemies.
    result = page.evaluate(f"""()=>{{window.__pilotGod=true;window.__pilotAvoid=2;
      if({str(int(stage[2:]) % 5 == 0).lower()}){{window.__debugPilot(241);window.__debugTankBoss();}}
      const r=window.__debugPilot({64 if int(stage[2:]) % 5 == 0 else seconds});window.__debugGod=true;
      if(r.mode!=='result')window.__sgCombatLoad(['EVO_F1','EVO_W1','EVO_L1','EVO_V2'],{{}},{{S5:3,S1:3}});return r;}}""")
    if result['mode'] == 'result':
        raise RuntimeError(f'{stage} ended before late measurement: {result}')
    if args.stress:
        types = {'CH05':'T1_BAGGY','CH10':'T2_DUST','CH13':'T3_BUBBLE','CH15':'T3_BUBBLE','CH17':'T4_SAW','CH18':'T4_NUTRIA','CH19':'T4_BURNER','CH20':'T4_BURNER'}
        elite = {'CH13':'T3_NET','CH18':'T4_DOZER','CH19':'T4_BULKI'}
        page.evaluate("""q=>{window.__debugSpawn(q.type,Math.max(0,160-window.__sgSnapshot().enemies),250);
          if(q.elite)window.__debugSpawn(q.elite,1,120);window.__debugBench(0,0,true);}""", {'type':types[stage], 'elite':elite.get(stage)})
    threat = {'CH18':'tracks','CH19':'balls'}.get(stage) if args.threat_effects else None
    page.evaluate("""q=>{window.__qaThreatMax={};window.__tabletDrive=setInterval(()=>{const s=window.__sgSnapshot();const a=s.runTime/4,k=[];
      if(Math.cos(a)>.3)k.push('d');else if(Math.cos(a)<-.3)k.push('a');
      if(Math.sin(a)>.3)k.push('s');else if(Math.sin(a)<-.3)k.push('w');window.__debugSetKeys(k);if(q.foam)window.__debugFoam();
      if(q.threat){const bucket=Math.floor(s.runTime/2);if(window.__qaThreatBucket!==bucket){window.__qaThreatBucket=bucket;window.__debugT4Visuals(q.threat);}
        const v=window.__sgT4();for(const key of ['marks','balls','booms'])window.__qaThreatMax[key]=Math.max(window.__qaThreatMax[key]||0,v[key]);}
      },200);}""", {'foam':args.foam and stage == 'CH13', 'threat':threat})
    return result


def cpu_top(prof):
    nodes = {n['id']: n['callFrame'] for n in prof['nodes']}
    totals = {}
    for sid, dt in zip(prof.get('samples', []), prof.get('timeDeltas', [])):
        cf = nodes[sid]
        name = f"{cf['functionName'] or '(anonymous)'} {cf.get('url','').split('/')[-1]}:{cf.get('lineNumber',0)+1}"
        totals[name] = totals.get(name, 0) + dt / 1000
    total = sum(totals.values()) or 1
    return [{'function': k, 'ms': v, 'percent': v/total*100} for k,v in sorted(totals.items(), key=lambda x: -x[1])[:10]]


def memory(cdp):
    cdp.send('HeapProfiler.collectGarbage')
    heap = cdp.send('Runtime.getHeapUsage')
    dom = cdp.send('Memory.getDOMCounters')
    metrics = {v['name']: v['value'] for v in cdp.send('Performance.getMetrics')['metrics']}
    return {'heapUsed': heap['usedSize'], 'heapTotal': heap['totalSize'], **dom, 'layoutCount': metrics.get('LayoutCount'), 'taskDuration': metrics.get('TaskDuration')}


def measure(page, cdp, name):
    if args.trace:
        cdp.send('Profiler.enable')
        cdp.send('Profiler.setSamplingInterval', {'interval': 1000})
        cdp.send('Profiler.start')
        cdp.send('Tracing.start', {'categories': 'devtools.timeline,v8', 'transferMode': 'ReturnAsStream'})
    page.evaluate('window.__qaThreatMax={};window.__debugPerf(true)')
    page.wait_for_timeout(int(args.measure*1000))
    perf = page.evaluate('window.__debugPerf(false)')
    if args.threat_effects:
        perf['threatSampleMax'] = page.evaluate('window.__qaThreatMax')
        if not perf['threatSampleMax'].get('marks' if 'CH18' in name else 'balls'):
            raise AssertionError('Controlled threat was not visible in the sample')
    if perf['mode'] != 'playing':
        raise RuntimeError('Scene ended while measuring; shorten sample')
    if args.trace:
        prof = cdp.send('Profiler.stop')['profile']
        (OUT / f'{name}.cpuprofile').write_text(json.dumps(prof), encoding='utf-8')
        completed = []
        cdp.on('Tracing.tracingComplete', lambda e: completed.append(e))
        cdp.send('Tracing.end')
        while not completed:
            page.wait_for_timeout(50)
        stream = completed[0]['stream']
        with (OUT / f'{name}.trace.json').open('w', encoding='utf-8') as f:
            while True:
                part = cdp.send('IO.read', {'handle': stream})
                f.write(part['data'])
                if part['eof']:
                    break
        cdp.send('IO.close', {'handle': stream})
        perf['top10'] = cpu_top(prof)
    perf['long33Pct'] = 100*perf['long33']/max(1,perf['frames'])
    perf['long50Pct'] = 100*perf['long50']/max(1,perf['frames'])
    return perf


def run_scene(b, stage, dev, rate, rep):
    ctx, page, errors = context(b, dev, args.source)
    try:
        start(page, stage)
        prepared = prepare(page, stage)
        cdp = ctx.new_cdp_session(page)
        cdp.send('Performance.enable')
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
        page.wait_for_timeout(int(args.warm*1000))
        mem0 = memory(cdp)
        name = f'{args.label}-{stage}-{dev}-x{rate:g}-r{rep}'
        perf = measure(page, cdp, name)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        page.evaluate('clearInterval(window.__tabletDrive);window.__debugSetKeys([])')
        mem1 = memory(cdp)
        rec = {'stage': stage, 'device': dev, 'viewport': DEVICES[dev], 'rate': rate, 'rep': rep, 'prepared': prepared, 'perf': perf, 'memoryBefore': mem0, 'memoryAfter': mem1, 'errors': errors}
        print(f"{name}: fps {perf['fps']:.1f} low1 {perf['low1']:.1f} sim {perf['simMs']:.2f} draw {perf['drawMs']:.2f} long50 {perf['long50Pct']:.1f}% ratio {perf['ratio']} errors {len(errors)}", flush=True)
        return rec
    finally:
        ctx.close()


def repeat(b):
    stage = args.stages.split(',')[0]
    dev = args.devices.split(',')[0]
    rate = float(args.rates.split(',')[0])
    ctx, page, errors = context(b, dev, args.source)
    records = []
    try:
        cdp = ctx.new_cdp_session(page)
        cdp.send('Performance.enable')
        for n in range(1,6):
            start(page, stage)
            prepared = prepare(page, stage)
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
            page.wait_for_timeout(int(args.warm*1000))
            perf = measure(page, cdp, f'{args.label}-repeat-{n}')
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
            page.evaluate('clearInterval(window.__tabletDrive);window.__debugSetKeys([]);window.__debugEnd(false)')
            page.locator('#btn-continue:enabled').wait_for()
            page.locator('#btn-continue').click()
            quiet(page)
            mem = memory(cdp)
            # Count timer/listener/DOM retention after settling, without navigating the tab.
            records.append({'round': n, 'prepared': prepared, 'perf': perf, 'memory': mem, 'timers': page.evaluate('window.__qaTimers()')})
            print(f"repeat {n}: fps {perf['fps']:.1f} heap {mem['heapUsed']} listeners {mem['jsEventListeners']} nodes {mem['nodes']}", flush=True)
        return {'device': dev, 'stage': stage, 'rate': rate, 'rounds': records, 'errors': errors}
    finally:
        ctx.close()


def lobby(b):
    records = []
    for ui in (1,2):
        args.url = f'{BASE}/?ui={ui}'
        ctx, page, errors = context(b, 'ipad', args.source)
        try:
            cdp = ctx.new_cdp_session(page)
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': float(args.rates.split(',')[0])})
            times = []
            for _ in range(3):
                for tab in ('training','parts','gear','friends','book','adventure'):
                    t = page.evaluate("""tab=>new Promise(resolve=>{const t=performance.now();document.querySelector('.sg-nav [data-tab="'+tab+'"]').click();
                      requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-t)));})""", tab)
                    times.append(t)
            scroll = page.evaluate("""()=>new Promise(resolve=>{const root=document.querySelector('#guardian-lobby');const ds=[];let last=performance.now(),n=0;
              function step(t){ds.push(t-last);last=t;root.scrollTop=(n++%2)*root.scrollHeight;if(n<60)requestAnimationFrame(step);else resolve(ds);}
              requestAnimationFrame(step);})""")
            records.append({'ui': ui, 'tabMs': times, 'tabMedian': statistics.median(times), 'tabMax': max(times), 'scrollFrameMedian': statistics.median(scroll), 'scrollFrameMax': max(scroll), 'errors': errors})
            print(f"UI{ui}: tab median {statistics.median(times):.1f}ms max {max(times):.1f}ms scroll frame max {max(scroll):.1f}ms", flush=True)
        finally:
            ctx.close()
    return records


def replay(b):
    if not args.reference:
        raise ValueError('--reference measurement commit required')
    results = []
    for stage in args.stages.split(','):
        for seed in (args.seed, args.seed+1):
            god = seed == args.seed
            device, quality = ('pc',0) if god else ('ipad',5)
            pair = []
            for ref in (args.reference, None):
                ctx, page, errors = context(b, device, ref, replay=True)
                try:
                    rewards = []
                    page.on('response', lambda r: rewards.append(r.json()) if r.url.endswith('/api/play/finish') and r.ok else None)
                    original = args.seed
                    args.seed = seed
                    start(page, stage)
                    args.seed = original
                    page.evaluate(f"window.__pilotGod={str(god).lower()};window.__pilotAvoid=2;window.__qaInputHash=2166136261;window.__debugQuality({quality})")
                    page.evaluate('window.__debugPilot(260)')
                    # Include draw between fixed-tick commands so draw RNG consumption is identical.
                    for _ in range(3):
                        page.evaluate('window.__debugPilot(5)')
                    outcome = page.evaluate('window.__debugOutcome()')
                    # Full quality must retain the same canvas pixels. Warm both bitmap paths first.
                    canvas_hash = None
                    if quality == 0:
                        page.evaluate('window.__debugLayerBench([],1)')
                        page.wait_for_timeout(500)
                        png = page.evaluate("()=>{window.__debugLayerBench([],1);return document.getElementById('game').toDataURL().split(',')[1]}")
                        canvas_hash = hashlib.sha256(base64.b64decode(png)).hexdigest()
                        (OUT/f'replay-{stage}-{seed}-{"before" if ref else "after"}.png').write_bytes(base64.b64decode(png))
                    page.evaluate('window.__debugEnd(false)')
                    page.locator('#btn-continue:enabled').wait_for()
                    # Outcome + visible settlement reward, ignoring random request IDs/account metadata.
                    if not rewards:
                        raise AssertionError('No local settlement response captured')
                    reward = {k: rewards[-1][k] for k in ('reward','charged','cleared','stage')}
                    pair.append({'outcome': outcome, 'inputHash': page.evaluate('window.__qaInputHash'), 'canvasHash':canvas_hash, 'settlement': reward, 'errors': errors})
                finally:
                    ctx.close()
            equal = pair[0] == pair[1]
            results.append({'stage': stage, 'seed': seed, 'device':device, 'quality':quality, 'god':god, 'equal': equal, 'before': pair[0], 'after': pair[1]})
            print(f'replay {stage} seed {seed}: {"PASS" if equal else "FAIL"}', flush=True)
    if not all(r['equal'] for r in results):
        (OUT / f'{args.label}-replay.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        raise AssertionError('Gameplay replay differs')
    return results


def layers(b):
    results = []
    for stage in args.stages.split(','):
        ctx, page, errors = context(b, 'ipad', args.source, replay=True)
        try:
            start(page, stage)
            prepare(page, stage)
            page.evaluate('window.__debugPilot(2)')   # Populate evolved fields/shots after CombatLoad.reset.
            page.evaluate('clearInterval(window.__tabletDrive);window.__debugQuality(5)')
            if stage == 'CH13':
                page.evaluate('window.__debugFoam()')
            page.wait_for_timeout(500)
            page.evaluate('window.__debugLayerBench([],1)')
            page.wait_for_timeout(500)   # Warm asynchronous sprite/bitmap caches before timing.
            samples = []
            for _ in range(3):
                row = {layer: page.evaluate('off=>window.__debugLayerBench(off)', [] if layer=='all' else [layer]) for layer in ('all','zones','t4ground','skills','foam')}
                samples.append(row)
            median = {key: statistics.median(row[key] for row in samples) for key in samples[0]}
            results.append({'stage': stage, 'medianMs': median, 'samples': samples, 'errors': errors})
            print(f'layers {stage}: {median}', flush=True)
        finally:
            ctx.close()
    return results


def main():
    data = {'label': args.label, 'mode': args.mode, 'conditions': vars(args).copy(), 'commit': subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(), 'records': []}
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(headless=True, executable_path=chrome_path(), args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
            data['browser'] = b.version
            if args.mode == 'scenes':
                for dev in args.devices.split(','):
                    for rate in map(float,args.rates.split(',')):
                        for stage in args.stages.split(','):
                            for rep in range(1,args.reps+1):
                                data['records'].append(run_scene(b, stage, dev, rate, rep))
                                (OUT / f'{args.label}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            else:
                data['records'] = {'repeat': repeat, 'lobby': lobby, 'replay': replay, 'layers': layers}[args.mode](b)
            b.close()
    finally:
        (OUT / f'{args.label}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
