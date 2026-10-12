"""Read-only ownership check against D's initial commit. Does not read sibling worktrees."""
import json, re, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE='3da7fc051b25c5dd5ad00db1d38529ea196cb9f9'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
changed=[name for name in git('diff','--name-only','-z',BASE).decode('utf-8').split('\0') if name]
allowed={'game/src/assets.js','game/src/ui2-art.js','game/src/element-content.js','game/src/element-effects.js','game/src/main.js','game/src/rework-ui.js','game/src/ui-v2.css','game/src/rework.css','game/index.html','game/tools/build-single.ps1','game/tools/version-assets.mjs','game/tools/sync-dist.ps1','game/tools/ci-deploy.mjs','dist_web/_headers','tests/loading-assets.test.mjs','tests/single-build.test.mjs','tests/ui2-art.test.mjs','tests/tablet-render.test.mjs','game/tools/assets-diet.py','game/STATUS.md'}
def owned(name):
    if name in allowed:return True
    if name.startswith('docs/codex/') or name.startswith('game/admin/'):return True
    if re.fullmatch(r'game/tools/cut_[^/]+\.py',name):return True
    if name.startswith('game/assets/') and not name.startswith(('game/assets/story/','game/assets/audio/')) and not name.endswith(('.woff2','.woff','.ttf','.otf','.mp3','.ogg','.wav')):return True
    return False
assert all(owned(name) for name in changed),[name for name in changed if not owned(name)]
for name in ['game/src/main.js','game/src/rework-ui.js']:
    before=git('show',BASE+':'+name).decode('utf-8').replace('\r\n','\n')
    after=(ROOT/name).read_text(encoding='utf-8')
    # The only edits allowed in these two files are raster image path extensions.
    clean=lambda text:re.sub(r'\.(?:png|jpg|webp)(?=[?"\x27`/]|\b)', '.IMAGE',text)
    assert clean(before)==clean(after),name+' changed outside path strings'
for name in ['game/src/ui-v2.css','game/src/rework.css']:
    before=git('show',BASE+':'+name).decode('utf-8').replace('\r\n','\n')
    after=(ROOT/name).read_text(encoding='utf-8')
    clean=lambda text:re.sub(r'url\([^)]*\)','url(IMAGE)',text)
    assert clean(before)==clean(after),name+' changed outside url()'
before=git('show',BASE+':game/index.html').decode('utf-8').replace('\r\n','\n')
after=(ROOT/'game/index.html').read_text(encoding='utf-8')
clean=lambda text:re.sub(r'(assets/[^\s"\x27)]+)\.(?:png|jpg|webp)(?:\?v=[\w.-]+)?',r'\1.IMAGE',text)
assert clean(before)==clean(after),'index.html changed outside image paths'
if 'game/STATUS.md' in changed:
    before=git('show',BASE+':game/STATUS.md').decode('utf-8').replace('\r\n','\n')
    after=(ROOT/'game/STATUS.md').read_text(encoding='utf-8')
    assert after.endswith(before),'STATUS existing content changed'
result={'baseline':BASE,'branch':git('branch','--show-current').decode().strip(),'changedFiles':len(changed),'ownershipPass':True,'mainAndReworkOnlyImagePaths':True,'cssOnlyUrls':True,'indexOnlyImagePaths':True,'push':False,'deploy':False}
assert result['branch']=='codex/2026-10-12-D'
(ROOT/'docs/codex/measurements/D/ownership.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(result))
