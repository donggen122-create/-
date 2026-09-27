#!/usr/bin/env python3
"""퍼즐 그림을 모으고 다듬어서 js/paintings.js 를 만드는 스크립트.

그림 출처(모두 오픈소스 패키지 안에 들어 있는 퍼블릭 도메인·CC0 이미지):
  - npm aquarelle 1.5.2 (MIT): 명화 이미지 모음
  - npm public-domain-wallpapers 1.3.2, 1.0.4 (MIT): 메트로폴리탄 미술관 오픈 액세스(CC0),
    NASA(퍼블릭 도메인), 국립중앙박물관 소장 옛 그림
  - PyPI scikit-image 0.26.0 (BSD): 예제 사진(CC0·퍼블릭 도메인)

실행:
  pip install pillow numpy
  python3 tools/build_pictures.py            # 이미지 만들기 + js/paintings.js, CREDITS.md 쓰기
  python3 tools/build_pictures.py --report   # 이미지는 그대로 두고 점검 결과만 보기

규칙(CLAUDE.md '그림 추가 규칙'과 같음):
  - 가운데 기준으로 최대 4:3(세로 그림은 3:4)까지만 자르고, 긴 변 800px, JPEG 품질 80
  - 한 가지 색이 넓게 퍼진 그림은 빼요: '단색' 비율(가장 많은 한 색이 차지하는 몫)이
    40% 넘으면 경고, 55% 넘으면 멈춰요. 우주 사진처럼 검은 바탕이 넓은 그림이 여기에 걸려요.
"""
import io
import json
import os
import sys
import tarfile
import urllib.request
import zipfile

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "assets", "paintings")
JS_OUT = os.path.join(ROOT, "js", "paintings.js")
CREDITS_OUT = os.path.join(ROOT, "CREDITS.md")

SOURCES = {
    "aq": ("https://registry.npmjs.org/aquarelle/-/aquarelle-1.5.2.tgz", "tgz"),
    "pdw": ("https://registry.npmjs.org/public-domain-wallpapers/-/public-domain-wallpapers-1.3.2.tgz", "tgz"),
    "pdw104": ("https://registry.npmjs.org/public-domain-wallpapers/-/public-domain-wallpapers-1.0.4.tgz", "tgz"),
    "sk": (
        "https://files.pythonhosted.org/packages/a1/b4/2528bb43c67d48053a7a649a9666432dc307d66ba02e3a6d5c40f46655df/scikit_image-0.26.0.tar.gz",
        "tgz",
    ),
}

SOURCE_TEXT = {
    "aq": "npm aquarelle 1.5.2 (images/{f})",
    "pdw": "The Met Open Access / npm public-domain-wallpapers 1.3.2 ({f})",
    "pdw104": "The Met Open Access / npm public-domain-wallpapers 1.0.4 ({f})",
    "nasa": "NASA (public domain) / npm public-domain-wallpapers 1.3.2 ({f})",
    "nasa104": "NASA (public domain) / npm public-domain-wallpapers 1.0.4 ({f})",
    "nmk": "국립중앙박물관 소장품 / npm public-domain-wallpapers 1.3.2 ({f})",
    "sk": "scikit-image 0.26.0 skimage/data/{f}",
}

# 카테고리: west 서양 명화 / east 동양·우리 옛 그림 / photo 사진
# 항목: (파일 이름, 출처, 원본 파일, 카테고리, 제목, 작가, 연도, 영문 제목, 영문 작가, 작가 사망 연도, 옵션)
# 옵션: anchor=(x,y) 자를 때 기준(0~1, 기본 가운데), box=(왼,위,오른,아래) 원본에서 먼저 잘라낼 영역,
#       obj=True 고른 배경을 걷어내고 그림만 남기기
NEW = [
    # ── 빈센트 반 고흐 (1890)
    ("vangogh-irises", "aq", "vangogh-i1.jpg", "west", "붓꽃", "빈센트 반 고흐", "1889", "Irises", "Vincent van Gogh", 1890, {}),
    ("vangogh-wheatfield-crows", "aq", "vangogh-fc.jpg", "west", "까마귀가 나는 밀밭", "빈센트 반 고흐", "1890", "Wheatfield with Crows", "Vincent van Gogh", 1890, {}),
    ("vangogh-noon-rest", "aq", "vangogh-rw.jpg", "west", "낮잠", "빈센트 반 고흐", "1890", "Noon – Rest from Work", "Vincent van Gogh", 1890, {}),
    ("vangogh-pollard-willows", "aq", "vangogh-pw.jpg", "west", "해 질 녘의 버드나무", "빈센트 반 고흐", "1888", "Pollard Willows with Setting Sun", "Vincent van Gogh", 1890, {}),
    ("vangogh-poppy-field", "aq", "vangogh-po.jpg", "west", "양귀비가 핀 들판", "빈센트 반 고흐", "1889", "Field with Poppies", "Vincent van Gogh", 1890, {}),
    ("vangogh-olive-trees", "aq", "vangogh-ot.jpg", "west", "노란 해와 올리브 나무", "빈센트 반 고흐", "1889", "Olive Trees with Yellow Sky and Sun", "Vincent van Gogh", 1890, {}),
    ("vangogh-thatched-cottages", "aq", "vangogh-tc.jpg", "west", "코르드빌의 초가집", "빈센트 반 고흐", "1890", "Thatched Cottages at Cordeville", "Vincent van Gogh", 1890, {}),
    ("vangogh-flower-beds", "aq", "vangogh-fb.jpg", "west", "네덜란드의 꽃밭", "빈센트 반 고흐", "1883", "Flower Beds in Holland", "Vincent van Gogh", 1890, {}),
    ("vangogh-ploughman", "aq", "vangogh-hp.jpg", "west", "집과 밭 가는 농부", "빈센트 반 고흐", "1889", "Landscape with House and Ploughman", "Vincent van Gogh", 1890, {}),
    ("vangogh-bouquet", "pdw", "met-436525.webp", "west", "꽃병의 꽃다발", "빈센트 반 고흐", "1890", "Bouquet of Flowers in a Vase", "Vincent van Gogh", 1890, {}),
    # ── 클로드 모네 (1926)
    ("monet-impression-sunrise", "aq", "monet-sr.jpg", "west", "인상, 해돋이", "클로드 모네", "1872", "Impression, Sunrise", "Claude Monet", 1926, {}),
    ("monet-japanese-bridge", "aq", "monet-jb.jpg", "west", "수련 연못과 일본식 다리", "클로드 모네", "1899", "The Water-Lily Pond", "Claude Monet", 1926, {}),
    ("monet-lilies-clouds", "aq", "monet-w6.jpg", "west", "수련과 구름", "클로드 모네", "1903", "Water-Lilies: The Clouds", "Claude Monet", 1926, {}),
    ("monet-giverny-irises", "aq", "monet-gv.jpg", "west", "지베르니 정원의 붓꽃", "클로드 모네", "1900", "Irises in Monet's Garden", "Claude Monet", 1926, {}),
    ("monet-chrysanthemums", "aq", "monet-cy.jpg", "west", "국화", "클로드 모네", "1897", "Chrysanthemums", "Claude Monet", 1926, {}),
    ("monet-green-lilies", "aq", "monet-w2.jpg", "west", "초록빛 수련", "클로드 모네", "1900년대", "Water Lilies", "Claude Monet", 1926, {}),
    # ── 조르주 쇠라 (1891)
    ("seurat-port-en-bessin", "aq", "seurat-pb.jpg", "west", "포르탕베생의 일요일", "조르주 쇠라", "1888", "Sunday at Port-en-Bessin", "Georges Seurat", 1891, {}),
    ("seurat-bathers", "aq", "seurat-ba.jpg", "west", "아니에르의 물놀이", "조르주 쇠라", "1884", "Bathers at Asnières", "Georges Seurat", 1891, {}),
    ("seurat-grande-jatte", "aq", "seurat-il.jpg", "west", "그랑드 자트 섬", "조르주 쇠라", "1884", "The Island of La Grande Jatte", "Georges Seurat", 1891, {}),
    ("seurat-la-maria", "aq", "seurat-lm.jpg", "west", "옹플뢰르의 마리아호", "조르주 쇠라", "1886", "The 'Maria' at Honfleur", "Georges Seurat", 1891, {}),
    ("seurat-honfleur", "aq", "seurat-he.jpg", "west", "옹플뢰르 항구 입구", "조르주 쇠라", "1886", "The Harbour Entrance at Honfleur", "Georges Seurat", 1891, {}),
    ("seurat-side-show", "aq", "seurat-ss.jpg", "west", "서커스 선전 공연", "조르주 쇠라", "1888", "Circus Sideshow", "Georges Seurat", 1891, {}),
    # ── 피에르오귀스트 르누아르 (1919)
    ("renoir-boating-party", "aq", "renoir-bp.jpg", "west", "뱃놀이 일행의 점심", "피에르오귀스트 르누아르", "1881", "Luncheon of the Boating Party", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-gust-of-wind", "aq", "renoir-gw.jpg", "west", "돌풍", "피에르오귀스트 르누아르", "1872", "The Gust of Wind", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-guernsey", "aq", "renoir-cb.jpg", "west", "건지섬 해변의 아이들", "피에르오귀스트 르누아르", "1883", "Children on the Seashore, Guernsey", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-doges-palace", "aq", "renoir-dp.jpg", "west", "베네치아 두칼레 궁전", "피에르오귀스트 르누아르", "1881", "The Doge's Palace, Venice", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-summer-path", "aq", "renoir-cf.jpg", "west", "여름 시골 오솔길", "피에르오귀스트 르누아르", "1874", "Country Footpath in the Summer", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-noirmoutier", "aq", "renoir-nm.jpg", "west", "누아르무티에", "피에르오귀스트 르누아르", "1892", "Noirmoutier", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-montmartre-garden", "aq", "renoir-gg.jpg", "west", "몽마르트르 정원의 소녀", "피에르오귀스트 르누아르", "", "Young Girl in the Garden at Montmartre", "Pierre-Auguste Renoir", 1919, {}),
    ("renoir-seashore", "pdw", "met-437430.webp", "west", "바닷가의 여인", "피에르오귀스트 르누아르", "1883", "By the Seashore", "Pierre-Auguste Renoir", 1919, {"anchor": (0.5, 0.2)}),
    ("renoir-charpentier", "pdw", "met-438815.webp", "west", "샤르팡티에 부인과 아이들", "피에르오귀스트 르누아르", "1878", "Madame Georges Charpentier and Her Children", "Pierre-Auguste Renoir", 1919, {}),
    # ── 폴 세잔 (1906)
    ("cezanne-card-players", "aq", "cezanne-cp.jpg", "west", "카드놀이 하는 사람들", "폴 세잔", "1890년대", "The Card Players", "Paul Cézanne", 1906, {}),
    ("cezanne-sainte-victoire", "aq", "cezanne-sv.jpg", "west", "생트빅투아르 산", "폴 세잔", "1880년대", "Mont Sainte-Victoire", "Paul Cézanne", 1906, {}),
    ("cezanne-boy-red-vest", "aq", "cezanne-rv.jpg", "west", "붉은 조끼를 입은 소년", "폴 세잔", "1888–1890", "Boy in a Red Vest", "Paul Cézanne", 1906, {}),
    ("cezanne-estaque", "aq", "cezanne-le.jpg", "west", "레스타크의 바다", "폴 세잔", "1880년대", "View from L'Estaque", "Paul Cézanne", 1906, {}),
    ("cezanne-flowers-fruit", "aq", "cezanne-ff.jpg", "west", "꽃과 과일 정물", "폴 세잔", "1888–1890", "Still Life with Flowers and Fruit", "Paul Cézanne", 1906, {}),
    ("cezanne-auvers", "aq", "cezanne-vo.jpg", "west", "오베르쉬르우아즈 풍경", "폴 세잔", "1873", "View of Auvers-sur-Oise", "Paul Cézanne", 1906, {}),
    ("cezanne-red-roof", "aq", "cezanne-rr.jpg", "west", "붉은 지붕의 집", "폴 세잔", "1887–1890", "House with Red Roof", "Paul Cézanne", 1906, {}),
    ("cezanne-bibemus", "aq", "cezanne-cq.jpg", "west", "비베뮈스 채석장", "폴 세잔", "1900년경", "Corner of Bibemus Quarry", "Paul Cézanne", 1906, {}),
    ("cezanne-maison-maria", "aq", "cezanne-mm.jpg", "west", "마리아의 집", "폴 세잔", "1895", "Maison Maria with a View of Château Noir", "Paul Cézanne", 1906, {}),
    ("cezanne-chateau-noir", "aq", "cezanne-n3.jpg", "west", "검은 성", "폴 세잔", "1900–1904", "Château Noir", "Paul Cézanne", 1906, {}),
    ("cezanne-viaduct", "pdw", "met-435877.webp", "west", "생트빅투아르 산과 아르크 계곡", "폴 세잔", "1882–1885", "Mont Sainte-Victoire and the Viaduct of the Arc River Valley", "Paul Cézanne", 1906, {}),
    ("cezanne-seated-peasant", "pdw", "met-437990.webp", "west", "앉아 있는 농부", "폴 세잔", "1892–1896년경", "Seated Peasant", "Paul Cézanne", 1906, {"anchor": (0.5, 0.3)}),
    # ── 구스타프 클림트 (1918)
    ("klimt-adele", "aq", "klimt-ab.jpg", "west", "아델레 블로흐바우어의 초상", "구스타프 클림트", "1907", "Portrait of Adele Bloch-Bauer I", "Gustav Klimt", 1918, {}),
    ("klimt-tree-of-life", "aq", "klimt-tl.jpg", "west", "생명의 나무", "구스타프 클림트", "1909년경", "The Tree of Life", "Gustav Klimt", 1918, {}),
    ("klimt-unterach-church", "aq", "klimt-cw.jpg", "west", "운터라흐의 교회", "구스타프 클림트", "1916", "Church in Unterach on the Attersee", "Gustav Klimt", 1918, {}),
    ("klimt-beech-forest", "aq", "klimt-be.jpg", "west", "너도밤나무 숲", "구스타프 클림트", "1902", "Beech Forest", "Gustav Klimt", 1918, {}),
    ("klimt-oleander", "aq", "klimt-go.jpg", "west", "협죽도와 두 소녀", "구스타프 클림트", "1890년경", "Two Girls with an Oleander", "Gustav Klimt", 1918, {}),
    # ── 에드가 드가 (1917)
    ("degas-dance-class", "aq", "degas-d3.jpg", "west", "발레 수업", "에드가 드가", "1870년경", "The Dancing Class", "Edgar Degas", 1917, {}),
    ("degas-pink-dancers", "aq", "degas-pd.jpg", "west", "분홍 옷의 무희들", "에드가 드가", "1880년대", "Pink Dancers", "Edgar Degas", 1917, {}),
    ("degas-four-dancers", "aq", "degas-fd.jpg", "west", "네 명의 무희", "에드가 드가", "1899", "Four Dancers", "Edgar Degas", 1917, {}),
    ("degas-masked-dancers", "aq", "degas-em.jpg", "west", "가면 쓴 무희들의 입장", "에드가 드가", "1879", "The Entrance of the Masked Dancers", "Edgar Degas", 1917, {}),
    ("degas-dance-foyer", "aq", "degas-df.jpg", "west", "오페라 극장의 무용 연습실", "에드가 드가", "1872", "The Dance Foyer at the Opéra", "Edgar Degas", 1917, {}),
    ("degas-race-horses", "aq", "degas-rh.jpg", "west", "경주마", "에드가 드가", "1880년대", "Race Horses", "Edgar Degas", 1917, {}),
    ("degas-two-dancers", "aq", "degas-td.jpg", "west", "두 발레리나", "에드가 드가", "1879", "Two Dancers", "Edgar Degas", 1917, {}),
    ("degas-print-collector", "pdw", "met-436122.webp", "west", "판화 수집가", "에드가 드가", "1866", "The Collector of Prints", "Edgar Degas", 1917, {"anchor": (0.5, 0.3)}),
    ("degas-tissot", "pdw", "met-436144.webp", "west", "제임스 티소의 초상", "에드가 드가", "1867–1868년경", "James-Jacques-Joseph Tissot", "Edgar Degas", 1917, {"anchor": (0.5, 0.3)}),
    # ── 에두아르 마네 (1883)
    ("manet-folies-bergere", "aq", "manet-b2.jpg", "west", "폴리베르제르의 술집", "에두아르 마네", "1882", "A Bar at the Folies-Bergère", "Édouard Manet", 1883, {}),
    ("manet-monet-boat", "aq", "manet-mp.jpg", "west", "배 위에서 그림 그리는 모네", "에두아르 마네", "1874", "Monet Painting on His Studio Boat", "Édouard Manet", 1883, {}),
    ("manet-blue-sofa", "aq", "manet-mm.jpg", "west", "파란 소파 위의 마네 부인", "에두아르 마네", "1874", "Madame Manet on a Blue Sofa", "Édouard Manet", 1883, {}),
    ("manet-steamboat", "aq", "manet-sb.jpg", "west", "불로뉴를 떠나는 증기선", "에두아르 마네", "1864", "Steamboat Leaving Boulogne", "Édouard Manet", 1883, {}),
    ("manet-masked-ball", "aq", "manet-mb.jpg", "west", "오페라 극장의 가면무도회", "에두아르 마네", "1873", "Masked Ball at the Opera", "Édouard Manet", 1883, {}),
    ("manet-fishing", "aq", "manet-fi.jpg", "west", "낚시", "에두아르 마네", "1862–1863", "Fishing", "Édouard Manet", 1883, {}),
    ("manet-monet-family", "pdw", "met-436965.webp", "west", "아르장퇴유 정원의 모네 가족", "에두아르 마네", "1874", "The Monet Family in Their Garden at Argenteuil", "Édouard Manet", 1883, {}),
    # ── 윌리엄 터너 (1851)
    ("turner-temeraire", "aq", "turner-ft.jpg", "west", "전함 테메레르", "윌리엄 터너", "1839", "The Fighting Temeraire", "J. M. W. Turner", 1851, {}),
    ("turner-grand-canal", "aq", "turner-gc.jpg", "west", "베네치아 대운하", "윌리엄 터너", "1835", "The Grand Canal, Venice", "J. M. W. Turner", 1851, {}),
    ("turner-wolverhampton", "aq", "turner-wh.jpg", "west", "울버햄프턴 장터", "윌리엄 터너", "1796", "Wolverhampton, Staffordshire", "J. M. W. Turner", 1851, {}),
    ("turner-carthage", "aq", "turner-dc.jpg", "west", "카르타고 제국의 몰락", "윌리엄 터너", "1817", "The Decline of the Carthaginian Empire", "J. M. W. Turner", 1851, {}),
    ("turner-avalanche", "aq", "turner-fa.jpg", "west", "그라우뷘덴의 눈사태", "윌리엄 터너", "1810", "The Fall of an Avalanche in the Grisons", "J. M. W. Turner", 1851, {}),
    ("turner-stonehenge", "aq", "turner-sh.jpg", "west", "스톤헨지", "윌리엄 터너", "1825년경", "Stonehenge", "J. M. W. Turner", 1851, {}),
    ("turner-rome-vatican", "aq", "turner-rv.jpg", "west", "바티칸에서 본 로마", "윌리엄 터너", "1820", "Rome, from the Vatican", "J. M. W. Turner", 1851, {}),
    ("turner-venice-salute", "pdw", "met-437853.webp", "west", "살루테 성당에서 본 베네치아", "윌리엄 터너", "1835년경", "Venice, from the Porch of Madonna della Salute", "J. M. W. Turner", 1851, {}),
    # ── 제임스 휘슬러 (1903)
    ("whistler-mother", "aq", "whistler-wm.jpg", "west", "화가의 어머니", "제임스 휘슬러", "1871", "Arrangement in Grey and Black No. 1", "James McNeill Whistler", 1903, {}),
    ("whistler-golden-screen", "aq", "whistler-gs.jpg", "west", "금빛 병풍", "제임스 휘슬러", "1864", "The Golden Screen", "James McNeill Whistler", 1903, {}),
    ("whistler-battersea-reach", "aq", "whistler-br.jpg", "west", "옛 배터시 강가", "제임스 휘슬러", "1863", "Grey and Silver: Old Battersea Reach", "James McNeill Whistler", 1903, {}),
    ("whistler-white-no3", "aq", "whistler-sw.jpg", "west", "흰색 교향곡 3번", "제임스 휘슬러", "1867", "Symphony in White, No. 3", "James McNeill Whistler", 1903, {}),
    ("whistler-battersea-bridge", "aq", "whistler-bb.jpg", "west", "녹턴: 배터시 다리", "제임스 휘슬러", "1872년경", "Nocturne: Battersea Bridge", "James McNeill Whistler", 1903, {}),
    ("whistler-white-red", "aq", "whistler-wr.jpg", "west", "흰색과 빨강의 교향곡", "제임스 휘슬러", "1868년경", "Symphony in White and Red", "James McNeill Whistler", 1903, {}),
    # ── 메리 커샛 (1926)
    ("cassatt-the-tea", "aq", "cassatt-tt.jpg", "west", "차 한 잔", "메리 커샛", "1880", "The Tea", "Mary Cassatt", 1926, {}),
    ("cassatt-blue-armchair", "aq", "cassatt-lg.jpg", "west", "파란 안락의자의 소녀", "메리 커샛", "1878", "Little Girl in a Blue Armchair", "Mary Cassatt", 1926, {}),
    ("cassatt-garden", "aq", "cassatt-cg.jpg", "west", "정원의 아이들", "메리 커샛", "1878", "Children in a Garden", "Mary Cassatt", 1926, {}),
    ("cassatt-in-the-park", "aq", "cassatt-ip.jpg", "west", "공원에서", "메리 커샛", "1894", "In the Park", "Mary Cassatt", 1926, {}),
    ("cassatt-red-poppies", "aq", "cassatt-rp.jpg", "west", "붉은 양귀비", "메리 커샛", "1874–1880", "Red Poppies", "Mary Cassatt", 1926, {}),
    ("cassatt-conversation", "aq", "cassatt-tc.jpg", "west", "대화", "메리 커샛", "1896", "The Conversation", "Mary Cassatt", 1926, {}),
    ("cassatt-theater", "aq", "cassatt-th.jpg", "west", "극장에서", "메리 커샛", "1879", "At the Theater", "Mary Cassatt", 1926, {}),
    ("cassatt-in-the-box", "aq", "cassatt-ib.jpg", "west", "극장 관람석", "메리 커샛", "1879", "In the Box", "Mary Cassatt", 1926, {}),
    ("cassatt-comforting-baby", "aq", "cassatt-sc.jpg", "west", "아기를 달래는 수전", "메리 커샛", "1881", "Susan Comforting the Baby", "Mary Cassatt", 1926, {}),
    ("cassatt-summertime", "aq", "cassatt-st.jpg", "west", "여름날", "메리 커샛", "1894", "Summertime", "Mary Cassatt", 1926, {}),
    # ── 폴 고갱 (1903)
    ("gauguin-arearea", "aq", "gauguin-aa.jpg", "west", "아레아레아(즐거움)", "폴 고갱", "1892", "Arearea", "Paul Gauguin", 1903, {}),
    ("gauguin-swineherd", "aq", "gauguin-sh.jpg", "west", "돼지 치는 소년", "폴 고갱", "1888", "The Swineherd, Brittany", "Paul Gauguin", 1903, {}),
    ("gauguin-tahiti", "aq", "gauguin-tl.jpg", "west", "타히티 풍경", "폴 고갱", "1893", "Tahitian Landscape", "Paul Gauguin", 1903, {}),
    ("gauguin-bouquet", "aq", "gauguin-bf.jpg", "west", "꽃다발", "폴 고갱", "1896", "Bouquet of Flowers", "Paul Gauguin", 1903, {}),
    ("gauguin-brittany", "aq", "gauguin-bl.jpg", "west", "브르타뉴 풍경", "폴 고갱", "1894", "Breton Landscape", "Paul Gauguin", 1903, {}),
    ("gauguin-day-of-gods", "aq", "gauguin-dg.jpg", "west", "신들의 날", "폴 고갱", "1894", "Day of the Gods", "Paul Gauguin", 1903, {}),
    ("gauguin-sacred-spring", "aq", "gauguin-ms.jpg", "west", "신비로운 샘", "폴 고갱", "1894", "Miraculous Source", "Paul Gauguin", 1903, {}),
    ("gauguin-by-the-sea", "aq", "gauguin-bs.jpg", "west", "바닷가에서", "폴 고갱", "1892", "By the Sea", "Paul Gauguin", 1903, {}),
    # ── 에드바르 뭉크 (1944)
    ("munch-the-sun", "aq", "munch-su.jpg", "west", "태양", "에드바르 뭉크", "1911", "The Sun", "Edvard Munch", 1944, {}),
    ("munch-dance-of-life", "aq", "munch-dl.jpg", "west", "생의 춤", "에드바르 뭉크", "1899–1900", "The Dance of Life", "Edvard Munch", 1944, {}),
    ("munch-ladies-bridge", "aq", "munch-lb.jpg", "west", "다리 위의 여인들", "에드바르 뭉크", "1903", "The Ladies on the Bridge", "Edvard Munch", 1944, {}),
    ("munch-melancholy", "aq", "munch-mc.jpg", "west", "멜랑콜리", "에드바르 뭉크", "1894", "Melancholy", "Edvard Munch", 1944, {}),
    # ── 바실리 칸딘스키 (1944)
    ("kandinsky-composition-vii", "aq", "kandinsky-c7.jpg", "west", "구성 VII", "바실리 칸딘스키", "1913", "Composition VII", "Wassily Kandinsky", 1944, {}),
    ("kandinsky-composition-vi", "aq", "kandinsky-c6.jpg", "west", "구성 VI", "바실리 칸딘스키", "1913", "Composition VI", "Wassily Kandinsky", 1944, {}),
    ("kandinsky-kyiv-gate", "aq", "kandinsky-gg.jpg", "west", "키이우의 큰 문", "바실리 칸딘스키", "1928", "The Great Gate of Kiev", "Wassily Kandinsky", 1944, {}),
    ("kandinsky-in-the-blue", "aq", "kandinsky-ib.jpg", "west", "파랑 속에서", "바실리 칸딘스키", "1925", "In the Blue", "Wassily Kandinsky", 1944, {}),
    ("kandinsky-red-spot", "aq", "kandinsky-rs.jpg", "west", "붉은 점 II", "바실리 칸딘스키", "1921", "Red Spot II", "Wassily Kandinsky", 1944, {}),
    # ── 피트 몬드리안 (1944)
    ("mondrian-red-tree", "aq", "mondrian-rt.jpg", "west", "붉은 나무", "피트 몬드리안", "1910년경", "Evening; Red Tree", "Piet Mondrian", 1944, {}),
    ("mondrian-composition-a", "aq", "mondrian-ca.jpg", "west", "구성 A", "피트 몬드리안", "1923", "Composition A", "Piet Mondrian", 1944, {}),
    ("mondrian-windmill", "aq", "mondrian-wg.jpg", "west", "게인강의 풍차", "피트 몬드리안", "1907", "Windmill on the Gein", "Piet Mondrian", 1944, {}),
    ("mondrian-gray-tree", "aq", "mondrian-gt.jpg", "west", "회색 나무", "피트 몬드리안", "1912", "Gray Tree", "Piet Mondrian", 1944, {}),
    # ── 파울 클레 (1940)
    ("klee-autumn-messenger", "aq", "klee-ma.jpg", "west", "가을의 전령", "파울 클레", "1922", "Messenger of Autumn", "Paul Klee", 1940, {}),
    ("klee-yellow-birds", "aq", "klee-yb.jpg", "west", "노란 새가 있는 풍경", "파울 클레", "1923", "Landscape with Yellow Birds", "Paul Klee", 1940, {}),
    ("klee-saint-germain", "aq", "klee-hg.jpg", "west", "생제르맹의 집들", "파울 클레", "1914", "In the Houses of Saint-Germain", "Paul Klee", 1940, {}),
    ("klee-around-fish", "aq", "klee-af.jpg", "west", "물고기 둘레", "파울 클레", "1926", "Around the Fish", "Paul Klee", 1940, {}),
    ("klee-red-balloon", "aq", "klee-rb.jpg", "west", "빨간 풍선", "파울 클레", "1922", "Red Balloon", "Paul Klee", 1940, {}),
    ("klee-transparent", "aq", "klee-tp.jpg", "west", "투명한 원근", "파울 클레", "1921", "Transparent-Perspectival", "Paul Klee", 1940, {}),
    # ── 앙드레 드랭 (1954)
    ("derain-turning-road", "aq", "derain-tr.jpg", "west", "굽은 길, 레스타크", "앙드레 드랭", "1906", "The Turning Road, L'Estaque", "André Derain", 1954, {}),
    ("derain-thames", "aq", "derain-tt.jpg", "west", "템스강", "앙드레 드랭", "1906", "The Thames", "André Derain", 1954, {}),
    ("derain-pool-of-london", "aq", "derain-pl.jpg", "west", "런던의 항구", "앙드레 드랭", "1906", "The Pool of London", "André Derain", 1954, {}),
    ("derain-blackfriars", "aq", "derain-bf.jpg", "west", "블랙프라이어스 다리", "앙드레 드랭", "1906", "Blackfriars Bridge", "André Derain", 1954, {}),
    ("derain-charing-cross", "aq", "derain-cb.jpg", "west", "채링크로스 다리", "앙드레 드랭", "1906", "Charing Cross Bridge", "André Derain", 1954, {}),
    # ── 앙리 마티스 (1954)
    ("matisse-harmony-red", "aq", "matisse-hr.jpg", "west", "빨강의 조화", "앙리 마티스", "1908", "Harmony in Red", "Henri Matisse", 1954, {}),
    ("matisse-collioure", "aq", "matisse-vc.jpg", "west", "콜리우르 풍경", "앙리 마티스", "1906", "View of Collioure", "Henri Matisse", 1954, {}),
    ("matisse-tangier", "aq", "matisse-bt.jpg", "west", "탕헤르 풍경", "앙리 마티스", "1912", "The Beach of Tangier", "Henri Matisse", 1954, {}),
    ("matisse-seville", "aq", "matisse-sl.jpg", "west", "세비야 정물", "앙리 마티스", "1911", "Spanish Still Life, Seville", "Henri Matisse", 1954, {}),
    ("matisse-green-sideboard", "aq", "matisse-sg.jpg", "west", "초록 찬장이 있는 정물", "앙리 마티스", "1928", "Still Life with Green Sideboard", "Henri Matisse", 1954, {}),
    # ── 메트로폴리탄 미술관의 여러 화가
    ("roesen-still-life", "pdw", "met-11938.webp", "west", "꽃과 과일이 가득한 정물", "세버린 로즌", "1850–1855", "Still Life: Flowers and Fruit", "Severin Roesen", 1872, {}),
    ("fantin-latour-still-life", "pdw", "met-436293.webp", "west", "과일과 꽃이 있는 정물", "앙리 팡탱라투르", "1866", "Still Life with Flowers and Fruit", "Henri Fantin-Latour", 1904, {}),
    ("fantin-latour-summer-flowers", "pdw", "met-438031.webp", "west", "여름 꽃", "앙리 팡탱라투르", "1880", "Summer Flowers", "Henri Fantin-Latour", 1904, {}),
    ("caillebotte-chrysanthemums", "pdw", "met-671456.webp", "west", "정원의 국화", "귀스타브 카유보트", "1893", "Chrysanthemums in the Garden at Petit-Gennevilliers", "Gustave Caillebotte", 1894, {}),
    ("redon-vase", "pdw", "met-437382.webp", "west", "분홍 배경의 꽃병", "오딜롱 르동", "1906년경", "Vase of Flowers (Pink Background)", "Odilon Redon", 1916, {}),
    ("robinson-low-tide", "pdw", "met-19523.webp", "west", "썰물, 리버사이드 요트 클럽", "시어도어 로빈슨", "1894", "Low Tide, Riverside Yacht Club", "Theodore Robinson", 1896, {}),
    ("lerolle-organ", "pdw", "met-436880.webp", "west", "오르간 연습", "앙리 르롤", "1885", "The Organ Rehearsal", "Henry Lerolle", 1929, {}),
    ("puvis-shepherds-song", "pdw", "met-437344.webp", "west", "목동의 노래", "피에르 퓌비 드 샤반", "1891", "The Shepherd's Song", "Pierre Puvis de Chavannes", 1898, {}),
    ("durand-thanatopsis", "pdw", "met-10793.webp", "west", "「타나톱시스」의 풍경", "애셔 브라운 듀랜드", "1850", "Landscape—Scene from \"Thanatopsis\"", "Asher Brown Durand", 1886, {}),
    ("lorrain-sunrise", "pdw", "met-435907.webp", "west", "해돋이", "클로드 로랭", "1646–1647년경", "Sunrise", "Claude Lorrain", 1682, {}),
    ("gainsborough-upland", "pdw", "met-436441.webp", "west", "숲이 우거진 언덕", "토머스 게인즈버러", "1783년경", "Wooded Upland Landscape", "Thomas Gainsborough", 1788, {}),
    ("gericault-aqueduct", "pdw", "met-436455.webp", "west", "수도교가 있는 저녁 풍경", "테오도르 제리코", "1818", "Evening: Landscape with an Aqueduct", "Théodore Géricault", 1824, {}),
    ("koninck-landscape", "pdw", "met-436831.webp", "west", "넓게 펼쳐진 숲 풍경", "필립스 코닝크", "1670년대", "An Extensive Wooded Landscape", "Philips Koninck", 1688, {}),
    ("van-der-neer-sunset", "pdw", "met-437191.webp", "west", "해 질 녘 풍경", "아르트 반 데르 네르", "1650년대", "Landscape at Sunset", "Aert van der Neer", 1677, {}),
    ("post-brazil", "pdw", "met-437323.webp", "west", "브라질 풍경", "프란스 포스트", "1650", "A Brazilian Landscape", "Frans Post", 1680, {}),
    ("carnevale-birth-of-virgin", "pdw", "met-435848.webp", "west", "성모 마리아의 탄생", "프라 카르네발레", "1467", "The Birth of the Virgin", "Fra Carnevale", 1484, {}),
    ("david-virgin-angels", "pdw", "met-436102.webp", "west", "네 천사와 성모자", "헤라르트 다비트", "1510–1515년경", "Virgin and Child with Four Angels", "Gerard David", 1523, {}),
    ("stevens-japanese-robe", "pdw", "met-437756.webp", "west", "일본 옷", "알프레드 스테뱅스", "1872년경", "The Japanese Robe", "Alfred Stevens", 1906, {"anchor": (0.5, 0.3)}),
    ("de-witte-oude-kerk", "pdw", "met-438490.webp", "west", "델프트 구교회 안", "에마뉘엘 더 비테", "1650년경", "Interior of the Oude Kerk, Delft", "Emanuel de Witte", 1692, {}),
    ("goya-josefa", "pdw", "met-436543.webp", "west", "호세파 데 카스티야의 초상", "프란시스코 고야", "1804", "Josefa de Castilla Portugal y van Asbrock de Garcini", "Francisco de Goya", 1828, {"anchor": (0.5, 0.25)}),
    ("goya-red-boy", "pdw", "met-436545.webp", "west", "붉은 옷의 소년", "프란시스코 고야", "1787–1788", "Manuel Osorio Manrique de Zuñiga", "Francisco de Goya", 1828, {"anchor": (0.5, 0.4)}),
    ("jacometto-portrait", "pdw", "met-459027.webp", "west", "수녀로 보이는 여인의 초상", "야코메토 베네치아노", "1485–1495년경", "Portrait of a Woman, Possibly a Nun of San Secondo", "Jacometto Veneziano", 1497, {"anchor": (0.5, 0.3)}),
    ("gaulli-portrait", "pdw", "met-643540.webp", "west", "여인의 초상", "조반니 바티스타 가울리", "1670년대", "Portrait of a Woman", "Giovanni Battista Gaulli", 1709, {"anchor": (0.5, 0.25)}),
    ("aivazovsky-stormy-sea", "pdw", "met-435570.webp", "west", "폭풍우 속의 배", "이반 아이바좁스키", "1892", "A Ship in a Stormy Sea", "Ivan Aivazovsky", 1900, {}),
    ("courbet-calm-sea", "pdw", "met-436005.webp", "west", "고요한 바다", "귀스타브 쿠르베", "1869", "The Calm Sea", "Gustave Courbet", 1877, {}),
    ("bruegel-harvesters", "pdw104", "met-435809.webp", "west", "추수하는 사람들", "피터르 브뤼헐", "1565", "The Harvesters", "Pieter Bruegel the Elder", 1569, {}),
    # ── 동양·우리 옛 그림
    ("yi-am-mother-dog", "nmk", "nmk-331.webp", "east", "어미 개와 강아지", "이암", "16세기", "Mother Dog and Puppies", "Yi Am", 1566, {"anchor": (0.5, 0.6)}),
    ("joseon-winter-landscape", "nmk", "nmk-332.webp", "east", "겨울 산수", "작가 모름(조선)", "조선 시대", "Winter Landscape", "Unknown (Joseon)", None, {}),
    ("joseon-flowers-insects", "nmk", "nmk-363.webp", "east", "꽃과 벌레", "작가 모름(조선)", "조선 시대", "Flowers and Insects", "Unknown (Joseon)", None, {"anchor": (0.5, 0.6)}),
    ("joseon-landscape", "nmk", "nmk-387.webp", "east", "산수도", "작가 모름(조선)", "조선 시대", "Landscape Painting", "Unknown (Joseon)", None, {}),
    ("joseon-hong-nakseong", "nmk", "nmk-501.webp", "east", "홍낙성 초상", "작가 모름(조선)", "조선 시대", "Portrait of Hong Nakseong", "Unknown (Joseon)", None, {"anchor": (0.5, 0.15)}),
    ("joseon-yi-gilbo", "nmk", "nmk-660.webp", "east", "이길보 초상", "작가 모름(조선)", "조선 시대", "Portrait of Yi Gilbo", "Unknown (Joseon)", None, {}),
    ("zhao-yuan-landscape", "pdw", "met-45650.webp", "east", "원나라 산수화", "조원", "14세기 후반", "Landscape", "Zhao Yuan", None, {}),
    ("sakai-oho-rivers", "pdw", "met-53427.webp", "east", "여섯 개의 맑은 강", "사카이 오호", "1839년경", "Six Jewel Rivers", "Sakai Ōho", 1841, {}),
    ("hiroshige-rivers", "pdw", "met-53449.webp", "east", "여러 지방의 맑은 강", "우타가와 히로시게", "1857", "Six Jewel Rivers from Various Provinces", "Utagawa Hiroshige", 1858, {"box": (155, 130, 972, 1350)}),
    # ── 사진
    ("le-gray-great-wave", "pdw", "met-261941.webp", "photo", "세트의 큰 파도", "귀스타브 르 그레", "1857", "The Great Wave, Sète", "Gustave Le Gray", 1884, {}),
    ("photo-cat", "sk", "chelsea.png", "photo", "고양이 첼시", "스테판 반 데르 발트", "", "Chelsea the cat", "Stéfan van der Walt (CC0)", None, {}),
    ("photo-coffee", "sk", "coffee.png", "photo", "커피 한 잔", "레이철 미케티", "", "Coffee cup", "Rachel Michetti (CC0)", None, {}),
    ("photo-astronaut", "sk", "astronaut.png", "photo", "우주비행사 아일린 콜린스", "미국 항공우주국(NASA)", "", "Astronaut Eileen Collins", "NASA", None, {}),
    ("photo-falcon9", "sk", "rocket.jpg", "photo", "팰컨 9 로켓 발사", "스페이스X", "2015", "Falcon 9 launch carrying DSCOVR", "SpaceX", None, {}),
    ("nasa-blue-marble", "nasa", "nasa-as17-148-22727.webp", "photo", "푸른 구슬 지구", "미국 항공우주국(NASA)", "1972", "The Blue Marble (Apollo 17)", "NASA", None, {}),
    ("nasa-full-moon", "nasa", "nasa-as17-152-23311.webp", "photo", "보름달", "미국 항공우주국(NASA)", "1972", "Full Moon (Apollo 17)", "NASA", None, {}),
    ("nasa-aldrin", "nasa", "nasa-as11-40-5873.webp", "photo", "달 위의 버즈 올드린", "미국 항공우주국(NASA)", "1969", "Buzz Aldrin on the Moon (Apollo 11)", "NASA", None, {}),
    ("nasa-apollo-flag", "nasa", "nasa-as11-40-5874.webp", "photo", "달에 꽂은 깃발", "미국 항공우주국(NASA)", "1969", "Aldrin beside the flag (Apollo 11)", "NASA", None, {}),
    ("nasa-apollo17-boulder", "nasa", "nasa-as17-140-21496.webp", "photo", "달의 큰 바위와 우주비행사", "미국 항공우주국(NASA)", "1972", "Harrison Schmitt beside a boulder (Apollo 17)", "NASA", None, {}),
    ("nasa-tarantula", "nasa", "nasa-pia05062.webp", "photo", "타란툴라 성운", "미국 항공우주국(NASA)", "2004", "The Tarantula Nebula", "NASA/JPL-Caltech", None, {}),
    ("nasa-california-nebula", "nasa", "nasa-pia13108.webp", "photo", "캘리포니아 성운", "미국 항공우주국(NASA)", "2010", "Menkhib and the California Nebula", "NASA/JPL-Caltech/UCLA", None, {}),
    ("nasa-infrared-van-gogh", "nasa", "nasa-pia14091.webp", "photo", "적외선 하늘의 소용돌이", "미국 항공우주국(NASA)", "2011", "The van Gogh of the Infrared Sky", "NASA/JPL-Caltech/UCLA", None, {}),
    ("nasa-witch-head", "nasa", "nasa-pia17553.webp", "photo", "마녀 머리 성운", "미국 항공우주국(NASA)", "2013", "Witch Head Nebula", "NASA/JPL-Caltech", None, {}),
    ("nasa-cats-paw", "nasa", "nasa-pia22568.webp", "photo", "고양이 발 성운", "미국 항공우주국(NASA)", "2018", "Cat's Paw Nebula", "NASA/JPL-Caltech", None, {}),
    ("nasa-tarantula-spitzer", "nasa", "nasa-pia23646.webp", "photo", "적외선으로 본 타란툴라 성운", "미국 항공우주국(NASA)", "2020", "Tarantula Nebula (Spitzer)", "NASA/JPL-Caltech", None, {}),
    ("nasa-iss-earth", "nasa", "nasa-iss043e003041.webp", "photo", "우주정거장에서 본 지구", "미국 항공우주국(NASA)", "2015", "Earth observation (Expedition 43)", "NASA", None, {}),
    ("nasa-aurora-loop", "nasa", "nasa-s39-23-020.webp", "photo", "남극 오로라 고리", "미국 항공우주국(NASA)", "1991", "Aurora Australis, Sinuous Loop", "NASA", None, {}),
    ("nasa-aurora-red", "nasa", "nasa-s39-23-036.webp", "photo", "붉은 오로라", "미국 항공우주국(NASA)", "1991", "Aurora Australis, Red Crown", "NASA", None, {}),
    ("nasa-aurora-green", "nasa", "nasa-s39-25-006.webp", "photo", "초록 오로라", "미국 항공우주국(NASA)", "1991", "Aurora Australis, Green Airglow", "NASA", None, {}),
    ("nasa-skylab", "nasa", "nasa-sl4-143-4706.webp", "photo", "지구 위의 스카이랩", "미국 항공우주국(NASA)", "1974", "Skylab in Earth orbit", "NASA", None, {}),
    ("nasa-hubble-nitrogen", "nasa", "nasa-gsfc_20171208_archive_e000699.webp", "photo", "허블이 본 성운", "미국 항공우주국(NASA)", "", "Hubble View of a Nitrogen-Rich Nebula", "NASA", None, {}),
    ("nasa-searchlight-nebula", "nasa", "nasa-gsfc_20171208_archive_e001743.webp", "photo", "빛줄기를 뿜는 성운", "미국 항공우주국(NASA)", "", "Searchlight Beams from a Preplanetary Nebula", "NASA", None, {}),
    ("nasa-lagoon-nebula", "nasa", "nasa-gsfc_20171208_archive_e001955.webp", "photo", "석호 성운", "미국 항공우주국(NASA)", "", "Heart of the Lagoon Nebula", "NASA", None, {}),
    ("nasa-carina-nebula", "nasa", "nasa-gsfc_20171208_archive_e002076.webp", "photo", "용골자리 성운", "미국 항공우주국(NASA)", "", "Landscape in the Carina Nebula", "NASA", None, {}),
    ("nasa-earth-moon", "nasa", "nasa-pia00342.webp", "photo", "지구와 달", "미국 항공우주국(NASA)", "", "The Earth & Moon", "NASA/JPL/USGS", None, {}),
    ("nasa-jupiter-cassini", "nasa", "nasa-pia04866.webp", "photo", "카시니호가 찍은 목성", "미국 항공우주국(NASA)", "2003", "Cassini Jupiter Portrait", "NASA/JPL/Space Science Institute", None, {}),
    ("nasa-earth-2012", "nasa", "nasa-pia18033.webp", "photo", "지구", "미국 항공우주국(NASA)", "2012", "Earth", "NASA", None, {}),
    ("nasa-titan", "nasa", "nasa-pia20016.webp", "photo", "토성의 달 타이탄", "미국 항공우주국(NASA)", "2015", "Peering Through Titan Haze", "NASA/JPL/University of Arizona", None, {}),
    ("nasa-saturn", "nasa", "nasa-pia21046.webp", "photo", "토성", "미국 항공우주국(NASA)", "2016", "Saturn, Approaching Northern Summer", "NASA/JPL-Caltech/Space Science Institute", None, {}),
    ("nasa-jupiter-marble", "nasa", "nasa-pia22946.webp", "photo", "구슬 같은 목성", "미국 항공우주국(NASA)", "2019", "Jupiter Marble", "NASA", None, {}),
    ("nasa-discovery-sunrise", "nasa", "nasa-ed05-0166-06.webp", "photo", "해 뜰 녘의 디스커버리호", "미국 항공우주국(NASA)", "2005", "Sunrise on Space Shuttle Discovery", "NASA/Carla Thomas", None, {}),
    ("nasa-columbia-landing", "nasa", "nasa-s81-30746.webp", "photo", "착륙하는 컬럼비아호", "미국 항공우주국(NASA)", "1981", "Space Shuttle Columbia touchdown", "NASA", None, {}),
    ("nasa-two-shuttles", "nasa", "nasa-s90-48650.webp", "photo", "나란히 선 두 우주왕복선", "미국 항공우주국(NASA)", "1990", "Two space shuttles on adjacent launch pads", "NASA", None, {}),
    ("nasa-atlantis-mir", "nasa", "nasa-sts076-370-020.webp", "photo", "미르 정거장에서 본 아틀란티스호", "미국 항공우주국(NASA)", "1996", "Atlantis seen from the Mir Space Station", "NASA", None, {}),
    ("nasa-mars-pathfinder", "nasa104", "nasa-pia02652.webp", "photo", "마스 패스파인더가 본 화성", "미국 항공우주국(NASA)", "1997", "Mars Pathfinder", "NASA/JPL", None, {}),
    ("nasa-curiosity-selfie", "nasa104", "nasa-pia19808.webp", "photo", "화성 탐사 로버 큐리오시티", "미국 항공우주국(NASA)", "2015", "Curiosity Rover Selfie at Buckskin", "NASA/JPL-Caltech/MSSS", None, {}),
]

# 원래 있던 그림 10점: 파일은 이미 assets/paintings 에 있어요. 순서도 그대로 맨 앞에 둬요.
ORIGINAL = [
    ("01-monet-poppy-field", "양귀비 들판", "클로드 모네", "", "Poppy Field", "Claude Monet", 1926, "https://github.com/pmilovanov/hermitage-art (Monet,_Claude_-_Poppy_Field.jpg)"),
    ("02-van-gogh-starry-night", "별이 빛나는 밤", "빈센트 반 고흐", "1889", "The Starry Night", "Vincent van Gogh", 1890, "https://github.com/jcjohnson/neural-style (examples/inputs/starry_night_google.jpg, Google Art Project)"),
    ("03-fantin-latour-roses-nasturtiums", "꽃병의 장미와 한련", "앙리 팡탱라투르", "", "Roses and Nasturtiums in a Vase", "Henri Fantin-Latour", 1904, "https://github.com/pmilovanov/hermitage-art (Fantin-Latour,_Henri_-_Roses_and_Nasturtiums_in_a_Vase.jpg)"),
    ("04-monet-woman-in-garden", "생타드레스 정원의 여인", "클로드 모네", "1867", "Woman in the Garden, Sainte-Adresse", "Claude Monet", 1926, "https://github.com/pmilovanov/hermitage-art (Monet,_Claude_-_Woman_in_the_Garden._Sainte-Adresse.jpg)"),
    ("05-shishkin-morning-pine-forest", "소나무 숲의 아침", "이반 시시킨", "1889", "Morning in a Pine Forest", "Ivan Shishkin", 1898, "https://github.com/pmilovanov/hermitage-art (Shishkin,_Ivan_-_Morning_in_a_Pine_Forest.jpg)"),
    ("06-renoir-girl-with-fan", "부채를 든 소녀", "피에르오귀스트 르누아르", "1881", "Girl with a Fan", "Pierre-Auguste Renoir", 1919, "https://github.com/pmilovanov/hermitage-art (Renoir,_Pierre-Auguste_-_Girl_with_a_Fan.jpg)"),
    ("07-aivazovsky-ninth-wave", "아홉 번째 파도", "이반 아이바좁스키", "1850", "The Ninth Wave", "Ivan Aivazovsky", 1900, "https://github.com/pmilovanov/hermitage-art (Aivazovsky,_Ivan_-_The_Ninth_Wave.jpg)"),
    ("08-monet-haystack-giverny", "지베르니의 건초더미", "클로드 모네", "1886", "Haystack at Giverny", "Claude Monet", 1926, "https://github.com/pmilovanov/hermitage-art (Monet,_Claude_-_Haystack_at_Giverny.jpg)"),
    ("09-monet-water-lilies", "수련", "클로드 모네", "1919", "Water Lilies (1919)", "Claude Monet", 1926, "https://github.com/titu1994/Neural-Style-Transfer (images/inputs/style/water-lilies-1919-2.jpg)"),
    ("10-pissarro-boulevard-montmartre", "몽마르트르 대로", "카미유 피사로", "1897", "Boulevard Montmartre in Paris", "Camille Pissarro", 1903, "https://github.com/pmilovanov/hermitage-art (Pissarro,_Camille_-_Boulevard_Monmartre_in_Paris.jpg)"),
]


# ───────────────────────── 내려받기 ─────────────────────────

def fetch(key):
    url, _ = SOURCES[key]
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(url))
    if not os.path.exists(path):
        print("내려받는 중:", url)
        with urllib.request.urlopen(url) as r, open(path + ".part", "wb") as f:
            f.write(r.read())
        os.replace(path + ".part", path)
    return path


_archives = {}


def read_source(src, name):
    key = {"nasa": "pdw", "nmk": "pdw", "nasa104": "pdw104"}.get(src, src)
    if key not in _archives:
        tf = tarfile.open(fetch(key), "r:gz")
        _archives[key] = (tf, {os.path.basename(m.name): m for m in tf.getmembers() if m.isfile()})
    tf, members = _archives[key]
    member = members.get(name)
    if member is None:
        raise FileNotFoundError(f"{key}: {name}")
    return Image.open(io.BytesIO(tf.extractfile(member).read())).convert("RGB")


# ───────────────────────── 다듬기 ─────────────────────────

def _frame_depth(strips, limit):
    """가장자리에서 안쪽으로 액자·여백처럼 고른 띠가 몇 줄인지. 뚜렷한 경계가 없으면 0."""
    base = strips[0].mean(axis=0)
    if base.max() - base.min() > 28:  # 색이 짙은 가장자리(하늘 등)는 액자로 보지 않아요
        return 0
    for i in range(1, limit):
        s = strips[i]
        if s.std(axis=0).max() > 12 or np.abs(s.mean(axis=0) - base).max() > 18:
            return i if i >= 3 else 0
    return 0


def trim_frame(im):
    a = np.asarray(im, dtype=np.float32)
    h, w, _ = a.shape
    top = _frame_depth(a, int(h * 0.2))
    bottom = _frame_depth(a[::-1], int(h * 0.2))
    left = _frame_depth(a.transpose(1, 0, 2), int(w * 0.2))
    right = _frame_depth(a.transpose(1, 0, 2)[::-1], int(w * 0.2))
    if top or bottom or left or right:
        inset = 2  # 경계에 남는 얇은 선까지 걷어내요
        box = (left + inset if left else 0, top + inset if top else 0,
               w - (right + inset if right else 0), h - (bottom + inset if bottom else 0))
        return im.crop(box)
    return im


def crop_object(im):
    """고른 배경 위에 놓인 그림(액자 속 작품 등)만 남겨요."""
    a = np.asarray(im, dtype=np.int16)
    h, w, _ = a.shape
    ring = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    mask = np.abs(a - bg).max(axis=2) > 30
    rows = np.where(mask.mean(axis=1) > 0.02)[0]
    cols = np.where(mask.mean(axis=0) > 0.02)[0]
    if not len(rows) or not len(cols):
        return im
    pad = int(0.01 * max(w, h))
    return im.crop((max(0, cols[0] + pad), max(0, rows[0] + pad), min(w, cols[-1] - pad), min(h, rows[-1] - pad)))


def crop_ratio(im, anchor=(0.5, 0.5)):
    """최대 4:3(세로 그림은 3:4)까지만 남기고 잘라요."""
    w, h = im.size
    if w / h > 4 / 3:
        nw = round(h * 4 / 3)
        x = round((w - nw) * anchor[0])
        return im.crop((x, 0, x + nw, h))
    if w / h < 3 / 4:
        nh = round(w * 4 / 3)
        y = round((h - nh) * anchor[1])
        return im.crop((0, y, w, y + nh))
    return im


def shrink(im, size):
    w, h = im.size
    k = size / max(w, h)
    if k >= 1:
        return im
    return im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def flatness(im):
    """가장 많은 한 가지 색이 차지하는 비율(0~1). 높을수록 조각 구분이 어려워요."""
    a = np.asarray(im.resize((80, 60)), dtype=np.int16) // 32
    codes = (a[..., 0] * 64 + a[..., 1] * 8 + a[..., 2]).ravel()
    return np.bincount(codes).max() / codes.size


# ───────────────────────── 목록 만들기 ─────────────────────────

def interleave(groups):
    """카테고리가 고루 섞이도록 순서를 정해요(각 묶음 안의 순서는 유지)."""
    keyed = []
    for items in groups:
        n = len(items)
        for i, it in enumerate(items):
            keyed.append(((i + 0.5) / n, len(keyed), it))
    keyed.sort(key=lambda x: (x[0], x[1]))
    return [it for _, _, it in keyed]


def js_entry(d):
    return "  " + json.dumps(d, ensure_ascii=False)


def main():
    report_only = "--report" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    entries = {"west": [], "east": [], "photo": []}
    warn = []

    for slug, src, name, cat, t, a, y, en_t, en_a, died, opt in NEW:
        im = read_source(src, name)
        if opt.get("box"):
            im = im.crop(opt["box"])
        elif opt.get("obj"):
            im = crop_object(im)
        else:
            im = trim_frame(im)
        im = shrink(crop_ratio(im, opt.get("anchor", (0.5, 0.5))), 800)
        flat = flatness(im)
        if flat >= 0.55:
            raise SystemExit(f"{slug}: 한 가지 색이 {flat:.0%}나 돼요. 조각을 구분하기 어려워서 빼야 해요.")
        if flat > 0.4:
            warn.append(f"{slug}: 단색 {flat:.0%}")
        path = f"assets/paintings/{slug}.jpg"
        if not report_only:
            im.save(os.path.join(ROOT, path), "JPEG", quality=80, optimize=True)
        entries[cat].append({
            "id": slug, "cat": cat, "t": t, "a": a, "y": y,
            "src": path,
            "w": im.size[0], "h": im.size[1],
            "enTitle": en_t, "enArtist": en_a, "artistDied": died,
            "source": SOURCE_TEXT[src].format(f=name),
        })

    originals = []
    for slug, t, a, y, en_t, en_a, died, source in ORIGINAL:
        im = Image.open(os.path.join(OUT, slug + ".jpg")).convert("RGB")
        originals.append({
            "id": slug, "cat": "west", "t": t, "a": a, "y": y,
            "src": f"assets/paintings/{slug}.jpg",
            "w": im.size[0], "h": im.size[1],
            "enTitle": en_t, "enArtist": en_a, "artistDied": died, "source": source,
        })

    ordered = originals + interleave([entries["west"], entries["east"], entries["photo"]])
    ids = [e["id"] for e in ordered]
    assert len(ids) == len(set(ids)), "파일 이름이 겹쳐요"

    print(f"모두 {len(ordered)}점 (서양 명화 {len(entries['west']) + len(originals)}, "
          f"동양·옛 그림 {len(entries['east'])}, 사진 {len(entries['photo'])})")
    for w in warn:
        print("  주의 -", w)
    if report_only:
        return

    header = (
        "/* 퍼즐 그림 목록 — tools/build_pictures.py 가 만든 파일이에요. 그림을 더하거나 고칠 때는 그 스크립트를 고친 뒤 다시 실행하세요.\n"
        "   모두 저작권 보호 기간이 끝난 작품(작가 사망 후 70년 이상)이거나 퍼블릭 도메인·CC0로 공개된 사진이에요.\n"
        "   스테이지마다 이 목록에서 그림을 무작위로 골라요.\n"
        "   id = 이름, cat = west(서양 명화)|east(동양·우리 옛 그림)|photo(사진), t/a/y = 제목/작가/연도,\n"
        "   src = 그림 파일, w/h = 픽셀 크기, artistDied = 작가 사망 연도(모르거나 사진이면 null), source = 원본 출처. */\n"
    )
    with open(JS_OUT, "w", encoding="utf-8") as f:
        f.write(header + "window.PAINTINGS = [\n" + ",\n".join(js_entry(e) for e in ordered) + "\n];\n")
    print("썼어요:", os.path.relpath(JS_OUT, ROOT))
    write_credits(ordered)
    print("썼어요:", os.path.relpath(CREDITS_OUT, ROOT))


def write_credits(ordered):
    names = {"west": "서양 명화", "east": "동양·우리 옛 그림", "photo": "사진"}
    out = [
        "# 퍼즐 그림 출처",
        "",
        "`tools/build_pictures.py`가 만든 파일이에요. 모든 그림은 저작권 보호 기간이 끝난 작품(작가 사망 후 70년 이상)이거나 "
        "퍼블릭 도메인·CC0로 공개된 사진이에요.",
        "",
        "- 명화 이미지: npm 패키지 [aquarelle](https://www.npmjs.com/package/aquarelle) 1.5.2 (MIT)",
        "- 메트로폴리탄 미술관 오픈 액세스(CC0), NASA(퍼블릭 도메인), 국립중앙박물관 소장 옛 그림: "
        "npm 패키지 [public-domain-wallpapers](https://www.npmjs.com/package/public-domain-wallpapers) 1.3.2·1.0.4 (MIT)",
        "- 예제 사진(고양이, 커피, 우주비행사, 로켓): [scikit-image](https://scikit-image.org) 0.26.0 `skimage/data` (CC0·퍼블릭 도메인)",
        "- 맨 앞의 그림 10점: 채팅에서 처음 만들 때 모은 그림 (`source`에 원본 주소)",
        "",
    ]
    for cat in ("west", "east", "photo"):
        items = [e for e in ordered if e["cat"] == cat]
        out += [f"## {names[cat]} ({len(items)}점)", "", "| 제목 | 작가 | 연도 | 원제 / 원작가 (사망 연도) | 출처 |", "|---|---|---|---|---|"]
        for e in items:
            died = f" ({e['artistDied']})" if e["artistDied"] else ""
            row = [e["t"], e["a"], e["y"] or "-", f"{e['enTitle']} / {e['enArtist']}{died}", e["source"]]
            out.append("| " + " | ".join(str(x).replace("|", "\\|") for x in row) + " |")
        out.append("")
    with open(CREDITS_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out))


if __name__ == "__main__":
    main()
