# 서호팡팡수호대 — 협업 브리핑 (ChatGPT용, 2026-09-22 기준)

> **2026-09-22 저녁 상태**: Codex의 Guardian v1(67972a6e) → v2 5원소(03883e12, [guardian-rework-v2.md](guardian-rework-v2.md)) 개편을 Claude Code가 자기 트리에 합쳤고, 그 위에 **접속 신호(지금 접속 중)** 와 **관리 페이지 아이디·비밀번호 로그인** 이 얹혀 있다(Codex v2도 이를 계승함). 현재 서버 원본은 `/share/server/`(index.js·guardian.js·legacy-migration.js·profile-migration-v2.js·wrangler.toml·schema.sql·migrations·관리 페이지). **다음에 배포하는 쪽은 반드시 이 폴더의 서버 파일과 `wrangler.toml`(`run_worker_first`)을 먼저 받아 합칠 것.** 아래 3-0 참고.
>
> **주인공 그림 결정(프로젝트 주인, 2026-09-22 저녁)**: 주인공 원본 PNG 위에 무기를 따로 덧그리는 방식(v2 `weapon-effects.js`의 검·연필·배트·손에 든 공)은 쓰지 않는다. 근거리는 원본 공격 프레임(칼·연필 휘두르기, `main.js heroFrame`), 원거리는 주인이 Gemini로 만드는 방망이 휘두르기·피구공 던지기 프레임(`assets.js HEROES[hero].frames.ranged`)을 쓴다. 날아가는 야구공·피구공, 근거리 궤적, 타격 불꽃은 그대로. Codex는 이 부분을 되돌리지 말 것.

이 문서는 프로젝트를 처음 보는 AI/사람이 10분 안에 상황을 파악하도록 Claude Code가 정리한 요약입니다. 모든 자료는 아래 공유 폴더에서 링크로 읽을 수 있습니다.

- 게임(실서버): https://seoho-pangpang.seoho-pangpang-server.workers.dev
- 공유 폴더: https://seoho-pangpang.seoho-pangpang-server.workers.dev/share/ (이 문서 = `briefing_for_gpt.md`)
- 전체 묶음(zip, 문서+데이터+소스+가공 그림): `share/seoho-pangpang-package-2026-09-22.zip`

## 1. 한 줄 요약
서호초등학교 학생(1~6학년, 약 100명)용 **브라우저 탑다운 서바이벌 액션 게임**. 주인공(호야/민지)이 마을을 오염시키는 "오염 괴물"을 정화한다. 5분을 버티면 단계 성공, 각 장의 5단계는 보스전. 학생은 아이디·비밀번호 계정으로 접속하고 진행 상황은 서버에 저장된다.

## 2. 지금 상태
- **실서버 배포 완료**(Cloudflare Workers + D1). 게임 파일과 API가 한 주소.
- **로비**: 밝은 동화책 톤, 탭 5개(모험·대원·가방·임무·상점), 쉬운 말("출동!", "성공/도전 전").
- **환경 테마 기획안 승인**: 6장 × 5단계 = 30단계(`docs/20_환경_테마_기획.md`).
- **1장 「쓰레기 마을」 구현·배포 완료**: 바닥 3종, 소품(장애물·타이어 튕기기·쓰레기통 정리·쓰레기 줍기), 적 4종+엘리트+파리, 보스 쓰레기 산 대왕(기술 6종, 2페이즈), 악취 구역, 정화 장치(분리수거함), 새싹(경험치).
- **2장 이후**: 단계 이름·환경 이야기만 새것이고 적·보스는 옛 세계관 데이터 그대로. 다음 작업 = 2장 「더러워진 개울」.
- 게임 데이터 용어(봉화·광휘·파수꾼·금화 등)와 전투 결과 창 등은 아직 옛 세계관/어두운 스타일이 남아 있음.

## 3-0. 배포 충돌 방지 규칙 (Codex ↔ Claude Code, 2026-09-22 추가)
- 둘 다 같은 Cloudflare Worker `seoho-pangpang`에 `wrangler deploy`를 한다. 정적 파일은 **배포하는 쪽의 로컬 사본이 통째로 올라가므로**, 상대의 변경을 받지 않고 배포하면 상대 변경이 실서버에서 사라진다(2026-09-22에 실제로 일어남 → Claude가 Codex 버전 7d85ddf0을 미리보기 주소에서 받아 합쳤음).
- 배포 직전에 `npx wrangler deployments list`로 마지막 배포가 내 것인지 확인한다. 아니면 `https://<버전ID 앞 8자>-seoho-pangpang.seoho-pangpang-server.workers.dev/` 에서 상대 파일(`/share/`의 설명서·zip, `/src/*.js`, `/index.html`)을 받아 합친 뒤 배포한다.
- 배포할 때 `wrangler deploy --message "무엇을 바꿨는지"`로 메시지를 남기고, 바꾼 파일 묶음(zip)과 설명서를 `/share/`에 올린다. 서버 코드(`server/`)와 DB는 Claude Code가 관리한다(관리 API·지급 표가 있음).
- **역할 분담(2026-09-22 저녁, Guardian v1 이후 수정)**: Codex 담당 = 게임 클라이언트(`index.html`, `src/*.js`, `rework.css`, 그림·연출)와 개편 서버 모듈(`server/src/guardian.js`, `legacy-migration.js`). Claude Code 담당 = `server/src/index.js`(회원·세션·관리자 인증·**접속 신호**·관리 API 골격), D1 표(`presence`, `grants` 등), 선생님 관리 페이지(`/admin/`, Codex의 이용권 UI 포함), 문서·`/share/`. 상대 영역을 바꿔야 하면 `/share/`에 설명서를 남기고 프로젝트 주인에게 말한다.
- **배포 전 합치기(양쪽 공통)**: (1) `npx wrangler deployments list`로 마지막 배포가 내 것인지 확인. (2) 아니면 `/share/server/`의 `index.js`·`guardian.js`·`legacy-migration.js`·`wrangler.toml`·`migrations/`·`admin_index.html`과 `/src/*.js`·`/index.html`을 받아 내 사본에 합친다. **`wrangler.toml`의 `[assets] run_worker_first = ["/"]`와 `index.js`의 `injectPresence`·`/api/presence`·`/api/admin/login|online`은 접속 신호·관리자 로그인 기능이므로 빼면 관리 페이지에 "신호 기능이 꺼져 있어요" 경고가 뜬다.** (3) `wrangler deploy --message "…"`로 배포하고 `/share/`에 바뀐 파일 목록·설명서를 남긴다.
- 서버 API 계약: `/api/register|login|logout|me`, `GET /api/save`(읽기 전용 보관, `archived:true`), Codex의 `/api/guardian*`·`/api/play/*`, 관리자 `POST /api/admin/login`·`GET /api/admin/online|stats|passes`·`POST …/grant-passes|reset-password|lock|reset-save|delete`. 403 = 잠긴 계정, 410 = 종료된 옛 API(`PUT /save`, `grant`).

## 3. 프로젝트 주인·협업 방식
- 주인은 **개발자가 아닌 교사**. 한국어, 기술 용어 없이 결과 중심으로 소통. 그림은 본인의 **Gemini 앱**으로 만든다(프롬프트를 복사 가능한 형태로 주면 됨, API 유료는 원치 않음).
- 구현·배포는 Claude Code가 담당해 왔다. ChatGPT와는 **기획·문구·데이터(CSV/JSON) 제안·그림 프롬프트·교육 내용 검수** 등에서 협업 예정.
- 코드 변경 제안은 파일 경로와 함께 "무엇을 왜 바꾸는지"를 적어 주면 Claude Code가 적용·배포·검증한다.

## 4. 폴더 지도 (zip 기준)
| 경로 | 내용 |
|---|---|
| `HANDOFF.md` | 세션 인수인계: 배포 절차, 도구 함정, 다음 후보 작업 |
| `game/STATUS.md` | 구현 기록(최신이 위). 무엇이 되어 있고 무엇이 근사인지 정직하게 기록 |
| `docs/01~19_*.md` | 원 기획서 19장(컨셉·전투·스킬·챕터·성장·경제·UI·기술 구조 등). 원안은 LUMEN(황혼의 파수꾼) 세계관 |
| `docs/20_환경_테마_기획.md` | **현재 방향**: 환경 테마 30단계 표, 용어 치환, 필요한 기믹 |
| `data/*.csv, *.json` | 게임 데이터 원본(적 52, 보스 20, 챕터 60, 스킬 24, 패시브 18, 진화 28, 장비 48, 부품 24, 펫 12, 수집품 100, 특성 84, 미션 44, 업적 100, 상점·보상, 이벤트 6) → `game/tools/build-content.ps1`이 `game/src/content.data.js`로 변환 |
| `game/src/themes.js` | 환경 테마: 6장 이름·30단계 이름·환경 이야기 30개 + **1장 전투 데이터**(적·보스·단계 구성). 2장부터는 여기에 T2_* 표를 추가하는 방식 |
| `game/src/content.js` | 데이터 → 게임 정의(적·보스·챕터·스킬…). 끝부분에서 테마 1이 CH01~05를 덮어씀 |
| `game/src/main.js` | 게임 본체(로비·전투·렌더·보스 패턴·소품 기능). 약 4,300줄 |
| `game/src/economy.js`, `ecoui.js`, `meta.js`, `save.js`, `cloud.js`, `assets.js` | 경제·로비 UI·메타 데이터·저장·서버 통신·에셋 목록 |
| `game/index.html` | 화면 구조와 CSS(끝의 "로비 밝은 테마" 블록이 현재 로비 스타일) |
| `game/assets/` | 가공된 그림·효과음·글꼴(`sprites/t1/` = 1장 그림 23장) |
| `game/tools/` | 그림 자르기(`cut_theme1.py`, `cut_heroes.py`), 글꼴 추출, 단일 파일 빌드, 데이터 변환 |
| `game/ASSET_CREDITS.md` | 에셋 출처·라이선스(Kenney CC0, Jua OFL, 사용자 Gemini 생성물) |
| `server/` | Cloudflare Worker(`src/index.js`): 회원가입·로그인·저장 API, `schema.sql`(D1) |
| `이미지 에셋/필요한_그림_목록.md` | 테마별 필요한 그림 목록과 Gemini 프롬프트(1장은 완료) |

## 5. 게임 규칙 요약(현재 구현)
- 5분 카운트다운 서바이벌 30단계. 적은 시간이 갈수록 촘촘해지고, 각 장 5단계는 시간이 끝나면 보스 등장 → 처치해야 성공. 별 3개: 성공 / 부활 없이 / 4분 전 Lv20.
- 조작: 방향키 또는 손가락 끌기. 공격은 자동. 레벨업마다 카드 3장 중 선택(공격 24·패시브 18, 진화·융합 28).
- 1장 소품: 타이어·벤치·봉투 더미·넘어진 쓰레기통 = 장애물. 타이어에 부딪힌 적은 튕겨 나가며 조금 다침. 쓰레기통 곁에 1.2초 서면 정리(새싹 6+금화 30). 바닥 쓰레기를 밟으면 새싹 3.
- 1장 보스 기술: 쓰레기 투척 / 악취 방귀 구름(5초 안개, 느려짐·지속 피해) / 쓰레기 흡입(끌어당김 후 물기) / 2페이즈: 쓰레기 눈사태·봉지 유령 소환·쓰레기 뿌리기(8초 안에 주우면 보스 체력 3%↓, 1초 기절, 내 체력 5%↑).
- 로비에 숨긴 기능(코드는 유지): 놀이 모드 8종, 빠른 전투, 부품·프리셋·이벤트, 모드 전용 상점.

## 6. 기술 사실(코드 제안 시 참고)
- 빌드 없음: 순수 ES 모듈 + Canvas 2D. 1u = 32px, 주인공 화면 높이 약 60px. 폰(375px)과 PC(1280px) 모두 지원.
- 서버: Cloudflare Workers + D1(SQLite). 비밀번호는 PBKDF2-SHA256 해시. IP별 시도 제한.
- 도구: PowerShell 5.1 스크립트(한글 포함 시 UTF-8 BOM), Python 3.12(Pillow·numpy·scipy·fonttools).
- 제목 글꼴은 부분 추출(Jua)이라 새 문구는 글꼴 재추출 필요.
- 단일 파일판(`dist_single/LUMEN.html`)은 인터넷만 있으면 더블클릭으로 실행(실서버 API 사용).

## 7. 열린 과제(우선순위 미정)
1. 2장 「더러워진 개울」 그림 8장 → 구현(1장과 같은 절차). 새 기믹: 궤적 오염 장판, 정지 장애물, 이동 안전 구역, 인력.
2. 전투 화면·결과·레벨업 창을 로비처럼 밝은 스타일로. 옛 용어(봉화·광휘·금화·파수꾼) 정리.
3. 선생님용 계정 관리(비밀번호 재설정·삭제) 도구.
4. 로비 마을 카드(오염/깨끗) 그림, 보스 2페이즈 실제 플레이 확인, 적 걷기 애니메이션.
5. 난이도 곡선(적 배수 1.11^(n−1) → 1.07~1.08) 조정, 30일 경제 흐름 검증.

## 8. 공유 폴더 파일 목록
- `briefing_for_gpt.md`(이 문서) · `HANDOFF.md` · `STATUS.md` · `env_theme_plan.md`(=docs/20) · `asset_list.md`(=필요한_그림_목록) · `ASSET_CREDITS.md` · `README.md`
- `docs/01_concept.md` … `docs/20_환경_테마_기획.md`, `data/*.csv|json`
- 게임 소스는 실서버에서 그대로 읽힌다: `/src/main.js`, `/src/themes.js`, `/src/content.js`, `/index.html` 등
- `seoho-pangpang-package-2026-09-22.zip`(전체 묶음, 약 5MB)
