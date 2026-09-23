# 서호팡팡수호대 — Claude 작업 안내 (모든 PC 공통)

서호초등학교 학생용 브라우저 게임. 실서버 https://seoho-pangpang.seoho-pangpang-server.workers.dev (Cloudflare Workers + D1 `seoho-pangpang-db`, 게임 파일과 API가 한 주소). 자세한 인수인계는 `HANDOFF.md`, 작업 기록은 `game/STATUS.md`(최신이 위).

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
- GitHub 올리기(git push)가 Claude의 명령 창에서 막힐 때: `error: cannot spawn git: Permission denied`가 나면 보호 모드(sandbox) 밖에서, PATH에 `C:\Program Files\Git\cmd;C:\Program Files\Git\mingw64\bin;C:\Program Files\Git\usr\bin`을 붙이고 `$env:GCM_INTERACTIVE='always'`로 push한다. 그래도 가끔 같은 오류가 나면 몇 초 뒤 다시 시도하면 된다(새로 설치된 Git을 백신이 검사하는 중으로 보임). 로그인이 없으면 `git credential-manager github login --browser --no-ui`(브라우저가 GitHub에 로그인돼 있으면 자동 완료). 저장소 설정 `credential.credentialStore=dpapi`.
- 단일 파일판: `game/tools/build-single.ps1` → `dist_single/LUMEN.html`(git 제외).

## 지킬 것
- 비밀값 `ADMIN_KEY`·`ADMIN_ID`·`ADMIN_PW`·`TEACHER_ID`·`TEACHER_PW`는 Cloudflare 비밀값과 각 PC의 `server/.dev.vars`(git 제외)에만 둔다. 값을 문서·커밋·공유 폴더·메모에 절대 쓰지 않는다.
- 실서버에 확인용 임시 계정을 만들면 확인 뒤 반드시 지운다(관리 API `/api/admin/delete`).
- Codex(ChatGPT)도 같은 Worker에 배포한다. 배포 전 check-live, 겹치지 않게. Codex가 Claude 담당 파일(원소 스킬·난이도·관리 페이지 역할 등, HANDOFF.md)을 되돌리지 않았는지 합칠 때 확인.
- 관리 페이지 `/admin/`: 관리자 비밀번호 = 전부, 선생님 계정 비밀번호 = 학생 계정 삭제·진행 초기화·그림 보내기 없음(서버가 403). 이 구분을 없애지 않는다.
- PowerShell 5.1: 한글이 든 `.ps1`은 UTF-8 BOM으로 저장, `&&` 대신 `;`, 네이티브 명령의 `2>&1`은 오류로 바뀌니 주의.
- claude.ai 아티팩트로 게임을 올리지 않는다(서버 통신이 안 됨).
