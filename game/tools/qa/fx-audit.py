# 스킬 효과 점검(2026-09-24 사용자 "스킬 이펙트 중에서 너무 과하거나 화면을 가리는 경우가 없는지"):
# 파츠 전설·큰 물통(범위 +50%)·번개 배터리 최대인 가장 센 상태로 스킬·진화를 하나씩(그리고 늦은 판 4진화 묶음) 켜고
# 적 무리 속에서 같은 순간을 효과 켜고/끄고 그려 비교한다(main.js __debugFxAudit).
#  - cover: 효과가 바꾼 화면 비율 · near: 주인공 둘레 3칸 중 바뀐 비율 · hero: 주인공 그림 중 바뀐 비율(heavy = 거의 덮임) · white: 번쩍여 하얘진 화면 비율
# 사용: python game/tools/qa/fx-audit.py [--url http://localhost:8797] [--sizes 1280x720,375x667] [--only F1,EVO_F1] [--samples 16]
import argparse, json, os, random, statistics, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:8797')
ap.add_argument('--out', default=str(ROOT / 'game/tools/qa/out/fx-audit'))
ap.add_argument('--sizes', default='1280x720,375x667')
ap.add_argument('--only', default='')
ap.add_argument('--samples', type=int, default=10)
ap.add_argument('--stage', default='CH03')
ap.add_argument('--no-ghost', action='store_true', help='효과 위 주인공 겹쳐 그리기를 끄고 잰다(예전 모습과 비교)')
args = ap.parse_args()
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
EXE = os.environ.get('CHROME_PATH') or ('/opt/pw-browsers/chromium-1194/chrome-linux/chrome' if Path('/opt/pw-browsers/chromium-1194/chrome-linux/chrome').exists() else None)
fresh = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import {freshProfile} from './game/src/rework-core.js';console.log(JSON.stringify(freshProfile()));"], cwd=ROOT))

SKILLS = ['F1', 'F2', 'W1', 'W2', 'V1', 'V2', 'E1', 'E2', 'L1', 'L2']
SCENARIOS = [('weapon-ranged', [], 'ranged'), ('weapon-melee', [], 'melee')] + [(s, [s], 'ranged') for s in SKILLS] + [('EVO_' + s, ['EVO_' + s], 'ranged') for s in SKILLS] + [
    ('late-A', ['EVO_F1', 'EVO_F2', 'EVO_L1', 'EVO_W2'], 'ranged'),
    ('late-B', ['EVO_V2', 'EVO_E1', 'EVO_L2', 'EVO_W1'], 'melee'),
    ('late-C', ['EVO_E2', 'EVO_V1', 'EVO_F1', 'EVO_L1'], 'ranged'),
]
if args.only: SCENARIOS = [s for s in SCENARIOS if s[0] in args.only.split(',')]

def super_profile():
    import copy
    p = copy.deepcopy(fresh)
    parts = ['PART_' + s for s in SKILLS]
    p.update(difficulty='normal', weaponMode='ranged', coins=999999, gifts=99, training={'attack': 100, 'hp': 100, 'speed': 60},
             milestones={'firstPart': True, 'firstPet': True, 'bossPet': True}, pets=['otter'], activePet='otter', friendship=28,
             stages={f'CH{i:02d}': {'cleared': True, 'stars': 3} for i in range(1, 11)},
             parts={x: {'copies': 80, 'level': 10} for x in parts}, equippedParts=parts[:3])
    return p

def quiet(page):
    q = 0
    while q < 3:
        page.wait_for_timeout(300)
        if page.locator('dialog[open]').count():
            q = 0
            try: page.locator('dialog[open] [data-close], dialog[open] button').first.click(timeout=2000)
            except Exception: page.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        else: q += 1

def enter_run(page, W, H):
    uid = f'qafx{W}{random.randint(10, 99)}'[:12]
    page.goto(args.url, wait_until='networkidle')
    page.locator('#login-id').fill(uid); page.locator('#login-pw').fill('qa_local_1234'); page.locator('#btn-register').click()
    page.locator('#btn-title-start').wait_for(state='visible')
    assert page.request.post(args.url + '/_qa/profile', data={'id': uid, 'profile': super_profile()}).ok
    page.wait_for_function("!document.querySelector('#btn-title-start').disabled")
    page.evaluate("document.getElementById('btn-title-start').click()"); page.locator('#guardian-lobby .sg-nav').wait_for(); quiet(page)
    page.locator('.sg-nav [data-tab="adventure"]').click(); page.wait_for_timeout(200); quiet(page)
    page.locator(f'.sg-chapter-chip[data-chapter="{(int(args.stage[2:]) - 1) // 5 + 1}"]').click(); page.wait_for_timeout(200)
    page.locator(f'[data-stage="{args.stage}"]').click(); page.wait_for_timeout(200); page.locator('#sg-start').click(); page.locator('#levelup:not(.hidden)').wait_for()
    page.evaluate("window.__debugGod=true")
    if args.no_ghost: page.evaluate("window.__debugNoGhost(true)")

def run_size(b, W, H, report):
    touch = W < 1100
    ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 700, has_touch=touch, device_scale_factor=1)
    page = ctx.new_page(); errs = []
    page.on('pageerror', lambda e: errs.append(str(e)))
    enter_run(page, W, H)
    rec = report.setdefault(f'{W}x{H}', {})
    for name, ids, mode in SCENARIOS:
        page.evaluate("([ids,mode])=>window.__sgCombatLoad(ids,{weaponMode:mode},{S5:3,S1:3})", [ids, mode])
        page.evaluate("window.__debugSim(1.5)")
        frames, best = [], -1
        for k in range(args.samples):
            page.evaluate("()=>{if(window.__sgSnapshot().enemies<34)window.__debugSpawn(['T1_SNACKBAG','T1_BOTTLE','T1_BUTTBUG'][Math.floor(Math.random()*3)],14,260)}")
            page.evaluate("window.__debugSim(0.27)")
            f = page.evaluate("window.__debugFxAudit()")
            frames.append(f)
            if f['cover'] + f['hero'] > best:
                best = f['cover'] + f['hero']; page.screenshot(path=str(OUT / f'{W}x{H}-{name}.png'))
        agg = {}
        for key in ['cover', 'near', 'hero', 'heavy', 'white']:
            vals = [f[key] for f in frames]
            agg[key] = {'avg': round(statistics.mean(vals), 1), 'max': round(max(vals), 1)}
        agg['layers'] = {L: {key: round(statistics.mean(f['layers'][L][key] for f in frames), 1) for key in ['cover', 'near', 'hero', 'heavy', 'white']} for L in frames[0]['layers']}
        rec[name] = agg
        print(f"{W}x{H} {name:14s} cover {agg['cover']['avg']:5.1f}/{agg['cover']['max']:5.1f}  near {agg['near']['avg']:5.1f}/{agg['near']['max']:5.1f}  hero {agg['hero']['avg']:5.1f}/{agg['hero']['max']:5.1f} heavy {agg['heavy']['avg']:5.1f}/{agg['heavy']['max']:5.1f}  white {agg['white']['avg']:4.1f}/{agg['white']['max']:4.1f}", flush=True)
    rec['_pageErrors'] = errs
    ctx.close()

def main():
    report = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, executable_path=EXE, args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
        for s in args.sizes.split(','):
            W, H = map(int, s.split('x'))
            run_size(b, W, H, report)
        b.close()
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
