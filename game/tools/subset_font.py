# 제목 글꼴(Jua, OFL) 부분 추출: index.html의 모든 표시 글자 + JS에서 제목 화면에 넣는 문구 → game/assets/ui/jua-title.woff2
# 시작 화면·로비 제목 문구를 바꾼 뒤에는 이 스크립트를 다시 실행해야 새 글자가 시스템 글꼴로 빠지지 않는다.
# 사용: python game/tools/subset_font.py
import re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC_FONT = ROOT / "game" / "assets_src" / "fonts" / "Jua-Regular.ttf"
OUT = ROOT / "game" / "assets" / "ui" / "jua-title.woff2"
CHARS_FILE = ROOT / "game" / "assets_src" / "fonts" / "jua-title-chars.txt"

# main.js 등에서 제목 화면(--font-title 적용 요소)에 JS로 써 넣는 문구는 여기에 추가한다
JS_STRINGS = [
    "시작하기", "이어하기", "님으로 접속 중", "서버에 연결하는 중…", "서버에 연결할 수 없어요",
    "인터넷 연결을 확인하고 다시 시도해 주세요.", "다시 시도", "계정을 만드는 중…", "접속 중…", "다른 아이디로",
    "서호팡팡수호대", "☁",
    # 로비(밝은 테마): 출동 버튼·장 제목·단계 이름·환경 이야기 제목 (src/themes.js와 맞출 것)
    "출동!", "장", "성공", "도전 전", "환경 이야기", "내 대원", "이전 장", "다음 장", "보스",
    "쓰레기 마을", "더러워진 개울", "뿌연 하늘", "불타는 숲", "플라스틱 바다", "뜨거운 지구",
    "학교 운동장", "학교 앞 골목", "놀이터", "재활용 센터 앞", "쓰레기 산",
    "빨래터 상류", "하수구 입구", "녹조 연못", "기름띠 개울", "개울 바닥",
    "큰길 도로변", "공장 굴뚝 지대", "미세먼지 경보의 날", "쓰레기 태우는 밭", "하늘 꼭대기",
    "등산로 입구", "벌목장", "외래종 습격", "산불", "숲의 심장",
    "해변", "갯벌", "기름 유출", "쓰레기 해류", "쓰레기 섬",
    "불 켜진 도시", "탄소 발전소", "녹아내리는 빙하", "이상기후", "지구의 심장",
    "쓰레기 산 대왕", "구정물 슬라임 왕", "스모그 드래곤", "산불 거인", "쓰레기 섬 문어왕", "탄소 대왕",
]
BASIC = "0123456789.!,~·:%+-/()[]?…ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

def main():
    html = (ROOT / "game" / "index.html").read_text(encoding="utf-8")
    body = re.sub(r"<style>.*?</style>", "", html, flags=re.S)
    body = re.sub(r"<script.*?</script>", "", body, flags=re.S)
    chars = set()
    for m in re.finditer(r">([^<]+)<|(?:placeholder|title|alt)=\"([^\"]*)\"", body):
        chars.update((m.group(1) or "") + (m.group(2) or ""))
    for s in JS_STRINGS: chars.update(s)
    chars.update(BASIC)
    text = "".join(sorted(c for c in chars if ord(c) > 32))
    CHARS_FILE.write_text(text, encoding="utf-8")
    subprocess.run([sys.executable, "-m", "fontTools.subset", str(SRC_FONT), f"--text-file={CHARS_FILE}",
                    "--flavor=woff2", f"--output-file={OUT}", "--layout-features=*", "--no-hinting"], check=True)
    print(f"glyphs {len(text)} → {OUT.name} {OUT.stat().st_size // 1024} KB")

if __name__ == "__main__":
    main()
