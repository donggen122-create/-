"""Assemble the requested Korean report from committed local QA evidence."""
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
D=ROOT/'docs/codex/measurements/B'
read=lambda n:json.loads((D/n).read_text(encoding='utf-8'))
before=read('loading-before-wire.json');after=read('loading-after.json')
caps=read('cap-study/summary.json')
replay=read('replay-final/B-replay-final-replay.json')
lines=[
f"첫 화면 다운로드를 {max(v['title']['bytes'] for v in before.values())/1e6:.2f}MB에서 {max(v['title']['bytes'] for v in after.values())/1e6:.2f}MB로 줄였고, 다시 접속하면 {max(v['reload']['bytes'] for v in after.values())/1e6:.3f}MB만 받습니다.",
"출동 단추는 화면 7가지에서 스크롤 없이 보이고, 공지는 계정·기기마다 한 번 닫으면 다시 자동으로 뜨지 않습니다.",
"적 수 상한은 꺼 두었습니다. 아래 모의 측정 표를 보고 선생님이 켤지와 숫자를 정하면 됩니다.",
"", "# B 로딩·화면 작업 보고", "", "작업 날짜: 2026-10-11~12. 브랜치 `codex/2026-10-11-B`, 이 worktree만 수정·커밋. push·배포·실서버 및 실제 D1 접속 없음. 격리 서버 `http://localhost:8797`, SQLite 메모리 DB, `qa` 및 `qa` 접두 시험 계정만 사용.",
"", "## ① 같은 조건의 전·후 측정", "",
"변경 전 소스 `037d07b14bc4861838d825cb68df44f42b9d50e9`. 설치된 Chrome, Playwright headless, GPU 비활성화, DPR 1, 캐시 없는 새 문맥. PC 1280×720 / 폰 375×667 / iPad급 1024×768 CPU ×4. 네트워크 속도 제한 없음, localhost. 각 조건 1회 표본이며 실제 태블릿 실측이나 실서버 속도 예측이 아니다.",
"", "MB는 1,000,000바이트. 요청 수는 CDP의 요청 이벤트(메모리 캐시 포함), 바이트는 실제 전송량(encodedDataLength, 아직 다운로드 중인 소리 포함). 로비·첫 출동은 앞 단계에 더해 받은 양. 시간에는 자동화의 network-idle/300ms 안정화 대기가 포함된다. 새로고침은 같은 문맥이다.",
"", "| 기기 | 구간 | 전 요청 | 전 MB | 전 ms | 후 요청 | 후 MB | 후 ms |", "|---|---|---:|---:|---:|---:|---:|---:|"]
for dev,label in [('pc','PC'),('phone','폰'),('ipad','iPad ×4')]:
    for phase,name in [('title','시작 화면'),('lobby','로그인 → 로비'),('battle','로비 → 1-1 첫 프레임'),('reload','두 번째 접속')]:
        a=before[dev][phase];b=after[dev][phase]
        lines.append(f"| {label} | {name} | {a['requests']} | {a['bytes']/1e6:.3f} | {a['ms']:.1f} | {b['requests']} | {b['bytes']/1e6:.3f} | {b['ms']:.1f} |")
lines += ["", "시작 ≤5MB / 두 번째 ≤0.5MB: 세 기기 모두 통과. 출동 클릭부터 첫 그림 준비 및 첫 프레임까지의 구체적인 추가 시간은 위 PC/iPad 행과 JSON의 `battle` 값에 있다. 소리 완료는 출동의 대기 조건에 들어 있지 않다.",
"", "| 시작 화면 폴더 | 전 PC 바이트 / 요청 | 후 PC 바이트 / 요청 |", "|---|---:|---:|"]
for folder in ['src','assets/sprites','assets/elements_v2','assets/ui','assets/ui2','assets/seoho_v1','assets/audio']:
    a=before['pc']['title']['groups'].get(folder,{'bytes':0,'requests':0});b=after['pc']['title']['groups'].get(folder,{'bytes':0,'requests':0})
    lines.append(f"| {folder} | {a['bytes']:,} / {a['requests']} | {b['bytes']:,} / {b['requests']} |")
lines += ["", "전·후의 모든 구간·기기별 폴더 수치는 [before](measurements/B/loading-before-wire.json), [after](measurements/B/loading-after.json)에 보관했다. 초기 완료 요청만 집계했던 [첫 기준 기록](measurements/B/loading-before.json)보다 before-wire가 정확하다. Claude의 21.4MB/250개는 별도 시점·조건이므로 이번 표와 섞지 않았다.",
"", "캐시 수치 해석: 기존 QA 어댑터는 모든 정적 파일을 `no-store`로 보냈다. 후 측정은 `_headers`의 그림·소리 immutable와 Workers 기본 ETag/재검증을 어댑터에서 재현했다. 따라서 큰 재접속 차이 전체를 실서버 개선 효과라고 주장하지 않는다. 코드 1.3MB는 다시 접속할 때 재검증하고, HTML은 기존 Worker 처리 그대로다.",
"", "## ② 바꾼 파일과 방식", "",
"- `assets.js`: `t1_`~`t4_` 목록과 공용 목록. 3장 공용 쓰레기 투사체를 명시 포함. 장·주인공·원소 효과·전투 아이콘·선택 친구를 출동 전에 decode까지 기다린다. 시작 화면에는 전투 그림을 받지 않는다. 선택 전에는 두 주인공 idle만, 선택 후에는 선택한 주인공 프레임만 준비한다. 실패한 그림은 재시도 가능하며 늦게 끝난 이전 작업이 단추를 다시 잠그지 않는다.",
"- `main.js`: 그림·소리 준비, 공지, spawn 부분만 변경. `/play/start` 이전에 그림을 준비해 실패가 이용권/판 시간에 영향을 주지 않게 했다. 공용 효과 모듈 캐시도 준비한다. 친구 전원 즉시 로딩을 없앴다. `sgEnd`·결과·주인공 피해 처리 및 규칙·보상은 수정하지 않았다.",
"- `music.js`: 사용자 동작 전에는 Audio를 만들지 않는다. 첫 pointerdown/keydown의 재생 잠금 해제를 유지한다. SFX도 첫 동작 뒤 백그라운드로 받으며, 잘못된 선택 효과음 이름은 `/undefined`를 요청하지 않는다.",
"- `ui2-art.js`, `rework-ui.js`, `ui-v2.css`: 보이는 아이콘만 받고, 낮은 화면의 지도 그림/큰 장면을 줄인다. 원래 출동 단추가 메뉴 아래에 가려지면 같은 동작·상태의 단추를 메뉴 바로 위에 고정한다. 단계 지도는 위에 유지. UI 1 배치는 그대로. 소식 아이콘으로 공지를 다시 연다. 4장 공지 대체 몬스터 그림은 공지 JPG가 실패할 때만 요청한다.",
"- `index.html`, `rework.css`, `ui-v2.css`, `version-assets.mjs`, `sync-dist.ps1`: 한 곳의 `ASSET_VERSION`으로 정적 주소를 찍는다. 생성된 JS 사본에만 버전을 붙여 A 담당 결과 소스를 건드리지 않는다. `check-live.ps1`의 비교도 이 생성 규칙을 사용한다. live-check 자체는 실서버 금지 때문에 실행하지 않았다. 로컬 원본의 생성 비교 해시와 dist 해시는 일치했다.",
"- `dist_web/_headers`: `/assets/*` 1년 immutable. HTML/JS/CSS 기본 캐시는 유지. git ignore 대상이 아니고 sync 뒤에도 남는다.",
"- `build-single.ps1`: 버전 꼬리표를 제거해 data URI 표를 찾고 모든 그림/소리를 포함. 빌드 성공, file://에서 4장 124개 매니페스트/그림 준비, 외부 그림 요청 0, 페이지 오류 0.",
"- QA 도구·테스트: 폴더별 전송 계측, 출동 가시성, 장별 커버리지, 상한 기본 꺼짐/예외, 버전·캐시·단일 파일판·오류 후 재시도 검사를 추가.",
"", "## ③ 출동 단추 전·후 캡처", "", "모두 원본 PNG를 캡처한 뒤 보고용 128색 PNG로 저장했으며 각 400KB 이하. 게임 에셋의 형식·품질은 바꾸지 않았다.", "", "| 크기 | 전 | 후 |", "|---|---|---|"]
for size in ['1280x720','1280x800','1024x768','820x1180','768x1024','375x667','360x640']:
    lines.append(f"| {size} | [전](preview/B_lobby_{size}_before.png) | [후](preview/B_lobby_{size}_after.png) |")
lines += ["", "UI 1·UI 2 각 7크기에서 모험/훈련/파츠/장비/친구/도감·설명창·카드·전투·멈춤·결과를 검사했다. `total issues 0`, 페이지 오류 0. UI 2 출동 단추의 실제 클릭 가능 영역(메뉴 가림 포함)을 7크기에서 통과했다. [UI 1](measurements/B/responsive-ui1.json), [UI 2](measurements/B/responsive-ui2.json). 반복 QA의 로컬 keep-alive 연결 종료는 idempotent 프로필 설정 재시도로 처리했고, 기존 시험 ID는 로그인으로 재사용한다.",
"", "공지 저장은 이 기기의 localStorage에 계정 ID별로 남는다. 닫기·Esc·바깥 클릭·모험 보기 모두 저장한다. 소식으로 다시 보기, 새로고침 후 자동 재표시 안 됨을 브라우저에서 확인했다. 저장소가 차단되거나 삭제된 기기에서는 다시 표시될 수 있다.",
"", "## ④ 적 수 상한 측정과 제안", "",
"`SLOW_ENEMY_CAP = {enabled:false, cap:100}`. 가장 낮은 두 화질 단계에서만 일반 적 생성을 건너뛰며 대왕·중간 보스/elite·특별한 적·분열 자식은 제외한다. 꺼진 경우 모든 화질에서 160개 생성 동일 검사와 재생 검사를 통과했다.",
"", "iPad급 1180×820 DPR 2 / 안드로이드급 1280×800 DPR 1.5, CPU ×6, CH18(4-3)·CH20(4-5), 같은 시드 10808. 기존 `--stress` 합성 군중 160개, 선택 위협/elite 포함. 모든 행을 가장 낮은 화질로 동일 고정(`--quality 99`), warm 8초 + 측정 15초, 조건당 1회, 별도 성능 브라우저를 순서대로 실행했다. 상한이 켜진 경우 준비 시점부터 적용했다. 보호 대상 때문에 총 적 수는 상한을 넘을 수 있다.",
"", "| 기기 | 단계 | 상한 | 평균 FPS | 하위 1% FPS | 준비 후 적 수 | 표본 끝 적 수 |", "|---|---|---:|---:|---:|---:|---:|"]
for r in caps:
    lines.append(f"| {r['device']} ×6 | {'4-3' if r['stage']=='CH18' else '4-5'} | {r['cap'] or '없음'} | {r['fps']:.1f} | {r['low1']:.1f} | {r['stressEnemies']} | {r['sampleEnemies']} |")
qualifying=[cap for cap in [0,120,100,80] if all(r['low1']>=20 for r in caps if r['cap']==cap)]
lines += ["", "네 조건 모두 하위 1% 20 이상인 설정: "+(', '.join('상한 없음' if c==0 else str(c) for c in qualifying) or '없음')+". 원시 FPS·화질 변화·메모리·오류는 [측정 자료](measurements/B/cap-study/summary.json) 및 같은 폴더의 4개 JSON에 있다.",
"", "측정 제한: B의 성능 브라우저는 순차 실행했지만, 같은 PC에서 다른 headless Chrome·story 검사 프로세스가 CPU를 사용하고 있었다. 읽기 전용 [프로세스 기록](measurements/B/perf-process-snapshot.json)을 남겼으며 다른 세션의 프로세스는 건드리지 않았다. 표는 이 환경에서 관측한 값이고, 상한 변화의 인과 효과나 실제 학생 기기의 FPS를 보장하지 않는다.",
"", "제안: 기본 꺼짐을 유지한다. 이 ×6 합성 표본만으로 학생 기기에 켜지 않는다. 실제 느린 태블릿에서 먼저 확인하고, 표의 20 FPS 통과 값 중 게임 밀도를 가장 덜 줄이는 값부터 선생님이 시험/선택한다. 특정 기기에서 모두 20 미만이면 상한 하나만으로 목표 달성을 주장할 수 없다.",
"", "## ⑤ 실서버 캐시 적용 근거", "",
"Cloudflare 공식 [Workers Static Assets Headers](https://developers.cloudflare.com/workers/static-assets/headers/)는 정적 자산 디렉터리의 `_headers`와 Cache-Control override/immutable를 지원한다고 설명한다. Worker 코드가 직접 만든 응답에는 적용되지 않는다는 제한도 명시한다. 저장소 `server/wrangler.toml`은 `assets.directory='../dist_web'`, `run_worker_first=['/']`로 `/assets/*`는 정적 자산 대상이다. 루트 HTML·API·Worker 업로드 응답에 이 규칙이 적용된다고 주장하지 않는다. 배포 후 실제 응답 헤더 확인은 Claude의 통합/배포 단계에서 해야 한다.",
"", "ASSET_VERSION은 `game/src/assets.js` 한 곳의 `20261011b1`. 그림/소리를 바꾸면 이 값을 올리고 sync/build를 실행한다. HTML/CSS 주소를 자동 동기화하고 JS helper·생성 사본·단일 파일판도 같은 값을 쓴다. `_headers`는 원본으로 git에 올렸고 sync에서 보존됨을 확인했다.",
"", "## ⑥ 검사·남은 위험·다음 단계", "",
"- `node --test \"tests/*.test.mjs\"`: 181/181 통과.",
f"- `tablet-perf.py --mode replay`: 6단계 × 2시드 {sum(r['equal'] for r in replay)}/{len(replay)} 통과. 모든 게임 상태·조작 해시·서버 정산은 완전히 일치. [재생 기록](measurements/B/replay-final/B-replay-final-replay.json).",
"- 최초 엄격 PNG 해시 비교에서 CH05 한 표본의 17픽셀(전체의 0.00185%)에서 파란색 채널 최대 9 차이만 있었고 게임 값은 동일했다. decode/합성 반올림이 원인인지는 확정하지 않았다. 새 도구는 게임 값은 완전 일치, 이미지 차이는 전체 0.0025% 이하·채널 10 이하만 허용하며 모든 숫자를 남긴다. 나머지 11표본은 PNG 해시도 일치했고, 에셋 원본은 변경하지 않았다. 픽셀 단위 완전 동일라고 주장하지 않는다.",
"- 장별 자동 조종 4/4: 그림 준비 누락 0, 예상 밖 404 0, 빈 그림 draw 0. 일부 대왕 판은 제한 시간 실패였으며 클리어 성능/밸런스 검증을 뜻하지 않는다. 의도적인 404 1건으로 실패→재시도 및 판 시작 전 차단도 검사했다. [장별 검사](measurements/B/chapter-loading.json).",
"- 실제 iOS Safari의 소리/손 조작, 실제 학교 태블릿 성능은 미검증. 실서버 캐시·압축·네트워크 시간도 미검증. CPU ×4/×6는 실물 기기와 같다는 뜻이 아니다.",
"- 첫 출동에는 공용 PNG 효과/무기/아이콘을 한 번 받으므로 여전히 크다. 다음에는 아래 큰 파일과 실제 사용 목록을 근거로 WebP 후보를 시각 비교하고 장별 스프라이트 시트를 시험한다. 이번에는 PNG/JPG/오디오를 바꾸지 않았다. 별도 디바이스 측정 후 선택 친구/무기의 세분화 로딩도 고려한다.",
"", "남은 큰 파일 20개(전체 assets, 현재 안 쓰는 원본 효과도 포함):", "", "| 파일 | 바이트 |", "|---|---:|"]
for r in read('largest-20.json'):lines.append(f"| `{r['file']}` | {r['bytes']:,} |")
lines += ["", "작은 커밋은 이 브랜치에만 남겼다. LF 정규화 커밋 1개가 별도로 있으며 최종 기준 diff는 구현 변화만 확인할 수 있다. 사용자 제공 작업지시와 `docs/47`의 기존 미추적 파일은 수정·추가하지 않았다. A 폴더·다른 브랜치·보호 파일 변경 없음.", "", "DONE"]
target=ROOT/'docs/codex/2026-10-11_보고_B_로딩_화면.md'
target.write_bytes(('\n'.join(lines)+'\n').encode('utf-8'))
print(target)
