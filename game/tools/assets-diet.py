"""Reproducible, idempotent PNG/JPG diet. No source deletion: git rm is a reviewed step.

python game/tools/assets-diet.py
python game/tools/assets-diet.py --force-lossless game/assets/sprites/t1/floor_dirt.png
Original committed bytes remain accessible without checkout for replay-driven lossless fallback.
"""
import argparse, hashlib, json, subprocess
from io import BytesIO
from pathlib import Path
from PIL import Image, __version__
from cut_webp import encode_webp

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'docs/codex/measurements/D/convert.json'
BASELINE = ROOT/'docs/codex/measurements/D/inventory-D-before.json'


def digest(data): return hashlib.sha256(data).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--force-lossless', nargs='*', default=[])
    args = ap.parse_args()
    inventory = json.loads(BASELINE.read_text(encoding='utf-8'))
    old = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    prior = {r['source']: r for r in old.get('files', [])}
    force = set(args.force_lossless)
    allowed = {r['path'] for r in inventory['files'] if r['format'] in ['.png','.jpg','.jpeg'] and r['path'] in inventory['references'] and not r['path'].startswith('game/assets/story/')}
    if force - allowed: raise ValueError(f'Outside conversion scope: {force-allowed}')
    rows = []
    for info in inventory['files']:
        name = info['path']
        if info['format'] not in ['.png','.jpg','.jpeg']: continue
        src = ROOT/name; dest = src.with_suffix('.webp')
        if name not in allowed:
            rows.append({'source':name,'beforeBytes':info['bytes'],'afterBytes':info['bytes'],'status':'excluded','reason':'story or unreferenced; left untouched'})
            continue
        cached = prior.get(name)
        if cached and name not in force:
            target = dest if cached['status']=='converted' else src
            if target.exists() and digest(target.read_bytes()) == cached['outputSha256']:
                rows.append(cached); continue
            raise ValueError(f'Output changed outside tool: {target}')
        data = src.read_bytes() if src.exists() else subprocess.check_output(['git','show',inventory['commit']+':'+name],cwd=ROOT)
        lossy = name not in force and (info['format'] in ['.jpg','.jpeg'] or '/elements_v2/fx/' in name or '/elements_v2/weapons/' in name or '/pets/' in name and '_idle' in name or '/floor_' in name)
        with Image.open(BytesIO(data)) as im:
            encoded, stats = encode_webp(im, lossy)
            dimensions = list(im.size)
        converted = len(encoded) <= len(data)*.8
        if name in force and not converted:
            # The path family may already point at WebP. Restoring PNG then requires code changes.
            raise ValueError(f'Lossless fallback saves less than 20%: {name}')
        if converted: dest.write_bytes(encoded)
        row = {'source':name,'target':dest.relative_to(ROOT).as_posix() if converted else name,
               'status':'converted' if converted else 'retained','beforeBytes':len(data),
               'afterBytes':len(encoded) if converted else len(data), 'dimensions':dimensions,
               'sourceSha256':digest(data),'outputSha256':digest(encoded if converted else data),
               'reason':'replay tolerance fallback' if name in force else '20% threshold', **stats}
        if name in force and cached:
            row['initialDecision'] = cached.get('initialDecision', cached)
        rows.append(row)
        print(name, row['status'], row['beforeBytes'], row['afterBytes'], flush=True)
    result = {'baselineCommit':inventory['commit'],'pillow':__version__,'policy':'lossless exact method=6; large candidates q90 then q95 if max RGBA delta>24, then lossless; save >=20%; unreferenced/story untouched', 'files':rows}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')


if __name__ == '__main__': main()
