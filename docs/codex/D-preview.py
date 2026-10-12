"""Six magnified PNG/WebP comparisons, using committed original bytes without checkout."""
import io, json, subprocess, sys, base64
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'game/tools'))
from cut_webp import encode_webp
sys.path.insert(0,str(ROOT/'game/tools/qa'))
from browser import chrome_path
from playwright.sync_api import sync_playwright
report=json.loads((ROOT/'docs/codex/measurements/D/convert.json').read_text(encoding='utf-8'))
chosen={'effect':'game/assets/sprites/skills/fire_boom_1.png',
        'weapon':'game/assets/elements_v2/weapons/baseball.png',
        'friend':'game/assets/seoho_v1/pets/otter_idle.png',
        'boss':'game/assets/sprites/t4/boss_angry.png',
        'icon':'game/assets/ui2/icons/cur_coin.png',
        'floor':'game/assets/sprites/t1/floor_dirt.png'}
records=[]
pw=sync_playwright().start()
browser=pw.chromium.launch(headless=True,executable_path=chrome_path(),args=['--no-sandbox','--disable-gpu'])
page=browser.new_page(viewport={'width':1020,'height':570},device_scale_factor=1)
CAPTURE="""async ({sources,labels,crop,caption})=>{
  document.body.style.margin='0';document.body.innerHTML='<canvas width="1020" height="570"></canvas>';
  const c=document.querySelector('canvas'),g=c.getContext('2d');g.fillStyle='#eee';g.fillRect(0,0,1020,570);g.font='12px sans-serif';
  const load=src=>new Promise((r,e)=>{const im=new Image();im.onload=()=>r(im);im.onerror=e;im.src=src});const ims=await Promise.all(sources.map(load));
  for(let col=0;col<2;col++){const origin=10+col*510,im=ims[col];
    for(let y=40;y<540;y+=20)for(let x=origin;x<origin+500;x+=20){g.fillStyle=((x-origin)/20+(y-40)/20)%2?'#c0c0c0':'#e8e8e8';g.fillRect(x,y,20,20)}
    g.imageSmoothingEnabled=false;g.drawImage(im,crop[0],crop[1],crop[2]-crop[0],crop[3]-crop[1],origin,40,500,500);
    g.fillStyle='#eee';g.fillRect(origin+348,48,144,144);g.strokeStyle='#444';g.strokeRect(origin+348,48,144,144);
    const ratio=Math.min(140/im.width,140/im.height);g.imageSmoothingEnabled=true;g.drawImage(im,origin+350+(140-im.width*ratio)/2,50+(140-im.height*ratio)/2,im.width*ratio,im.height*ratio);
    g.fillStyle='#000';g.fillText(labels[col],origin,22);
  }g.fillText(caption,10,560);
}"""
for kind,name in chosen.items():
    row=next(r for r in report['files'] if r['source']==name)
    original_bytes=subprocess.check_output(['git','show',report['baselineCommit']+':'+name],cwd=ROOT)
    original=Image.open(io.BytesIO(original_bytes)).convert('RGBA')
    candidate=None
    if row['status']!='converted':
        candidate=ROOT/f'docs/codex/measurements/D/candidates/{kind}.webp'
        candidate.parent.mkdir(parents=True,exist_ok=True)
        if not candidate.exists(): candidate.write_bytes(encode_webp(original)[0])
    # Center an opaque region; zoom the same <=200px crop to 500px on both sides.
    box=original.getchannel('A').getbbox() or (0,0,*original.size)
    x=(box[0]+box[2])//2; y=(box[1]+box[3])//2
    side=min(200,*original.size); left=max(0,min(original.width-side,x-side//2)); top=max(0,min(original.height-side,y-side//2))
    crop=(left,top,left+side,top+side)
    dest=ROOT/f'docs/codex/preview/D_webp_{kind}.png'; dest.parent.mkdir(parents=True,exist_ok=True)
    actual_webp=(candidate or ROOT/row['target']).read_bytes()
    page.evaluate(CAPTURE,{'sources':['data:image/png;base64,'+base64.b64encode(original_bytes).decode(),'data:image/webp;base64,'+base64.b64encode(actual_webp).decode()],
                          'labels':['Original PNG','WebP candidate (PNG kept)' if candidate else 'WebP'], 'crop':crop,
                          'caption':f'{kind} | zoom {500/side:.2f}x | source RGBA delta {row["maxChannelDelta"]} | same crop {crop}'})
    screenshot=Image.open(io.BytesIO(page.screenshot())).convert('RGB')
    screenshot.quantize(colors=256).save(dest,optimize=True)
    if dest.stat().st_size>400*1024: raise ValueError('Preview too large')
    records.append({'kind':kind,'source':name,'target':row['target'],'candidate':candidate.relative_to(ROOT).as_posix() if candidate else None,'captureEngine':'Chromium screenshot, quantized 256 colors','crop':crop,'zoom':500/side,'bytes':dest.stat().st_size,'preview':dest.relative_to(ROOT).as_posix()})
browser.close();pw.stop()
(ROOT/'docs/codex/measurements/D/previews.json').write_text(json.dumps(records,indent=2),encoding='utf-8',newline='\n')
print(json.dumps(records,indent=2))
