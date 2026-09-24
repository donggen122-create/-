# 장비 아이콘 24개 · 보급 상자 그림 가공(사용자 Gemini, 2026-09-24): 이미지 에셋/장비_*.png · 보급상자_*.png
#   → game/assets/sprites/gear/gear_<세트>_<칸>.png, game/assets/sprites/ui/supply_<part|gear>_<closed|lid|open>.png
# 처리는 cut_theme2.py와 같다(마젠타 크로마키 → 상자별로 잘라 덩어리 고르기 → 크기 맞춰 축소).
# 받은 그림 사정: 몇 장은 3줄로 나와 같은 물건이 한 번 더 있고(윗 두 줄만 씀), 민지 두 장은 물건 아래 영어 글자가 있다(글자 줄은 잘라 냄).
# 칸마다 배경이 달라(연분홍 칸·밝은 선) 장마다 키 방식·밴드를 따로 둔다. 오른쪽 아래 Gemini 반짝이는 지운다.
# 사용: python game/tools/cut_gear.py   (미리보기: game/assets_src/gear/preview_gear.png)
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
GEAR = ROOT / "game" / "assets" / "sprites" / "gear"
UI = ROOT / "game" / "assets" / "sprites" / "ui"
PREVIEW = ROOT / "game" / "assets_src" / "gear"
ICON = 160   # 아이콘 긴 변(화면 최대 76px × 2)
BOX = 300    # 보급 상자 긴 변(화면 약 150px × 2)
SLOTS = ["helm", "armor", "shoes", "gloves", "necklace", "weapon"]
WATERMARK = (870, 870, 940, 940)

def grid(rows, cols):
    """rows = [(y0, y1), ...] · cols = [(x0, x1), ...] → 칸 순서(투구·갑옷·신발 / 장갑·목걸이·무기)"""
    return [(x0, y0, x1, y1) for (y0, y1) in rows for (x0, x1) in cols]

# (원본, 세트 또는 상자 이름, 키(strict, 밴드), 지울 영역, [(출력, box, 모드, 최소 비율)])
C3 = [(8, 333), (349, 675), (691, 1016)]
SHEETS = [
    # 3×3(아래 줄은 같은 물건) → 윗 두 줄
    ("장비_호야_야구복.png", (False, (35, 150)), [WATERMARK],
     list(zip([f"gear_hoya_ranged_{s}.png" for s in SLOTS], grid([(20, 335), (345, 672)], C3), ["all"] * 6, [0.02] * 6))),
    # 물건 아래 영어 글자 → 글자 위까지만. 칸 사이 밝은 선은 키로 지워진다
    ("장비_민지_피구복.png", (True, (100, 180)), [WATERMARK],
     list(zip([f"gear_minji_ranged_{s}.png" for s in SLOTS], grid([(30, 312), (392, 636)], [(12, 338), (352, 674), (688, 1012)]), ["all"] * 6, [0.01] * 6))),
    # 연분홍 칸 3×3(아래 줄은 같은 물건) → 윗 두 줄
    ("장비_호야_교복.png", (False, (20, 100)), [WATERMARK],
     list(zip([f"gear_hoya_melee_{s}.png" for s in SLOTS], grid([(40, 336), (364, 660)], [(40, 336), (364, 660), (688, 984)]), ["all"] * 6, [0.02] * 6))),
    # 글자 아래(분홍 하트가 있어 min(R,B)-G 키)
    ("장비_민지_교복.png", (True, (60, 130)), [WATERMARK],
     list(zip([f"gear_minji_melee_{s}.png" for s in SLOTS], grid([(30, 348), (515, 805)], [(12, 338), (352, 674), (688, 1012)]), ["all"] * 6, [0.02] * 6))),
    # 2×2: 닫힌 상자 · 뚜껑 / (같은 상자) · 열린 상자. 열린 상자 위 분홍 빛은 키로 지운다
    ("보급상자_파츠.png", (True, (40, 100)), [WATERMARK],
     [("supply_part_closed.png", (20, 40, 505, 505), "largest", 0), ("supply_part_lid.png", (525, 110, 1000, 460), "largest", 0),
      ("supply_part_open.png", (525, 470, 1000, 965), "largest", 0)]),
    ("보급상자_장비.png", (True, (40, 100)), [WATERMARK],
     [("supply_gear_closed.png", (60, 60, 470, 480), "largest", 0), ("supply_gear_lid.png", (560, 160, 960, 420), "largest", 0),
      ("supply_gear_open.png", (560, 460, 980, 900), "largest", 0)]),
]

def cut(col, alpha, box, fit, mode, min_frac):
    x0, y0, x1, y1 = box
    a = alpha[y0:y1, x0:x1]; c = col[y0:y1, x0:x1]
    mask = a > 40
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=2))
    if n == 0: raise RuntimeError(f"빈 상자 {box}")
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = [int(np.argmax(sizes)) + 1] if mode == "largest" else [i + 1 for i, s in enumerate(sizes) if s >= min_frac * sizes.max()]
    sel = np.isin(lab, keep) & mask
    ys, xs = np.where(sel)
    frame = np.dstack([c, np.where(sel, a, 0)])[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    im = Image.fromarray(frame, "RGBA").convert("RGBa")
    k = fit / max(im.size)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS).convert("RGBA")

def main():
    GEAR.mkdir(parents=True, exist_ok=True); UI.mkdir(parents=True, exist_ok=True); PREVIEW.mkdir(parents=True, exist_ok=True)
    made = []
    for name, (strict, band), erase, cuts in SHEETS:
        rgb = np.asarray(Image.open(SRC / name).convert("RGB")).copy()
        for ex0, ey0, ex1, ey1 in erase: rgb[ey0:ey1, ex0:ex1] = (255, 0, 255)
        col, alpha = chroma_key(rgb, "magenta", band, strict_magenta=strict)
        for out, box, mode, frac in cuts:
            ui = out.startswith("supply_")
            im = cut(col, alpha, box, BOX if ui else ICON, mode, frac)
            path = (UI if ui else GEAR) / out
            # 256색으로 줄여 저장(화질 차이 없이 약 1/5 크기 — 학교 와이파이·태블릿)
            im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True); made.append((out, im))
            print(out, im.size, round(path.stat().st_size / 1024), "KB")
    # 미리보기: 체크 무늬 위에 전부
    cell = 190; cols = 6; rows = (len(made) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (255, 255, 255, 255))
    for y in range(0, rows * cell, 16):
        for x in range(0, cols * cell, 16):
            if (x // 16 + y // 16) % 2: sheet.paste((225, 225, 225, 255), (x, y, x + 16, y + 16))
    for i, (_, im) in enumerate(made):
        t = im.copy(); t.thumbnail((cell - 20, cell - 20))
        x = (i % cols) * cell + (cell - t.width) // 2; y = (i // cols) * cell + (cell - t.height) // 2
        sheet.alpha_composite(t, (x, y))
    sheet.convert("RGB").save(PREVIEW / "preview_gear.png")
    print("preview", PREVIEW / "preview_gear.png")

if __name__ == "__main__":
    main()
