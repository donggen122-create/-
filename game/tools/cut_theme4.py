# 환경 테마 4 「불타는 숲」 그림 가공(2026-10-07): 이미지 에셋/*_04*.png → game/assets/sprites/t4/*.png
# 그림 11장은 사용자가 Codex로 만들었다(이미지 에셋/테마4_숲_프롬프트.md). 처리는 cut_theme3.py와 같다
# (마젠타 크로마키 → 칸별로 잘라 덩어리 고르기 → 높이 맞춰 축소, 바닥은 이어 붙게, 마을 카드는 두 칸 잘라 JPG).
# 사용: python game/tools/cut_theme4.py   (미리보기: game/assets_src/theme4/preview_t4.png)
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402
from cut_theme1 import cut as cut_basic  # noqa: E402
from scipy import ndimage  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "t4"
PREVIEW = ROOT / "game" / "assets_src" / "theme4"
TILE = 448


def grid(cols, rows, w, h, pad=6):
    cw, ch = w / cols, h / rows
    return lambda c, r: (int(c * cw) + pad, int(r * ch) + pad, int((c + 1) * cw) - pad, int((r + 1) * ch) - pad)


G32 = grid(3, 2, 1254, 1254)      # 3칸×2줄 정사각 시트(적 3종·효과·소품)
G22 = grid(2, 2, 1254, 1254)      # 대왕 2×2
G41 = grid(4, 1, 1672, 941)       # 버너몬 불꽃 4단계
G21 = grid(2, 1, 1672, 941)       # 불도저 2모습
# 불키는 팔·공이 옆 칸으로 넘어와서 칸을 넓게 잡고, 상자 가장자리에 닿은 조각(옆 그림)은 버린다(cut 아래)
BULKI = [(0, 6, 660, 935), (470, 6, 1240, 935), (1150, 6, 1672, 935)]


def cut(col, alpha, box, out_h, mode, min_frac):
    """cut_theme1.cut과 같되, 가장 큰 덩어리가 아니면서 상자 가장자리에 닿은 조각(옆 칸 그림의 끝)은 지운다."""
    x0, y0, x1, y1 = box
    a = alpha[y0:y1, x0:x1].copy()
    lab, n = ndimage.label(ndimage.binary_dilation(a > 40, iterations=2))
    if n > 1:
        sizes = ndimage.sum(a > 40, lab, range(1, n + 1))
        big = int(np.argmax(sizes)) + 1
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0, big}
        if edge: a[np.isin(lab, list(edge))] = 0
    al = alpha.copy(); al[y0:y1, x0:x1] = a
    return cut_basic(col, al, box, out_h, mode, min_frac)

# (파일, 키 밴드, 잘라낼 것들[(출력 이름, box, 출력 높이, 모드, 최소 크기 비율)])
SHEETS = [
    # 위 줄 평소(버너몬·톱니몬·뉴트몬) · 아래 줄 공격(불꽃 키우기·회전·이빨 방어)
    ("적_04_숲3종.png", (35, 150), [
        ("en_burner.png",      G32(0, 0), 160, "all", 0.004),
        ("en_saw.png",         G32(1, 0), 150, "all", 0.004),
        ("en_nutria.png",      G32(2, 0), 130, "all", 0.004),
        ("en_burner_big.png",  G32(0, 1), 160, "all", 0.002),
        ("en_saw_spin.png",    G32(1, 1), 160, "all", 0.001),
        ("en_nutria_guard.png", G32(2, 1), 130, "all", 0.002),
    ]),
    # 버너몬 불꽃: 작음 · 중간 · 최대 · 꺼진 불씨(약한 때)
    ("적_04b_버너몬_불꽃.png", (35, 150), [
        ("en_burner_s.png",   G41(0, 0), 160, "all", 0.004),
        ("en_burner_m.png",   G41(1, 0), 160, "all", 0.004),
        ("en_burner_l.png",   G41(2, 0), 160, "all", 0.004),
        ("en_burner_out.png", G41(3, 0), 160, "all", 0.004),
    ]),
    # 중간 보스 와르르 불도저: 평소 · 돌진 직전(흙먼지까지)
    ("적_04c_불도저.png", (35, 150), [
        ("en_dozer.png",        G21(0, 0), 230, "all", 0.002),
        ("en_dozer_charge.png", G21(1, 0), 230, "all", 0.002),
    ]),
    # 불키: 평소 · 쓰레기 공 던지기 · 점프 내려찍기
    ("적_04d_불키.png", (35, 150), [
        ("en_bulki.png",       BULKI[0], 200, "all", 0.002),
        ("en_bulki_throw.png", BULKI[1], 200, "all", 0.002),
        ("en_bulki_jump.png",  BULKI[2], 200, "all", 0.002),
    ]),
    # 대왕 산불 거인: 평소 · 내려찍기 · 화남 · 정화 후
    ("보스_04_산불거인.png", (35, 150), [
        ("boss_calm.png",  G22(0, 0), 300, "all", 0.002),
        ("boss_slam.png",  G22(1, 0), 300, "all", 0.002),
        ("boss_angry.png", G22(0, 1), 300, "all", 0.002),
        ("boss_clean.png", G22(1, 1), 300, "all", 0.002),
    ]),
    ("효과_04_숲.png", (35, 150), [
        ("fx_flames.png", G32(0, 0), 150, "all", 0.002),
        ("fx_tracks.png", G32(1, 0), 200, "all", 0.002),
        ("fx_trashball.png", G32(2, 0), 110, "all", 0.002),
        ("fx_slam.png",   G32(0, 1), 190, "all", 0.002),
        ("fx_dust.png",   G32(1, 1), 120, "all", 0.002),
        ("fx_puff.png",   G32(2, 1), 130, "all", 0.002),
    ]),
    # 계곡 웅덩이는 옆 칸까지 넓게 그려져 상자를 넓힌다
    ("소품_04_숲.png", (35, 150), [
        ("prop_pond.png",   (6, 6, 535, 620), 190, "all", 0.002),
        ("prop_stump.png",  G32(1, 0), 120, "all", 0.002),
        ("prop_burnt.png",  G32(2, 0), 190, "all", 0.002),
        ("prop_camptrash.png", G32(0, 1), 110, "all", 0.002),
        ("prop_ember.png",  G32(1, 1), 100, "all", 0.002),
        ("prop_sprout.png", G32(2, 1), 90, "all", 0.002),
    ]),
]
# (파일, 출력 이름, 밝기 배율, 대비(1 = 그대로))
# 1~3장 바닥은 밝기 180~210·표준편차 5~21. 4장 원본은 어두워(숲길 125·그을린 숲 68) 갈색·검은 몬스터가 묻혀 보여서 밝게 올리고 무늬는 옅게.
TILES = [
    ("바닥_04_숲길.png", "floor_trail.png", 1.32, 0.7),
    ("바닥_04b_벌목장.png", "floor_logging.png", 1.12, 0.75),
    ("바닥_04c_그을린숲.png", "floor_burnt.png", 1.75, 0.8),
]
# 로비 마을 카드(마젠타 아님): 왼쪽 불타는 숲 · 오른쪽 되살아난 숲
CARDS = [("마을카드_04_숲.png", [("card_polluted.png", (20, 20, 818, 918)), ("card_clean.png", (853, 20, 1652, 918))], 520)]


def make_tile(name, out_name, gain, contrast):
    arr = np.asarray(Image.open(SRC / name).convert("RGB")).astype(np.float32)
    h, w = arr.shape[:2]
    sh = np.roll(np.roll(arr, h // 2, axis=0), w // 2, axis=1)
    yy, xx = np.mgrid[0:h, 0:w]
    band = 0.12
    dx = np.minimum(xx, w - 1 - xx) / (band * w); dy = np.minimum(yy, h - 1 - yy) / (band * h)
    wgt = (1 - np.clip(np.minimum(dx, dy), 0, 1))[..., None]
    out = (arr * (1 - wgt) + sh * wgt) * gain
    if contrast != 1.0:
        m = out.reshape(-1, 3).mean(axis=0)
        out = m + (out - m) * contrast
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((TILE, TILE), Image.LANCZOS)
    im.save(OUT / out_name, optimize=True)
    lum = np.asarray(im.convert("L")).astype(np.float32)
    print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB", "밝기", round(lum.mean()), "표준편차", round(lum.std()))


def main():
    OUT.mkdir(parents=True, exist_ok=True); PREVIEW.mkdir(parents=True, exist_ok=True)
    made = []
    for name, band, cuts in SHEETS:
        rgb = np.asarray(Image.open(SRC / name).convert("RGB")).copy()
        r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
        bg = np.clip((np.minimum(r, b) - g - 120) / 60, 0, 1)
        rgb[..., 1] = np.clip(g - 70 * bg, 0, 255).astype(np.uint8)
        col, alpha = chroma_key(rgb, "magenta", band, strict_magenta=True)
        for out_name, box, out_h, mode, min_frac in cuts:
            im = cut(col, alpha, box, out_h, mode, min_frac)
            im.save(OUT / out_name, optimize=True); made.append((out_name, im))
            print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")
    for name, out_name, gain, contrast in TILES: make_tile(name, out_name, gain, contrast)
    for name, crops, width in CARDS:
        src = Image.open(SRC / name).convert("RGB")
        for out_name, box in crops:
            im = src.crop(box); im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            im.save(OUT / out_name.replace('.png', '.jpg'), quality=86); print(out_name, im.size)
    cellw = 170; cols = 6
    rows = (len(made) + cols - 1) // cols
    pv = Image.new("RGBA", (cols * cellw, rows * cellw + TILE // 2 + 10), (90, 90, 100, 255))
    for i, (n, im) in enumerate(made):
        t = im.copy(); t.thumbnail((cellw - 10, cellw - 10))
        pv.alpha_composite(t, ((i % cols) * cellw + (cellw - t.width) // 2, (i // cols) * cellw + (cellw - t.height) // 2))
    for j, (_, out_name, *_rest) in enumerate(TILES):
        tile = Image.open(OUT / out_name).convert("RGBA").resize((TILE // 4, TILE // 4), Image.LANCZOS)
        for a in range(2):
            for b in range(2):
                pv.alpha_composite(tile, (j * (TILE // 2 + 20) + a * (TILE // 4), rows * cellw + 10 + b * (TILE // 4)))
    pv.convert("RGB").save(PREVIEW / "preview_t4.png")
    print("preview:", PREVIEW / "preview_t4.png")


if __name__ == "__main__":
    main()
