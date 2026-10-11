"""Measure Chromium native/scaled compositing of original PNG vs lossless WebP."""
import base64, json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'docs/codex/measurements/D'
sys.path.insert(0,str(ROOT/'game/tools/qa'))
from browser import chrome_path
from playwright.sync_api import sync_playwright
report=json.loads((OUT/'convert.json').read_text(encoding='utf-8'))
rows=[r for r in report['files'] if r['status']=='converted' and r['source'].endswith('.png')]
names=[r['source'] for r in rows]
data=subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=(''.join(report['baselineCommit']+':'+n+'\n' for n in names)).encode())
offset=0; originals={}
for name in names:
    end=data.index(b'\n',offset); size=int(data[offset:end].split()[-1]); offset=end+1
    originals[name]=data[offset:offset+size]; offset+=size+1
JS="""async ([a,b])=>{
  const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src});
  const ims=await Promise.all([load(a),load(b)]), out={};
  for(const mode of ['native','scaled']){
    const w=mode==='native'?ims[0].width:96,h=mode==='native'?ims[0].height:Math.max(1,Math.round(96*ims[0].height/ims[0].width));
    const pixels=ims.map(im=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#808080';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);return g.getImageData(0,0,w,h).data});
    let changed=0,max=0;for(let i=0;i<pixels[0].length;i+=4){let hit=false;for(let k=0;k<3;k++){const d=Math.abs(pixels[0][i+k]-pixels[1][i+k]);if(d)hit=true;max=Math.max(max,d)}if(hit)changed++}
    out[mode]={changedPixels:changed,maxChannelDelta:max,totalPixels:w*h};
  }return out;
}"""
result=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome_path(),args=['--no-sandbox','--disable-gpu'])
    page=browser.new_page()
    for row in rows:
        a='data:image/png;base64,'+base64.b64encode(originals[row['source']]).decode()
        b='data:image/webp;base64,'+base64.b64encode((ROOT/row['target']).read_bytes()).decode()
        metrics=page.evaluate(JS,[a,b]); result.append({'source':row['source'],**metrics})
        if metrics['native']['changedPixels'] or metrics['scaled']['changedPixels']:print(row['source'],metrics,flush=True)
    browser.close()
(OUT/'browser-pixels.json').write_text(json.dumps(result,indent=2),encoding='utf-8',newline='\n')
print('checked',len(result),'native differences',sum(r['native']['changedPixels']>0 for r in result),'scaled differences',sum(r['scaled']['changedPixels']>0 for r in result),flush=True)
