"""Reproduce six story portraits from read-only original artwork (Pillow).

Coordinates are source pixels, manually chosen around the face. Outputs always
stay in assets/story; no original sprite or generated AI image is modified.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'game/assets/story'
# Otter is one full illustration, not a sprite strip: its first/only frame.
CROPS = {
    'hoya': ('sprites/heroes/hoya_idle_1.png', (37, 28, 96, 87)),
    'minji': ('sprites/heroes/minji_idle_1.png', (28, 28, 103, 103)),
    'otter': ('seoho_v1/pets/otter_idle.png', (355, 105, 1015, 765)),
    'boss-angry': ('sprites/t3/boss_angry.png', (54, 30, 230, 206)),
    'boss-calm': ('sprites/t3/boss_calm.png', (48, 20, 228, 200)),
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (source, box) in CROPS.items():
        im = Image.open(ROOT / 'game/assets' / source).convert('RGBA')
        im = im.crop(box).resize((160, 160), Image.Resampling.LANCZOS)
        im.save(OUT / f'{name}.png', optimize=True)
    im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw.ellipse((6, 6, 153, 153), fill='#78b751')
    font = ImageFont.truetype(str(ROOT / 'game/assets_src/fonts/Jua-Regular.ttf'), 34)
    draw.text((80, 80), '개굴이', font=font, fill='white', anchor='mm')
    im.save(OUT / 'frog.png', optimize=True)
    print(f'6 portraits: {OUT}')


if __name__ == '__main__':
    main()
