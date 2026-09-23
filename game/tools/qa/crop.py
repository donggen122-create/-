# 전투 캡처에서 화면 가운데(주인공 주변)를 잘라 확대한다: python crop.py in.png out.png [w h scale]
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 640
h = int(sys.argv[4]) if len(sys.argv) > 4 else 440
scale = int(sys.argv[5]) if len(sys.argv) > 5 else 1
im = Image.open(src)
cx, cy = im.width // 2, im.height // 2
crop = im.crop((cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2)).resize((w * scale, h * scale), Image.LANCZOS)
crop.save(dst)
print("saved", dst, crop.size)
