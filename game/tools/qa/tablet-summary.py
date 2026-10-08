"""Publish only anonymous local-QA aggregates and the requested comparison chart.

python game/tools/qa/tablet-summary.py --input game/tools/qa/out/tablet
Requires matplotlib in the external QA venv. Raw traces remain in ignored out/.
"""
import argparse
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[3]
ap = argparse.ArgumentParser()
ap.add_argument('--input', default=str(ROOT/'game/tools/qa/out/tablet'))
ap.add_argument('--output', default=str(ROOT/'docs/codex/2026-10-08_태블릿_측정.json'))
ap.add_argument('--chart', default=str(ROOT/'docs/codex/preview/perf_before_after.png'))
args = ap.parse_args()
folder = Path(args.input)


def script_top(path):
    p = json.loads(path.read_text(encoding='utf-8'))
    nodes = {n['id']: n['callFrame'] for n in p['nodes']}
    totals = defaultdict(float)
    for sid, dt in zip(p.get('samples', []), p.get('timeDeltas', [])):
        cf = nodes[sid]
        if '/src/' in cf.get('url',''):
            totals[f"{cf['functionName'] or '(anonymous)'} {cf['url'].split('/')[-1]}:{cf['lineNumber']+1}"] += dt/1000
    return [{'function':k,'selfMs':round(v,2)} for k,v in sorted(totals.items(),key=lambda x:-x[1])[:10]]


data = {'scope':'Loopback QA only. Chromium software rendering, synthetic CPU throttling; not physical tablet results.',
        'low1Definition':'1000 / mean duration of slowest ceil(1% of sampled frames). Includes profiling/QA overhead.', 'sets':{}}
for side in ('before','after'):
    for suite in ('screen','deep','bulki','foam','threat','layers-warm','repeat','lobby'):
        label = f'{side}-{suite}'
        path = folder/f'{label}.json'
        if not path.exists():
            raise FileNotFoundError(path)
        raw = json.loads(path.read_text(encoding='utf-8'))
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
for suite in ('screen','deep','bulki','foam','threat','layers-warm','repeat','lobby'):
    b,a = [data['sets'][f'{s}-{suite}'] for s in ('before','after')]
    if b['conditions'] != a['conditions'] or b['browser'] != a['browser']:
        raise AssertionError(f'Comparison conditions differ: {suite}')
    if isinstance(b['records'],list) and len(b['records']) != len(a['records']):
        raise AssertionError(f'Comparison row count differs: {suite}')
replay = json.loads((folder/'invariant.json').read_text(encoding='utf-8'))
if not replay['records'] or not all(r['equal'] for r in replay['records']):
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
Path(args.output).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')

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
