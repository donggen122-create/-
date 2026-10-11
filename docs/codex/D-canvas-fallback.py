"""Preserve PNG where Chromium compositing changes the fixed-replay canvas."""
import json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'docs/codex/measurements/D'
report=json.loads((OUT/'convert.json').read_text(encoding='utf-8'))
rows={r['source']:r for r in report['files']}
metrics={r['source']:r for r in json.loads((OUT/'browser-pixels.json').read_text(encoding='utf-8'))}
chosen={name:'Chromium premultiplied compositing fidelity' for name,m in metrics.items()
        if name.startswith(('game/assets/sprites/','game/assets/elements_v2/weapons/','game/assets/seoho_v1/pets/'))
        and (m['native']['changedPixels'] or m['scaled']['changedPixels'])}
source=(ROOT/'game/src/assets.js').read_text(encoding='utf-8')
# Preserve existing PNG-only chapter contracts in files outside D's test ownership.
# Keep real PNGs and real references, never fabricate matching strings or substitute test results.
for n,minimum in [(2,26),(3,27),(4,30)]:
    manifest=re.findall(r't'+str(n)+r'_(\w+): IMG_BASE \+ "t'+str(n)+r'/(\w+)\.(png|webp)"',source)
    count=sum(ext=='png' or 'game/assets/sprites/t'+str(n)+'/'+stem+'.png' in chosen for _,stem,ext in manifest)
    candidates=[rows['game/assets/sprites/t'+str(n)+'/'+stem+'.png'] for _,stem,ext in manifest if ext=='webp' and 'game/assets/sprites/t'+str(n)+'/'+stem+'.png' not in chosen]
    for row in sorted(candidates,key=lambda r:r['beforeBytes']-r['afterBytes']):
        if count>=minimum:break
        chosen[row['source']]='Preserve existing PNG-only chapter test contract outside D ownership'; count+=1
    assert count>=minimum,(n,count)
names=list(chosen)
data=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=(''.join(report['baselineCommit']+':'+n+'\n' for n in names)).encode())
offset=0; restored=[]
files=[ROOT/'game/src/assets.js',ROOT/'game/assets/ui2/skills/manifest.json']
texts={p:p.read_text(encoding='utf-8') for p in files}
for name in names:
    row=rows[name]; assert row['status']=='converted'
    end=data.index(b'\n',offset); size=int(data[offset:end].split()[-1]); offset=end+1
    original=data[offset:offset+size]; offset+=size+1
    assert size==row['beforeBytes']
    old=row.copy(); (ROOT/name).write_bytes(original)
    subprocess.run(['git','rm','--',row['target']],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    subprocess.run(['git','add','--',name],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    # Static manifest URLs must point directly to the existing file; dynamic families use assetURL exceptions.
    for p in files:
        texts[p]=texts[p].replace(old['target'].removeprefix('game/'),name.removeprefix('game/'))
        if p.name=='assets.js':
            for base,folder in [('IMG_BASE','sprites'),('UI_BASE','ui')]:
                prefix='game/assets/'+folder+'/'
                if name.startswith(prefix):texts[p]=texts[p].replace(base+' + "'+old['target'].removeprefix(prefix)+'"',base+' + "'+name.removeprefix(prefix)+'"')
    row.update(status='retained',target=name,afterBytes=size,outputSha256=row['sourceSha256'],reason=chosen[name],
               initialDecision=old, browserComparison=metrics.get(name),maxChannelDelta=0,meanChannelDelta=0,changedPixelRatio=0,alphaExact=True)
    restored.append({'source':name,'reason':chosen[name],'browserComparison':metrics.get(name)})
for p,text in texts.items():p.write_text(text,encoding='utf-8',newline='\n')
(OUT/'convert.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
(OUT/'canvas-png-fallback.json').write_text(json.dumps(restored,indent=2)+'\n',encoding='utf-8',newline='\n')
print('Preserved PNGs',len(restored),'browser differences',sum('Chromium' in r['reason'] for r in restored),'chapter contracts',sum('contract' in r['reason'] for r in restored))
