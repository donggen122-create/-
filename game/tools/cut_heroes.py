# 주인공(호야·민지) 시트 → 프레임별 투명 PNG
# 입력: 이미지 에셋/*.png (Gemini 앱 생성, 마젠타/초록 단색 배경, 일부에 격자선·잔상 스프라이트 섞임)
# 처리: 크로마키(배경색 → 투명, 색 번짐 제거) → 격자선 제거 → 연결 요소 중 칸마다 가장 큰 덩어리만 채택(잔상 제외)
#       → 발바닥 정렬 공통 캔버스 → 높이 128px로 축소 → game/assets/sprites/heroes/<id>_<anim>_<n>.png
# 사용: python game/tools/cut_heroes.py     (미리보기: game/assets_src/kids/preview_*.png)
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "heroes"
PREVIEW = ROOT / "game" / "assets_src" / "kids"
IDLE_H = 112         # 두 주인공의 '서 있기' 키를 이 높이로 통일한다(캐릭터 간 크기 차이 방지)
FOOT_PAD = 2         # 캔버스 높이는 모든 프레임(칼 든 공격 등)이 들어가는 공통 크기로 자동 결정

# 시트 파일, 배경색, 키 판정 범위(lo, hi): 키 성분이 lo 이하면 불투명, hi 이상이면 투명.
# 잔상·반투명 격자가 섞인 B·C는 좁게(엄격하게) 잡아 배경에 가까운 옅은 잡티를 함께 지운다.
SHEETS = {
    "A": ("주인공.png", "magenta", (60, 200)),        # 호야 이동
    "B": ("주인공 전투.png", "magenta", (25, 50)),    # 호야 전투(격자선·잔상 있음)
    "C": ("여주인공.png", "green", (25, 50)),         # 민지 이동(잔상 있음)
    "D": ("여주인공 전투.png", "green", (60, 200)),   # 민지 전투
}
# 시트별로 잔상이 캐릭터와 맞닿아 연결 요소로 분리되지 않는 자리를 좌표(x0,y0,x1,y1)로 직접 지운다.
ERASE = {
    "B": [(1380, 875, 1800, 1024),                           # 공격 3 발밑에 붙은 '쓰러진 호야' 잔상
          (1300, 300, 1500, 660)],                           # 공격 3 가방 옆에 붙은 '점프 호야' 잔상
    "C": [(0, 1365, 830, 2048), (1200, 1365, 1560, 2048)],   # 3줄: 잔상 민지·격자 패치(점프 프레임 옆)
}
# 3×3 격자 기준 칸 좌표 (2048px). B는 3×2.
def cell3(c, r): s = 2048 / 3; return (int(c * s), int(r * s), int((c + 1) * s), int((r + 1) * s))
def cellB(c, r): s = 2048 / 3; return (int(c * s), int(r * 1010), int((c + 1) * s), int(r * 1010 + 1010))

# 캐릭터별 애니메이션 → (시트, 칸) 목록
FRAMES = {
    "hoya": {
        "idle":   [("A", cell3(0, 2))],
        "walk":   [("A", cell3(0, 0)), ("A", cell3(1, 0)), ("A", cell3(2, 0))],
        "run":    [("A", cell3(0, 1)), ("A", cell3(1, 1)), ("A", cell3(2, 1))],
        "jump":   [("A", cell3(1, 2)), ("A", cell3(2, 2))],
        "attack": [("B", cellB(0, 0)), ("B", cellB(1, 0)), ("B", cellB(2, 0))],
        # B의 피격 칸은 글자·잔상 민지가 몸에 겹쳐 있고 얼굴도 깨져 있어 서 있는 프레임을 대신 쓴다(피격 섬광으로 표현)
        "hurt":   [("A", cell3(0, 2))],
        "down":   [("B", cellB(1, 1))],
    },
    "minji": {
        "idle":   [("D", cell3(2, 2))],
        "walk":   [("C", cell3(0, 0)), ("C", cell3(1, 0)), ("C", cell3(2, 0))],
        "run":    [("C", cell3(0, 1)), ("C", cell3(1, 1)), ("C", cell3(2, 1))],
        # C의 점프 최고점 칸은 반투명 격자가 다리 뒤에 겹쳐 분리 불가 → 뛰어오르는 프레임 1장만 사용
        "jump":   [("C", cell3(1, 2))],
        "attack": [("D", cell3(0, 0)), ("D", cell3(1, 0)), ("D", cell3(2, 0))],
        "hurt":   [("D", cell3(0, 1))],
        "down":   [("D", cell3(1, 2))],
    },
}

def chroma_key(rgb, key, band=(60, 200), strict_magenta=False):
    """배경색과의 '키 성분' 차이로 부드러운 알파를 만들고, 반투명 가장자리의 배경색 번짐을 제거한다.
    strict_magenta: 마젠타 키를 min(R,B)-G로 계산 → 분홍(꽃잎·볼)처럼 R만 높은 색은 배경으로 오인하지 않는다."""
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    if key == "magenta":
        keyness = (np.minimum(r, b) - g) if strict_magenta else (r + b) / 2 - g
        keycol = np.array([255, 0, 255], np.float32)
    else:
        keyness = g - (r + b) / 2; keycol = np.array([0, 255, 0], np.float32)
    lo, hi = float(band[0]), float(band[1])
    alpha = 1 - np.clip((keyness - lo) / (hi - lo), 0, 1)
    a = alpha[..., None]
    col = np.where(a > 0.02, (rgb.astype(np.float32) - (1 - a) * keycol) / np.maximum(a, 0.02), 0)
    return np.clip(col, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)

def remove_grid_lines(alpha, rgb):
    """검은 격자선(행/열 전체에 걸친 어두운 직선)을 투명 처리한다."""
    # 진짜 격자선은 화면을 거의 끝까지 가로지른다(0.85↑). 검은 머리 3개가 나란한 줄(≈0.7)은 선이 아니다.
    dark = (alpha > 128) & (rgb.max(axis=2) < 70)
    for axis in (0, 1):
        frac = dark.mean(axis=axis)
        idx = np.where(frac > 0.85)[0]
        for i in idx:
            if axis == 0: alpha[:, max(0, i - 1):i + 2] = 0
            else: alpha[max(0, i - 1):i + 2, :] = 0
    return alpha

def extract(sheet_rgba, rect):
    """칸 안에서 가장 큰 연결 요소(+ 그 25% 이상 크기의 요소)만 남긴 프레임을 잘라 반환."""
    x0, y0, x1, y1 = rect
    alpha = sheet_rgba[..., 3]
    mask = alpha > 40
    # 인접한 부분(칼·손 등)을 잇기 위해 약간 팽창한 마스크로 라벨링
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=3))
    if n == 0: raise RuntimeError("빈 칸")
    objs = ndimage.find_objects(lab)
    cands = []
    for i, sl in enumerate(objs, start=1):
        if sl is None: continue
        cy = (sl[0].start + sl[0].stop) / 2; cx = (sl[1].start + sl[1].stop) / 2
        if not (x0 <= cx < x1 and y0 <= cy < y1): continue
        area = int((lab[sl] == i).sum())
        cands.append((area, i, sl))
    if not cands: raise RuntimeError(f"칸 {rect}에 요소 없음")
    cands.sort(reverse=True)
    big = cands[0][0]
    keep = cands[:1]          # 칸에서 가장 큰 덩어리 하나만(잔상·반짝이·글자는 모두 그보다 작다)
    sl = cands[0][2]
    print(f"    칸 {rect}: 요소 {len(cands)}개, 채택 {len(keep)}개, 최대 {big}px bbox x{sl[1].start}-{sl[1].stop} y{sl[0].start}-{sl[0].stop}")
    sel = np.zeros_like(mask)
    for _, i, _ in keep: sel |= (lab == i)
    sel &= mask
    ys, xs = np.where(sel)
    by0, by1, bx0, bx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    frame = sheet_rgba[by0:by1, bx0:bx1].copy()
    frame[..., 3] = np.where(sel[by0:by1, bx0:bx1], frame[..., 3], 0)
    return frame

def main():
    sheets = {}
    for k, (name, key, band) in SHEETS.items():
        im = Image.open(SRC / name).convert("RGB")
        rgb = np.asarray(im)
        col, alpha = chroma_key(rgb, key, band)
        alpha = remove_grid_lines(alpha, col)
        for x0, y0, x1, y1 in ERASE.get(k, []): alpha[y0:y1, x0:x1] = 0
        sheets[k] = np.dstack([col, alpha])
        dbg = Image.new("RGBA", im.size, (90, 90, 100, 255)); dbg.alpha_composite(Image.fromarray(sheets[k], "RGBA"))
        dbg.convert("RGB").resize((1024, 1024), Image.LANCZOS).save(PREVIEW / f"debug_{k}.png")
    OUT.mkdir(parents=True, exist_ok=True)
    # 1차: 프레임 추출 + 캐릭터별 배율(서 있기 키 = IDLE_H). 2차: 두 캐릭터 공통 캔버스에 발바닥 정렬로 배치.
    scaled = {}   # hero -> [(anim, n, Image)]
    for hero, anims in FRAMES.items():
        frames = {}
        for anim, cells in anims.items():
            print(f"{hero}/{anim}")
            frames[anim] = [extract(sheets[s], rect) for s, rect in cells]
        scale = IDLE_H / frames["idle"][0].shape[0]
        scaled[hero] = []
        for anim, fl in frames.items():
            for n, f in enumerate(fl, start=1):
                im = Image.fromarray(f, "RGBA").convert("RGBa")
                w = max(1, round(f.shape[1] * scale)); h = max(1, round(f.shape[0] * scale))
                scaled[hero].append((anim, n, im.resize((w, h), Image.LANCZOS).convert("RGBA")))
        print(hero, "scale", round(scale, 3))
    canvas_h = max(im.height for fl in scaled.values() for _, _, im in fl) + FOOT_PAD
    canvas_w = max(im.width for fl in scaled.values() for _, _, im in fl) + 2
    manifest = []
    for hero, fl in scaled.items():
        preview_cells = []
        for anim, n, im in fl:
            canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            canvas.paste(im, ((canvas_w - im.width) // 2, canvas_h - FOOT_PAD - im.height))   # 발바닥 정렬·가운데
            fn = f"{hero}_{anim}_{n}.png"
            canvas.save(OUT / fn)
            manifest.append(fn)
            preview_cells.append(canvas)
        # 미리보기(회색 바탕)
        pv = Image.new("RGBA", (canvas_w * len(preview_cells), canvas_h), (90, 90, 100, 255))
        for i, c in enumerate(preview_cells): pv.alpha_composite(c, (i * canvas_w, 0))
        pv = pv.resize((pv.width * 2, pv.height * 2), Image.NEAREST)
        pv.save(PREVIEW / f"preview_{hero}.png")
    print(f"공통 캔버스 {canvas_w}x{canvas_h}px, 서 있기 키 {IDLE_H}px (게임의 HERO_DRAW_H는 60×{canvas_h}/{IDLE_H}로 맞출 것)")
    print("\n".join(manifest))

if __name__ == "__main__":
    main()
