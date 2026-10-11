"""Repeatable D-only source path updates from conversion decisions, plus cutter migration."""
import argparse, ast, json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser(); ap.add_argument('mode', choices=['cutters','paths']); args=ap.parse_args()

def write(p, text): p.write_text(text,encoding='utf-8',newline='\n')

if args.mode == 'cutters':
    for p in (ROOT/'game/tools').glob('cut_*.py'):
        if p.name == 'cut_webp.py': continue
        text=p.read_text(encoding='utf-8')
        # Output basenames are ASCII; Korean generator input names and PNG previews stay intact.
        text=re.sub(r'(["\x27])((?:[a-z][\w{}_-]*|\{hero\}_\{anim\}_\{n\}|\{group\}_\{name\})\.(?:png|jpg))\1',
                    lambda m:m[0] if m[2].startswith(('preview_','debug_')) else m[1]+m[2].rsplit('.',1)[0]+'.webp'+m[1],text)
        if p.name == 'cut_ui.py':
            text=text.replace("/{name}.png'","/{name}.webp'").replace("(name+'.png')","(name+'.webp')")
        # Cut card tables had PNG output names but emitted JPG. Now both names and outputs agree.
        text=text.replace("out_name.replace('.png', '.jpg')", 'out_name')
        if p.name == 'cut_gear.py':
            text=text.replace('im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)',
                              'save_webp(im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG), path)')
        # Only asset-output save calls, never source-sheet preparation or diagnostic previews.
        tree=ast.parse(text); lines=text.splitlines(keepends=True); starts=[0]
        for line in lines: starts.append(starts[-1]+len(line))
        edits=[]
        for node in ast.walk(tree):
            if not isinstance(node,ast.Call) or not isinstance(node.func,ast.Attribute) or node.func.attr!='save' or not node.args: continue
            target=ast.get_source_segment(text,node.args[0]); obj=ast.get_source_segment(text,node.func.value)
            output = target.startswith(('OUT /','args.output/','dest/')) or p.name == 'cut_ui.py' and target=='path' and obj=='im'
            if not output: continue
            edits.append((starts[node.lineno-1]+node.col_offset, starts[node.end_lineno-1]+node.end_col_offset, f'save_webp({obj}, {target})'))
        # AST columns count UTF-8 bytes. The asset save statements contain only ASCII.
        for start,end,new in sorted(edits,reverse=True): text=text[:start]+new+text[end:]
        text=text.replace('from PIL import ', 'from cut_webp import save_webp\nfrom PIL import ',1)
        ast.parse(text)
        write(p,text)
    print('Migrated cutters; previews and generator input sheets preserved')
else:
    conversion=json.loads((ROOT/'docs/codex/measurements/D/convert.json').read_text(encoding='utf-8'))
    rows=conversion['files']; mapping={r['source'].removeprefix('game/assets/'):r['target'].removeprefix('game/assets/') for r in rows if r['status']=='converted'}
    sources=['assets.js','ui2-art.js','element-content.js','element-effects.js','main.js','rework-ui.js']
    files=[ROOT/'game/src'/n for n in sources]+[ROOT/'game/src/rework.css',ROOT/'game/src/ui-v2.css',ROOT/'game/index.html']+list((ROOT/'game/admin').glob('*'))
    for p in files:
        if not p.is_file(): continue
        text=p.read_text(encoding='utf-8')
        for old,new in mapping.items():
            text=text.replace('assets/'+old,'assets/'+new)
            if p.name == 'assets.js':
                for base,folder in [('IMG_BASE','sprites'),('UI_BASE','ui')]:
                    if old.startswith(folder+'/'): text=text.replace(base+' + "'+old[len(folder)+1:]+'"',base+' + "'+new[len(folder)+1:]+'"')
        # Dynamic URL families must have one extension. Fail instead of pointing at nonexistent files.
        families=['elements_v2/weapons','seoho_v1/pets','sprites/skills','sprites/t4','ui2/icons','ui2/skills']
        for family in families:
            family_rows=[r for r in rows if r['source'].startswith('game/assets/'+family+'/')]
            if not family_rows: continue
            retained=[r['source'] for r in family_rows if r['status']!='converted']
            if retained: raise ValueError(f'Mixed dynamic family {family}: {retained}')
            text=re.sub(r'(assets/'+re.escape(family)+r'/(?:\$\{[^}]+\}|[^"\x27`\s])+?)\.png',r'\1.webp',text)
        if p.name=='ui2-art.js':
            text=text.replace('/skills/${name}.png','/skills/${name}.webp').replace("'emblem.png'","'emblem.webp'")
        if p.name=='assets.js': text=text.replace('20261011b1','20261012d1')
        write(p,text)
    manifest=ROOT/'game/assets/ui2/skills/manifest.json'
    text=manifest.read_text(encoding='utf-8')
    for old,new in mapping.items(): text=text.replace('game/assets/'+old,'game/assets/'+new)
    write(manifest,text)
    print('Updated converted paths and manifest')
