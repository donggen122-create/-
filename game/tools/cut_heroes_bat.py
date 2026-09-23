# 원거리 공격 주인공 시트(호야 야구방망이·민지 피구공, 사용자 Gemini 생성, 1024×1024 3×3, 마젠타/초록 배경, JPG)
# → 프레임별 투명 PNG. 기존 cut_heroes.py와 같은 크기 규칙(서 있기 키 112px, 캔버스 높이 143px)이라 게임에서 원본 프레임과 같은 크기로 보인다.
# 앵커: 발 중심(프레임 아래 15% 알파의 x 평균)을 캔버스 가운데에 두어 방망이가 옆으로 뻗어도 몸이 흔들리지 않는다.
# 사용: python game/tools/cut_heroes_bat.py   (미리보기: game/assets_src/kids/preview_<hero>_ranged.png)
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key   # 같은 키잉 규칙 재사용

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "heroes"
PREVIEW = ROOT / "game" / "assets_src" / "kids"
IDLE_H = 112
CANVAS_H = 143          # 기존 프레임과 같은 캔버스 높이(hoya_idle_1.png)
FOOT_PAD = 2

SHEETS = {   # 키: (파일, 배경, (lo, hi), strict_magenta)
    "HM": ("주인공 방망이 이동.jpg", "magenta", (50, 170), True),
    "HB": ("주인공 방망이 전투.jpg", "magenta", (50, 170), True),
    "MB": ("여주인공 피구공 전투.jpg", "green", (50, 170), False),
}
def cell(c, r, size=1024, n=3):
    s = size / n
    return (int(c * s), int(r * s), int((c + 1) * s), int((r + 1) * s))

FRAMES = {
    "hoya": {
        "ranged":      [("HB", cell(0, 0)), ("HB", cell(1, 0)), ("HB", cell(2, 0)), ("HB", cell(0, 1)), ("HB", cell(1, 1)), ("HB", cell(2, 1))],
        "ranged_hurt": [("HB", cell(0, 2))],
        "ranged_down": [("HB", cell(1, 2))],
        "ranged_idle": [("HM", cell(0, 2))],
        "ranged_walk": [("HM", cell(0, 0)), ("HM", cell(1, 0)), ("HM", cell(2, 0))],
        "ranged_run":  [("HM", cell(0, 1)), ("HM", cell(1, 1)), ("HM", cell(2, 1))],
        "ranged_jump": [("HM", cell(1, 2)), ("HM", cell(2, 2))],
    },
    "minji": {
        "ranged":      [("MB", cell(0, 0)), ("MB", cell(1, 0)), ("MB", cell(2, 0)), ("MB", cell(0, 1)), ("MB", cell(1, 1)), ("MB", cell(2, 1))],
        "ranged_hurt": [("MB", cell(0, 2))],
        "ranged_down": [("MB", cell(1, 2))],
        "ranged_idle": [("MB", cell(2, 2))],
    },
}
STAND = {"hoya": ("HM", cell(0, 2)), "minji": ("MB", cell(2, 2))}   # 키 기준 프레임(서 있기)

def extract(sheet_rgba, rect):
    """칸 안에서 가장 큰 연결 요소만 남긴 프레임과 그 위치(bbox)를 돌려준다(속도선·별·따로 떨어진 공은 버림)."""
    x0, y0, x1, y1 = rect
    alpha = sheet_rgba[..., 3]
    mask = alpha > 40
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=3))
    objs = ndimage.find_objects(lab)
    cands = []
    for i, sl in enumerate(objs, start=1):
        if sl is None: continue
        cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
        if not (x0 <= cx < x1 and y0 <= cy < y1): continue
        cands.append((int((lab[sl] == i).sum()), i, sl))
    if not cands: raise RuntimeError(f"칸 {rect}에 요소 없음")
    cands.sort(reverse=True)
    sel = (lab == cands[0][1]) & mask
    ys, xs = np.where(sel)
    by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    frame = sheet_rgba[by0:by1, bx0:bx1].copy()
    frame[..., 3] = np.where(sel[by0:by1, bx0:bx1], frame[..., 3], 0)
    print(f"    칸 {rect}: 요소 {len(cands)}개, 최대 {cands[0][0]}px, bbox x{bx0}-{bx1} y{by0}-{by1}")
    return frame

def feet_center(frame):
    """프레임 아래 15% 영역의 알파 중심 x(발 위치). 없으면 전체 중심."""
    a = frame[..., 3] > 128
    h = a.shape[0]
    band = a[int(h * 0.85):, :]
    xs = np.where(band)[1]
    if xs.size < 20: xs = np.where(a)[1]
    return float(xs.mean())

def main():
    sheets = {}
    for k, (name, key, band, strict) in SHEETS.items():
        im = Image.open(SRC / name).convert("RGB")
        rgb = np.asarray(im)
        col, alpha = chroma_key(rgb, key, band, strict_magenta=strict)
        sheets[k] = np.dstack([col, alpha])
        dbg = Image.new("RGBA", im.size, (90, 90, 100, 255)); dbg.alpha_composite(Image.fromarray(sheets[k], "RGBA"))
        dbg.convert("RGB").save(PREVIEW / f"debug_{k}.png")
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for hero, anims in FRAMES.items():
        sk, rect = STAND[hero]
        stand = extract(sheets[sk], rect)
        scale = IDLE_H / stand.shape[0]
        print(hero, "scale", round(scale, 3), "stand h", stand.shape[0])
        frames = []   # (anim, n, image, feet_cx_scaled)
        for anim, cells in anims.items():
            print(f"{hero}/{anim}")
            for n, (s, r) in enumerate(cells, start=1):
                f = extract(sheets[s], r)
                fc = feet_center(f) * scale
                im = Image.fromarray(f, "RGBA").convert("RGBa")
                w = max(1, round(f.shape[1] * scale)); h = max(1, round(f.shape[0] * scale))
                frames.append((anim, n, im.resize((w, h), Image.LANCZOS).convert("RGBA"), fc))
        # 캔버스 폭: 발 중심을 가운데 두었을 때 모든 프레임이 들어가는 폭(짝수)
        half = max(max(fc, im.width - fc) for _, _, im, fc in frames) + 2
        canvas_w = int(np.ceil(half * 2)); canvas_w += canvas_w % 2
        cells_prev = []
        for anim, n, im, fc in frames:
            canvas = Image.new("RGBA", (canvas_w, CANVAS_H), (0, 0, 0, 0))
            x = int(round(canvas_w / 2 - fc)); y = CANVAS_H - FOOT_PAD - im.height
            if y < 0: raise RuntimeError(f"{hero}/{anim}{n}: 프레임 높이 {im.height} > 캔버스 {CANVAS_H}")
            canvas.paste(im, (x, y))
            fn = f"{hero}_{anim}_{n}.png"
            canvas.save(OUT / fn); manifest.append(fn); cells_prev.append(canvas)
        pv = Image.new("RGBA", (canvas_w * len(cells_prev), CANVAS_H), (90, 90, 100, 255))
        for i, c in enumerate(cells_prev): pv.alpha_composite(c, (i * canvas_w, 0))
        pv = pv.resize((pv.width * 2, pv.height * 2), Image.NEAREST)
        pv.save(PREVIEW / f"preview_{hero}_ranged.png")
        print(hero, "canvas", canvas_w, "x", CANVAS_H, "frames", len(frames))
    print("\n".join(manifest))

if __name__ == "__main__":
    main()
