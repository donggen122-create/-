# 환경 테마 3 「오염된 하천」 그림 가공(2026-09-30): 이미지 에셋/*_03*.png·jpg → game/assets/sprites/t3/*.png
# 적·대왕·효과·소품 6장은 Antigravity, 바닥 3장·마을 카드는 사용자 Gemini 앱(이미지 에셋/테마3_개울_프롬프트.md "그림 상태").
# 처리는 cut_theme2.py와 같다(마젠타 크로마키 → 상자별로 잘라 덩어리 고르기 → 높이 맞춰 축소, 바닥은 별 표식 덮고 이어 붙게).
# 사용: python game/tools/cut_theme3.py   (미리보기: game/assets_src/theme3/preview_t3.png)
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cut_heroes import chroma_key  # noqa: E402
from cut_theme1 import cut  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "t3"
PREVIEW = ROOT / "game" / "assets_src" / "theme3"
TILE = 448
C = 341  # 3×3 시트 한 칸

def cell(r, c, pad=6): return (c * C + pad, r * C + pad, (c + 1) * C - pad, (r + 1) * C - pad)

# (파일, 키 밴드, 지울 영역, 잘라낼 것들[(출력 이름, box, 출력 높이, 모드, 최소 크기 비율)])
SHEETS = [
    # 적 3×3: 위 줄 평소(거품몬·페트리·콜라 캔) · 가운데 줄은 페트리 뚜껑 들썩(예고)만 씀(거품몬·콜라 캔은 위 줄과 같은 그림) · 아래 줄 공격
    ("적_03_하천3종.png", (35, 150), [], [
        ("en_bubble.png",        (15, 30, 395, 345), 160, "all", 0.004),
        ("en_petri.png",         cell(0, 1), 160, "all", 0.01),
        ("en_can.png",           cell(0, 2), 160, "all", 0.01),
        ("en_petri_windup.png",  cell(1, 1), 160, "all", 0.01),
        ("en_bubble_atk.png",    (15, 690, 425, 1010), 160, "all", 0.004),
        ("en_petri_fire.png",    cell(2, 1), 160, "all", 0.01),
        ("en_can_fire.png",      cell(2, 2), 160, "all", 0.004),
    ]),
    # 녹조몬: 평소 · 나뉘기 직전 · 작은 녹조몬(떨어지는 방울까지) — 2026-09-30 저녁 그물몬으로 바꿔 게임에서는 쓰지 않음(그림은 보관)
    ("적_03d_녹조몬.png", (35, 150), [], [
        ("en_algae.png",       (20, 110, 540, 610), 180, "all", 0.002),
        ("en_algae_swell.png", (540, 100, 1060, 600), 180, "all", 0.002),
        ("en_algae_small.png", (1060, 320, 1345, 600), 110, "all", 0.002),
    ]),
    # 그물몬(2026-09-30 저녁, 녹조몬 대신 — 학생 그물 몬스터 원안, 사용자 Gemini): 평소 · 덮치기 직전. 오른쪽 아래 Gemini 별 표식은 지운다
    ("적_03e_그물몬.png", (35, 150), [(918, 458, 958, 505)], [
        ("en_netmon.png",        (55, 15, 445, 545), 170, "all", 0.003),
        ("en_netmon_pounce.png", (455, 10, 1018, 548), 170, "all", 0.003),
    ]),
    # 유령그물 대장(중간 보스): 평소 · 그물 던지기 직전
    ("적_03c_유령그물대장.png", (35, 150), [], [
        ("en_net.png",       (0, 30, 686, 768), 240, "all", 0.003),
        ("en_net_throw.png", (686, 10, 1376, 768), 240, "all", 0.003),
    ]),
    # 대왕: 왼쪽 평소 · 오른쪽 화남(튀는 방울·쓰레기까지)
    ("보스_03_구정물대왕.png", (35, 150), [], [
        ("boss_calm.png",  (30, 40, 684, 750), 300, "all", 0.002),
        ("boss_angry.png", (684, 40, 1370, 750), 300, "all", 0.002),
    ]),
    ("효과_03_개울.png", (35, 150), [], [
        ("fx_wave.png",  (20, 30, 545, 365), 180, "all", 0.002),
        ("fx_oil.png",   (575, 40, 985, 345), 160, "largest", 0),
        ("fx_foam.png",  (565, 355, 995, 695), 180, "all", 0.002),
        ("fx_algae.png", (25, 375, 515, 695), 170, "all", 0.002),
        ("fx_cola.png",  (25, 740, 505, 935), 90, "all", 0.001),
        ("fx_net.png",   (505, 695, 1015, 1005), 180, "largest", 0),
    ]),
    # 소품 배경은 (255,66,255)라 조금 분홍 → 같은 밴드로 충분히 빠진다
    ("소품_03_개울.png", (35, 150), [], [
        ("prop_reeds.png",       (15, 35, 415, 475), 200, "all", 0.002),
        ("prop_stones.png",      (395, 95, 705, 465), 110, "all", 0.1),
        ("prop_rock.png",        (700, 95, 1015, 405), 120, "largest", 0),
        ("prop_trash.png",       (15, 635, 415, 965), 130, "all", 0.02),
        ("prop_fish_caught.png", (415, 665, 705, 935), 110, "all", 0.02),
        ("prop_fish_free.png",   (725, 655, 1015, 995), 140, "all", 0.002),
    ]),
]
# (파일, 출력 이름, 별 표식 덮기 [(덮을 상자, 가져올 위치)], 밝기 배율, 원본에서 쓸 네모(없으면 전체), 대비(1 = 그대로))
# 개울 자갈 바닥은 무늬가 진해(밝기 표준편차 32, 1·2장 바닥은 5~21) 몬스터가 묻혀 보여서 대비를 낮춘다.
TILES = [
    ("바닥_03_개울.jpg", "floor_stream.png", [((860, 860, 960, 960), (300, 300))], 0.97, None, 0.62),
    ("바닥_03b_물가.jpg", "floor_bank.png", [((860, 860, 960, 960), (300, 300))], 0.97, None, 0.85),
    # 하수구: 원본이 512px마다 똑같이 반복된다 → 한 칸(512)만 잘라 크게(시멘트 판이 덜 촘촘하게), 칸 선은 옅게
    # 무지개 기름 얼룩은 대왕의 기름 웅덩이(피해)와 헷갈려 채도를 낮춘다(아래 SATURATION)
    ("바닥_03c_하수구.jpg", "floor_sewer.png", [((860, 860, 960, 960), (300, 300))], 0.94, (0, 0, 512, 512), 0.8),
]
SATURATION = {"floor_sewer.png": 0.35}
# 로비 마을 카드(마젠타 아님): 둥근 액자 안 그림만
CARDS = [("마을카드_03_개울.jpg", [("card_polluted.png", (46, 46, 478, 540)), ("card_clean.png", (548, 46, 980, 540))], 520)]


def soften_lines(arr):
    """진갈색 칸 선을 주변 색 쪽으로 반쯤 섞어 옅게 한다(하수구 바닥의 네모 칸이 덜 도드라지게)."""
    from scipy import ndimage
    lum = arr.mean(axis=2)
    line = (lum < 115) & (arr[..., 0] > arr[..., 2])          # 어둡고 붉은 쪽(갈색 선)
    line = ndimage.binary_dilation(line, iterations=1)
    blur = np.stack([ndimage.median_filter(arr[..., i], size=9) for i in range(3)], axis=2)
    out = arr.copy()
    out[line] = arr[line] * 0.35 + blur[line] * 0.65
    return out


def make_tile(name, out_name, patches, gain, crop, contrast=1.0):
    arr = np.asarray(Image.open(SRC / name).convert("RGB")).astype(np.float32)
    for (bx0, by0, bx1, by1), (sx, sy) in patches:
        arr[by0:by1, bx0:bx1] = arr[sy:sy + (by1 - by0), sx:sx + (bx1 - bx0)]
    if crop:                                                   # 이미 반복되는 그림: 한 주기만 쓰고 섞지 않는다
        x0, y0, x1, y1 = crop
        out = soften_lines(arr[y0:y1, x0:x1]) * gain
    else:
        h, w = arr.shape[:2]
        sh = np.roll(np.roll(arr, h // 2, axis=0), w // 2, axis=1)
        yy, xx = np.mgrid[0:h, 0:w]
        band = 0.12
        dx = np.minimum(xx, w - 1 - xx) / (band * w); dy = np.minimum(yy, h - 1 - yy) / (band * h)
        wgt = (1 - np.clip(np.minimum(dx, dy), 0, 1))[..., None]
        out = (arr * (1 - wgt) + sh * wgt) * gain
    sat = SATURATION.get(out_name, 1.0)
    if sat != 1.0:                                             # 회색 쪽으로(밝기는 그대로)
        gray = out.mean(axis=2, keepdims=True)
        out = gray + (out - gray) * sat
    if contrast != 1.0:                                        # 색마다 평균 쪽으로 당겨 무늬를 옅게
        m = out.reshape(-1, 3).mean(axis=0)
        out = m + (out - m) * contrast
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((TILE, TILE), Image.LANCZOS)
    im.save(OUT / out_name, optimize=True)
    print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True); PREVIEW.mkdir(parents=True, exist_ok=True)
    made = []
    for name, band, erase, cuts in SHEETS:
        rgb = np.asarray(Image.open(SRC / name).convert("RGB")).copy()
        # 소품 시트처럼 배경이 (255,66,255)이면 초록 성분을 0 쪽으로 옮겨 순수 마젠타로 맞춘다(가장자리 색 번짐 방지)
        r, g, b = [rgb[..., i].astype(np.float32) for i in range(3)]
        bg = np.clip((np.minimum(r, b) - g - 120) / 60, 0, 1)
        rgb[..., 1] = np.clip(g - 70 * bg, 0, 255).astype(np.uint8)
        col, alpha = chroma_key(rgb, "magenta", band, strict_magenta=True)
        for x0, y0, x1, y1 in erase: alpha[y0:y1, x0:x1] = 0
        for out_name, box, out_h, mode, min_frac in cuts:
            im = cut(col, alpha, box, out_h, mode, min_frac)
            im.save(OUT / out_name, optimize=True); made.append((out_name, im))
            print(out_name, im.size, round((OUT / out_name).stat().st_size / 1024), "KB")
    for name, out_name, patches, gain, crop, contrast in TILES: make_tile(name, out_name, patches, gain, crop, contrast)
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
    pv.convert("RGB").save(PREVIEW / "preview_t3.png")
    print("preview:", PREVIEW / "preview_t3.png")


if __name__ == "__main__":
    main()
