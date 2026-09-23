# 서호팡팡수호대 — 세션 인수인계 (2026-09-22 기준)

## 2026-09-23. 파츠 보급 개편 2차·3차 완성 / 실서버 배포 완료 fc20ccda (Claude)
- docs/23 최종안(사용자 선택)의 2차 보급 규칙과 3차 금 메달 기능을 구현했다. 이름: 보급·보급권·동/은/금 메달·레벨 올리기. 규칙·검증·배포 절차: `docs/26_2차_3차_개편_구현_기록.md`. 아래 "뽑기·파츠 강화 개편(구현 전)"과 "두 안 중 확인" 안내는 끝난 일이다.
- 성공 보급권: 쉬움·보통 1장, 어려움 2장, 같은 단계는 하루 2번 성공까지만(사용자 요청).
- 태블릿 해상도 자동 조절 수리 포함. 검사 92/92, 브라우저 PC 1280·폰 375 통과(격리 서버). 15:32 KST GitHub Actions로 배포 완료(fc20ccda). 다음 배포도 휴대폰에서 "배포해" → deploy/ 브랜치, 또는 배포 PC deploy.ps1(둘 다 check-live 기록 공유).
- 휴대폰·원격 배포(2026-09-23): `seoho-game` 최신 커밋으로 `deploy/YYYYMMDD-HHMM` 브랜치를 올리면(휴대폰 GitHub 웹에서 브랜치 만들기도 가능) GitHub Actions(`.github/workflows/seoho-deploy.yml`)가 검사 → check-live → dist_web 동기화 → wrangler deploy → `server/.last_deploy_version`·share 기록 커밋까지 한다. Codex 배포를 합친 뒤 기록과 다를 때만 `deploy-force/…` 브랜치. 끝나면 배포 브랜치는 지워진다. 저장소 비밀값 `CLOUDFLARE_API_TOKEN`(Workers 편집) 필요(값은 어디에도 쓰지 않는다). 기본 브랜치 main은 다른 프로젝트라 Run workflow 버튼 대신 브랜치를 쓰고, Claude 작업 환경은 태그 올리기가 막혀 있다.

## 2026-09-23. 1차 개선 구현·검증 완료 / 실서버 배포 대기
- 첫 스킬 선택에 장착 파츠 스킬 보장, 진화 뒤 파츠 5종 복구, 실제 발동·쉬었던 파츠 결과 안내, 첫 보상 선택 창·다음 할 일·특급 선택 보호를 구현했다. 스킬 선택창 위로 전투 아이콘이 겹치던 표시도 정리했다.
- 오래된 도전 30분 정리, 옛 E3/V3/W3 파츠 복구·초과분 뽑기권·강화 코인 환급, 원본 보관·반복 처리·저장 충돌 보호를 구현했다. 학생의 운영 기록은 아직 변경하지 않았다.
- 태블릿 대응: 반복 화면 쓰기·그라데이션 생성을 줄이고 화면 밖 그리기 생략, 고주사율 시간 계산 수리, 밀린 계산 제한, 느린 기기의 그림 해상도 단계 조절. 실제 태블릿에서 끊김이 완전히 해결됐다는 뜻은 아니다.
- 자동 검사 64/64, 실제 Chromium PC 1280·휴대폰 375의 가입·첫 보상·재접속·뽑기·첫 카드·전투 결과 및 최초 성공 후 안내 흐름을 모두 확인했다. 검증용 서버는 실제 Worker 처리 코드와 메모리 DB를 연결한 별도 환경이며 실서비스 플레이 검증과 구분한다.
- dist_web 동기화, 단일 파일 LUMEN.html 재생성 및 PC/폰 열기, Cloudflare 배포 묶음 검사(dry-run)를 마쳤다. 현재 실서버 시작 화면도 두 크기에서 200·스크립트 오류 없음으로 확인했다. 수정본의 실서버 배포 후 검증은 아직 아니다.
- 실서버 배포는 하지 않았다. GitHub 실행 환경에 Cloudflare 배포 연결 정보가 없어 기존 배포 PC에서 check-live 후 deploy.ps1로 반영해야 한다. server/.last_deploy_version은 바꾸지 않았다.
- 의견이 갈린 묶음 확률·전설·조각과 2차 보급 경제, 레벨 피해 수치는 변경하지 않았다. 배경음·스킬 v3·난이도·교사 권한·추석 이벤트를 유지했다.
- 자세한 완료 범위·검증 결과·다음 배포 절차: docs/25_1차_개선_검증_기록.md. 이 기록이 아래 중간 점검의 63개·검증 중 상태보다 최신이다.



## 2026-09-23 Codex 후속 작업 — 1차 오류 수리·성능 개선
- 사용자가 Claude 중단 작업을 이어서 구현하도록 요청. 공통 1차 범위부터 적용하고, 서로 다른 2차 보급 경제·전설 제안은 보류한다.
- 바뀐 규칙·실제 검증·배포 여부는 `docs/25_1차_개선_검증_기록.md`와 STATUS 맨 위를 확인한다. 아래의 이전 "구현 전" 안내는 과거 요청이며 이번 1차 수정을 되돌리지 않는다.

## 다음 반영 요청: 뽑기·파츠 강화 개편 (2026-09-23, 구현 전)
- 사용자가 ChatGPT 개편안을 GitHub에 남겨 Claude가 반영하도록 요청했다. 전체 문서: [보급 상자·파츠 성장 개편안](docs/2026-09-23_뽑기_파츠_강화_개편안.md). `CLAUDE.md` 맨 위에도 연결되어 있다.
- **이번 작업은 문서 전달만 완료했다. 게임 소스·실서버에는 아직 적용하지 않았다.** 최신 `seoho-game`을 받은 다음 제안서의 인수인계와 제11절 확인 기준에 따라 구현한다.
- 핵심: 원소 선택·5번째 직접 선택 유지, 1/3/7개 묶음(80/18/2%), 누적 1/3/7/15개 등급, 등급별 기능 변화, 완성 뒤 초과분 재활용, 달성 불가능한 같은 원소 3개 조건 정리. 수치는 시험값이며 추가 공격의 세부 수치는 비교 검증한다.
- 기존 학생의 파츠·레벨·코인·뽑기권·선택 횟수와 첫 획득 기능을 보존한다. 배경음악·난이도·스킬 v3·선생님 권한·추석 이용권 이벤트 등 최근 작업을 되돌리지 않는다.
- 큰 화면 변경 전 설명 → 구현·검사 → dist_web 동기화·실서버 배포 → PC 1280/휴대폰 375 실제 화면·스크린샷 → 단일 파일판 재생성 → STATUS 맨 위 기록까지가 구현 완료 기준이다.
- 아래에는 초기 버전의 역사적 설명도 남아 있으므로, 현재 구현 판단은 `game/STATUS.md`의 최신 항목과 실제 소스를 우선한다.

## 한 줄 요약
서호초등학교 학생(약 100명)용 브라우저 탑다운 서바이벌 액션 게임. 원래 기획명 LUMEN(황혼의 파수꾼)에서 이름·주제를 바꿔 **"서호팡팡수호대 — 마을의 환경을 지켜라"**(생태·환경 주제)로 전환 중. 실서버에 배포되어 있고 학생 계정(아이디·비번만)으로 서버 저장한다.

- **실서버(학생용 주소)**: https://seoho-pangpang.seoho-pangpang-server.workers.dev
- 사용자는 개발자가 아니다. 한국어, 쉬운 말, 결과는 화면(스크린샷·실서버)으로 확인해 보여 주기.
- 진행 기록은 `game/STATUS.md`(최신이 위) — 작업 후 반드시 갱신.

## 폴더
| 경로 | 내용 |
|---|---|
| `game/` | **소스**. `index.html`, `src/*.js`(ES 모듈, 빌드 없음), `assets/`(그림·소리·글꼴), `tools/`(스크립트), `STATUS.md`, `ASSET_CREDITS.md` |
| `dist_web/` | 배포 사본 = `game/`의 index.html·src·assets를 복사한 것. **서버가 이 폴더를 서빙**한다. 수정 후 반드시 동기화 |
| `dist_single/LUMEN.html` | 단일 파일판(모든 것 data URI). `game/tools/build-single.ps1`로 생성. 열면 실서버 API에 붙음(인터넷 필요) |
| `server/` | Cloudflare Worker(`src/index.js`: 계정·저장 API + 선생님 관리 API) + D1 스키마(`schema.sql`, `migrations/`) + `wrangler.toml` + README(배포 절차·관리 API). `.dev.vars`는 로컬 관리 열쇠(공유 금지) |
| `game/admin/` | 선생님 관리 페이지(원본) → `dist_web/admin/` 복사해 배포. 실서버 `/admin/`, 로그인 = 아이디·비밀번호(Cloudflare 비밀값 `ADMIN_ID`·`ADMIN_PW`, 사용자가 보관, 문서에 적지 말 것). 스크립트는 `X-Admin-Key`(`ADMIN_KEY`)도 가능. "지금 접속 중"(접속 신호)·이용권 지급(Codex) 포함 |
| `이미지 에셋/` | 사용자가 Gemini 앱으로 만든 원본 그림(주인공 시트, 시작 화면 배경, 엠블럼, 마스코트, 테마 1 그림) + `필요한_그림_목록.md` |
| `dist_web/share/` | **ChatGPT 협업용 공개 자료**(브리핑·문서·데이터·전체 zip). 실서버 `/share/`로 서빙. `GPT_협업_브리핑.md`(루트)가 원본. 갱신은 STATUS 00000000 참조 |
| `dist_web/robots.txt` | AI 도구 읽기 허용(ai-input=yes, ai-train=no), `/api/`·`/admin/` 제외. 클라우드플레어가 앞에 자체 안내문을 붙일 수 있음 |
| `data/`, `docs/` | 원 기획서 CSV/JSON·문서 19장. `data` → `game/tools/build-content.ps1` → `game/src/content.data.js` |

## GitHub로 여러 PC에서 작업 (2026-09-23~)
- 저장소: GitHub `donggen122-create/-`의 **`seoho-game` 브랜치**(사용자 지정, 2026-09-23). **공개 저장소**이고 `main`은 다른 프로젝트(가계부)라 건드리지 않는다. Claude가 읽는 공통 규칙은 루트 `CLAUDE.md`(모든 PC에서 자동으로 읽힘) — PC마다 다른 Claude 메모 대신 여기에 둔다.
- 새 PC: Git·Node.js 설치 → `git clone -b seoho-game https://github.com/donggen122-create/-.git seoho-game` → `powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\setup.ps1`(npm 설치·로컬 비밀값 파일·로컬 DB 표) → `server`에서 `npx wrangler login`(브라우저 허용).
- 작업 시작 `git pull` → 작업 → 배포 `game\tools\deploy.ps1 -Message "..."`(검사·Codex/다른 PC 배포 확인·dist_web 동기화·배포·버전 기록) → `git add -A; git commit; git push origin seoho-game`(server/.last_deploy_version 포함 — 다른 PC의 check-live가 이 기록으로 "내 배포"를 안다).
- git에 안 올리는 것(.gitignore): `server/.dev.vars`(비밀값), node_modules, `.wrangler`(로컬 DB), `dist_single/`, dist_web 중 game/에서 복사해 오는 부분(src·assets·admin·index.html·ASSET_CREDITS.md). `.gitattributes`의 `* -text`로 줄바꿈 변환 없이 바이트 그대로.
- 스크립트는 경로가 PC마다 달라도 된다: `game/tools/env.ps1`이 node·git·gh·python을 찾아 준다. 한글이 든 .ps1은 UTF-8 BOM으로 저장(PowerShell 5.1).

## 실행·배포 명령 (PowerShell 5.1, 프로젝트 루트에서)
```powershell
# node·python 위치는 game\tools\env.ps1 이 찾는다(스크립트들이 자동으로 부름). 직접 쓸 때:  . .\game\tools\env.ps1  → $Python

# ★★ 협업 상태(2026-09-22 저녁~): Codex(ChatGPT)가 게임을 "Guardian v1"(17:47, 67972a6e) → "v2 5원소"(19:33, 03883e12)로 전면 개편했고 Codex도 같은 Worker에 배포한다.
#    Codex는 클라이언트뿐 아니라 서버(server/src/guardian.js·legacy-migration.js·profile-migration-v2.js, index.js 일부)와 관리 페이지도 바꾼다(STATUS 000000000000000).
#    주인공 그림 결정(사용자): Codex의 무기 덧그리기 대신 원본 공격 프레임(칼·연필)을 쓴다. 원거리는 사용자 Gemini 그림(방망이·피구공)으로 만든 f.ranged 프레임을 쓴다(그림 대기).
#    사용자 지시: 작업·배포 전 반드시 확인하고, Codex 작업과 절대 겹치지 말 것.
#    → 세션 시작·작업 착수·배포 직전에 아래를 실행. "주의"가 나오면 -Pull 로 받고 /share/의 Codex 설명서·zip을 읽어 먼저 합친다.
powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\check-live.ps1          # (-Pull 추가 시 파일 내려받음)
#    → 합치는 법: zip의 game/·assets는 그대로 복사(클라이언트는 Codex 것), server/src/index.js는 Codex zip의 것이 번들 결과물이므로
#      내 index.js에 Codex 변경을 다시 적용한다(guardian.js·legacy-migration.js는 그대로 복사). 합친 뒤 그 Codex 버전 ID를 server\.last_deploy_version 에 적으면 check-live가 OK를 낸다.
#    → Claude 담당: server/src/index.js(회원·세션·관리자 인증·접속 신호·관리 API), game/admin/, DB 표(presence·grants…), 문서·/share/. Codex 담당: game/index.html·game/src/*·그림, server/src/guardian.js·legacy-migration.js.
#      game/src/*는 사용자 지시 없이 고치지 않는다. 서버 원본은 /share/server/ 에 올려 두어 Codex가 배포 전에 받아 합치게 한다(배포 때마다 갱신).
#    → 배포 후: 출력의 "Current Version ID"를 server\.last_deploy_version 에 기록(deploy.ps1이 자동. wrangler secret bulk 도 새 버전을 만드니 그때는 직접 기록).
#    → 비밀값: ADMIN_KEY(스크립트용 열쇠·토큰 서명), ADMIN_ID·ADMIN_PW(관리자 로그인), TEACHER_ID·TEACHER_PW(선생님 계정 로그인). 값은 사용자에게만 전달, 문서·커밋에 적지 않음. 로컬은 server\.dev.vars(git 제외).
#    → 관리 페이지 역할(2026-09-23): /admin/ 하나에서 비밀번호로 구분 — 관리자 = 전부, 선생님 계정 = 학생 계정 삭제·진행 초기화·그림 보내기 없음(서버 index.js admin()이 403). 관리자 화면에 "선생님 화면 미리보기".
#    → 캡처: game\tools\qa\capture.ps1(게임 화면)·admin-capture.ps1(관리 페이지, 비밀번호 대신 .dev.vars 열쇠로 토큰)·sim.ps1(난이도 자동 조종). 바탕은 node game\tools\shot.cjs(페이지 오류도 출력).
#    → 사용자 그림 받기: 사용자는 다른 PC(노트북, 계정 dongg)에서 Gemini로 그림을 만든다 → 실서버 /admin/upload 에 올리게 하고(관리자 로그인),
#      작업 PC에서 관리자 토큰으로 GET /api/admin/upload/list → GET /api/admin/upload/file?id=&token= 로 내려받아 이미지 에셋/업로드/ 에 둔다(STATUS 0000000000000000).
#    → 주인공 원거리 프레임: 이미지 에셋/주인공 방망이 *.jpg·여주인공 피구공 전투.jpg → python game\tools\cut_heroes_bat.py → assets/sprites/heroes/*_ranged_*.png
#    → 난이도 3단계(2026-09-23 오전, STATUS 00000000000000000000): 쉬움★·보통★★·어려움★★★ = 성공 시 별 수. 배수·특별한 적 표는 rework-core.js DIFFICULTIES·SPECIAL_TRAITS,
#      동작·표시는 main.js(sgRunConfig·sgDiffMul·sgMaybeTrait·sgDamage 5번째 인자 = 원소/'weapon'), 도전 중 난이도 변경 금지는 guardian.js. 무기 원소 설정은 없앴다(근거리·원거리만).
#      로컬 자동 조종: 시뮬 스크립트에서 1-3 이상을 고를 때 테스트 계정의 앞 단계가 안 깨져 있으면 1-1로 돌아가니 D1에서 stages를 먼저 성공 처리할 것.
#    → 원소 스킬 체계 v3(2026-09-23, STATUS 000000000000000000): 스킬 10·지원품 8·진화 10 = game/src/element-content.js(데이터)·rework-core.js(카드 규칙)·element-combat.js(동작)·element-effects.js(그림)·rework-ui.js(도감).
#      그림은 이미지 에셋/스킬 *.jpg → python game\tools\cut_skills.py → assets/sprites/skills/. 새 스킬을 넣으려면 content에 항목(kind·sprite) + combat의 cast()에 kind 동작 + effects에 그리기 추가.
#      검사: node --test "tests/*.test.mjs" (element-v3·element-spread·guardian·weapon·admin-roles). 이 파일들은 이제 Claude 담당 — Codex 배포본과 합칠 때 되돌아가지 않았는지 확인할 것.
# 게임 수정 → 실서버 배포(검사 → 마지막 배포 확인 → game/→dist_web 동기화·공유 폴더 사본 → 배포 → 버전 기록). wrangler 로그인은 PC마다 한 번.
powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\deploy.ps1 -Message "what changed"
git add -A; git commit -m "..."; git push                                                   # 버전 기록을 다른 PC와 공유

# 로컬 테스트: 게임+API 한 번에(동기화 후 wrangler dev, http://localhost:8797) = .claude/launch.json "wrangler"
powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\dev-server.ps1
# 정적만: powershell -File game\server.ps1 -Port 8796  (.claude/launch.json "lumen")

# 단일 파일판
powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\build-single.ps1
```
- 실서버 D1: `seoho-pangpang-db`(APAC). 운영 쿼리: `npx wrangler d1 execute seoho-pangpang-db --remote --command "SELECT COUNT(*) FROM users"`
- 실서버에 **계정은 아직 0개**(테스트 계정은 로컬 DB에만 있었고 지워짐).

## 현재 구현 상태 (핵심)
- **시작 화면**: 배경 일러스트(세로/가로 자동), 무궁화 '서호' 엠블럼, 제목(Jua 글꼴 부분 추출), 호야·민지 응원 포즈(넓은 화면은 양옆 absolute, 좁은 화면은 카드 양옆 작게), 새싹 지구 마스코트(호야 머리 위), 접속 카드.
- **서버 필수**: 기기 전용 모드 없음. `src/cloud.js`가 API를 ①localStorage `lumen_api` → ②같은 주소 `/api` → ③실서버 고정 주소 순으로 찾음. 접속 후 서버 저장본 우선, 없으면 기기 진행 업로드. `writeSave`마다 2초 뒤 업로드(로비 우상단 ☁). 토큰 `lumen_token`.
- **API**(`server/src/index.js`): register/login/me/logout/save(GET·PUT). 비번 PBKDF2-SHA256 12k회. 제한: IP당 로그인 300/10분·가입 100/시간, 같은 아이디 비번 10회 연속 실패 → 15분 잠금.
- **주인공**: 호야/민지 중 처음 한 번만 선택(`save.hero`, 변경 버튼 없음). 프레임 애니메이션(서기/걷기3/달리기3/점프/공격3/피격/쓰러짐) `assets/sprites/heroes/`, 서 있기 키 112px 통일(`HERO_DRAW_H=77`). 겉모습만 바뀌고 능력은 기존 캐릭터(C01~C12)가 담당.
- **스테이지 1~30 서바이벌**(`SURVIVAL_CHAPTERS=30`): 5분 카운트다운, 버티면 클리어. 각 장의 5단계(CH05·10·…)는 시간 종료 시 보스 등장 → 처치해야 클리어. CH31~는 기존 방식.
- **로비(2026-09-22 개편, 밝은 테마)**: 탭 5개 모험/대원/가방/임무/상점. 모험 탭 = 내 대원 카드 + 환경 이야기 카드 + 모험 지도(현재 장의 5단계 카드, 출동! 버튼). 장·단계 이름·환경 이야기는 `src/themes.js`(6장×5단계, chapters 데이터는 그대로). 놀이 모드·빠른 전투·봉화 수익 버튼·부품·프리셋·이벤트·모드 상점·재화 4종은 **숨김**(코드 유지, STATUS 00000 참조). 봉화 수익은 로비 입장 시 자동 수령.
- **일시정지**: Esc/⏸ → 계속·로비로·처음 화면으로(나가기 = 패배 정리). 로비 🏠 = 처음 화면.
- 문구: 시작 화면·로비 "마을의 환경을 지켜라". 로비는 쉬운 말(출동!, 성공/도전 전, 대원, 가방…)로 바꿨지만 게임 데이터 용어(봉화·어둠 지대·광휘·파수꾼·금화 등)와 전투·결과 화면은 아직 옛 세계관·어두운 스타일.
- **환경 테마 기획안**(6장: 쓰레기 마을 → 더러워진 개울 → 뿌연 하늘 → 불타는 숲 → 플라스틱 바다 → 뜨거운 지구)은 사용자 승인. **테마 1 「쓰레기 마을」은 구현·배포됨**(STATUS 000000): 그림은 `이미지 에셋/` → `game/tools/cut_theme1.py` → `game/assets/sprites/t1/`, 적·보스·단계 구성은 `src/themes.js`(T1_*), `content.js` 끝에서 CH01~05에 덮어씀. 테마 2 이후는 같은 방식으로: 그림 목록·프롬프트 `이미지 에셋/필요한_그림_목록.md`(전체 목록의 바닥·소품 + 적·보스 시트 추가 요청), `cut_theme1.py`를 복사해 상자 좌표만 바꾸고, themes.js에 T2_* 표를 추가.
- claude.ai 아티팩트 링크는 서버 통신이 막혀 쓸 수 없음 → 사용자가 직접 삭제 예정. 더 갱신하지 말 것.

## 도구·함정
- **PowerShell 스크립트에 한글이 있으면 UTF-8 BOM으로 저장**(없으면 깨져서 실패). `Remove-Item 경로\*.png`가 가끔 차단됨 → `Copy-Item -Force`로 덮어쓰기.
- `Invoke-RestMethod`는 TLS1.2 설정 + UTF-8 바이트 본문 필요(한글 JSON). 실서버 확인은 `curl.exe`도 가능.
- 브라우저 패널은 `file://`를 못 연다 → 단일 파일 테스트는 `node game\tools\shot.cjs --url file:///C:/…/dist_single/LUMEN.html --out x.png`(페이지 오류까지 출력).
- **Gemini 앱 이미지**: 같은 채팅에서 이어 요청하면 이전 그림을 "편집"해 회색 캔버스가 나옴 → **이미지마다 새 채팅**, "이전 이미지를 편집하지 말고 새로 생성" 문구. 다운로드 파일이 깨지면 우클릭 저장(1024px)으로 대체. 배경은 마젠타(#FF00FF)/초록(#00FF00) 단색으로 요청 → `cut_heroes.py`(시트) / `cut_title_art.py`(단일 그림) 크로마키. 마젠타 키는 `min(R,B)-G`(분홍 보호), 분홍 글로우는 가장자리 연결 영역 제거(flood).
- 제목 글꼴은 부분 추출(266자, 39KB). **시작 화면·로비 제목 문구를 바꾸면 `python game/tools/subset_font.py` 재실행**(JS 문구는 스크립트의 `JS_STRINGS`에 추가). 임의 문자열(아이디)은 `.sysfont`로.
- `build-single.ps1`의 모듈 순서 `$order`에 새 모듈 추가 필요(현재 content.data, themes, content, meta, save, assets, cloud, economy, ecoui, theme-effects, rework-core, rework-content, rework-ui, main). 에셋 경로는 `IMG_BASE + "리터럴"`과 템플릿 문자열의 `./assets/seoho_v1/…`·`./assets/sprites/heroes/…`(→ `__asset()` 표)만 data URI로 바뀜. `rework.css`는 인라인.
- **사용자에게 화면을 보여 줄 때는 PNG 파일로 보낸다(SendUserFile)** — 브라우저 패널의 스크린샷은 사용자에게 안 보인다. 로그인이 필요한 화면(로비)은 로컬 wrangler에 `dist_web/zz_shot.html`(STATUS 00000의 캡처 방법)로 Edge 헤드리스 캡처. 시안은 먼저 HTML 목업(game/zz_*.html, 8796)으로 만들어 PNG로 보여 주고 승인 후 구현(로비는 4판까지 갔음).
- 이 PC에는 git이 없고 프로젝트도 git 저장소가 아니다(백업 = 폴더 + 실서버 배포본). 다른 Claude 세션이 같은 폴더에서 동시에 작업할 수 있으니(포트 8796/8797 점유, index.html·STATUS.md 동시 수정) 편집 전에 파일을 다시 읽을 것.
- QA 훅(콘솔): `__debugAutoPlay(s)`, `__debugAdvance(s)`, `__debugGod=true`, `__debugUnlockAll()`, `__debugSpawn(id,n)`, `__debugForceBoss()`, `__debugBossHp(비율)`, `__debugBossPattern("이름")`, `__debugDecor()`, `__debugPlayerPos()`, `__save()`, `__cloud`. 브라우저 패널은 백그라운드라 게임 루프가 거의 멈추므로 `__debugAdvance`로 시간을 보내고, 이동은 KeyboardEvent를 흉내 낸다.

## 사용자 성향·합의
- 결과를 **실서버에서 바로 확인**하고 스크린샷으로 보여 주면 좋아함. 단일 파일도 매번 첨부해 왔음.
- 배치 변경에 민감: 호야·민지를 "자연스럽게" 바꿨다가 "이전이 낫다"로 되돌림. 큰 재배치 전에 시안 설명 후 진행.
- 이미지는 사용자가 Gemini 앱(구독)으로 생성 → 프롬프트를 복사 가능한 코드 블록으로 요청 문구·파일명·저장 위치까지 적어 주기. API 유료는 원치 않음.
- 도메인 구매는 "나중에 고민". Cloudflare Registrar(.com 약 $10/년) 또는 국내 업체(.kr) 안내함.

## 다음 후보 작업 (우선순위는 사용자에게 확인)
1. **테마 2 「더러워진 개울」** — 테마 1과 같은 절차(그림 8장 → cut → themes.js T2_*). 기획안의 새 기믹(궤적 오염 장판·정지 장애물·이동 안전 구역·인력)은 아직 엔진에 없음. 테마 1 다듬기: 로비 마을 카드(오염/깨끗) 그림, 보스 2페이즈 실제 플레이 확인, 적 이동 애니메이션(2프레임) 원하면 시트 추가 요청.
2. 전투 HUD·결과·레벨업·일시정지 창도 로비처럼 밝은 스타일로. "금화"→"코인" 등 데이터 용어 정리.
3. (완료) 선생님 관리 페이지 `/admin/` — 통계·비번 재설정·잠금·선물·초기화·삭제. 추가 후보: 반/번호 필드, 학급별 묶음 보기, 플레이 시간 집계.
4. 서바이벌 연출(타이머 경고, 보스 등장 연출).
5. 그림 재생성: 가로 배경 고화질, 엠블럼(여백 있게), 호야 피격 프레임, 민지 점프 최고점 프레임.
6. 도메인 연결(사용자 구매 후).
