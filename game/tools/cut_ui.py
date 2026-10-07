"""Cut UI sheets by connected alpha components (never by fixed grid).

Run from any directory: python game/tools/cut_ui.py
Requires Pillow and numpy. Wrong count or undersized source stops the build.
Detached highlights are attached to the nearest substantial component.
"""
import argparse
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
    ap=argparse.ArgumentParser(); ap.add_argument('--input',type=Path,default=ROOT/'이미지 에셋/UI'); ap.add_argument('--output',type=Path,default=ROOT/'game/assets/ui2'); args=ap.parse_args()
    # Validate every source before writing outputs, so count failures leave no partial set.
    prepared=[]
    for filename,names in SHEETS.items():
        im=key_magenta(Image.open(args.input/filename)); boxes=ordered_boxes(im,len(names))
        prepared.extend((name,fitted(im,box,512 if name=='emblem' else 256)) for name,box in zip(names,boxes))
        print(f'{filename}: {len(boxes)} icons; source boxes {boxes}')
    bg=Image.open(args.input/'UI_배경_작전본부.png').convert('RGB')
    if bg.width<1600: raise ValueError('HQ background needs a larger source')
    bg=bg.resize((1600,round(bg.height*1600/bg.width)),Image.Resampling.LANCZOS)
    icons=args.output/'icons'; icons.mkdir(parents=True,exist_ok=True)
    files=[]
    for name,im in prepared:
        path=(args.output if name=='emblem' else icons)/(name+'.png'); im.save(path,optimize=True); files.append(path)
    bg.save(args.output/'bg_hq.jpg',quality=80,optimize=True)
    dest=ROOT/'docs/codex/preview/ui2_icons.jpg'; dest.parent.mkdir(parents=True,exist_ok=True); preview(files,dest)
    print(f'Built {len(prepared)-1} icons + emblem + HQ background; {dest.stat().st_size} byte preview')

if __name__=='__main__': main()
