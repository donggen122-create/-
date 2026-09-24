# 환경 테마 2 「대기오염 — 오염된 공장 지대」 그림 가공(사용자 Gemini, 2026-09-24): 이미지 에셋/*_02*.png → game/assets/sprites/t2/*.png
# 처리는 cut_theme1.py와 같다(마젠타 크로마키 → 상자별로 잘라 덩어리 고르기 → 높이 맞춰 축소, 바닥은 별 표식 덮고 이어 붙게).
# 사용: python game/tools/cut_theme2.py   (미리보기: game/assets_src/theme2/preview_t2.png)
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402
from cut_theme1 import cut  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "t2"
PREVIEW = ROOT / "game" / "assets_src" / "theme2"
TILE = 448
C = 341  # 3×3 시트 한 칸

def cell(r, c, pad=6): return (c * C + pad, r * C + pad, (c + 1) * C - pad, (r + 1) * C - pad)

# (파일, 키 밴드, 지울 영역(별 표식·글자), 잘라낼 것들[(출력 이름, box, 출력 높이, 모드, 최소 크기 비율)])
SHEETS = [
    # 적 9칸: 먼지몬 · 가스몬(평소·불 뿜기·불 뿜기 직전) · 세균몬(평소 3가지·터지기 직전) · 산성비 구름몬
    ("적_02_대기오염.png", (35, 150), [(890, 880, 950, 945)], [
        ("en_dust.png",        cell(0, 0), 160, "all", 0.004),
        ("en_gas.png",         cell(0, 1), 160, "all", 0.01),
        ("en_gas_fire.png",    cell(0, 2), 160, "all", 0.01),
        ("en_gas_windup.png",  cell(1, 0), 160, "all", 0.01),
        ("en_germ.png",        cell(1, 1), 160, "all", 0.01),
        ("en_germ2.png",       cell(1, 2), 160, "all", 0.01),
        ("en_germ3.png",       cell(2, 0), 160, "all", 0.01),
        ("en_raincloud.png",   cell(2, 2), 160, "all", 0.004),
    ]),
    # 분홍 빛무리(마젠타와 섞인 빛)가 있는 그림은 키를 세게(밴드 낮게) 따로 자른다 → 빛무리는 지우고 몸만
    ("적_02_대기오염.png", (8, 60), [], [("en_germ_armed.png", cell(2, 1), 160, "largest", 0)]),
    ("소품_02_대기오염.png", (8, 60), [], [("prop_tree.png", (50, 50, 530, 520), 200, "all", 0.02)]),
    ("적_02b_왕먼지몬.png", (35, 150), [(870, 870, 950, 950)], [
        ("en_bigdust.png", (40, 60, 990, 1000), 200, "all", 0.002),
    ]),
    # 대왕: 왼쪽 평소 · 오른쪽 화남. 위의 NORMAL/ANGRY 글자와 흩어진 작은 방울은 최소 크기로 빠진다
    ("보스_02_굴뚝가스대왕.png", (35, 150), [(1300, 640, 1376, 720), (0, 0, 250, 82), (688, 0, 870, 82)], [
        ("boss_calm.png",  (20, 85, 684, 766), 300, "all", 0.03),
        ("boss_angry.png", (688, 8, 1374, 766), 300, "all", 0.03),
    ]),
    ("소품_02_대기오염.png", (35, 150), [(885, 885, 935, 935)], [
        ("prop_drums.png",    (610, 60, 960, 380), 140, "largest", 0),
        ("prop_pipe.png",     (100, 480, 690, 700), 70, "largest", 0),
        ("prop_chimney.png",  (690, 350, 990, 660), 140, "all", 0.02),
        ("prop_cones.png",    (60, 680, 440, 970), 120, "all", 0.05),
        ("prop_pedestal.png", (440, 690, 670, 970), 110, "largest", 0),
        ("prop_valve.png",    (680, 690, 970, 975), 110, "all", 0.03),
    ]),
    ("효과_02_대기오염.png", (35, 150), [(885, 885, 935, 935)], [
        ("fx_flame.png", (10, 10, 512, 512), 180, "all", 0.01),
        ("fx_smog.png",  (512, 10, 1014, 512), 220, "all", 0.005),
        ("fx_bomb.png",  (10, 512, 512, 1014), 160, "all", 0.01),
        ("fx_splat.png", (512, 512, 1014, 1014), 200, "all", 0.003),
    ]),
]
# (파일, 출력 이름, 별 표식 덮기 [(덮을 상자, 가져올 위치)], 밝기 배율)
TILES = [
    ("바닥_02_공장.png", "floor_factory.png", [((860, 860, 960, 960), (300, 300))], 0.86),   # 원본이 너무 하얘서 조금 어둡게
    ("바닥_02b_철판.png", "floor_steel.png", [((860, 860, 960, 960), (300, 300))], 1.0),
    ("바닥_02c_굴뚝.png", "floor_soot.png", [((860, 860, 960, 960), (300, 300))], 1.0),
]
# 로비 마을 카드(마젠타 아님): 액자 안 그림만(아래 영어 글자 제외)
CARDS = [("마을카드_02_공장.png", [("card_polluted.png", (62, 60, 636, 664)), ("card_clean.png", (742, 60, 1316, 664))], 520)]


def make_tile(name, out_name, patches, gain):
    arr = np.asarray(Image.open(SRC / name).convert("RGB")).astype(np.float32)
    h, w = arr.shape[:2]
    for (bx0, by0, bx1, by1), (sx, sy) in patches:
        arr[by0:by1, bx0:bx1] = arr[sy:sy + (by1 - by0), sx:sx + (bx1 - bx0)]
    sh = np.roll(np.roll(arr, h // 2, axis=0), w // 2, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    band = 0.12
    dx = np.minimum(xx, w - 1 - xx) / (band * w); dy = np.minimum(yy, h - 1 - yy) / (band * h)
    wgt = (1 - np.clip(np.minimum(dx, dy), 0, 1))[..., None]
    out = (arr * (1 - wgt) + sh * wgt) * gain
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
            im.save(OUT / out_name, optimize=True); made.append((out_name, im))
            print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")
    for name, out_name, patches, gain in TILES: make_tile(name, out_name, patches, gain)
    for name, crops, width in CARDS:
        src = Image.open(SRC / name).convert("RGB")
        for out_name, box in crops:
            im = src.crop(box); im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            im.save(OUT / out_name.replace('.png', '.jpg'), quality=86); print(out_name, im.size)
    cellw = 170; cols = 6
    rows = (len(made) + cols - 1) // cols
    pv = Image.new("RGBA", (cols * cellw, rows * cellw + TILE // 2 * 2 + 10), (90, 90, 100, 255))
    for i, (n, im) in enumerate(made):
        t = im.copy(); t.thumbnail((cellw - 10, cellw - 10))
        pv.alpha_composite(t, ((i % cols) * cellw + (cellw - t.width) // 2, (i // cols) * cellw + (cellw - t.height) // 2))
    for j, (_, out_name, _, _) in enumerate(TILES):
        tile = Image.open(OUT / out_name).convert("RGBA").resize((TILE // 4, TILE // 4), Image.LANCZOS)
        for a in range(2):
            for b in range(2):
                pv.alpha_composite(tile, (j * (TILE // 2 + 20) + a * (TILE // 4), rows * cellw + 10 + b * (TILE // 4)))
    pv.convert("RGB").save(PREVIEW / "preview_t2.png")
    print("preview:", PREVIEW / "preview_t2.png")


if __name__ == "__main__":
    main()
