"""D-only wrappers: original QA tools remain untouched; all traffic is local."""
import argparse, json, re, sys, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / 'game/tools/qa'
OUT = ROOT / 'docs/codex/measurements/D'
sys.path.insert(0, str(QA))
ap = argparse.ArgumentParser()
ap.add_argument('mode', choices=['loading', 'loading4', 'chapter', 'replay', 'inventory', 'responsive1', 'responsive2', 'single'])
ap.add_argument('--label', default='D-before')
args = ap.parse_args()
OUT.mkdir(parents=True, exist_ok=True)
if args.mode == 'inventory':
    files = [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size,
              'format': p.suffix.lower()} for p in sorted((ROOT/'game/assets').rglob('*')) if p.is_file()]
    formats = {}
    for row in files:
        g = formats.setdefault(row['format'], {'files': 0, 'bytes': 0})
        g['files'] += 1; g['bytes'] += row['bytes']
    sources = list((ROOT/'game/src').glob('*.js')) + list((ROOT/'game/src').glob('*.css')) + [ROOT/'game/index.html'] + list((ROOT/'game/admin').glob('*'))
    refs = {}
    for src in sources:
        if not src.is_file(): continue
        text = src.read_text(encoding='utf-8')
        # Discard comments so source attribution and example paths do not count as use.
        text = re.sub(r'^\s*//.*$', '', text, flags=re.M)
        patterns = re.findall(r'(?:\./|\.\./|["\x27`])assets/((?:\$\{[^}]+\}|[^"\x27`\s<>])+?\.(?:png|jpe?g|webp|svg))', text)
        for base, folder in [('IMG_BASE','sprites'),('UI_BASE','ui')]:
            patterns += [folder+'/'+p for p in re.findall(base+r'\s*\+\s*["\x27]([^"\x27]+)["\x27]', text)]
        if src.name == 'ui2-art.js':
            patterns += ['ui2/'+p for p in re.findall(r"'([^']+\.(?:png|webp))'", text)]
        for pattern in patterns:
            # Dynamic expressions expand against actual files; union ternary choices, never invent files.
            pieces = re.split(r'(\$\{[^}]+\})', pattern)
            regex = ''.join('(?:ui2|sprites)' if piece.startswith('${isUI2') else '[^/]+' if piece.startswith('${') else re.escape(piece) for piece in pieces)
            for row in files:
                rel = row['path'].removeprefix('game/assets/')
                if re.fullmatch(regex, rel): refs.setdefault(row['path'], []).append(src.relative_to(ROOT).as_posix())
    result = {'commit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
              'formats': formats, 'files': files, 'references': refs,
              'unreferenced': [r for r in files if r['format'] in ['.png','.jpg','.jpeg','.webp','.svg'] and r['path'] not in refs],
              'method': 'Static literals plus existing-file expansion of dynamic asset path templates; all runtime JS, CSS, index and admin scanned. Dynamic expansion is conservative, not a proof every file is requested.'}
    (OUT/f'inventory-{args.label}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'formats':formats,'referenced':len(refs),'unreferenced':len(result['unreferenced'])}))
    sys.exit()
name = {'loading':'loading-audit.py','loading4':'loading-audit.py','chapter':'chapter-loading-audit.py','replay':'tablet-perf.py','responsive1':'responsive-audit.py','responsive2':'responsive-audit.py','single':'single-loading-smoke.py'}[args.mode]
file = QA/name
source = file.read_text(encoding='utf-8')
if args.mode in ['loading','loading4']:
    # Same seeded card offers and server profile before each cold-context login, before and after.
    source = source.replace('    page=ctx.new_page();', '    ctx.add_init_script("let s=10808;Math.random=()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};")\n    page=ctx.new_page();')
    source = source.replace("    measure('title',", "    page.request.post(BASE+'/_qa/reset-attempts')\n    page.request.post(BASE+'/api/register',data={'id':'qaload','pw':'qa_local_1234'})\n    assert page.request.post(BASE+'/_qa/profile',data={'id':'qaload','profile':fresh},max_retries=2).ok\n    measure('title',")
    if args.mode == 'loading4':
        source = source.replace("stages={})", "stages={f'CH{i:02}': {'cleared':True,'stars':3} for i in range(1,21)})")
        source = source.replace('def depart():', 'def depart():\n        page.evaluate(\'()=>{window.__sgUI.chapter="4";window.__sgUI.stage="CH16";window.__sgUI.chapterPicked=true;window.__sgUI.render()}\')')
    sys.argv = [str(file),'--url','http://localhost:8797/?ui=2','--label',args.label+('-chapter4' if args.mode=='loading4' else ''),'--prefix','D','--out',str(OUT)]
elif args.mode == 'chapter':
    source = source.replace("measurements/B/chapter-loading.json", "measurements/D/chapter-loading.json")
    # The original failure/retry test targets the floor path which was converted.
    ext = 'webp' if (ROOT/'game/assets/sprites/t1/floor_dirt.webp').exists() else 'png'
    source = source.replace('t1/floor_dirt.png', 't1/floor_dirt.'+ext)
    sys.argv = [str(file)]
elif args.mode.startswith('responsive'):
    sys.argv=[str(file),'--url','http://localhost:8797'+('/?ui=2' if args.mode=='responsive2' else ''),'--out',str(OUT/args.mode),'--sizes','1280x720,1280x800,1024x768,820x1180,768x1024,375x667,360x640','--shots','']
elif args.mode=='single':
    source=source.replace('measurements/B/single-smoke.json','measurements/D/single-smoke.json')
    sys.argv=[str(file)]
else:
    # Reference JS expects its original PNG/JPG. Serve exact committed bytes through Playwright,
    # not the converted current files, and do not check out or mutate another branch.
    hook = '''
    if ref:
        if not reference_images:
            names = subprocess.check_output(['git','ls-tree','-r','--name-only',ref,'game/assets'],cwd=ROOT,text=True).splitlines()
            names=[name for name in names if name.endswith(('.png','.jpg','.jpeg'))]
            data=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=(''.join(ref+':'+name+'\\n' for name in names)).encode())
            offset=0
            for name in names:
                end=data.index(b'\\n',offset); size=int(data[offset:end].split()[-1]); offset=end+1
                reference_images[name]=data[offset:offset+size]; offset+=size+1
        def reference_asset(route):
            name='game/'+urlsplit(route.request.url).path.lstrip('/')
            body=reference_images.get(name)
            if body is None: return route.fallback()
            route.fulfill(body=body,content_type='image/png' if name.endswith('.png') else 'image/jpeg')
        ctx.route(BASE+'/assets/**',reference_asset)
'''
    source = source.replace('def context(b,', 'reference_images = {}\nreference_source = {}\n\ndef context(b,')
    source = source.replace("            content = subprocess.check_output(['git', 'show', f'{ref}:{name}'], cwd=ROOT)", "            content = reference_source[name] if name in reference_source else subprocess.check_output(['git', 'show', f'{ref}:{name}'], cwd=ROOT)\n            reference_source[name] = content")
    source = source.replace('    source_routes(ctx, ref)', '    source_routes(ctx, ref)'+hook)
    sys.argv = [str(file),'--url','http://localhost:8797/?ui=2','--label',args.label,'--mode','replay','--reference','90926db','--account','qad','--out',str(OUT/'replay')]
exec(compile(source,str(file),'exec'), {'__file__':str(file),'__name__':'__main__'})
for p in OUT.rglob('*.json'):
    p.write_text(p.read_text(encoding='utf-8'),encoding='utf-8',newline='\n')
