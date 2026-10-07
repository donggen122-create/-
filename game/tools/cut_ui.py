"""Cut UI sheets by connected alpha components (never by fixed grid).

Run from any directory: python game/tools/cut_ui.py
Requires Pillow and numpy. Wrong count or undersized source stops the build.
Detached highlights are attached to the nearest substantial component.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SHEETS = {
    'UI_아이콘_메뉴.png': ['nav_adventure','nav_training','nav_parts','nav_gear','nav_friends','nav_book'],
    'UI_아이콘_재화.png': ['cur_pass','cur_coin','cur_gift','cur_star','cur_sprout','cur_crown'],
    'UI_아이콘_기능.png': ['fn_mission','fn_news','fn_settings','fn_sound_on','fn_sound_off','fn_lock','fn_time','fn_clean'],
    'UI_아이콘_능력치.png': ['stat_attack','stat_hp','stat_speed'],
    # The sheet uses earth before wind; ELEMENTS' object insertion order differs.
    'UI_원소_배지.png': ['el_fire','el_water','el_earth','el_wind','el_lightning'],
    'UI_장비칸.png': ['slot_helm','slot_armor','slot_gloves','slot_shoes','slot_necklace','slot_weapon'],
    'UI_엠블럼.png': ['emblem'],
}
NEW_SHEETS = {
    'UI_아이콘_단추.png': ['btn_help','btn_close','btn_prev','btn_next','btn_check','btn_reroll'],
    'UI_보급상자.png': ['supply_closed','supply_open','hud_weapon_ranged','fn_pause'],
}

def normalize_skills(output):
    """Copy only UI sprites referenced by content; retain the original pixels.

    Copies have square canvases with 6% padding regardless of source size.
    They are not forced to 256px: small original sprites are never upscaled.
    """
    script="import * as R from './game/src/rework-core.js';console.log(JSON.stringify(Object.fromEntries(['SKILLS','PARTS','SUPPORTS','COMBOS'].map(k=>[k,Object.fromEntries(Object.entries(R[k]).map(([id,d])=>[id,d.sprite]))]))));"
    content=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT))
    used={}
    for kind,items in content.items():
        for id,name in items.items():
            if name: used.setdefault(name,[]).append(f'{kind}:{id}')
    prepared=[]; manifest={}
    for name,ids in sorted(used.items()):
        source=ROOT/f'game/assets/sprites/skills/{name}.png'
        im=Image.open(source).convert('RGBA'); box=im.getchannel('A').getbbox()
        if not box: raise ValueError(f'Empty skill sprite: {source}')
        crop=im.crop(box); side=math.ceil(max(crop.size)/.88)
        out=Image.new('RGBA',(side,side)); out.alpha_composite(crop,((side-crop.width)//2,(side-crop.height)//2))
        prepared.append((name,out))
        manifest[name]={'source':source.relative_to(ROOT).as_posix(),'used_by':ids,'source_size':list(im.size),'alpha_box':list(box),'copy_size':[side,side]}
    dest=output/'skills'; dest.mkdir(parents=True,exist_ok=True)
    for name,im in prepared: im.save(dest/(name+'.png'),optimize=True)
    (dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'Normalized {len(prepared)} referenced skill/support/evolution sprites without upscaling')

def key_magenta(im):
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    chroma = np.minimum(rgb[:,:,0],rgb[:,:,2])-rgb[:,:,1]
    # A broad chroma key would erase purple elemental art. Only background
    # connected to the image border is keyed; enclosed magenta holes use a
    # tight near-pure key. Flood fill also handles mildly uneven generated key.
    candidate = (chroma > 150) & (rgb[:,:,0] > 180) & (rgb[:,:,2] > 180)
    flood = Image.fromarray(candidate.astype('uint8')*255).copy()
    for point in [(0,0),(im.width-1,0),(0,im.height-1),(im.width-1,im.height-1)]:
        if flood.getpixel(point)==255: ImageDraw.floodfill(flood,point,128)
    bg = (np.asarray(flood)==128) | ((rgb[:,:,0]>242)&(rgb[:,:,2]>242)&(rgb[:,:,1]<20))
    band = np.asarray(Image.fromarray(bg.astype('uint8')*255).filter(ImageFilter.MaxFilter(7))) > 0
    alpha = np.ones(bg.shape,dtype=np.float32)
    # Unmix magenta in the antialiased border only, leaving pink subjects intact.
    alpha[band] = np.clip(1-np.maximum(chroma[band]-25,0)/225,0,1)
    alpha[bg] = 0
    rgb = np.clip((rgb-(1-alpha[:,:,None])*np.array([255,0,255]))/np.maximum(alpha[:,:,None],.001),0,255)
    rgb[alpha < .01] = 0
    return Image.fromarray(np.dstack((rgb,alpha*255)).astype('uint8'),'RGBA')

def components(mask):
    """8-connected run-length union/find; no scipy/OpenCV dependency."""
    runs=[]; parents=[]; previous=[]
    def find(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]]; i=parents[i]
        return i
    for y,row in enumerate(mask):
        edges=np.diff(np.r_[False,row,False].astype('int8'))
        current=[]; j=0
        for x0,x1 in zip(np.flatnonzero(edges==1),np.flatnonzero(edges==-1)):
            i=len(runs); runs.append((int(x0),int(x1),y)); parents.append(i); current.append(i)
            while j<len(previous) and runs[previous[j]][1]<x0: j+=1
            k=j
            while k<len(previous) and runs[previous[k]][0]<=x1:
                parents[find(i)]=find(previous[k]); k+=1
        previous=current
    groups={}
    for i,(x0,x1,y) in enumerate(runs):
        root=find(i)
        if root not in groups: groups[root]={'area':0,'box':[x0,y,x1,y+1]}
        g=groups[root]; g['area']+=x1-x0; b=g['box']
        b[:]=[min(b[0],x0),min(b[1],y),max(b[2],x1),max(b[3],y+1)]
    return sorted((g for g in groups.values() if g['area']>=20),key=lambda g:-g['area'])

def gap(a,b):
    return np.hypot(max(a[0]-b[2],b[0]-a[2],0),max(a[1]-b[3],b[1]-a[3],0))

def ordered_boxes(im,count):
    cs=components(np.asarray(im)[:,:,3]>64)
    if len(cs)<count: raise ValueError(f'Expected {count} icons, found {len(cs)} components')
    seeds=cs[:count]
    typical=np.median([g['area'] for g in seeds])
    if min(g['area'] for g in seeds)<typical*.35:
        raise ValueError(f'Expected {count} substantial icons; missing/merged icon detected')
    boxes=[g['box'][:] for g in seeds]
    for g in cs[count:]:
        distances=[gap(g['box'],s['box']) for s in seeds]; i=int(np.argmin(distances)); b=seeds[i]['box']
        if distances[i]>min(b[2]-b[0],b[3]-b[1])*.30 or g['area']>typical*.35:
            raise ValueError(f'Extra disconnected art: area={g["area"]}, box={g["box"]}')
        a=boxes[i]; q=g['box']; a[:]=[min(a[0],q[0]),min(a[1],q[1]),max(a[2],q[2]),max(a[3],q[3])]
    rows=[]
    for b in sorted(boxes,key=lambda b:(b[1]+b[3])/2):
        cy=(b[1]+b[3])/2
        row=next((r for r in rows if abs(cy-r[0])<min(b[3]-b[1],r[1])*.5),None)
        if row is None: rows.append([cy,b[3]-b[1],[b]])
        else: row[2].append(b)
    return [b for r in rows for b in sorted(r[2],key=lambda b:b[0])]

def fitted(im,box,size):
    crop=im.crop(box); content=round(size*.88)
    if max(crop.size)<content: raise ValueError(f'Source {crop.size} smaller than {content}px: regenerate larger')
    crop.thumbnail((content,content),Image.Resampling.LANCZOS)
    out=Image.new('RGBA',(size,size)); out.alpha_composite(crop,((size-crop.width)//2,(size-crop.height)//2))
    return out

def prepare_ui3_sheets(folder):
    """Keep generated subjects; standardize keyed backdrops and 4:1 layout.

    This is the same chroma-key/crop operation used for the game icons.
    No subject is drawn, stretched or upscaled.
    """
    prepared=[]
    for filename,names in NEW_SHEETS.items():
        im=key_magenta(Image.open(folder/filename)); boxes=ordered_boxes(im,len(names))
        if filename=='UI_보급상자.png':
            cell=math.ceil(max(max(b[2]-b[0],b[3]-b[1]) for b in boxes)/.88/64)*64
            sheet=Image.new('RGB',(cell*4,cell),(255,0,255))
            for i,box in enumerate(boxes):
                crop=im.crop(box); sheet.paste(crop,(i*cell+(cell-crop.width)//2,(cell-crop.height)//2),crop)
        else:
            sheet=Image.new('RGB',im.size,(255,0,255)); sheet.paste(im,(0,0),im)
        # Alpha quantization can leave 1/255 near-key pixels at the boundary.
        # Snap only pixels the cutter classifies as fully transparent.
        rgb=np.asarray(sheet).copy(); rgb[np.asarray(key_magenta(sheet))[:,:,3]==0]=[255,0,255]
        sheet=Image.fromarray(rgb)
        prepared.append((folder/filename,sheet))
    for path,sheet in prepared: sheet.save(path,optimize=True)

def preview(files,path):
    cell=100; W=cell*len(files); out=Image.new('RGB',(W,248)); draw=ImageDraw.Draw(out)
    for row,bg in enumerate(['#151a3d','#fffaf0']):
        draw.rectangle((0,row*124,W,(row+1)*124),fill=bg)
        for i,f in enumerate(files):
            im=Image.open(f).convert('RGBA'); im.thumbnail((96,96),Image.Resampling.LANCZOS)
            out.paste(im,(i*cell+(cell-im.width)//2,row*124+2),im)
            draw.text((i*cell+3,row*124+101),f.stem,fill='white' if row==0 else '#151a3d')
    out.save(path,quality=85,optimize=True)
    if path.stat().st_size>400000: raise ValueError('Icon preview exceeds 400KB')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--input',type=Path,default=ROOT/'이미지 에셋/UI'); ap.add_argument('--output',type=Path,default=ROOT/'game/assets/ui2'); ap.add_argument('--ui3',action='store_true',help='Build only third-pass sheets and skill copies'); ap.add_argument('--prepare-ui3-sheets',action='store_true',help='Standardize generated key backgrounds and the supply 4:1 sheet'); args=ap.parse_args()
    if args.prepare_ui3_sheets: prepare_ui3_sheets(args.input)
    # Validate every source before writing outputs, so count failures leave no partial set.
    prepared=[]
    for filename,names in (NEW_SHEETS if args.ui3 else {**SHEETS,**NEW_SHEETS}).items():
        im=key_magenta(Image.open(args.input/filename)); boxes=ordered_boxes(im,len(names))
        prepared.extend((name,fitted(im,box,512 if name in ['emblem','supply_closed','supply_open'] else 256)) for name,box in zip(names,boxes))
        print(f'{filename}: {len(boxes)} icons; source boxes {boxes}')
    bg=None
    if not args.ui3:
        bg=Image.open(args.input/'UI_배경_작전본부.png').convert('RGB')
        if bg.width<1600: raise ValueError('HQ background needs a larger source')
        bg=bg.resize((1600,round(bg.height*1600/bg.width)),Image.Resampling.LANCZOS)
    icons=args.output/'icons'; icons.mkdir(parents=True,exist_ok=True)
    files=[]
    for name,im in prepared:
        path=(args.output if name=='emblem' else icons)/(name+'.png'); im.save(path,optimize=True); files.append(path)
    if bg is not None: bg.save(args.output/'bg_hq.jpg',quality=80,optimize=True)
    new_names={name for names in NEW_SHEETS.values() for name in names}
    dest=ROOT/'docs/codex/preview/ui3_icons.jpg'; dest.parent.mkdir(parents=True,exist_ok=True); preview([f for f in files if f.stem in new_names],dest)
    normalize_skills(args.output)
    print(f'Built {len(prepared)} sheet assets; {dest.stat().st_size} byte preview')

if __name__=='__main__': main()
