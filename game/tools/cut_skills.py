# 원소 스킬 그림 시트(사용자 Gemini 생성, 1024×1024, 4×4 초록 배경 / 지원품 3×3 마젠타 배경) → 스프라이트 PNG
# 배경은 "배경색과의 거리"로 지운다(초록 계열 바람 이펙트가 같이 지워지지 않게 순수 초록과의 RGB 거리 사용).
# 칸 안의 모든 조각을 남긴다(물방울·불꽃·벌떼처럼 여러 조각인 이펙트가 많다). 결과는 원본 해상도 그대로(게임에서 축소).
# 사용: python game/tools/cut_skills.py   (미리보기: game/assets_src/skills/preview_<이름>.png)
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "이미지 에셋"
OUT = ROOT / "game" / "assets" / "sprites" / "skills"
PREVIEW = ROOT / "game" / "assets_src" / "skills"

# 시트: (파일, 열×행, 칸 이름 목록(왼쪽 위부터), 키 방식)
SHEETS = {
    "fire": ("스킬 불.jpg", 4, ["bottle", "puddle_1", "puddle_2", "puddle_3", "rocket", "boom_1", "boom_2", "boom_3",
                               "volcano", "lava_1", "lava_2", "lava_3", "frocket", "fwork_1", "fwork_2", "fwork_3"], "green"),
    "water": ("스킬 물.jpg", 4, ["balloon", "splash_1", "splash_2", "splash_3", "beam", "beam_tip", "spray_1", "spray_2",
                               "kballoon", "ksplash_1", "ksplash_2", "ksplash_3", "rbeam", "rbeam_tip", "rspray_1", "rspray_2"], "green"),
    "wind": ("스킬 바람.jpg", 4, ["boomerang_1", "boomerang_2", "trail", "swirl", "top_1", "top_2", "top_3", "shadow",
                                "mboomerang_1", "mboomerang_2", "pull_line", "burst", "typhoon_1", "typhoon_2", "typhoon_3", "ring"], "green"),
    "earth": ("스킬 흙.jpg", 4, ["stone_1", "stone_2", "dust_1", "dust_2", "mole_1", "mole_2", "dirt_1", "dirt_2",
                               "boulder_1", "boulder_2", "dust_trail", "crack", "molefield", "bigdirt_1", "bigdirt_2", "chain_ring"], "green"),
    "lightning": ("스킬 번개.jpg", 4, ["cloud", "bolt_1", "bolt_2", "flash", "bee_1", "bee_2", "stinger", "spark",
                                    "storm", "tbolt_1", "tbolt_2", "bigflash", "swarm", "hstinger", "hline", "bigburst"], "green"),
    "support": ("지원품 아이콘.jpg", 3, ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", None], "magenta"),
}

def key_alpha(rgb, bg, lo, hi):
    """배경색(bg)과의 RGB 거리로 알파를 만들고, 반투명 가장자리의 배경색 번짐을 제거한다."""
    d = np.sqrt(((rgb.astype(np.float32) - bg) ** 2).sum(axis=2))
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    a = alpha[..., None]
    col = np.where(a > 0.02, (rgb.astype(np.float32) - (1 - a) * bg) / np.maximum(a, 0.02), 0)
    return np.clip(col, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)

def sample_bg(rgb):
    """네 귀퉁이 12px 정사각형의 중간값 = 배경색(JPG라 순수색에서 조금 벗어남)."""
    h, w = rgb.shape[:2]
    pts = np.concatenate([rgb[:12, :12].reshape(-1, 3), rgb[:12, w-12:].reshape(-1, 3), rgb[h-12:, :12].reshape(-1, 3), rgb[h-12:, w-12:].reshape(-1, 3)])
    return np.median(pts, axis=0).astype(np.float32)

def main():
    OUT.mkdir(parents=True, exist_ok=True); PREVIEW.mkdir(parents=True, exist_ok=True)
    manifest = []
    for group, (fname, n, names, mode) in SHEETS.items():
        im = Image.open(SRC / fname).convert("RGB")
        rgb = np.asarray(im)
        bg = sample_bg(rgb)
        lo, hi = (55, 130) if mode == "green" else (70, 160)
        col, alpha = key_alpha(rgb, bg, lo, hi)
        size = im.size[0]; s = size / n
        if group == "support":   # 칸 경계의 얇은 회색 격자선 지우기
            for k in range(1, n):
                c = int(k * s); alpha[:, c-7:c+8] = 0; alpha[c-7:c+8, :] = 0
        rgba = np.dstack([col, alpha])
        dbg = Image.new("RGBA", im.size, (90, 90, 100, 255)); dbg.alpha_composite(Image.fromarray(rgba, "RGBA")); dbg.convert("RGB").save(PREVIEW / f"debug_{group}.png")
        cells = []
        for idx, name in enumerate(names):
            if name is None: continue
            c, r = idx % n, idx // n
            x0, y0, x1, y1 = int(c * s), int(r * s), int((c + 1) * s), int((r + 1) * s)
            cell = rgba[y0:y1, x0:x1]
            a = cell[..., 3] > 30
            ys, xs = np.where(a)
            if xs.size == 0: print(f"  {group}/{name}: 비어 있음"); continue
            m = 2
            by0, by1 = max(0, ys.min() - m), min(cell.shape[0], ys.max() + 1 + m)
            bx0, bx1 = max(0, xs.min() - m), min(cell.shape[1], xs.max() + 1 + m)
            frame = Image.fromarray(cell[by0:by1, bx0:bx1].copy(), "RGBA")
            fn = f"{group}_{name}.png"
            frame.save(OUT / fn); manifest.append(fn); cells.append((name, frame))
            print(f"  {fn}: {frame.width}x{frame.height}")
        # 미리보기: 칸을 한 줄로
        cw = max(f.width for _, f in cells) + 8; ch = max(f.height for _, f in cells) + 8
        pv = Image.new("RGBA", (cw * len(cells), ch), (90, 90, 100, 255))
        for i, (_, f) in enumerate(cells): pv.alpha_composite(f, (i * cw + 4, 4))
        pv.convert("RGB").save(PREVIEW / f"preview_{group}.png")
    print(len(manifest), "sprites")

if __name__ == "__main__":
    main()
