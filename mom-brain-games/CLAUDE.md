# 엄마의 두뇌 놀이터

어머니(60~70대, 스마트폰 사용)를 위한 명화 직소 퍼즐 웹앱이에요. Claude 채팅에서 한 파일짜리 artifact로 만든 것을 이 프로젝트로 옮겼어요.
토스 앱 안의 미니앱(앱인토스, WebView SDK `@apps-in-toss/web-framework` 3.x)으로 출시할 예정이에요.

화면은 최대한 단순하게 두기로 했어요(사용자 요청).
- 처음 화면: 스테이지 번호, 그림 한 점, '시작하기' 버튼뿐이에요.
- 퍼즐 화면: 조각 판과 '그림 보기', '힌트', '다시 흩기' 버튼.
- 완성 화면: 맞춘 그림과 '다음 스테이지' 버튼.
- 소리 켜고 끄기 버튼만 화면 오른쪽 위에 따로 떠 있어요. 그 밖의 설정은 두지 않아요.
- 스테이지 1~200. 스테이지마다 그림을 무작위로 골라요(한 바퀴 도는 동안 같은 그림이 두 번 나오지 않게 순서를 섞어 저장).
- 조각 수는 늘 20~25개(가로 그림 5×4, 세로 그림 4×5, 정사각형에 가까우면 5×5). 레벨, 조각 돌리기 같은 난이도 변화는 없어요.

예전에 있던 짝 맞추기·장보기 기억·속담 잇기, 레벨 선택, 그림 목록, 내 사진 퍼즐, 글자 크기 설정은 사용자 요청으로 모두 뺐어요. 다시 넣자고 하기 전에는 추가하지 마세요.

## 실행과 테스트

- 실행: `npm install` 한 번, 그다음 `npm start` (= `python3 -m http.server 8000`) 후 http://localhost:8000
  - `file://`로 직접 열면 캔버스 보안 정책 때문에 조각을 집는 판정이 부정확해질 수 있어요. 꼭 로컬 서버로 여세요.
  - 폰에서 확인할 때는 같은 와이파이에서 `http://<컴퓨터 IP>:8000` 으로 접속하세요.
- 테스트: `npm install` 후 `npm test` (jsdom + node-canvas로 그림 목록 점검, 처음 화면, 소리 버튼, 퍼즐 한 판, 스테이지 200 이후, 하다 만 퍼즐 이어서 하기, 예전 저장값 이어받기, 뒤로가기, 토스 연결부(가짜 TossBridge), 토스용 빌드(dist)를 확인하는 스모크 테스트)
- 코드를 고친 뒤에는 반드시 `npm test`를 돌리고, 새 기능이면 `tests/smoke.test.js`에 확인 항목을 추가하세요.
- jsdom에는 `elementsFromPoint`가 없어서 테스트는 힌트로 퍼즐을 끝까지 맞춰요. 실제 끌기는 브라우저에서 확인하세요.

## 토스(앱인토스) 출시

- 빌드: `npm run build` → `tools/build-web.mjs`가 `dist/`를 만들고, `ait build`가 `<appName>.ait`(지금은 `masterpiece-puzzle.ait`)를 만들어요.
- 배포: 앱인토스 콘솔에 `.ait`를 올리거나, `npx ait token add`로 토큰을 등록한 뒤 `npm run deploy`.
- `apps-in-toss.config.ts`의 `appName`은 콘솔에 등록한 앱 이름과 반드시 같아야 해요.
- 앱 표시 이름(한국어), 아이콘, 소개, 등급분류는 콘솔에서 정해요. 앱 이름을 영어로만 쓰면 검수에서 반려된 사례가 있어요.
- 게임은 게임물 등급분류가 필요해요(구글 플레이에 먼저 내서 자체등급을 받아 입력하면 비용이 들지 않아요).
- 토스 연결부는 `src/toss-bridge.js` 하나에 모아 뒀어요. 빌드 때 esbuild가 `dist/js/toss-bridge.js`로 묶고 `dist/index.html`에만 넣어요. 개발용 `index.html`에는 없어서 브라우저에서 그냥 열면 토스 기능 없이 동작해요.
- 토스 앱 안인지는 `window.ReactNativeWebView`가 있는지로 판단해요(SDK와 같은 기준). 있을 때만 `window.TossBridge`가 생겨요.
- 쓰는 SDK 기능: `Storage`(진행 상황 저장), `graniteEvent`의 `backEvent`(뒤로가기), `Screen.close`(앱 닫기), `Screen.setAwakeMode`(퍼즐 중 화면 켜짐), `Device.triggerHaptic`(조각이 맞을 때 진동).
- 웹뷰 설정: 조각을 끌 때 화면이 튕기거나 당겨서 새로고침되지 않도록 `bounces`, `pullToRefreshEnabled`, `overScrollMode`를 껐어요.
- 외부 리소스(웹 폰트 등)는 쓰지 않아요. 글꼴은 기기 기본 글꼴이에요.
- 효과음은 앱이 백그라운드로 가면 멈추고(`AudioContext.suspend`), 다음 효과음 때 다시 켜져요. 배경음은 없어요.

## 폴더 구조

```
index.html              화면 뼈대 (스크립트 2개를 불러오기만 함)
apps-in-toss.config.ts  앱인토스 설정 (appName, 색, 네비게이션 바, 웹뷰)
src/toss-bridge.js      토스 SDK 연결부 → window.TossBridge (빌드 때만 묶여 들어가요)
tools/build-web.mjs     토스에 올릴 dist/ 를 만드는 스크립트
css/style.css           디자인 토큰(:root 색상 변수) + 화면별 스타일, 다크 모드 포함
js/paintings.js         퍼즐 그림 목록 window.PAINTINGS (tools/build_pictures.py 가 만든 파일)
js/app.js               앱 전체 로직 (빌드 도구 없는 순수 JS, 즉시 실행 함수 하나)
assets/paintings/       퍼즐 그림 JPG (긴 변 800px)
tools/build_pictures.py 그림을 내려받아 다듬고 js/paintings.js, CREDITS.md 를 만드는 스크립트
CREDITS.md              그림마다의 출처 (자동 생성)
tests/smoke.test.js     스모크 테스트
```

## app.js 구조

- 전역 상태: `screen`('home'|'play'|'result'), `st`(지금 판의 상태), `settings`(소리만), `stage`, `order`, `puzzle`(하다 만 퍼즐)
- 화면 전환: `renderHome` → (시작하기/이어서 하기) `enterPlay` → `startJigsaw` → `finishJigsaw` → `result` → (다음 스테이지) `goHome`
- 시작할 때 `loadSave`로 저장값을 불러온 뒤에 처음 화면을 그려요(토스 저장소는 비동기).
- 뒤로가기: 토스 앱에서는 `backEvent`를 받아 퍼즐·완성 화면이면 처음 화면으로, 처음 화면이면 앱을 닫아요. 브라우저에서는 퍼즐을 시작할 때 `history.pushState`로 기록을 하나 쌓아요.
- 버튼은 `data-action` 속성 + `app`에 붙은 click 위임 하나로 처리해요. 소리 버튼(`#soundBtn`)만 `body`에 따로 붙어 있어요.
- 스테이지: `currentPainting()`이 `order[stage-1]`번 그림을 줘요. `nextStage()`가 스테이지를 올리고, 200을 넘으면 1로 돌아가며 순서를 새로 섞어요.
- 조각 나누기: `gridFor(그림)`, 딱 붙는 거리: `TOL`(조각 짧은 변 × 0.3).
- 화면에 넣는 그림 제목은 `esc()`로 감싸요.
- 저장: 키 하나 `mbp:save`에 JSON으로 모아요. 토스 앱 안에서는 토스 `Storage`와 localStorage 둘 다에, 밖에서는 localStorage에만 써요.
  - `{v:1, stage, order, sound, puzzle}`. `order`는 섞어 둔 그림 순서(`PAINTINGS` 번호 배열)이고, 그림 수가 바뀌면 새로 섞어요.
  - `puzzle` = `{stage, id(그림 id), placed:[맞춘 조각 번호]}`. 조각을 하나 맞출 때마다 저장하고, 완성하면 지워요. 흩어진 조각 위치는 저장하지 않고 다시 흩어요.
  - 토스 앱이 업데이트되면 웹 주소가 바뀌어 localStorage가 비어 있을 수 있어서 토스 `Storage`를 먼저 읽어요. 3초 안에 대답이 없으면 localStorage로 먼저 시작하고, 이때는 토스 쪽 기록을 덮어쓰지 않아요. 늦게 대답이 오면(아직 아무것도 안 했을 때) 그 기록으로 다시 그려요.
  - 예전 버전이 따로 저장하던 `mbp:stage`, `mbp:order`, `mbp:settings`는 처음 한 번 읽어서 `mbp:save`로 옮겨요. `mbp:levels`, `mbp:jigcount`, `mbp:photo`, `mbp:done:*` 등은 쓰지 않아요.

## 그림 조각 맞추기 엔진

- 조각 모양: 가로·세로 경계선마다 무작위 탭 방향과 흔들림(jitter)을 정하고, 3개의 3차 베지어로 탭을 그려요(`mkEdge`, `edgePts`). 이웃 조각은 같은 경계선 좌표를 공유해서 정확히 맞물려요.
- 조각마다 `<canvas>` 하나: 조각 경로로 clip한 뒤 그림을 그리고 테두리를 흐리게 그려요. 캔버스 여백 `pad`는 탭이 튀어나올 공간이에요.
- 집기 판정: `elementsFromPoint`로 겹친 캔버스들을 위에서부터 보고, 그 지점 픽셀이 불투명한 첫 조각을 집어요(투명한 탭 여백은 통과).
- 끌기: Pointer Events + `setPointerCapture`. 조각 캔버스에만 `touch-action:none`이라 빈 곳을 누르면 화면 스크롤이 돼요.
- 맞추기: 놓은 위치가 정답 위치에서 `TOL × 조각 짧은 변` 안이면 딱 붙고 고정돼요.
- 판 크기: 화면 너비와 높이의 40% 중 작은 쪽에 맞추고, 아래에 흩어 놓는 칸을 둬요. 화면 너비가 30px 넘게 바뀌면 맞춘 조각은 유지한 채 다시 그려요.

## 꼭 지킬 원칙

- 대상은 어르신이에요. 글자는 기본 20px, 터치 영역은 최소 44px, 시간 제한은 두지 않아요.
- 화면은 단순하게. 버튼과 문구를 늘리지 마세요.
- 문구는 존댓말로, 틀려도 부드럽게("아쉬워요", "괜찮아요"). 꾸짖거나 점수로 압박하지 않아요.
- '치매 예방', '치료' 같은 효과를 단정하는 표현은 쓰지 않아요 ('두뇌 놀이' 정도로).
- 외부 이미지는 링크하지 말고 `assets/`에 저장해서 써요.
- 효과음은 Web Audio로 직접 만들어요. 소리 파일을 추가하지 마세요.

## 그림 추가 규칙

- 저작권 보호 기간이 끝난 작품만 넣어요. 기준: 작가 사망 후 70년 이상 지난 작품. 사진은 퍼블릭 도메인(NASA 등)이나 CC0로 공개된 것만 써요.
- 사진 복제본은 원작을 그대로 찍은 평면 복제본만 써요. 도자기·조각처럼 입체 유물을 찍은 사진은 사진가의 권리가 따로 있을 수 있어서 넣지 않았어요.
- 그림은 `tools/build_pictures.py`의 `NEW` 표에 한 줄 더하고 스크립트를 실행해요(`pip install pillow numpy`). 스크립트가 알아서:
  - 액자·여백처럼 고른 띠를 걷어내고, 가운데 기준으로 최대 4:3(세로 그림은 3:4)까지만 잘라요(초상화처럼 위쪽이 중요한 그림은 `anchor`로 기준을 옮겨요)
  - 긴 변 800px, JPEG 품질 80으로 줄여요
  - 한 가지 색이 55% 넘게 차지하면 멈춰요(우주 사진처럼 검은 바탕이 넓은 그림). 40%가 넘으면 경고만 해요
  - `js/paintings.js`와 `CREDITS.md`를 새로 써요
- `js/paintings.js` 항목: `id`, `cat`(west|east|photo), `t`(한국어 제목), `a`(한국어 작가 이름), `y`(연도), `src`, `w`, `h`, `enTitle`, `enArtist`, `artistDied`(모르거나 사진이면 null), `source`(원본 출처).
- 조각이 서로 구분되도록 색과 형태가 다양한 그림을 고르세요.

## 다음에 할 일

1. 앱인토스 콘솔에 앱 등록 → `appName` 맞추기 → `npm run build` → 샌드박스/토스 앱에서 실제 기기 테스트 → 등급분류 → 검수 요청
   - 실제 토스 앱에서 확인할 것: 저장·이어서 하기, 뒤로가기, 화면 켜짐, 진동, 끌기 감도
   - 빌드 파일이 약 19MB(그림 207점)예요. 콘솔 업로드 용량 제한이 있으면 그림 품질(JPEG 80)이나 수를 조정하기
2. 한국 옛 그림 더 넣기 (지금은 국립중앙박물관 조선 그림 6점만 있어요)
   - 후보: 김홍도 「씨름」「서당」「무동」, 신윤복 「단오풍정」, 신사임당 「초충도」, 정선 「인왕제색도」
   - 이 작업 환경에서는 위키미디어 공용에 접속할 수 없었어요. 라이선스를 확인하고 받아서 `NEW` 표에 추가하기
3. 보상형 광고는 '힌트'나 '그림 보기' 같은 도움 기능에 붙이는 것을 검토 (SDK의 `loadFullScreenAd`/`showFullScreenAd`)
