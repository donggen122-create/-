"""Make the 160x160 transparent story portraits in game/assets/story (Pillow + numpy).

Two kinds of source, both read-only:
  CROPS    - a face cut out of existing game art (bosses, friends). Coordinates are source pixels.
  MASTERS  - 1024px portraits drawn on a white background by Codex's image model
             (docs/codex/art). The white background is removed here.

White removal: a pixel is background only when ALL three channels are near 255, so skin and
pale colours stay opaque (use max over channels; an earlier min/int16 version made faces transparent),
and only white connected to the picture edge is removed.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'game/assets/story'
ART = ROOT / 'docs/codex/art'
CROPS = {
    'otter': ('seoho_v1/pets/otter_idle.webp', (355, 105, 1015, 765)),
    'sparrow': ('seoho_v1/pets/sparrow_idle.webp', (345, 172, 1003, 830)),
    'cat': ('seoho_v1/pets/cat_idle.webp', (423, 110, 1144, 831)),
    'boss1-angry': ('sprites/t1/boss_angry.webp', (60, 15, 240, 195)),
    'boss1-calm': ('sprites/t1/boss_calm.webp', (56, 15, 236, 195)),
    'boss2-angry': ('sprites/t2/boss_angry.webp', (49, 22, 229, 202)),
    'boss2-calm': ('sprites/t2/boss_calm.webp', (30, 45, 210, 225)),
    'boss-angry': ('sprites/t3/boss_angry.webp', (54, 30, 230, 206)),
    'boss-calm': ('sprites/t3/boss_calm.webp', (48, 20, 228, 200)),
}
MASTERS = {
    'hoya': '호야_초상_1024_codex.png',
    'minji': '민지_초상_1024_codex.png',
    'frog': '개굴이_1024_codex.png',
    'guard': '경비아저씨_초상_1024_codex.png',
    'crow': '까마귀_초상_1024_codex.png',
}


def cut_white(path):
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.int32)
    dist = np.maximum.reduce([255 - rgb[..., 0], 255 - rgb[..., 1], 255 - rgb[..., 2]])
    # Only white that is connected to the picture edge is background: eye whites, teeth and
    # shirt collars inside the outline stay opaque.
    mask = Image.fromarray(np.where(dist < 40, 255, 0).astype(np.uint8), 'L').copy()   # copy: fromarray images are read-only, floodfill would do nothing
    h, w = dist.shape
    for x, y in [(x, y) for x in range(0, w, 8) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 8) for x in (0, w - 1)]:
        if mask.getpixel((x, y)) == 255:
            ImageDraw.floodfill(mask, (x, y), 128)
    near_bg = np.array(Image.fromarray(np.where(np.array(mask) == 128, 255, 0).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(5))) > 0
    ramp = np.clip((dist - 10) * 255 // 30, 0, 255)
    alpha = np.where(near_bg, ramp, 255).astype(np.uint8)
    out = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')
    x0, y0, x1, y1 = out.getchannel('A').getbbox()
    side = max(x1 - x0, y1 - y0)
    side += 2 * int(side * 0.04)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(out.crop(box), (0, 0))
    return canvas.resize((160, 160), Image.Resampling.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (source, box) in CROPS.items():
        im = Image.open(ROOT / 'game/assets' / source).convert('RGBA')
        im.crop(box).resize((160, 160), Image.Resampling.LANCZOS).save(OUT / f'{name}.png', optimize=True)
    for name, source in MASTERS.items():
        if (ART / source).exists():
            cut_white(ART / source).save(OUT / f'{name}.png', optimize=True)
        else:
            print('missing master:', source)
    print(f'{len(CROPS) + len(MASTERS)} portraits: {OUT}')


if __name__ == '__main__':
    main()
