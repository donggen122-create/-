# 서호팡팡수호대 인수인계 — 2026-10-11 기준 (A 검증: 2026-10-12)

서호초 학생용 환경 주제 브라우저 액션 게임이며 현재 4장·20단계가 열려 있다. A 작업트리는 판 성능·쓰러진 까닭 기록, 관리 통계, 실패 결과 안내를 구현한 검토 대기본이다.

## 폴더

| 경로 | 역할 |
|---|---|
| game/ | 실행 소스. ES 모듈·CSS·그림·소리·글꼴·관리 페이지·STATUS.md |
| server/src/ | Worker 계정·세션·역할·성장·이용권·정산·관리 API |
| server/schema.sql, server/migrations/ | 기본 계정 표와 과거 변경. 성장 표는 guardian.js migrate |
| server/wrangler.toml | Worker·D1·정적 파일 binding 설정 |
| dist_web/ | 배포 사본. 배포 도구가 game/ 소스와 동기화 |
| dist_web/share/ | 협업용 공개 사본. 비밀값·학생 정보 넣지 않기 |
| dist_single/ | 생성한 단일 파일판. git 제외, 서버판과 별도 검사 필요 |
| data/, docs/ | 원 기획 CSV·JSON·문서·활동지·결정 근거 |
| docs/codex/ | 작업지시·보고·공개 가능한 익명 캡처 |
| tests/, game/tools/qa/ | 규칙·서버 검사와 격리 브라우저 점검 |
| 이미지 에셋/ | 사용자 그림 원본. 학생 이름이 있는 활동지 원본은 공개 저장소에 넣지 않기 |

## 실행·배포 명령

현재 A는 codex/2026-10-11-A에서만 커밋한다. **push·배포·다른 브랜치 작업 없음.** B 작업트리와 8797은 다른 세션이 사용한다.

```powershell
# A 격리 QA: game/ 직접 서빙 + 실제 Worker 핸들러 + 메모리 SQLite
$env:PORT='8798'
node game/tools/qa/node-server.mjs
# 별도 터미널, 저장소 루트
node --test "tests/*.test.mjs"
python game/tools/qa/records-results.py --url http://localhost:8798
python game/tools/qa/responsive-audit.py --url 'http://localhost:8798/?ui=2' --sizes 1280x720,1024x768,820x1180,768x1024,375x667,360x640
python game/tools/qa/responsive-audit.py --url 'http://localhost:8798/?ui=1' --sizes 1280x720,1024x768,820x1180,768x1024,375x667,360x640
python game/tools/qa/tablet-perf.py --url 'http://localhost:8798/?ui=2' --label A-invariant --mode replay --reference 037d07b14bc4861838d825cb68df44f42b9d50e9
```

node:sqlite 대응 Node가 필요하다(이번 환경 Node 24). Python은 Playwright·Chromium, records-results.py는 Pillow도 필요하다. Windows 도구 경로는 game/tools/env.ps1이 찾는다. 한글 PowerShell 스크립트는 UTF-8 BOM으로 저장한다.

아래는 **검토·병합 후 배포를 별도로 승인받은 담당자용**이며 A에서는 실행하지 않는다.

```powershell
# 일반 로컬 개발: 배포 사본 동기화 + 로컬 D1
powershell -NoProfile -ExecutionPolicy Bypass -File game/tools/dev-server.ps1
# 승인된 배포: 검사·최신 배포 확인·사본 동기화·버전 기록
powershell -NoProfile -ExecutionPolicy Bypass -File game/tools/deploy.ps1 -Message '승인된 변경 설명'
# 단일 파일판 생성(별도 검증)
powershell -NoProfile -ExecutionPolicy Bypass -File game/tools/build-single.ps1
```

GitHub 배포는 .github/workflows/seoho-deploy.yml: seoho-game 최신 커밋 기준 deploy/** 또는 deploy-force/** push가 시작 조건이다. 검사 → 마지막 배포 확인 → 동기화 → 배포 → 버전 기록 순이다. deploy-force는 배포 확인을 우회하므로 합의 없이 쓰지 않는다. main은 다른 프로젝트이며 건드리지 않는다. 이번에는 이 경로를 실행하지 않았다.

## 서버·DB

| 대상 | 주소·binding | 주의 |
|---|---|---|
| 운영 Worker | seoho-pangpang.seoho-pangpang-server.workers.dev | 마지막 로컬 영수증 server/.last_deploy_version. 현재 운영과 일치하는지는 별도 확인 필요 |
| 운영 D1 | seoho-pangpang-db, DB | A에서 접속하지 않음. 학생 계정 수 추정 금지 |
| 운영 정적 파일 | ASSETS → dist_web/ | game/와 자동으로 같아지는 것이 아님 |
| A 격리 서버 | http://localhost:8798 | 메모리 SQLite, 종료 시 QA 데이터 소멸, 실제 D1과 연결 없음 |
| 격리 열쇠 | game/tools/qa/.dev.vars | 최초 시작 때 QA용으로 생성, git 제외. 운영 비밀값 파일 읽지 않음 |
| 일반 개발 열쇠 | server/.dev.vars | git 제외. 값·내용을 로그·문서·캡처·커밋에 넣지 않기 |

비밀값 **이름만**: ADMIN_KEY, ADMIN_ID, ADMIN_PW, TEACHER_ID, TEACHER_PW, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. CI의 토큰 대체 이름은 workflow에서 확인한다. 값은 적지 않는다.

| 기존 표 | 역할 |
|---|---|
| users, sessions, attempts | 가입·해시 비밀번호·로그인·시도 제한 |
| presence | 접속 신호·기기 분류 |
| saves, grants | 과거 저장·지급, 현 시스템은 성장 프로필 사용 |
| guardian_profiles, guardian_profile_snapshots | 성장 프로필·revision·이전 버전 보존 |
| play_days | 서버 날짜 기준 이용권 사용·추가 지급 |
| play_runs | 출동·정산. 새 진단은 기존 result JSON에만 추가 |
| guardian_operations | 성장 요청 중복 방지 |
| play_admin_grants, play_admin_gift_grants | 관리자 이용권·코인·보급권 지급 기록 |

판 시작 result.loadout에 파츠·친구·난이도가 들어간다. 정산 뒤에도 loadout을 보존하고 유효한 perf·실패 사망의 cause만 붙인다. 옛 기록은 없는 필드를 추정하지 않는다. 보상·성장·이용권은 completeRun과 DB 트리거가 결정한다. 성공만 일반 이용권 차감, 시험 모드는 별도 규칙. 서버 날짜는 KST 아침 8시 기준이다.

## 클라이언트 모듈 지도

| 파일 (game/src/) | 역할 |
|---|---|
| main.js | 입력·전투·그리기·HUD·결과·서버 연동 |
| rework-core.js | 20단계·난이도·훈련·파츠·친구·미션·보상 규칙. A는 읽기 전용 진단/추천 도우미만 추가 |
| rework-ui.js, rework.css | 로비·성장·도감·선택 창, UI 1 공통 배치 |
| ui2-art.js, ui-v2.css | UI 2 그림표·마크업·스타일. 기본 UI 2, ?ui=1/2로 선택 |
| rework-content.js | Guardian 스킬·단계를 기존 전투 데이터에 연결 |
| element-content.js, element-combat.js, element-effects.js | 원소 스킬·지원품·진화 데이터, 판정, 그림 |
| weapon-effects.js, equipment.js | 기본 무기 판정·그림, 장비·세트·특수 능력 표 |
| themes.js, boss-patterns.js, theme-effects.js | 장별 한글 이름·적/목표/대왕, 기술표, 예고·바닥·효과 |
| runtime-performance.js | 고정 틱 시계·자동 화질·축소 그림 캐시·HUD 갱신 |
| assets.js, music.js | 그림·소리 불러오기·효과음, 로비 음악 |
| cloud.js | API 주소 선택·로그인·토큰·프로필 통신 |
| save.js | 기기 저장·기존 저장 연동 |
| content.data.js, content.js | 원 CSV 데이터·기존 엔진용 표 |
| meta.js, economy.js, ecoui.js | 기존 보너스·경제·화면 연결. Guardian 경로와 혼동하지 않기 |

main.js 줄 범위는 A 구현본 기준이며 병합하면 달라질 수 있다.

| 줄 범위 | 큰 덩어리·검색 이름 |
|---|---|
| 48–147 | DOM·캔버스 크기·HUD 배치 |
| 148–952 | 저장·장비/친구 특수 효과·기존 메뉴 |
| 953–1179 | 입력·상태·성능 히스토그램·피해 출처·소품 |
| 1180–1538 | 판 설정·서바이벌·오염 구역·newRun |
| 1539–1975 | 멈춤·스탯·적 생성·주인공 이동 |
| 1976–2883 | 공격·스킬·적 행동·takeDamage·접촉/폭발 피해 |
| 2884–3513 | 대왕 패턴·경험치·카드 |
| 3514–5031 | 사망·기존 결과·월드/HUD 그리기 |
| 5032–5472 | simTick·RAF·localhost QA 훅·자동 조종 |
| 5473–5550 | 기존 서버 저장 경로 |
| 5551–6122 | Guardian API·출동·카드·1~4장 위험 동작·HUD |
| 6123–파일 끝 | sgEnd·보류 결과·sgSettle·UI 1/2 실패 안내 |

## 관리 페이지·역할

/admin/은 game/admin/index.html + stage-stats.js. 토큰은 sessionStorage, 12시간 유효. X-Admin-Key는 관리자 스크립트용, X-Admin-Token은 역할 토큰용.

| 역할 | 가능 | 불가 |
|---|---|---|
| 관리자 | 통계·접속·개별/전체 지급·비번·잠금·초기화·삭제·그림·시험 프로필·선생님 미리보기 | 학생 정보·비밀값 공개 |
| 선생님 | 통계·단계별 현황·기기별 성능·접속·학생 한 명씩 지급·비번·잠금 | 삭제·초기화·그림·관리 설정·시험 프로필·전체 지급 |

제한은 화면과 index.js TEACHER_BLOCKED/API 양쪽에서 검사한다. 새 GET /api/admin/stage-stats?days=30은 선생님도 읽는다. 화면 기간 7·30·전체, API는 1~3650일/all 허용. stage=CH17처럼 기기 표를 단계별로 고른다. 20단계 표에 도전·성공·승률 막대·학생 수·현재 멈춘 학생·난이도·까닭 상위 3·성능 중앙값이 나온다. TEST_ACCOUNT_RE 시험 계정은 새 집계에서 제외하며 응답·표에 학생 아이디가 없다. 기존 학생별 표는 그대로다.

## 점검 도구

- node --test tests/*.test.mjs: 규칙·서버·역할·진단 검사. 검사 수는 최신 보고서 참조.
- records-results.py: qa 가입 → /_qa/profile → 1-1 실패/성공 → UI 1/2·PC/폰 결과·DB 저장 → QA 제외 → 합성 자료 120명/5000판 → 로컬 선생님 로그인·관리 캡처.
- responsive-audit.py: 시작·로비·장비 창·카드·전투·멈춤·결과의 가림/겹침/넘침. total issues와 _error·_pageErrors 모두 확인.
- tablet-perf.py --mode replay --reference <commit>: checkout 없이 git 이전 소스를 브라우저 요청에 적용. 같은 시드·입력·판 결과·보상·일부 그림 비교. 속도 개선의 증명은 아님.
- tablet-perf.py 다른 mode, tablet-summary.py: 프레임·CPU·힙·반복판. 실제 태블릿과 PC 흉내 구별.
- stage1-browser.py, stage2-browser.py, fx-audit.py, sim.js: 성장·스킬·그림·자동 조종. URL 제한과 프로필을 먼저 읽기.
- /_qa/runs?id=qa…는 해당 QA 계정의 메모리 판만 읽는다. /_qa/stats-fixture는 익명 합성 자료 생성, 운영에는 없는 경로다. 캡처 docs/codex/preview/A_*.png, 로그는 git 제외 game/tools/qa/out/.

## 함정

- 격리 서버는 시작 때 서버 모듈을 읽는다. 서버/규칙 변경 뒤 자신의 8798만 재시작한다. 다른 세션 서버는 종료하지 않는다.
- cloud.js API 후보는 localStorage lumen_api → 같은 주소 /api → 운영 주소다. QA는 localhost URL과 외부 요청 차단으로 실제 서버 연결을 막는다.
- __debugGod·__debugPilot 등은 localhost 전용이다. 자동 조종·무적 성공은 실제 난이도/손 조작 검증과 다르다.
- /_qa/profile은 QA 진행을 덮어쓰고 활성 판을 만료시킨다. 운영 표에 쓰는 도구가 아니다.
- 성능 표본은 보이는 전투 RAF만 포함한다. 카드 선택·멈춤·숨긴 탭·복귀 첫 간격은 제외. FPS는 자기 보고이며 기기 모델명이 아니다.
- 하위 1% FPS는 99백분위 간격의 역수. 1024ms까지 1ms, 이후 64ms 히스토그램 근사다. 표본 0개면 perf 없음. sec는 멈춤을 뺀 게임 시간이다.
- qmax는 판 중 최대 index(가장 낮은 화질). Q 숫자가 클수록 화질이 낮다. v는 진단 구현 버전 문자열, API clientVersion=2와 별개다.
- 실제 체력 피해의 마지막 출처만 기록한다. 회피·방패 흡수·부활 뒤 성공·자발적 나가기는 사망 까닭을 표시하지 않는다.
- 기존 클라이언트 결과 신뢰 문제는 남는다. 진단은 랭킹용 결과 인증이 아니며, 진단을 이유로 보상·밸런스를 바꾸지 않는다.
- Jua는 부분 추출 글꼴이다. 새 결과 안내는 시스템 글꼴로 한글 누락을 피한다. rework.css !important와 UI 2 선택자 세기도 함께 확인한다.
- 친구 CARD_COPIES와 파츠 GRADE_COPIES는 다르다. 옛 문서 숫자를 그대로 적용하지 않는다.
- 공개 저장소에 비밀값·학생 이름·실제 학생 판 원본을 올리지 않는다. 기존 학생별 표가 보이는 캡처는 가린다.
- 시험 뒤 격리 프로세스·브라우저를 정리한다. 운영 시험 계정을 별도 승인받아 썼다면 종료 후 그 시험 계정만 삭제하고 학생 기록은 보존한다.

## 사용자 성향·합의

한국어 쉬운 말·숫자·PNG로 확인하게 한다. 구현·검사·모의 플레이·실기기 측정을 구별한다. 학생 저장·계정·지급 기록을 보존한다. 큰 재배치·밸런스 변경은 합의가 필요하다. 주인공 원본 그림·학생 몬스터 기획을 존중하며 흔들림·슬로모션을 늘리지 않는다. 유료 외부 AI/API 호출은 별도 확인 없이 실행하지 않는다. Gemini 앱으로 제공한 원본은 보존한다.

A/B 파일 분담은 작업지시서가 우선이다. A는 기록·통계·결과·문서, B는 로딩·로비. CLAUDE.md·docs/47·B 작업트리는 A가 편집하지 않는다. 검토 뒤 병합·배포는 Claude 담당이며 구현이 곧 배포 완료는 아니다.

## 남은 일

전체 순서·결정·완료 기준은 [진단서 4절 개발 계획안](docs/47_현황_진단_개발계획.md#4-개발-계획안)을 따른다.

| 계획 단계 | 이후 할 일 |
|---|---|
| 0 실태 파악 | A 검토·병합 뒤 승인된 배포, 학생 태블릿 2대로 성능 비교. CLAUDE.md 정리는 별도 담당 |
| 1 교실에서 잘 돌게 | B 로딩/로비 검토, 실제 기기 자료로 최적화 결정·손 조작 검증 |
| 이후 이야기·랭킹·5/6장·정리 | 진단서 표의 결정 순서대로. 랭킹 전 결과 검증 강화 필요 |

이번 숫자·검증 범위·캡처 목록은 [A 보고서](docs/codex/2026-10-11_보고_A_기록_통계.md)에 기록한다.
