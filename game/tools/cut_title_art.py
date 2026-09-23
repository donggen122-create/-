# 시작 화면용 그림(단색 배경 JPG) → 투명 PNG. cut_heroes.py의 크로마키·최대 요소 선택을 재사용한다.
# 입력: 이미지 에셋/{주인공 배경, 여주인공 세로, 마스코트, 등불}.jpg  → 출력: game/assets/ui/title_*.png
# 사용: python game/tools/cut_title_art.py
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "ui"

# (입력 파일, 배경색, 출력 이름, 출력 높이px, 키 밴드(lo,hi), 바깥 채움 문턱)
# 밴드: 키 성분이 lo 이하면 불투명, hi 이상이면 투명. 마젠타는 min(R,B)-G 기준(분홍 보호).
# 바깥 채움 문턱(flood): 값이 있으면 '키 성분 > 문턱'인 픽셀 중 이미지 가장자리와 이어진 영역을 전부 투명으로.
#   배경에서 캐릭터 쪽으로 번지는 옅은 빛무리(새싹 뒤 분홍 글로우)를 지우되, 안쪽에 갇힌 분홍(볼)은 남긴다.
JOBS = [
    ("주인공 배경.jpg", "magenta", "title_hoya.png", 560, (40, 170), None),
    ("여주인공 세로.jpg", "green", "title_minji.png", 560, (40, 170), None),
    ("마스코트.jpg", "magenta", "title_emblem.png", 320, (60, 170), None),   # 파일명은 '마스코트'지만 내용은 무궁화 '서호' 배지(엠블럼). 분홍 꽃잎 보호
    ("등불.jpg", "magenta", "title_mascot.png", 260, (30, 120), 8),        # 새싹 지구 마스코트
]

def magenta_keyness(rgb):
    r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
    return np.minimum(r, b) - g

def erase_border_connected(alpha, keyness, thresh):
    """가장자리와 이어진 '배경스러운' 영역(keyness > thresh)을 투명 처리."""
    bgish = keyness > thresh
    lab, n = ndimage.label(bgish)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border > 0]
    kill = np.isin(lab, border)
    alpha = alpha.copy(); alpha[kill] = 0
    return alpha

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, key, out_name, out_h, band, flood in JOBS:
        rgb = np.asarray(Image.open(SRC / name).convert("RGB"))
        col, alpha = chroma_key(rgb, key, band, strict_magenta=True)
        if flood is not None and key == "magenta":
            alpha = erase_border_connected(alpha, magenta_keyness(rgb), flood)
        mask = alpha > 40
        lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=2))
        sizes = ndimage.sum(mask, lab, range(1, n + 1))
        big = int(np.argmax(sizes)) + 1                     # 가장 큰 덩어리만(Gemini 별 표식·잡티 제거)
        sel = (lab == big) & mask
        ys, xs = np.where(sel)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        frame = np.dstack([col, np.where(sel, alpha, 0)])[y0:y1, x0:x1]
        im = Image.fromarray(frame, "RGBA").convert("RGBa")
        scale = out_h / im.height
        im = im.resize((max(1, round(im.width * scale)), out_h), Image.LANCZOS).convert("RGBA")
        im.save(OUT / out_name, optimize=True)
        print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")

if __name__ == "__main__":
    main()
