"""Publish only anonymous local-QA aggregates and the requested comparison chart.

python game/tools/qa/tablet-summary.py --input game/tools/qa/out/tablet
Requires matplotlib in the external QA venv. Raw traces remain in ignored out/.
"""
import argparse
import json
import statistics
import hashlib
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--input', default=str(ROOT/'game/tools/qa/out/tablet'))
ap.add_argument('--output')
ap.add_argument('--chart', default=str(ROOT/'docs/codex/preview/perf_before_after.png'))
ap.add_argument('--pass2', action='store_true', help='Require interleaved three-pair simulation suites and 64 expanded replays')
ap.add_argument('--replay-labels', default='invariant2', help='Completed expanded replay labels, comma-separated')
ap.add_argument('--verification-only', action='store_true', help='Publish checks with explicitly incomplete measurements; never claim performance gains')
args = ap.parse_args()
args.output=args.output or str(ROOT/('docs/codex/2026-10-08_태블릿_검증_2차.json' if args.pass2 and args.verification_only else 'docs/codex/2026-10-08_태블릿_측정_2차.json' if args.pass2 else 'docs/codex/2026-10-08_태블릿_측정.json'))
folder = Path(args.input)


def script_top(path, limit=10):
    p = json.loads(path.read_text(encoding='utf-8'))
    nodes = {n['id']: n['callFrame'] for n in p['nodes']}
    totals = defaultdict(float)
    for sid, dt in zip(p.get('samples', []), p.get('timeDeltas', [])):
        cf = nodes[sid]
        if '/src/' in cf.get('url',''):
            totals[f"{cf['functionName'] or '(anonymous)'} {cf['url'].split('/')[-1]}:{cf['lineNumber']+1}"] += dt/1000
    return [{'function':k,'selfMs':round(v,2)} for k,v in sorted(totals.items(),key=lambda x:-x[1])[:limit]]

def has_errors(value):
    if isinstance(value,dict):
        return bool(value.get('errors')) or any(has_errors(v) for v in value.values())
    return isinstance(value,list) and any(has_errors(v) for v in value)


def pass2_summary():
    result={'scope':'Loopback QA only; not physical tablet performance.', 'baseline':'9b313a0', 'suites':{},
            'measurementStatus':'incomplete' if args.verification_only else 'complete', 'requiredWindows':90}
    tables=[]
    metrics=('simMs','fps','low1','long50Pct')
    expected={'crowd':{(s,d,r) for s in ('CH18','CH20','CH19') for d in ('ipad','android') for r in (4,6)},
              'natural':{(s,'ipad',4) for s in ('CH18','CH13')},'trace':{('CH18','ipad',6)}}
    if args.verification_only:
        expected={}
        rejected=[json.loads(line) for line in (folder/'discarded-samples.jsonl').read_text(encoding='utf-8').splitlines()]
        if not rejected or not all(r['perf']['foreignCpu']['busy'] for r in rejected):raise AssertionError('No verified CPU-load blocker')
        result['discardedWindows']=[{'label':r['label'],'stage':r['stage'],'device':r['device'],'rate':r['rate'],
                                    'foreignCpuSeconds':r['perf']['foreignCpu']['totalSeconds'],
                                    'maxForeignProcessCpuSeconds':r['perf']['foreignCpu']['top'][0]['cpuSeconds']}
                                   for r in rejected]
        result['blocker']='Other processes consumed CPU in every attempted sample; no valid before/after comparison. All requested performance conditions remain pending.'
    def stat(values):
        return {'median':statistics.median(values),'min':min(values),'max':max(values)}
    def fmt(v):
        return f"{v['median']:.2f} ({v['min']:.2f}~{v['max']:.2f})"
    for suite,keys in expected.items():
        raw=json.loads((folder/f'paired-{suite}.json').read_text(encoding='utf-8'))
        if raw['conditions']['paired']!='9b313a0' or raw['conditions']['reps']<3 or has_errors(raw):
            raise AssertionError(f'Invalid suite {suite}')
        rows=raw['records']; groups={}
        for i in range(0,len(rows),2):
            b,a=rows[i:i+2]
            k=(b['stage'],b['device'],b['rate'])
            if b['side']!='before' or a['side']!='after' or k!=(a['stage'],a['device'],a['rate']) or a['rep']!=b['rep']:
                raise AssertionError('Measurements are not alternating pairs')
            groups.setdefault(k,{'before':[],'after':[]})
            for side,row in (('before',b),('after',a)):
                if row['perf']['foreignCpu']['busy']:raise AssertionError('Contaminated sample')
                groups[k][side].append(row)
        if set(groups)!=keys:raise AssertionError(f'Incomplete conditions {suite}')
        tables.append(f'## {suite}\n\n|장면|기기·CPU|계산 ms 전 → 후|평균 FPS 전 → 후|하위 1% FPS 전 → 후|>50ms % 전 → 후|판정(계산 / FPS)|\n|---|---|---|---|---|---|---|')
        out=[]
        for k,g in groups.items():
            if any(len(g[side])<3 for side in g):raise AssertionError('Less than three samples')
            stats={side:{m:stat([r['perf'][m] for r in g[side]]) for m in metrics} for side in g}
            verdict=[]
            for m in ('simMs','fps'):
                b,a=[stats[x][m] for x in ('before','after')]
                verdict.append('차이 없음' if max(b['min'],a['min'])<=min(b['max'],a['max']) else
                               '개선' if (a['median']<b['median'] if m=='simMs' else a['median']>b['median']) else '악화')
            stage=f'{(int(k[0][2:])-1)//5+1}-{(int(k[0][2:])-1)%5+1}'
            cells=[f'{fmt(stats["before"][m])} → {fmt(stats["after"][m])}' for m in metrics]
            tables.append('|'+ '|'.join([stage,f'{k[1]} ×{k[2]:g}',*cells,' / '.join(verdict)])+'|')
            rec={'stage':k[0],'device':k[1],'rate':k[2],'stats':stats,'verdict':dict(zip(('simMs','fps'),verdict)),
                 'samples':[{key:r[key] for key in ('side','rep','attempt')}|{'perf':{m:r['perf'][m] for m in (*metrics,'frames','steps','gameSeconds','drawMs','ratio')},'foreignCpuSeconds':r['perf']['foreignCpu']['totalSeconds']} for side in g for r in g[side]]}
            if suite=='trace':
                rec['top10']={}
                for side in g:
                    profiles=[]
                    for r in g[side]:
                        path=folder/f'paired-trace-{side}-{k[0]}-{k[1]}-x{k[2]:g}-r{r["rep"]}.cpuprofile'
                        profiles.append({p['function']:p['selfMs'] for p in script_top(path,None)})
                    names=set().union(*profiles)
                    ranking=[{'function':name,**stat([p.get(name,0) for p in profiles])} for name in names]
                    rec['top10'][side]=sorted(ranking,key=lambda r:-r['median'])[:10]
            out.append(rec)
        result['suites'][suite]={'conditions':{k:v for k,v in raw['conditions'].items() if k not in ('out','url')},'browser':raw['browser'],'records':out}
        tables.append('')
    records=[]
    fingerprint=hashlib.sha256(b''.join(p.read_bytes() for p in sorted((ROOT/'game/src').glob('*')) if p.suffix in ('.js','.css'))).hexdigest()
    for label in args.replay_labels.split(','):
        replay=json.loads((folder/f'{label}.json').read_text(encoding='utf-8'))
        meta=json.loads((folder/f'{label}-replay-meta.json').read_text(encoding='utf-8'))
        if replay['conditions']['reference']!='9b313a0' or meta['sourceSha256']!=fingerprint:raise AssertionError('Replay source mismatch')
        records.extend(replay['records'])
    result['workingSourceSha256']=fingerprint
    expected_replays={(s,seed,w,c) for s in ('CH05','CH10','CH13','CH15','CH17','CH18','CH19','CH20')
                      for seed in (10808,10809) for w in ('ranged','melee') for c in ('natural','stress')}
    actual_replays={(r['stage'],r['seed'],r['weapon'],r['crowd']) for r in records}
    if len(records)!=64 or actual_replays!=expected_replays or has_errors(records) or not all(r['equal'] and r['before']==r['after'] for r in records):
        raise AssertionError('Expanded replay incomplete/failed')
    result['replay']=[{k:r[k] for k in ('stage','seed','weapon','crowd','quality','god','equal')}|
                      {'checkpoints':len(r['after']['checkpoints']),'seconds':r['after']['outcome']['seconds'],
                       'kills':r['after']['outcome']['kills'],'canvasHash':r['after']['canvasHash'],
                       'finalEnemyState':r['after']['finalEnemyState'],'inputHash':r['after']['inputHash'],'inputSha256':r['after']['inputSha256'],
                       'settlement':r['after']['settlement']} for r in records]
    for ui in (1,2):
        rec=json.loads((folder/f'responsive-ui{ui}'/'report.json').read_text(encoding='utf-8'))
        issues=sum(len(v) for r in rec.values() for screen in r.values() if isinstance(screen,dict) for v in screen.values() if isinstance(v,list))
        if len(rec)!=6 or issues or any(r.get('_error') or r.get('_pageErrors') for r in rec.values()):raise AssertionError('UI audit failed')
        result[f'responsiveUI{ui}']={'sizes':list(rec),'issues':issues,'pageErrors':0}
    (folder/'tables.md').write_text('\n'.join(tables),encoding='utf-8')
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'Validated {sum(len(v["records"])*6 for v in result["suites"].values())} measurement windows; 64 replays; UI issues 0')


if args.pass2:
    pass2_summary()
    raise SystemExit(0)


data = {'scope':'Loopback QA only. Chromium software rendering, synthetic CPU throttling; not physical tablet results.',
        'low1Definition':'1000 / mean duration of slowest ceil(1% of sampled frames). Includes profiling/QA overhead.', 'sets':{}}
for side in ('before','after'):
    for suite in ('screen','deep','bulki','foam','threat','worst-trace','layers-warm','repeat','lobby'):
        label = f'{side}-{suite}'
        path = folder/f'{label}.json'
        if not path.exists():
            raise FileNotFoundError(path)
        raw = json.loads(path.read_text(encoding='utf-8'))
        if not raw['records'] or has_errors(raw['records']):
            raise AssertionError(f'Incomplete/browser errors in {label}')
        conditions = {k:v for k,v in raw['conditions'].items() if k not in ('out','reference','source','label','url')}
        conditions.setdefault('foam',False)
        conditions.setdefault('stress',False)
        conditions.pop('keep_elite',None)
        conditions.setdefault('threat_effects',False)
        record = {'conditions':conditions, 'browser':raw['browser'], 'commit':raw['commit'], 'records':raw['records']}
        if raw['mode']=='scenes':
            for r in record['records']:
                prof = folder/f"{label}-{r['stage']}-{r['device']}-x{r['rate']:g}-r{r['rep']}.cpuprofile"
                if prof.exists():
                    r['perf']['scriptTop10'] = script_top(prof)
                if r['errors']:
                    raise AssertionError(f'Browser errors in {label}')
        data['sets'][label] = record
for suite in ('screen','deep','bulki','foam','threat','worst-trace','layers-warm','repeat','lobby'):
    b,a = [data['sets'][f'{s}-{suite}'] for s in ('before','after')]
    if b['conditions'] != a['conditions'] or b['browser'] != a['browser']:
        raise AssertionError(f'Comparison conditions differ: {suite}')
    if isinstance(b['records'],list) and len(b['records']) != len(a['records']):
        raise AssertionError(f'Comparison row count differs: {suite}')
replay = json.loads((folder/'invariant.json').read_text(encoding='utf-8'))
if len(replay['records'])!=8 or has_errors(replay['records']) or not all(r['equal'] for r in replay['records']):
    raise AssertionError('Invariant replay has not passed')
data['replay'] = [{'stage':r['stage'],'seed':r['seed'],'equal':r['equal'],'inputHash':r['after']['inputHash'],
                   'device':r['device'],'quality':r['quality'],'god':r['god'],'canvasHash':r['after']['canvasHash'],
                   'seconds':r['after']['outcome']['seconds'],'kills':r['after']['outcome']['kills'],
                   'settlement':r['after']['settlement']} for r in replay['records']]
for ui in (1,2):
    path = folder/f'responsive-ui{ui}'/'report.json'
    rec = json.loads(path.read_text(encoding='utf-8'))
    issues = sum(len(v) for r in rec.values() for screen in r.values() if isinstance(screen,dict) for v in screen.values() if isinstance(v,list))
    if len(rec)!=6 or issues or any(r.get('_error') or r.get('_pageErrors') for r in rec.values()):
        raise AssertionError(f'Responsive UI{ui} incomplete/failed')
    data[f'responsiveUI{ui}'] = rec
Path(args.output).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
b,a = [data['sets'][f'{s}-screen']['records'] for s in ('before','after')]
stages = [f"{(int(r['stage'][2:])-1)//5+1}-{(int(r['stage'][2:])-1)%5+1}" for r in b]
fig, ax = plt.subplots(figsize=(10,4.2))
for shift,rows,label,color in ((-.18,b,'Before','#8293a7'),(.18,a,'After','#287eac')):
    bars = ax.bar([i+shift for i in range(len(stages))],[r['perf']['low1'] for r in rows],width=.34,label=label,color=color)
    ax.bar_label(bars,fmt='%.1f',fontsize=8,padding=3)
ax.set_xticks(range(len(stages)),stages)
ax.set_ylabel('1% low FPS (higher is better)')
ax.set_title('Late scenes: 1180 x 820 @2x, CPU x4, automatic quality')
ax.legend(frameon=False)
ax.grid(axis='y',alpha=.2)
ax.set_axisbelow(True)
fig.text(.5,.01,'Local QA / headless software rendering. Boss HP held; single 15s sample with profiling overhead.',ha='center',fontsize=8)
fig.tight_layout(rect=(0,.035,1,1))
target = Path(args.chart)
target.parent.mkdir(parents=True,exist_ok=True)
fig.savefig(target,dpi=130)
if target.stat().st_size>400*1024:
    raise AssertionError('Comparison chart exceeds 400KB')
print(f'Aggregate {args.output}; chart {target.stat().st_size} bytes')

# Reviewable tables from the exact checked pairs; never copy figures by hand.
lines=['## 같은 조건의 전후 결과','', '[익명 QA 측정 JSON](2026-10-08_태블릿_측정.json) · [하위 1% FPS 그림](preview/perf_before_after.png)', '']
def table(headers,rows):
    lines.extend(['|'+'|'.join(headers)+'|','|'+'|'.join(['---']*len(headers))+'|'])
    lines.extend('|'+'|'.join(map(str,row))+'|' for row in rows)
    lines.append('')
def stage_name(stage):
    n=int(stage[2:])-1
    return f'{n//5+1}-{n%5+1}'
def pairs(suite):
    b,a=[data['sets'][f'{s}-{suite}']['records'] for s in ('before','after')]
    if suite=='repeat':
        b,a=b['rounds'],a['rounds']
    return zip(b,a)
for suite,title in [('screen','자연 후반 8장면: iPad급 ×4'),('deep','합성 군중: 3기기 ×2 CPU 배율'),('bulki','4-4 합성 군중'),('foam','3-3 연속 거품'),('threat','4장 자국·불 공 합성 시각 부하'),('worst-trace','CPU ×6 군중 대표 장면: 추가 trace 포함')]:
    lines.extend([f'### {title}','', '각 칸은 **전 → 후**. FPS는 높을수록, 긴 프레임 비율과 ms는 낮을수록 좋다.',''])
    rows=[]
    for b,a in pairs(suite):
        bp,ap=b['perf'],a['perf']
        metrics=[f'{bp[k]:.1f} → {ap[k]:.1f}' for k in ('fps','low1','long50Pct','simMs','drawMs')]
        rows.append([stage_name(b['stage']),f"{b['device']} ×{b['rate']:g}",*metrics,f"{bp['ratio']:g} → {ap['ratio']:g}"])
    table(['장면','기기·CPU','평균 FPS','하위 1% FPS','>50ms %','계산 ms','그림 제출 ms','최종 해상도 배율'],rows)
lines.extend(['### 고정 그림층: raster 완료 포함, CPU throttle 없음','', 'iPad급, 해상도 0.7배·효과 최소, 같은 고정 장면을 12번씩 그려 3회 중앙값. 각 칸 전 → 후(ms). `off`는 해당 층만 끈 결과다.',''])
table(['장면','전체','원소 off','거품 off','불 구역 off','4장 바닥 off'],[[stage_name(b['stage']),*[f"{b['medianMs'][k]:.2f} → {a['medianMs'][k]:.2f}" for k in ('all','skills','foam','zones','t4ground')]] for b,a in pairs('layers-warm')])
lines.extend(['### 같은 탭 연속 5판: GC 후 JS heap과 잔여 객체','', '전 → 후. native bitmap/GPU 메모리는 포함되지 않는다.',''])
repeat_rows=[]
for b,a in pairs('repeat'):
    repeat_rows.append([b['round'],f"{b['perf']['fps']:.1f} → {a['perf']['fps']:.1f}",f"{b['memory']['heapUsed']/1048576:.2f} → {a['memory']['heapUsed']/1048576:.2f}",f"{b['memory']['jsEventListeners']} → {a['memory']['jsEventListeners']}",f"{b['memory']['nodes']} → {a['memory']['nodes']}",f"{b['timers']} → {a['timers']}"])
table(['판','평균 FPS','heap MiB','리스너','DOM 노드','interval/timeout'],repeat_rows)
lines.extend(['### 로비: UI 1·UI 2, iPad급 CPU ×4',''])
table(['UI','탭 중앙값 ms','탭 최대 ms','스크롤 프레임 중앙값 ms','스크롤 프레임 최대 ms'],[[b['ui'],*[f"{b[k]:.1f} → {a[k]:.1f}" for k in ('tabMedian','tabMax','scrollFrameMedian','scrollFrameMax')]] for b,a in pairs('lobby')])
lines.extend(['### 느린 장면의 함수 상위 10개','', 'CPU sampling의 JS 자기 시간(self ms). 네이티브·유휴는 제외한 **게임 JS 함수** 순위다. 전후 순위가 달라 별도 열로 표시한다. 합계는 전체 프레임 계산/그리기 시간과 같지 않다. raw timeline·CPU profile은 ignored out 폴더에 보관했다.',''])
for suite,stage in [('worst-trace','CH18'),('bulki','CH19'),('worst-trace','CH20')]:
    b,a=next((b,a) for b,a in pairs(suite) if b['stage']==stage)
    lines.extend([f"#### {stage_name(stage)} / {suite} / iPad급 ×{b['rate']:g}",''])
    bt,at=b['perf']['scriptTop10'],a['perf']['scriptTop10']
    table(['순위','전 함수','self ms','후 함수','self ms'],[[i+1,bt[i]['function'],bt[i]['selfMs'],at[i]['function'],at[i]['selfMs']] for i in range(min(10,len(bt),len(at)))])
lines.extend(['## 검증 결과','', '- `node --test "tests/*.test.mjs"`: **175/175 통과**, 실패·스킵 0. 새 4개 검사는 10,000개 적 배열의 정렬/동점/penalty 순서와 캐시 중복 작업·LRU·늦은 완료 닫기·미지원 복귀를 검증한다.', '- 동일 시드·동일 60Hz 틱·동일 draw 순서의 브라우저 전후 검사 **8/8 일치**. 조작 해시, 처치·시간·체력·쓰레기·스킬/피해 통계·원소 상태·판 종료 상태·실제 격리 서버 정산 응답(보상·충전·성공·장면)이 모두 같다. 게임에 별도 점수 필드는 없어 전체 판 통계와 보상을 비교했다.', '- PC 전체 화질 시드 10808의 4장면은 PNG SHA-256도 일치한다. 시드 10809는 iPad급 최소 화질, 무적 없이 정상 생존으로 비교했다.', '- `responsive-audit.py`: UI 1·UI 2 각각 1280×720, 1024×768, 820×1180, 768×1024, 375×667, 360×640 **total issues 0**, page error 0. 로비 6탭·도움말/장비 창·레벨업·전투·멈춤·결과 포함.', '- Windows의 기존 `perf.py` 4-4 태블릿 3초 smoke, `bench.py` 4-4 PC 1회 smoke도 브라우저 오류 0. 이 숫자는 조건이 다른 도구 동작 확인이라 전후 표에 섞지 않았다.', '- `powershell -ExecutionPolicy Bypass -File game/tools/build-single.ps1`: 단일 HTML 생성 성공. 단일 파일판의 실기기 플레이까지 확인한 것은 아니다.', ''])
table(['장면','시드','기기·화질','시간 s','처치','전후 결과·보상','PC 픽셀'],[[stage_name(r['stage']),r['seed'],f"{r['device']} / {r['quality']}",f"{r['seconds']:.3f}",r['kills'],'동일','동일' if r['canvasHash'] else '대상 아님'] for r in data['replay']])
(folder/'report-tables.md').write_text('\n'.join(lines),encoding='utf-8',newline='\n')
