"""Generate the Korean D report from measured artifacts, never from estimated byte claims."""
import json, re
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'docs/codex/measurements/D'
def read(name): return json.loads((OUT/name).read_text(encoding='utf-8-sig'))
before=read('inventory-D-before.json'); after=read('inventory-D-after.json'); convert=read('convert.json')
image=lambda inv:sum(v['bytes'] for k,v in inv['formats'].items() if k in ['.png','.jpg','.jpeg','.webp','.svg'])
old,new=image(before),image(after)
loads={label:read(f'loading-{label}.json') for label in ['D-before','D-after','D-before-chapter4','D-after-chapter4']}
for data in loads.values():
    assert set(data)=={'pc','phone','ipad'}
    assert all(not record['errors'] and not record['failures'] for record in data.values()),'loading failures'
for name in ['responsive1','responsive2']:
    data=read(name+'/report.json')
    assert len(data)==7 and not any(r.get('_error') or r.get('_pageErrors') for r in data.values()),name
    assert not any(v for r in data.values() for section in r.values() if isinstance(section,dict) for v in section.values() if isinstance(v,list)),name+' issues'
first=max(loads['D-after'][dev]['battle']['bytes']/loads['D-before'][dev]['battle']['bytes'] for dev in ['pc','phone','ipad'])
rows=convert['files']; replaced=[r for r in rows if r['status']=='converted']
lossless=[r for r in replaced if r['lossless']]; lossy=[r for r in replaced if not r['lossless']]
replay=read('replay/D-replay-replay.json')
node=(OUT/'node-tests.txt').read_text(encoding='utf-8-sig')
count=lambda name:int(re.search(r'^# '+name+r' (\d+)',node,re.M)[1])
tests,passed,failed=count('tests'),count('pass'),count('fail')
build=read('build.json'); chapter=read('chapter-loading.json')
complete=new<=old*.5 and first<=.6 and failed==0 and len(replay)==16 and all(r['equal'] for r in replay)
reason=[]
if new>old*.5:reason.append('전체 그림 50% 이하 목표 미달')
if first>.6:reason.append('첫 출동 40% 감소 목표 미달')
if failed:reason.append(f'소유 범위 밖 PNG 고정 검사 {failed}건 실패')
status='DONE' if complete else 'INCOMPLETE: '+'; '.join(reason)
reductions=[100*(1-loads['D-after'][d]['battle']['bytes']/loads['D-before'][d]['battle']['bytes']) for d in ['pc','phone','ipad']]
first_text=f'{min(reductions):.2f}~{max(reductions):.2f}' if max(reductions)-min(reductions)>.01 else f'{min(reductions):.2f}'
lines=[f'선생님: 전체 그림 {old:,}B → {new:,}B, {100*(1-new/old):.2f}% 감소했습니다. 1장 첫 출동은 PC·폰·iPad급에서 {first_text}% 감소했습니다.  ',
       f'변환 {len(replaced)}개, 유지·제외 {len(rows)-len(replaced)}개. 재생 {sum(r["equal"] for r in replay)}/16, 장별 그림 검사 4/4, UI 1·2 각각 7크기 문제 0.  ',
       f'{status}. 이 브랜치에만 커밋했으며 push·배포·운영 D1 접속은 없습니다.','',
       '## ① 같은 조건의 전/후 바이트','',
       '전체 그림은 `game/assets`의 PNG/JPG/WebP/SVG 합계이며, 오디오·글꼴·JSON을 제외합니다. 참조 없는 그림 6개도 전체에 포함했고 원본을 보존했습니다. 전체 파일별 재고·실제 코드 참조(동적 식은 파일 목록으로 보수적으로 확장)는 [전](measurements/D/inventory-D-before.json), [후](measurements/D/inventory-D-after.json)에 있습니다.','',
       '| 형식 | 전 파일 수 | 전 바이트 | 후 파일 수 | 후 바이트 |','|---|---:|---:|---:|---:|']
for ext in sorted(set(before['formats'])|set(after['formats'])):
    a=before['formats'].get(ext,{'files':0,'bytes':0}); b=after['formats'].get(ext,{'files':0,'bytes':0})
    lines.append(f'| {ext} | {a["files"]} | {a["bytes"]:,} | {b["files"]} | {b["bytes"]:,} |')
lines += ['',f'그림 목표 ≤ {old//2:,}B / 실제 {new:,}B. 총 assets(소리·글꼴 등 포함) {sum(v["bytes"] for v in before["formats"].values()):,}B → {sum(v["bytes"] for v in after["formats"].values()):,}B.','',
          '| 기기 | 단계 | 전 B | 후 B | 감소율 |','|---|---|---:|---:|---:|']
for dev in ['pc','phone','ipad']:
    for phase,label,ch4 in [('시작','title',False),('로비(1장 프로필)','lobby',False),('첫 출동 1장 CH01','battle',False),('첫 출동 4장 CH16','battle',True),('재접속(1장 프로필)','reload',False),('로비(4장 프로필)','lobby',True),('재접속(4장 프로필)','reload',True)]:
        suffix='-chapter4' if ch4 else ''; a=loads['D-before'+suffix][dev][label]['bytes']; b=loads['D-after'+suffix][dev][label]['bytes']
        lines.append(f'| {dev} | {phase} | {a:,} | {b:,} | {100*(1-b/a):.2f}% |')
lines += ['', '시작은 로그인 전, 로비·출동은 해당 단계의 추가 전송량, 재접속은 같은 브라우저 캐시를 유지한 새로고침입니다. CDP encodedDataLength(헤더 포함)를 집계했으며, 실제 Cloudflare 압축·네트워크 성능을 뜻하지 않습니다. PC 1280×720, 폰 375×667, iPad급 1024×768(CPU ×4), DPR 1, Chromium, 같은 카드 난수 시드 10808, qa 계정 `qaload`, 로컬 8797만 사용했습니다. 4장은 별도 cold context에서 동일한 전체 해금 프로필을 매번 먼저 주입했습니다. 시간은 참고만 하고 바이트를 비교합니다.','',
          '지시된 원본 loading-audit 명령도 수정 전에 실행했습니다. [최초 결과](measurements/D/loading-D-before-initial.json)는 시작 3,340,303B로 B와 완전히 같고, 재접속 73,452~73,462B로 B의 73,457B와 5B 이내입니다. 최종 전/후 표는 카드 선택에 따른 다운로드 변동을 없앤 D 실행기의 동일 시드·프로필 조건입니다. 원본 QA 코드는 수정하지 않았습니다.','',
          '## ② 변환 규칙·파일 수·차이','',
          f'- 최종 무손실 WebP {len(lossless)}개, 손실 WebP {len(lossy)}개. 원본 유지 {sum(r["status"]=="retained" for r in rows)}개(20% 절감 미달 53개, Chromium 합성 차이 249개, 소유 범위 밖 기존 PNG 계약 보존 6개). 참조 없음/보호 범위 제외 {sum(r["status"]=="excluded" for r in rows)}개.',
          '- Pillow 12, `method=6`. 투명 스프라이트·UI는 `lossless=True, quality=100, exact=True`로 숨은 RGB까지 보존. 큰 효과·무기·친구 idle·바닥·JPG는 q90 → 최대 RGBA 채널 차 24 초과 시 q95 → 그래도 초과하면 무손실. 저장 크기가 원본의 80% 이하여야 교체. 알파와 치수는 전부 일치.',
          '- 원본과의 차이는 모든 RGBA 채널(완전 투명 픽셀의 숨은 RGB 포함)로 계산합니다. 각 파일의 최대 차·평균 차·변경 픽셀 비율, q90/q95/무손실 시도별 값·바이트, SHA-256은 [convert.json](measurements/D/convert.json)에 있습니다. 재실행 시 출력 해시가 같으면 그대로 재사용하고 임의 변경은 중단합니다.',
          '- 원본 자르기 로직은 유지하고 11개 cut 도구의 게임 그림 출력만 공통 `cut_webp.save_webp`로 연결했습니다. 이 출력은 무손실 WebP이며 입력 시트·미리보기 형식은 유지합니다. PNG로 유지한 파일은 명시적 IMAGE_FORMAT_EXCEPTIONS로 동적 URL에서도 올바른 원본을 찾습니다.', '',
          '기존 PNG/JPG 경로를 유지한 파일은 자르기 도구 재실행 때 그 원본 사본도 함께 갱신합니다. PNG는 무손실, JPG 사본은 공통 함수에서 quality=100으로 저장하고, WebP 출력은 무손실입니다. 예외 경로가 오래된 그림을 계속 표시하지 않도록 한 조치입니다. [공통 출력 검사](measurements/D/cutter-check.json), [멱등 검사](measurements/D/idempotence.json).','',
          '| 최종 변환 이미지 최대 채널 차 | 파일 수 |','|---|---:|']
for low,high,label in [(0,0,'0'),(1,10,'1~10'),(11,24,'11~24'),(25,255,'25 이상')]:lines.append(f'| {label} | {sum(low<=r["maxChannelDelta"]<=high for r in replaced)} |')
lines += ['',f'최종 변환 파일의 최대 차 {max(r["maxChannelDelta"] for r in replaced)}, 평균 채널 차 최대 {max(r["meanChannelDelta"] for r in replaced):.6f}, 변경 픽셀 비율 최대 {max(r["changedPixelRatio"] for r in replaced):.8f}. 손실 후보가 경계를 넘거나 재생 화면을 바꾸면 화질을 희생해 목표를 맞추지 않았습니다.','',
          '원본 복원(Windows에서는 cmd의 바이너리 리다이렉션 사용; 삭제된 PNG가 있던 마지막 커밋):','',
          '```powershell\ncmd /d /c "git show 3140c76:game/assets/sprites/t1/floor_dirt.png > game/assets/sprites/t1/floor_dirt.png"\n```','',
          'Chromium 실제 스크린샷 6종 확대 비교(동일 위치 2.5배 이상, 체크 배경, PNG 화면은 256색으로 저장; 정량 차이는 축소·팔레트화 이전의 원본 RGBA로 계산):','']
for item in read('previews.json'):lines.append(f'- [{item["kind"]}]({item["preview"].removeprefix("docs/codex/")}) — {item["bytes"]:,}B, {item["zoom"]:.2f}배.')
lines += ['', '## ③ 참조 없는 원본 그림 — 삭제·변환하지 않음','', '| 파일 | 바이트 |','|---|---:|']
for row in before['unreferenced']:lines.append(f'| `{row["path"]}` | {row["bytes"]:,} |')
lines += ['',f'합계 {sum(r["bytes"] for r in before["unreferenced"]):,}B. 목록은 코드의 정적 참조와 동적 URL의 기존 파일 확장 결과입니다. 동적 식 때문에 사용 후보를 넓게 잡았으며, 실제 모든 후보가 내려받아진다는 뜻은 아닙니다.','',
          '## ④ 검사 결과','', '| 검사 | 실제 결과 | 근거 |','|---|---|---|',
          f'| 전체 node 검사 | {passed}/{tests} 통과, 실패 {failed} | [TAP](measurements/D/node-tests.txt) |',
          '| D의 참조 존재·PNG/JPG 허용 목록·버전·스탬프·단일 파일 검사 | 통과 | 위 TAP의 D 검사 |',
          f'| 장별 자동 조종 | {len(chapter["chapters"])}/4, 예상 밖 404 {len(chapter["unexpected404"])}, 빈 그림 draw {sum(len(r["missingDraw"]) for r in chapter["chapters"])} | [장별 결과](measurements/D/chapter-loading.json) |',
          f'| 같은 시드 재생 90926db / qad | {sum(r["equal"] for r in replay)}/16, 게임 값 완전 일치 {sum(r["gameplayExact"] for r in replay)}/16 | [최종 결과](measurements/D/replay/D-replay-replay.json) |',
          '| UI 1·2 각 7크기 | 각각 total issues 0, 페이지 오류 0 | [UI 1](measurements/D/responsive1/report.json), [UI 2](measurements/D/responsive2/report.json) |',
          f'| build-single.ps1 | 성공 {build["bytes"]:,}B, WebP MIME·inline 검사 통과 | [빌드](measurements/D/build.json), [file:// 검사](measurements/D/single-smoke.json) |',
          '| 소유 범위 | 통과, main/rework-ui는 그림 경로 문자열만, CSS는 url()만, index는 그림 경로만 | [검증](measurements/D/ownership.json) |',
          '| 로컬 WebP MIME | 200 / image/webp | [응답](measurements/D/webp-mime.json) |','',
          '재생은 기준 커밋의 JS/CSS뿐 아니라 원본 PNG/JPG도 git show로 읽어 Playwright 응답에 사용했습니다(다른 체크아웃·폴더 접근 없음). 현재 파일을 기준 쪽에 재사용하지 않았습니다. 두 원본 커밋의 assets 차이는 없습니다. 이미지 해시가 달라지면 변경 픽셀 ≤ 전체 0.0025%, 최대 채널 차 ≤10인 도구 허용치를 적용했습니다. 최종 이미지 exact/equivalent 수치는 최종 JSON에 있습니다.', '',
          f'최종 PC 캔버스 검사: exact {sum(r["canvasCheck"]["exact"] for r in replay if r["quality"]==0)}/8, equivalent {sum(r["canvasCheck"]["equivalent"] for r in replay if r["quality"]==0)}/8. 처음 손실 변환의 재생 실패와 파일별 무손실 복귀는 [초기 재생](measurements/D/replay/D-replay-first-replay.json), [복귀 대상](measurements/D/lossless-fallback.json)에 기록했습니다. 낮은 화질 8표본은 도구가 이미지 해시를 비교하지 않으며 게임 값을 비교합니다.','',
          f'초기 진단은 {read("lossless-fallback.json")["initialDiagnosticSamples"]}개 표본에서 여러 장의 화면 차이를 확인하고 조기 종료했습니다. 손실 바닥 10개를 모두 무손실로 돌린 뒤 최종 16개 표본을 처음부터 끝까지 별도로 재실행했습니다. 초기의 미실행 표본을 통과로 세지 않았습니다.','',
          '버전은 20261012d1. version-assets는 WebP도 스탬프하며, index의 글꼴 경로는 D 소유 범위 밖이라 보존했습니다. sync-dist와 ci-deploy는 확장자 필터 없이 전체 assets를 복사하므로 수정할 필요가 없습니다(코드 확인; ci-deploy 실행 없음). /assets/* 헤더 규칙은 확장자와 무관해 WebP도 포함합니다. 운영 응답 확인은 하지 않았습니다. 단일 파일에는 교체한 그림의 WebP data URI와 유지한 PNG/JPG·SVG 등이 함께 들어갑니다. 유지 파일을 임의로 다시 변환하지 않았습니다.','',
          '## ⑤ 못 한 것·위험','',
          f'- {status}. 초기 변환은 PNG 고정 검사 3개를 실패했습니다. `tests/theme2.test.mjs:37`, `theme3.test.mjs:50`, `theme4.test.mjs:49`는 수정 허용 목록 밖이라 그대로 보존했습니다. Chromium 합성 차이 때문에 게임 그림을 PNG로 복귀하면서 추가 6개 원본·참조를 보존해 기존 PNG 검사 계약도 만족했습니다. 최종 전체 검사는 {passed}/{tests} 통과입니다. 향후 더 많은 장 그림을 WebP로 전환할 때 쓸 미적용 검사 수정안은 [D-followup-tests.patch](D-followup-tests.patch)에 있습니다.',
          '- 무손실 WebP의 Pillow RGBA는 원본과 완전히 같아도 Chromium 합성 결과는 달랐습니다. [브라우저 픽셀 검사](measurements/D/browser-pixels.json)는 346개를 원래 크기와 96px 축소로 회색 바탕에 그려 비교했고, 325개에서 최대 채널 차 1을 관측했습니다. 합성 내부 구현의 원인까지 확정하지는 않았습니다. 게임 캔버스에 쓰이는 249개는 [PNG 보존 목록](measurements/D/canvas-png-fallback.json)처럼 복귀했습니다. HTML UI에만 쓰이는 그림은 WebP로 유지했습니다. 따라서 6종 확대 비교 중 효과·무기·친구·대왕은 최종 채택되지 않은 무손실 후보도 함께 보여 줍니다.',
          '- 전체 절반·첫 출동 40% 감소를 달성했다고 주장하지 않습니다. 작은 PNG의 무손실 절감 한계, 최대 채널 차와 엄격한 재생 화면 허용치 때문에 손실 후보가 무손실로 복귀했고, 이미 압축된 JPG는 20% 조건을 만족하지 못해 유지했습니다. 참조 없는 큰 효과도 요청대로 보존했습니다. 스프라이트 시트·로딩 규칙·그리기·밸런스 변경은 하지 않았습니다.',
          '- [WebKit Safari 14 공식 발표](https://webkit.org/blog/11340/new-webkit-features-in-safari-14/)와 [Apple Safari 14 릴리스 노트](https://developer.apple.com/documentation/safari-release-notes/safari-14-release-notes)에 WebP 지원 추가가 명시돼 있습니다. 오래된 iOS/iPadOS 13 계열 등은 지원하지 않을 수 있으며 자동 PNG fallback을 제공하지 않습니다. 실제 iOS Safari·학교 기기·손 조작은 미검증입니다.',
          '- QA 서버 원본 MIME 표에 WebP가 없어 docs/codex/D-qa-server.mjs가 메모리에서만 MIME를 확장했습니다. 원본 game/tools/qa 코드는 그대로입니다. 이 서버를 시작할 때 앞서 D가 띄운 8797 PID/실행 파일/시작 시각/명령행을 확인하고 D 서버만 종료했습니다. 8798·8799에는 접근·종료하지 않았습니다.',
          '- 사용자 제공 미추적 작업지시서는 커밋하지 않았습니다. 브랜치 이동·push·배포·운영 API/D1 접근 없음. 최종 로컬 검증 자료는 이 작업트리에 남깁니다.','',status]
dest=ROOT/'docs/codex/2026-10-12_보고_D_그림_다이어트.md'
lines[0]=lines[0].rstrip()+chr(92)
lines[1]=lines[1].rstrip()+chr(92)
dest.write_text('\n'.join(lines)+'\n',encoding='utf-8',newline='\n')
print(status)
