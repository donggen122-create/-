# 대왕 기술 효과 그림(사용자 Gemini, 마젠타 배경 한 줄 3개) → 투명 PNG 3장. docs/29.
# 입력: 이미지 에셋/효과_01_대왕기술.png (① 던지는 쓰레기 뭉치 ② 쾅 충격파 고리 ③ 금 간 땅)
# 출력: game/assets/sprites/t1/fx_trashball.png · fx_shockring.png · fx_crack.png
# 사용: python game/tools/cut_boss_fx.py
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402
from cut_title_art import erase_border_connected, magenta_keyness  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋" / "효과_01_대왕기술.png"
OUT = ROOT / "game" / "assets" / "sprites" / "t1"
# 왼쪽부터 (이름, 긴 변 px, 부드러운 키). 금 간 땅은 가장자리가 마젠타와 섞여 번지므로(갈색+마젠타 선형 혼합)
# (R+B)/2-G 를 갈색(≈5)~마젠타(≈255) 사이 직선으로 알파를 매겨 번진 분홍·초록 테를 없앤다.
NAMES = [("fx_trashball.png", 128, False), ("fx_shockring.png", 256, False), ("fx_crack.png", 256, True)]

def main():
    rgb = np.asarray(Image.open(SRC).convert("RGB"))
    col, alpha = chroma_key(rgb, "magenta", (30, 150), strict_magenta=True)
    alpha = erase_border_connected(alpha, magenta_keyness(rgb), 150)
    soft_col, soft_alpha = chroma_key(rgb, "magenta", (8, 250), strict_magenta=False)
    mask = alpha > 24
    # 반짝이·조각까지 한 묶음이 되게 넓게 붙인 뒤 큰 묶음 3개(Gemini 별 표식 같은 잡티는 작아서 빠짐)
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=22))
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    groups = sorted((np.argsort(sizes)[::-1][:3] + 1).tolist(), key=lambda k: np.where(lab == k)[1].mean())
    for k, (name, side, soft) in zip(groups, NAMES):
        sel = (lab == k) & mask
        ys, xs = np.where(sel)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        c, a = (soft_col, soft_alpha) if soft else (col, alpha)
        if soft: sel = ndimage.binary_dilation(sel, iterations=6) & (lab == k)   # 옅은 테두리까지
        frame = np.dstack([c, np.where(sel, a, 0)])[y0:y1, x0:x1]
        im = Image.fromarray(frame, "RGBA").convert("RGBa")
        s = side / max(im.width, im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS).convert("RGBA")
        im.save(OUT / name, optimize=True)
        print(name, im.size)

if __name__ == "__main__":
    main()
