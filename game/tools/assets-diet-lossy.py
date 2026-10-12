"""Second WebP pass (Claude, 2026-10-12) over the PNG/JPG files that assets-diet.py retained.

D kept 308 referenced files as PNG because Chromium's canvas output was not bit-identical
(premultiplied-alpha rounding) or lossless saved < 20%. This pass judges what a player can see:
  - lossless WebP (hidden RGB under alpha=0 discarded, alpha exact) when it saves >= 20%
  - otherwise, for files >= --min-bytes, lossy q90 then q95 when the PREMULTIPLIED RGBA
    difference stays small (max channel delta <= 24, mean <= 1.0, alpha max delta <= 2)
  - otherwise keep the PNG/JPG.
Usage: python game/tools/assets-diet-lossy.py [--apply] [--min-bytes 100000]
  dry run prints the plan; --apply writes .webp, deletes the original, removes the entry from
  IMAGE_FORMAT_EXCEPTIONS in game/src/assets.js and writes docs/codex/measurements/D/convert-claude.json
"""
import argparse, io, json, re, sys
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
ASSETS_JS = ROOT / 'game/src/assets.js'
REPORT = ROOT / 'docs/codex/measurements/D/convert-claude.json'
ENTRY = re.compile(r'^\s*"(assets/[^"]+\.webp)":\s*"(assets/[^"]+\.(?:png|jpg))",\s*$', re.M)


def premultiplied(im):
    rgba = im.convert('RGBA')
    a = rgba.getchannel('A')
    return Image.merge('RGB', [ImageChops.multiply(rgba.getchannel(c), a) for c in 'RGB']), a


def visible_diff(original, decoded):
    o_rgb, o_a = premultiplied(original)
    d_rgb, d_a = premultiplied(decoded)
    rgb = ImageChops.difference(o_rgb, d_rgb)
    alpha = ImageChops.difference(o_a, d_a)
    hist = rgb.histogram()
    pixels = rgb.width * rgb.height
    mean = sum(i * hist[c * 256 + i] for c in range(3) for i in range(256)) / (pixels * 3)
    return {'max': max(v[1] for v in rgb.getextrema()), 'mean': round(mean, 4), 'alphaMax': alpha.getextrema()[1]}


def encode(im, lossless, quality):
    buf = io.BytesIO()
    im.save(buf, format='WEBP', lossless=lossless, quality=quality, method=6, exact=False)
    return buf.getvalue()


def plan_one(src_path, min_bytes):
    before = src_path.stat().st_size
    with Image.open(src_path) as im:
        im.load()
        has_alpha = im.mode in ('RGBA', 'LA', 'P') and (im.mode != 'P' or 'transparency' in im.info)
        work = im.convert('RGBA') if has_alpha else im.convert('RGB')
        attempts = []
        for lossless, q in ((True, 100), (False, 90), (False, 95)):
            if not lossless and before < min_bytes:
                break
            data = encode(work, lossless, q)
            with Image.open(io.BytesIO(data)) as dec:
                dec.load()
                diff = visible_diff(work, dec) if has_alpha else visible_diff(work.convert('RGBA'), dec.convert('RGBA'))
            rec = {'lossless': lossless, 'quality': q, 'bytes': len(data), **diff}
            attempts.append(rec)
            ok = (len(data) <= before * 0.8) and diff['alphaMax'] <= 2 and (diff['max'] == 0 if lossless else diff['max'] <= 24 and diff['mean'] <= 1.0)
            if ok:
                return {'status': 'convert', 'before': before, 'after': len(data), 'chosen': rec, 'attempts': attempts}, data
        return {'status': 'keep', 'before': before, 'after': before, 'attempts': attempts}, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--min-bytes', type=int, default=100000)
    ap.add_argument('--only', nargs='*', default=[], help='limit to paths containing these substrings')
    args = ap.parse_args()
    source = ASSETS_JS.read_text(encoding='utf-8')
    entries = ENTRY.findall(source)
    results, total_before, total_after, removed = [], 0, 0, []
    for webp_rel, orig_rel in entries:
        if args.only and not any(s in orig_rel for s in args.only):
            continue
        src = ROOT / 'game' / orig_rel
        if not src.exists():
            results.append({'source': orig_rel, 'status': 'missing'}); continue
        rec, data = plan_one(src, args.min_bytes)
        rec['source'] = orig_rel; rec['webp'] = webp_rel
        results.append(rec)
        total_before += rec['before']; total_after += rec['after']
        if rec['status'] == 'convert' and args.apply:
            (ROOT / 'game' / webp_rel).write_bytes(data)
            src.unlink()
            removed.append((webp_rel, orig_rel))
    if args.apply and removed:
        keep = {w for w, _ in removed}
        source = ENTRY.sub(lambda m: '' if m.group(1) in keep else m.group(0), source)
        source = re.sub(r'\n\n+(?=\s*")', '\n', source)  # drop blank lines left inside the map
        ASSETS_JS.write_text(source, encoding='utf-8', newline='\n')
        # Literal references ("t2/floor_steel.png", "./assets/seoho_v1/pets/cat_idle.png", CSS url()) -> .webp
        needles = {}
        for _, orig_rel in removed:
            parts = orig_rel.split('/')
            needles[f"{parts[-2]}/{parts[-1]}"] = f"{parts[-2]}/{Path(parts[-1]).stem}.webp"
        touched = {}
        for f in [*(ROOT / 'game/src').glob('*.js'), *(ROOT / 'game/src').glob('*.css'), ROOT / 'game/index.html',
                  *(ROOT / 'game/admin').glob('*.html'), *(ROOT / 'game/admin').glob('*.js')]:
            text = f.read_text(encoding='utf-8')
            new = text
            for old, rep in needles.items():
                new = new.replace(old, rep)
            if new != text:
                f.write_text(new, encoding='utf-8', newline='\n')
                touched[str(f.relative_to(ROOT))] = sum(text.count(o) for o in needles)
        sys.stdout.write('reference rewrites: ' + json.dumps(touched) + '\n')
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        REPORT.write_text(json.dumps({'policy': __doc__.strip().splitlines()[0], 'minBytes': args.min_bytes, 'files': results}, ensure_ascii=False, indent=1), encoding='utf-8')
    conv = [r for r in results if r['status'] == 'convert']
    out = sys.stdout
    for r in sorted(conv, key=lambda r: -r['before'])[:30]:
        c = r['chosen']
        out.write(f"{r['before']:>9} -> {r['after']:>8}  {'lossless' if c['lossless'] else 'q'+str(c['quality']):<8} max {c['max']:>2} mean {c['mean']:<6} a {c['alphaMax']}  {r['source']}\n")
    kept = [r for r in results if r['status'] == 'keep']
    out.write(f"convert {len(conv)} files: {sum(r['before'] for r in conv)} -> {sum(r['after'] for r in conv)} bytes; keep {len(kept)} files ({sum(r['before'] for r in kept)} bytes); all retained before {total_before} after {total_after}\n")
    if args.apply:
        out.write(f"applied: wrote {len(removed)} webp files, removed their originals and map entries\n")


if __name__ == '__main__':
    main()
