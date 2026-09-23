# 환경 테마 1 「쓰레기 마을」 그림 가공: 이미지 에셋/테마 1단계 *.jpg, 아이템. 공용.jpg, 바닥 타일.jpg, 쓰레기산.jpg
#   → game/assets/sprites/t1/*.png (투명 PNG · 이어 붙는 바닥 타일)
# 처리: 마젠타 크로마키(JPEG라 띠 폭 넉넉히) → 상자(box)별로 잘라 가장 큰 덩어리(또는 전부) 채택 → 높이 맞춰 축소.
#       바닥은 Gemini 별 표식을 다른 곳 무늬로 덮고(patch), 반 칸 밀어 겹치는 방식으로 이어 붙게(seamless) 만든 뒤 448px로 축소.
# 사용: python game/tools/cut_theme1.py   (미리보기: game/assets_src/theme1/preview_t1.png)
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "t1"
PREVIEW = ROOT / "game" / "assets_src" / "theme1"
TILE = 448

# (파일, 키 밴드, 지울 영역 목록, 잘라낼 것들[(출력 이름, box, 출력 높이, 모드, 최소 크기 비율)])
# 모드 largest = 상자 안에서 가장 큰 덩어리 하나(번호·글자·잡티 제거), all = 최소 비율 이상 덩어리 전부(연기·흩어진 조각 유지)
SHEETS = [
    ("테마 1단계 소품.jpg", (35, 150), [(870, 870, 960, 960)], [
        ("prop_bins.png",       (30, 40, 630, 580),  200, "largest", 0),
        ("prop_bin_fallen.png", (650, 50, 1000, 350), 150, "all", 0.02),
        ("prop_bags.png",       (660, 370, 1000, 650), 140, "largest", 0),
        ("prop_tire.png",       (30, 680, 330, 960), 120, "largest", 0),
        ("prop_bench.png",      (330, 620, 680, 970), 150, "largest", 0),
        ("prop_litter.png",     (700, 700, 1000, 960), 120, "all", 0.03),
    ]),
    ("테마 1단계 적.jpg", (35, 150), [(870, 870, 960, 960)], [
        ("en_snackbag.png",  (30, 60, 360, 440),  160, "largest", 0),
        ("en_buttbug.png",   (365, 60, 700, 440), 160, "largest", 0),
        ("en_bottle.png",    (700, 60, 1000, 440), 160, "largest", 0),
        ("en_baggy.png",     (30, 560, 360, 905), 160, "largest", 0),
        ("en_foodwaste.png", (365, 560, 740, 905), 160, "largest", 0),
        ("en_fly.png",       (740, 560, 1000, 900), 160, "largest", 0),
    ]),
    ("테마 1단계 보스.jpg", (35, 150), [], [
        ("boss_calm.png",  (10, 20, 500, 566),  300, "all", 0.02),
        ("boss_angry.png", (500, 20, 1014, 566), 300, "all", 0.02),
    ]),
    ("아이템. 공용.jpg", (20, 90), [], [
        ("item_sprout.png",     (55, 55, 340, 340),  64, "largest", 0),
        ("item_sprout_big.png", (375, 55, 655, 340), 64, "largest", 0),
        ("item_recycle.png",    (690, 55, 975, 340), 64, "largest", 0),
        ("item_heart.png",      (55, 370, 340, 655), 64, "largest", 0),
        ("item_orb.png",        (375, 370, 655, 655), 64, "largest", 0),
        ("item_star.png",       (690, 370, 975, 655), 64, "largest", 0),
    ]),
]
# (파일, 출력 이름, 별 표식 덮기 [(덮을 상자, 가져올 위치)])
TILES = [
    ("테마 1단계 흙.jpg", "floor_dirt.png", [((860, 860, 960, 960), (300, 300))]),
    ("바닥 타일.jpg", "floor_concrete.png", [((860, 860, 960, 960), (300, 300))]),
    ("쓰레기산.jpg", "floor_trash.png", [((860, 860, 960, 960), (300, 300))]),
]


def cut(col, alpha, box, out_h, mode, min_frac):
    x0, y0, x1, y1 = box
    a = alpha[y0:y1, x0:x1]; c = col[y0:y1, x0:x1]
    mask = a > 40
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=2))
    if n == 0: raise RuntimeError(f"빈 상자 {box}")
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    if mode == "largest": keep = [int(np.argmax(sizes)) + 1]
    else: keep = [i + 1 for i, s in enumerate(sizes) if s >= min_frac * sizes.max()]
    sel = np.isin(lab, keep) & mask
    ys, xs = np.where(sel)
    by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    frame = np.dstack([c, np.where(sel, a, 0)])[by0:by1, bx0:bx1]
    im = Image.fromarray(frame, "RGBA").convert("RGBa")
    scale = out_h / im.height
    im = im.resize((max(1, round(im.width * scale)), out_h), Image.LANCZOS).convert("RGBA")
    return im


def make_tile(name, out_name, patches):
    arr = np.asarray(Image.open(SRC / name).convert("RGB")).astype(np.float32)
    h, w = arr.shape[:2]
    for (bx0, by0, bx1, by1), (sx, sy) in patches:
        arr[by0:by1, bx0:bx1] = arr[sy:sy + (by1 - by0), sx:sx + (bx1 - bx0)]
    # 반 칸 민 그림(경계가 원래 그림의 한가운데라 이어짐)을 가장자리 띠(12%)에서만 섞는다 → 상하좌우로 이어 붙어도 티가 안 남
    sh = np.roll(np.roll(arr, h // 2, axis=0), w // 2, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    band = 0.12
    dx = np.minimum(xx, w - 1 - xx) / (band * w); dy = np.minimum(yy, h - 1 - yy) / (band * h)
    wgt = (1 - np.clip(np.minimum(dx, dy), 0, 1))[..., None]
    out = arr * (1 - wgt) + sh * wgt
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((TILE, TILE), Image.LANCZOS)
    im.save(OUT / out_name, optimize=True)
    print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True); PREVIEW.mkdir(parents=True, exist_ok=True)
    made = []
    for name, band, erase, cuts in SHEETS:
        rgb = np.asarray(Image.open(SRC / name).convert("RGB"))
        col, alpha = chroma_key(rgb, "magenta", band, strict_magenta=True)
        for x0, y0, x1, y1 in erase: alpha[y0:y1, x0:x1] = 0
        for out_name, box, out_h, mode, min_frac in cuts:
            im = cut(col, alpha, box, out_h, mode, min_frac)
            im.save(OUT / out_name, optimize=True)
            made.append((out_name, im))
            print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")
    for name, out_name, patches in TILES: make_tile(name, out_name, patches)
    # 미리보기: 회색 바탕에 잘라낸 것 전부 + 타일 3장(2×2 반복으로 이어짐 확인)
    cell = 170; cols = 6
    rows = (len(made) + cols - 1) // cols
    pv = Image.new("RGBA", (cols * cell, rows * cell + TILE + 10), (90, 90, 100, 255))
    for i, (n, im) in enumerate(made):
        t = im.copy(); t.thumbnail((cell - 10, cell - 10))
        pv.alpha_composite(t, ((i % cols) * cell + (cell - t.width) // 2, (i // cols) * cell + (cell - t.height) // 2))
    for j, (_, out_name, _) in enumerate(TILES):
        tile = Image.open(OUT / out_name).convert("RGBA").resize((TILE // 2, TILE // 2), Image.LANCZOS)
        for a in range(2):
            for b in range(2):
                pv.alpha_composite(tile, (j * (TILE // 2 * 2 + 10) + a * (TILE // 2), rows * cell + 10 + b * (TILE // 2)))
    pv.convert("RGB").save(PREVIEW / "preview_t1.png")
    print("preview:", PREVIEW / "preview_t1.png")


if __name__ == "__main__":
    main()
