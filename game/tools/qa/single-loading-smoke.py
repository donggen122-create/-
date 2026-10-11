"""Verify inlined art at file://; all network requests restricted to isolated QA."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from browser import chrome_path
ROOT=Path(__file__).resolve().parents[3]
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,executable_path=chrome_path(),args=['--no-sandbox','--disable-gpu'])
    ctx=b.new_context()
    ctx.add_init_script("localStorage.setItem('lumen_api','http://localhost:8797/api');const original=window.fetch;window.fetch=(url,...a)=>String(url).startsWith('http://localhost:8797/')?original(url,...a):Promise.reject(new Error('QA refuses off-host fetch'))")
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(('file:','http://localhost:8797/')) else r.abort())
    page=ctx.new_page();errors=[];asset_requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:asset_requests.append(r.url) if r.url.startswith('http') and '/assets/' in r.url else None)
    page.goto((ROOT/'dist_single/LUMEN.html').as_uri(),wait_until='load',timeout=60000)
    page.wait_for_function('typeof __m!=="undefined"&&__m.main',timeout=60000)
    page.evaluate("__m.assets.loadBattleAssets(4,'minji',{ui2:true})")
    ready=page.evaluate("()=>({chapter4:__m.assets.CHAPTER_SPRITE_KEYS[4].every(k=>__m.assets.SPRITES[k].naturalWidth>0),images:Object.keys(__m.assets.SPRITES).length,embedded:Object.values(__m.assets.SPRITE_FILES).every(s=>s.startsWith('data:'))})")
    assert ready['chapter4'] and ready['embedded'] and not errors and not asset_requests
    report={**ready,'pageErrors':errors,'externalAssetRequests':asset_requests}
    (ROOT/'docs/codex/measurements/B/single-smoke.json').write_bytes(json.dumps(report,indent=2).encode())
    print(report);ctx.close();b.close()
