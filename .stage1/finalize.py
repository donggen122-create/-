import json,os,re,subprocess,hashlib
from pathlib import Path
out=Path('game/tools/qa/out/stage1')
ui=json.loads((out/'ui-browser-results.json').read_text());assert len(ui['results'])==3 and not ui['pageErrors']
assert {r.get('viewport') for r in ui['results'] if 'viewport' in r}=={1280,375}
assert all(r.get('result')=='passed' if 'viewport' in r else r.get('intro_clear')=='passed' for r in ui['results'])
units=(out/'unit-tests.txt').read_text();assert re.search(r'^# pass 64$',units,re.M) and re.search(r'^# fail 0$',units,re.M)
titles=json.loads((out/'live-and-single.json').read_text());assert len(titles)==4 and all(not r.get('error') and not r['pageErrors'] and r['status']==200 for r in titles)
assert not json.loads((out/'deployment.json').read_text())['deployed']
before=json.loads((out/'before-browser-results.json').read_text());after=json.loads((out/'after-browser-results.json').read_text());assert not before['pageErrors'] and not after['pageErrors']
b=before['results'][0];a=after['results'][0]
source=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()
run=os.environ['GITHUB_RUN_ID'];url=f'https://github.com/donggen122-create/-/actions/runs/{run}'
sha=hashlib.sha256(Path('dist_single/LUMEN.html').read_bytes()).hexdigest()
notice='''## 2026-09-23. 1차 개선 구현·검증 완료 / 실서버 배포 대기
- 첫 스킬 선택에 장착 파츠 스킬 보장, 진화 뒤 파츠 5종 복구, 실제 발동·쉬었던 파츠 결과 안내, 첫 보상 선택 창·다음 할 일·특급 선택 보호를 구현했다. 스킬 선택창 위로 전투 아이콘이 겹치던 표시도 정리했다.
- 오래된 도전 30분 정리, 옛 E3/V3/W3 파츠 복구·초과분 뽑기권·강화 코인 환급, 원본 보관·반복 처리·저장 충돌 보호를 구현했다. 학생의 운영 기록은 아직 변경하지 않았다.
- 태블릿 대응: 반복 화면 쓰기·그라데이션 생성을 줄이고 화면 밖 그리기 생략, 고주사율 시간 계산 수리, 밀린 계산 제한, 느린 기기의 그림 해상도 단계 조절. 실제 태블릿에서 끊김이 완전히 해결됐다는 뜻은 아니다.
- 자동 검사 64/64, 실제 Chromium PC 1280·휴대폰 375의 가입·첫 보상·재접속·뽑기·첫 카드·전투 결과 및 최초 성공 후 안내 흐름을 모두 확인했다. 검증용 서버는 실제 Worker 처리 코드와 메모리 DB를 연결한 별도 환경이며 실서비스 플레이 검증과 구분한다.
- dist_web 동기화, 단일 파일 LUMEN.html 재생성 및 PC/폰 열기, Cloudflare 배포 묶음 검사(dry-run)를 마쳤다. 현재 실서버 시작 화면도 두 크기에서 200·스크립트 오류 없음으로 확인했다. 수정본의 실서버 배포 후 검증은 아직 아니다.
- 실서버 배포는 하지 않았다. GitHub 실행 환경에 Cloudflare 배포 연결 정보가 없어 기존 배포 PC에서 check-live 후 deploy.ps1로 반영해야 한다. server/.last_deploy_version은 바꾸지 않았다.
- 의견이 갈린 묶음 확률·전설·조각과 2차 보급 경제, 레벨 피해 수치는 변경하지 않았다. 배경음·스킬 v3·난이도·교사 권한·추석 이벤트를 유지했다.
- 자세한 완료 범위·검증 결과·다음 배포 절차: docs/25_1차_개선_검증_기록.md. 이 기록이 아래 중간 점검의 63개·검증 중 상태보다 최신이다.
'''
for name in ['game/STATUS.md','HANDOFF.md','CLAUDE.md']:
 p=Path(name);raw=p.read_bytes();head,rest=raw.split(b'\n',1)
 assert '1차 개선 구현·검증 완료 / 실서버 배포 대기'.encode() not in raw
 p.write_bytes(head+b'\n\n'+notice.encode()+b'\n'+rest)
doc=f'''# 1차 개선 구현·검증 결과와 배포 인수인계

작성: 2026-09-23. 상태: **코드 구현·분리 환경 검증 완료, 실서버 배포 대기**.
시작 기준: seoho-game 53046ee85246f909b60d0bd8bf944ccf281cd973.
검증한 실제 코드: `{source}`. 이후 완료 기록 커밋은 문서·검사 설정만 바꾼다.
검사 실행: {url}

## 구현된 변화

| 범위 | 실제 변경 |
|---|---|
| 첫 카드 | 장착한 파츠의 스킬을 첫 선택에 최소 1장 보장, 다시 고르기·낮은 체력 포함. 파츠가 없으면 기존 난수 흐름 유지 |
| 진화 뒤 기능 | F1 용암 6초, F2 폭발 범위 +15%, W1 12번 튕김, E1 바위당 첫 명중에서 작은 돌 2개, L1 다른 적에게 30% 추가 번개. 무한 재분열·연쇄 차단 |
| 보상 안내 | 첫 무료 파츠 안내 한 번, 나중에 버튼, 우선순위 다음 할 일 1장, 뽑기권 표시, 특급 완료 파츠의 무료·5번째 선택을 화면과 서버에서 차단 |
| 전투 결과 | 실제 기능 발동 횟수와 고르지 않아 쉬었던 파츠 설명. 판 시작 때 서버가 보관한 장착 목록으로 사용 통계 누적 |
| 기존 기록 | E3/V3/W3를 E2/V2/W2로 복구, 초과 1개당 뽑기권 1장, 옛 강화비 전액 환급. 원본 스냅샷·동시 지급 보호·중복 복구 방지, 저장 버전 2 유지 |
| 오래된 도전 | 30분 넘은 진행 중 도전을 로비·출동 시 무보상·무차감 정리, 5분 판은 유지 |
| 화면·성능 | 반복 HUD 쓰기 제거, 빛·비네트 재사용, 화면 밖 렌더 생략, 표시 숫자 상한, 고주사율 시간 계산 수리, 누적 계산 상한·해상도 단계 조절. 선택창과 전투 아이콘 겹침 제거 |
| 단일 파일 | runtime-performance 포함, 기존 재내보내기 누락 수리. 인터넷·서버 계정 필수는 유지 |

## 바꾸지 않은 것
뽑기 수량·확률, 코인 가격·파츠 레벨당 +2%, 전설, 재활용 조각, 친구 뽑기 경제, 실패 보급 상한, 일일 이용권·추석 이벤트, 배경음·원거리 프레임·원소 v3·난이도·선생님 권한. 서로 다른 2차 제안은 확인 후 진행한다. 첫 획득 기능을 상위 등급 뒤로 옮기지 않았다.

## 확인한 증거와 한계
- Node 검사 **64/64 통과**. 10,000 난수 시드, 첫 카드·재선택·낮은 체력, 옛 기록·초과분 환급, 반복 정산, 동시 선생님 지급, 30분 경계, 진화 기능과 생성 수 상한을 포함한다.
- 실제 Chromium PC 1280×850와 휴대폰 375×812에서 계정 생성 → 무료 파츠 선택 → 재접속 → 5번째 뽑기 → 첫 스킬 선택 → 전투·결과 흐름 통과. 별도 신규 계정으로 첫 단계 성공 후 안내가 한 번만 뜨는 것도 확인. `ui-browser-results.json` 3개 결과와 오류 0을 확인했다.
- 브라우저의 검증용 서버는 실제 Worker 처리 함수와 메모리 SQLite를 쓴 **격리 환경**이다. 운영 D1이나 실제 학생 계정으로 플레이한 것은 아니다. 화면 폭 검사이지 실제 휴대폰·태블릿 기기 측정은 아니다.
- 실제 운영 주소의 시작 화면은 PC·휴대폰 모두 HTTP 200, 스크립트 오류 0. 이 화면은 **배포 전 운영본**이며 새 파츠 기능이 운영에 반영됐다는 증거가 아니다.
- 단일 파일 시작 화면 PC·휴대폰 모두 스크립트 오류 0. LUMEN SHA-256: `{sha}`. 단일 파일에서 서버가 아직 지원하지 않는 새 정산·복구 기능까지 완료된 것으로 해석하지 않는다.
- `npx wrangler deploy --dry-run` 성공. **배포는 하지 않았다.** GitHub 환경에서 배포 토큰/계정 ID 존재 여부만 확인했고 값은 읽거나 기록하지 않았다. 등록된 연결 정보가 없었다. 실제 학생 데이터에 변경 없음.

## 성능 비교: 한 번의 인공 부하 측정
같은 실행기에서 1180×820·CPU 4배 느리게·4종 진화 스킬, 24초 대기 후 약 6초 측정. 실제 태블릿이 아니고 무작위 적 배치/처치 수·진행 시간도 완전히 같지 않으므로 성능 개선율의 확정 근거로 쓰지 않는다.

| 항목 | 수정 전 | 수정 후 |
|---|---:|---:|
| 화면 갱신/초 | {b['fps']:.2f} | {a['fps']:.2f} |
| 화면 1회 평균 ms | {b['meanMs']:.2f} | {a['meanMs']:.2f} |
| 표시 해상도 배율 | {b['canvasRatio']} | {a['canvasRatio']} |
| 측정 중 그라데이션 생성 | {b['calls']['createRadialGradient']} | {a['calls']['createRadialGradient']} |
| 측정 중 HUD 변경 | {b['hudMutations']} | {a['hudMutations']} |

반복 표시 작업이 줄어든 것은 확인했지만 실제 태블릿의 후반 끊김이 완전히 해결됐다고 판단하지 않는다. 교실 실기기 비교가 남아 있다.

## 배포 담당자의 다음 절차
1. seoho-game 최신 내용을 받는다. 이 브랜치가 아닌 main(가계부)은 건드리지 않는다.
2. `game/tools/check-live.ps1`로 다른 AI의 최근 배포를 확인한다. 다른 배포가 있으면 먼저 합친다. 이 세션은 실서버 버전 ID를 변경하지 않았다.
3. 운영의 옛 파츠 현황을 다시 확인하고 학생 개인정보를 공개 기록에 넣지 않는다. 옛 파츠 복구가 프로필 조회 시 실행되므로 배포 전에 백업/스냅샷 경로를 확인한다.
4. Node 검사 → 기존 `game/tools/deploy.ps1`(동기화·wrangler 배포) → 배포 버전 기록. Cloudflare 토큰은 채팅·문서에 붙이지 않는다.
5. 운영 테스트 계정으로 PC/폰에서 새 안내·뽑기·결과·재접속을 확인한다. 임시 계정은 삭제한다. 운영 캡처와 배포 ID를 STATUS 맨 위에 추가한다.
6. 새 코드가 들어간 단일 파일을 배포 뒤 다시 만들고 전달한다. 이 작업의 파일은 서버 미배포 상태를 명시한 검증판이다.

## 검사 과정에서 수정한 검사 자체의 문제
초기 실행은 Python 실패가 파이프 뒤의 tee 성공으로 가려져 성공처럼 보였다. bash pipefail·명시적인 JSON 결과 개수 확인·실패 종료를 추가하고 전체 재실행했다. 움직이는 시작 버튼은 표시/활성 확인 뒤 실제 포인터 클릭으로 검사했고, 완료 파츠 option은 상위 select가 아니라 option.disabled 속성을 직접 확인했다. 통과 판정은 위 최종 실행과 결과 파일을 기준으로 한다.

## 자료
스크린샷·검사 로그·성능 JSON·단일 파일은 위 실행의 seoho-stage1 결과 묶음에 있다(보관 5일). 대화에도 PNG와 LUMEN.html을 전달한다. 공개 저장소에는 실학생 개인정보·비밀값·독립 글꼴 파일을 새로 올리지 않았다. 이번 신규 검사 도구의 /_qa 경로는 루프백 검사용 서버에만 있고 운영 Worker에는 없다.
'''
Path('docs/25_1차_개선_검증_기록.md').write_text(doc)
Path('.github/workflows/seoho-verification.yml').write_text('''name: Seoho regression checks
on:
  push:
    branches: [seoho-game]
    paths: ['game/src/**', 'server/src/**', 'tests/**', '.github/workflows/seoho-verification.yml']
  pull_request:
    branches: [seoho-game]
permissions:
  contents: read
jobs:
  regression:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: node --check game/src/main.js && node --check game/src/rework-ui.js
      - run: node --test tests/*.test.mjs
''')
print('Final records saved only after all evidence assertions passed; production remains undeployed.')
