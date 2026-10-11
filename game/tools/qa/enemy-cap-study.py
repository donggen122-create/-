"""Run identical synthetic crowds sequentially, without concurrent performance browsers."""
import json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'docs/codex/measurements/B/cap-study'
OUT.mkdir(parents=True,exist_ok=True)
rows=[]
for cap in [0,120,100,80]:
    cmd=[sys.executable,str(ROOT/'game/tools/qa/tablet-perf.py'),'--label',f'B-cap-{cap}','--devices','ipad,android','--rates','6','--stages','CH18,CH20','--stress','--quality','99','--enemy-cap',str(cap),'--warm','8','--measure','15','--out',str(OUT)]
    subprocess.run(cmd,cwd=ROOT,check=True)
    data=json.loads((OUT/f'B-cap-{cap}.json').read_text(encoding='utf-8'))
    for r in data['records']:
        rows.append({'cap':cap,'stage':r['stage'],'device':r['device'],'fps':r['perf']['fps'],'low1':r['perf']['low1'],'stressEnemies':r['prepared']['stressEnemies'],'sampleEnemies':r['perf']['enemies'],'quality':r['perf']['quality'],'errors':r['errors']})
    (OUT/'summary.json').write_bytes(json.dumps(rows,ensure_ascii=False,indent=2).encode())
print(json.dumps(rows,ensure_ascii=False,indent=2),flush=True)
