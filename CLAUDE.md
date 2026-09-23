# 서호팡팡수호대 — Claude 작업 안내 (모든 PC 공통)

## 2026-09-23 저녁. 파츠 보급 = 무작위 + 5등급(노말~전설) (Claude)
- 사용자 요청으로 docs/26의 보급 규칙(원소 고르기·5번째 3개·처음 3종·동/은/금)을 대신한다: 10종 중 무작위(전설 제외), 개수 운 1·3·7개(80/18/2%), 등급 노말 1 · 레어 3 · 유니크 7 · 에픽 25 · 전설 80개. 첫 무료 파츠만 고르기. 이름은 보급·보급권. 등급 능력: 피해 레어 10 · 유니크 25 · 에픽 45 · 전설 80%, 발동 최대 25% 빠르게, 에픽 유니크 기능 강화, 전설 30% 한 번 더 발동. 자세한 내용 `docs/27_파츠_보급_무작위_5등급.md`.

## 2026-09-23. 파츠 보급 개편 2차·3차 완성 / 실서버 배포 완료 fc20ccda (Claude)
- docs/23 최종안(사용자 선택)의 2차 보급 규칙과 3차 금 메달 기능을 구현했다. 이름: 보급·보급권·동/은/금 메달·레벨 올리기. 규칙·검증·배포 절차: `docs/26_2차_3차_개편_구현_기록.md`. 아래 "뽑기·파츠 강화 개편(구현 전)"과 "두 안 중 확인" 안내는 끝난 일이다.
- 성공 보급권: 쉬움·보통 1장, 어려움 2장, 같은 단계는 하루 2번 성공까지만(사용자 요청).
- 태블릿 해상도 자동 조절 수리 포함. 검사 92/92, 브라우저 PC 1280·폰 375 통과(격리 서버). 15:32 KST GitHub Actions로 배포 완료(fc20ccda). 다음 배포도 휴대폰에서 "배포해" → deploy/ 브랜치, 또는 배포 PC deploy.ps1(둘 다 check-live 기록 공유).

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

서호초등학교 학생용 브라우저 게임. 실서버 https://seoho-pangpang.seoho-pangpang-server.workers.dev (Cloudflare Workers + D1 `seoho-pangpang-db`, 게임 파일과 API가 한 주소). 자세한 인수인계는 `HANDOFF.md`, 작업 기록은 `game/STATUS.md`(최신이 위).

## 다음 반영 요청 — 뽑기·파츠 강화 개편 (2026-09-23, 구현 전)
- 사용자가 ChatGPT 개편안을 남겨 Claude가 반영하도록 요청했다. 상세 기준: [보급 상자·파츠 성장 개편안](docs/2026-09-23_뽑기_파츠_강화_개편안.md). 먼저 이 문서의 인수인계와 제11절 확인 기준을 읽는다.
- 이번 커밋은 **문서 전달만**이다. 게임 소스·실서버에 이미 적용된 것으로 보고하지 않는다.
- 핵심: 원소 선택·5번째 직접 선택 유지, 1/3/7개 묶음(80/18/2%), 누적 1/3/7/15개 등급, 등급별 파츠 기능, 완성 후 초과분 재활용, 불가능한 같은 원소 3개 조합 정리. 수치는 시험값이며 추가 공격의 세부 수치는 검증해서 확정한다.
- 기존 파츠·레벨·코인·뽑기권·선택 횟수·첫 획득 기능을 보존한다. 배경음악·난이도·스킬 v3·선생님 권한·추석 이용권 이벤트 등 최신 작업을 되돌리지 않는다.
- **Claude 검토 의견(2026-09-23 오후)**: [뽑기·파츠 개편 최종안 초안](docs/23_뽑기_파츠_개편_최종안.md)은 Codex 안의 뼈대는 살리되 1/3/7 묶음·5회 열기·조각·당장의 전설 등급은 빼거나 미루고, 첫 카드 보장·진화 뒤 파츠 기능 수리·첫 파츠 창 자동 열기 등을 먼저 하자고 권한다. 두 안이 다르므로 **구현 전에 사용자에게 어느 안으로 할지 확인한다.**
- 태블릿 후반 렉 조사 중: [진단 메모](docs/24_태블릿_렉_진단_메모.md)(코드 수정 전).
- 아래 작업 순서대로 최신 작업본과 실서버 변경을 확인하고 구현한다. 큰 화면 배치 변경 전 설명, 배포 후 PC 1280/폰 375 실화면 확인·스크린샷, 단일 파일판 재생성, STATUS 맨 위 기록까지가 구현 완료 기준이다.

## 사용자
- 비개발자 선생님. 한국어, 쉬운 말로 결과부터. 결과는 실서버·화면 캡처(PC 1280, 휴대폰 375)로 확인해서 보여 준다.
- 큰 화면 배치 변경은 먼저 설명하고 한다. 그림은 사용자가 Gemini 앱으로 만든다(Claude는 프롬프트 제공, 유료 이미지 API 쓰지 않음).
- 작업이 끝나면 `game/STATUS.md` 맨 위에 기록을 남긴다.

## 저장소
- GitHub `donggen122-create/-`의 **`seoho-game` 브랜치**가 이 프로젝트다(`main` 브랜치는 다른 프로젝트 — 가계부 — 이니 건드리지 않는다).
- **공개(Public) 저장소**다: 비밀값·학생 정보(관리 페이지 캡처 등)를 절대 커밋하지 않는다. `.gitignore`가 `server/.dev.vars`·`game/tools/qa/out/` 등을 막아 두었다.

## 처음 PC에서
1. Git, Node.js(LTS) 설치(없으면 `winget install --id Git.Git -e`, `winget install --id OpenJS.NodeJS.LTS -e`).
2. `git clone -b seoho-game https://github.com/donggen122-create/-.git seoho-game` 뒤 그 폴더에서 `powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\setup.ps1` (서버 도구 설치·로컬 비밀값 파일·로컬 DB 표).
3. `server` 폴더에서 `npx wrangler login` (브라우저에서 사용자가 허용) — 실서버 배포용.

## 작업 순서
- 시작: `git pull` → `powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\check-live.ps1`. "주의"면 다른 PC에서 배포한 것(git pull 다시)인지 Codex 배포인지 확인하고, Codex면 `-Pull`로 받아 먼저 합친다(HANDOFF.md).
- 원본은 `game/`. `dist_web/`은 배포 사본으로 src·assets·admin·index.html은 `game/tools/sync-dist.ps1`이 만든다(git 제외). `dist_web/share/`(Codex와 공유하는 공개 자료)와 `robots.txt`만 원본.
- 로컬 확인: `.claude/launch.json`의 "wrangler"(= `game/tools/dev-server.ps1`, http://localhost:8797). 로컬 테스트 계정 `테스트`/`1234`(없으면 게임 화면에서 가입). 1-3 이상 시험은 테스트 계정이 앞 단계를 성공해 있어야 한다.
- 캡처·밸런스: `game/tools/qa/capture.ps1`(게임), `admin-capture.ps1`(관리 페이지), `sim.ps1`(난이도 자동 조종). 헤드리스 Edge는 스크립트가 정리한다.
- 검사: `node --test "tests/*.test.mjs"`.
- 배포: `powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\deploy.ps1 -Message "what changed"` → 끝나면 `git add -A; git commit; git push origin seoho-game` (`server/.last_deploy_version` 포함).
- 휴대폰·원격 배포(2026-09-23): `seoho-game` 최신 커밋으로 `deploy/YYYYMMDD-HHMM` 브랜치를 올리면(휴대폰 GitHub 웹에서 브랜치 만들기도 가능) GitHub Actions(`.github/workflows/seoho-deploy.yml`)가 검사 → check-live → dist_web 동기화 → wrangler deploy → `server/.last_deploy_version`·share 기록 커밋까지 한다. Codex 배포를 합친 뒤 기록과 다를 때만 `deploy-force/…` 브랜치. 끝나면 배포 브랜치는 지워진다. 저장소 비밀값 `CLOUDFLARE_API_TOKEN`(Workers 편집) 필요(값은 어디에도 쓰지 않는다). 기본 브랜치 main은 다른 프로젝트라 Run workflow 버튼 대신 브랜치를 쓰고, Claude 작업 환경은 태그 올리기가 막혀 있다.
- GitHub 올리기(git push)가 Claude의 명령 창에서 막힐 때: `error: cannot spawn git: Permission denied`가 나면 보호 모드(sandbox) 밖에서, PATH에 `C:\Program Files\Git\cmd;C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\usr\bin`을 붙이고 `$env:GCM_INTERACTIVE='always'`로 push한다. 그래도 가끔 같은 오류가 나면 몇 초 뒤 다시 시도하면 된다(새로 설치된 Git을 백신이 검사하는 중으로 보임). 로그인이 없으면 `git credential-manager github login --browser --no-ui`(브라우저가 GitHub에 로그인돼 있으면 자동 완료). 저장소 설정 `credential.credentialStore=dpapi`.
- 단일 파일판: `game/tools/build-single.ps1` → `dist_single/LUMEN.html`(git 제외).

## 지킬 것
- 비밀값 `ADMIN_KEY`·`ADMIN_ID`·`ADMIN_PW`·`TEACHER_ID`·`TEACHER_PW`는 Cloudflare 비밀값과 각 PC의 `server/.dev.vars`(git 제외)에만 둔다. 값을 문서·커밋·공유 폴더·메모에 절대 쓰지 않는다.
- 실서버에 확인용 임시 계정을 만들면 확인 뒤 반드시 지운다(관리 API `/api/admin/delete`).
- Codex(ChatGPT)도 같은 Worker에 배포한다. 배포 전 check-live, 겹치지 않게. Codex가 Claude 담당 파일(원소 스킬·난이도·관리 페이지 역할 등, HANDOFF.md)을 되돌리지 않았는지 합칠 때 확인.
- 관리 페이지 `/admin/`: 관리자 비밀번호 = 전부, 선생님 계정 비밀번호 = 학생 계정 삭제·진행 초기화·그림 보내기 없음(서버가 403). 이 구분을 없애지 않는다.
- PowerShell 5.1: 한글이 든 `.ps1`은 UTF-8 BOM으로 저장, `&&` 대신 `;`, 네이티브 명령의 `2>&1`은 오류로 바뀌니 주의.
- claude.ai 아티팩트로 게임을 올리지 않는다(서버 통신이 안 됨).
