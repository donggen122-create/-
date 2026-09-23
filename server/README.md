# 서호팡팡수호대 서버 (Cloudflare Workers + D1)

게임 본체(`dist_web/`)와 계정·저장 API를 한 Worker로 배포한다. 비용: 무료 요금제(하루 요청 10만, D1 5GB)로 100명 규모 충분.

**현재 배포 주소 (2026-09-22 첫 배포)**: https://seoho-pangpang.seoho-pangpang-server.workers.dev
D1: `seoho-pangpang-db` (APAC, id는 wrangler.toml). 계정: Cloudflare 대시보드 로그인 계정(wrangler login 완료된 PC에서만 배포 가능).

## 구성
- `src/index.js` — `/api/*` 처리(가입·로그인·저장 내려받기/올리기), 그 외 경로는 `dist_web` 정적 파일
- `schema.sql` — D1 테이블(users / sessions / saves / attempts)
- `wrangler.toml` — 배포 설정. `database_id`는 처음 한 번 채워야 한다

## API
| 메서드·경로 | 본문 | 응답 |
|---|---|---|
| GET `/api/health` | – | `{ok:true}` |
| POST `/api/register` | `{id, pw}` | `{token, id, hasSave:false}` |
| POST `/api/login` | `{id, pw}` | `{token, id, hasSave, updatedAt}` |
| GET `/api/me` | (Bearer 토큰) | `{id}` |
| GET `/api/save` | (Bearer) | `{save, updatedAt, device}` |
| PUT `/api/save` | `{save, device}` | `{ok, updatedAt}` |
| POST `/api/logout` | (Bearer) | `{ok}` |

규칙: 아이디 2~12자(한글·영어·숫자·_), 비번 4자 이상. 비번은 PBKDF2-SHA256(12,000회, 사용자별 소금)으로만 저장. 세션 60일.
시도 제한(교실이 공인 IP 하나를 함께 쓰는 점을 고려): IP당 로그인 시도 300회/10분, 가입 100회/시간(안전밸브). 같은 아이디 비밀번호 연속 실패 10회 → 15분 잠금(성공 시 즉시 해제). 값은 `src/index.js`의 `RATE`.

## 처음 배포 (한 번)
PowerShell에서 `server/` 폴더로 이동한 뒤:
```
npx wrangler login                       # 브라우저가 열리면 Cloudflare 계정으로 허용
npx wrangler d1 create seoho-pangpang-db # 출력된 database_id를 wrangler.toml에 붙여 넣기
npx wrangler d1 execute seoho-pangpang-db --remote --file=schema.sql
npx wrangler deploy                      # 주소: https://seoho-pangpang.<계정>.workers.dev
```

## 게임을 고친 뒤 다시 배포
```
Copy-Item ..\game\src\*.js ..\dist_web\src\ -Force; Copy-Item ..\game\index.html ..\dist_web\ -Force
npx wrangler deploy
```

## 로컬 테스트(계정 없이)
```
npx wrangler d1 execute seoho-pangpang-db --local --file=schema.sql
npx wrangler dev --port 8797             # http://localhost:8797 에서 게임+API 동작
```
주의: 로컬 D1은 `wrangler.toml`의 `database_id`별로 따로 생긴다. id를 바꾸면(처음 실제 DB를 만들 때 등) 로컬 DB가 비어 `no such table` 500이 나므로 위 첫 줄을 다시 실행한다. 실서버와는 무관.

## 선생님 관리 페이지 (2026-09-22)
- 주소: `https://seoho-pangpang.seoho-pangpang-server.workers.dev/admin/` (원본 `game/admin/index.html` → `dist_web/admin/`). 관리자 열쇠를 입력해야 열리며 열쇠는 브라우저 창을 닫으면 지워진다.
- 열쇠는 Cloudflare 비밀값 `ADMIN_KEY`. 바꾸기: `server/`에서 `npx wrangler secret put ADMIN_KEY`(입력 요청이 뜨면 새 열쇠 입력). 로컬 개발은 `server/.dev.vars`의 `ADMIN_KEY=...`(이 파일은 공유·배포하지 말 것).
- 기능: 통계(계정·플레이한 학생·오늘 접속·판 수·성공·잠긴 계정·선물 대기), 아이디별 비밀번호 재설정 / 잠금·해제 / 선물(금화·별가루·에너지) / 진행 초기화 / 계정 삭제, 전체 선물.
- 선물은 `grants` 표에 쌓였다가 학생이 `GET /api/save`(접속 직후 저장본 내려받기)를 할 때 합쳐지고 `applied_at`이 찍힌다. 플레이 중인 학생은 게임을 다시 열어야 받는다.
- 잠긴 계정(`users.locked=1`)은 로그인 403, 기존 세션은 삭제되어 게임이 처음 화면으로 돌아간다.
- DB 변경 이력: `migrations/2026-09-22_admin.sql`(users.locked, grants). 새 DB는 `schema.sql`만으로 충분.

### 관리 API (`X-Admin-Key` 헤더 필요)
| 메서드·경로 | 본문 | 응답 |
|---|---|---|
| GET `/api/admin/stats` | – | `{users:[{id, display_id, created_at, last_login, locked, saved_at, runs, clears, acc_level, hero, gold, dust, energy, best_stage, stages_cleared, pending_grants, sessions}], now}` |
| POST `/api/admin/reset-password` | `{id, pw}` | `{ok}` (세션 삭제) |
| POST `/api/admin/lock` | `{id, locked}` | `{ok, locked}` |
| POST `/api/admin/grant` | `{id}` 또는 `{ids:[]}` 또는 `{all:true}` + `{gold, dust, energy, note}` | `{ok, count}` |
| POST `/api/admin/reset-save` | `{id}` | `{ok}` (저장·선물·세션 삭제) |
| POST `/api/admin/delete` | `{id}` | `{ok}` |
열쇠 틀림 20회/15분(IP)이면 잠깐 잠금.

## 운영 메모
- 학생이 비번을 잊으면: 관리 페이지에서 「비번」(위). 콘솔로도 가능: `npx wrangler d1 execute seoho-pangpang-db --remote --command "..."`.
- 전체 계정 수: `--command "SELECT COUNT(*) FROM users"`.

## 접속 신호 · 관리자 로그인 · Codex Guardian v1 (2026-09-22 저녁 추가)
- **접속 신호**: 서버가 `/` 응답(index.html)에 `<script src="/presence.js?v=1" defer>`를 붙인다(`injectPresence`, `wrangler.toml`의 `run_worker_first = ["/"]` 필요). 로그인·가입 응답이 쿠키 `sp_hb`(세션 토큰, HttpOnly, `Path=/api/presence`)와 `sp_in=1`을 주고, 스크립트는 30초마다 `POST /api/presence`(204), 화면을 숨기거나 닫으면 `POST /api/presence?bye=1`. 표 `presence(user_id, since, last_seen, device)` — `migrations/2026-09-22_presence.sql`.
- **관리자 API 인증**: `POST /api/admin/login {id, pw}` → 비밀값 `ADMIN_ID`·`ADMIN_PW`와 맞으면 `{token, expiresAt}`(12시간, `만료ms.HMAC(ADMIN_KEY)`). 이후 `X-Admin-Token: <token>` 또는 `X-Admin-Key: <ADMIN_KEY>`. `GET /api/admin/online` → `{online:[{id,display_id,since,last_seen,device}], recent:[...], gap:120000}`. `GET /api/admin/stats` 각 줄에 `last_seen`·`passes`.
- **Codex Guardian v1(2026-09-22)**: `src/guardian.js`(`/api/guardian`, `/api/guardian/*`, `/api/play/*`, 관리자 `passes`·`grant-passes`·`migrate-v1`; 표 guardian_profiles·play_days·play_runs·guardian_operations·play_admin_grants는 첫 호출 때 생성), `src/legacy-migration.js`. `GET /api/save`는 읽기 전용(`archived:true`), `PUT /api/save`·`POST /api/admin/grant`는 410. guardian.js는 `../../game/src/rework-core.js`를 import하므로 game/src 없이 배포할 수 없다.
- **비밀값 넣기**: `npx wrangler secret bulk secrets.json` (`{"ADMIN_KEY":"...","ADMIN_ID":"...","ADMIN_PW":"..."}`, UTF-8·BOM 없음, 넣은 뒤 파일을 비운다). `secret put`에 파이프로 넣으면 줄바꿈이 붙어 틀린 값이 된다. 로컬은 `.dev.vars`.
## 선생님 계정(관리 페이지 역할) · GitHub 작업 (2026-09-23)
- **역할**: `/admin/` 로그인 한 곳에서 비밀번호로 구분한다. 비밀값 `ADMIN_ID`·`ADMIN_PW` = 관리자(전부), `TEACHER_ID`·`TEACHER_PW` = 선생님 계정(아이디가 관리자와 같아도 됨). 로그인 응답 `{token, expiresAt, role:"owner"|"teacher"}`, `GET /api/admin/me` → `{role}`.
- **선생님 계정이 못 하는 것**(서버가 403): `delete`(학생 계정 삭제), `reset-save`(진행 초기화), `upload/*`(그림 보내기), `migrate-*`, `config`, `as-teacher`. 나머지(stats·online·passes·grant-passes·reset-password·lock)는 된다. 선생님 지급은 기록 메모 앞에 `[선생님]`.
- **토큰**: 관리자 `만료ms.HMAC(ADMIN_KEY)`(예전 그대로), 선생님 `t만료ms.HMAC(ADMIN_KEY+TEACHER_ID+TEACHER_PW)` → 선생님 비밀번호를 바꾸면 기존 선생님 로그인은 풀린다. 선생님 비밀번호를 10번 틀리면(모든 기기 합산) 15분 동안 선생님 로그인만 막힌다.
- **관리자 전용**: `GET /api/admin/config` → `{teacher:{configured, sameIdAsAdmin}}`, `POST /api/admin/as-teacher` → 선생님 토큰(관리 화면의 "선생님 화면 미리보기").
- **비밀값 넣기**: 위와 같이 `npx wrangler secret bulk <json>`으로 `{"TEACHER_ID":"...","TEACHER_PW":"..."}`(값은 문서에 적지 않음). 넣으면 새 버전이 생기므로 `server/.last_deploy_version`에 그 버전을 기록한다.
- **배포**: 이제 `game/tools/deploy.ps1 -Message "..."`(검사 → 마지막 배포 확인 → `game/`→`dist_web` 동기화 → 배포 → 버전 기록). 로컬 서버는 `game/tools/dev-server.ps1`. 새 PC 준비는 `game/tools/setup.ps1`.