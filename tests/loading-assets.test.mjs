import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {versionStaticContent} from '../game/tools/version-assets.mjs';
import {assetURL,ASSET_VERSION} from '../game/src/assets.js';
import {T1_ENEMIES,T2_ENEMIES,T3_ENEMIES,T4_ENEMIES,T1_BOSS,T2_BOSS,T3_BOSS,T4_BOSS} from '../game/src/themes.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'game/src/assets.js'),'utf8');
// Browser-independent manifest: execute only declarations, no browser/audio setup.
const prefix=source.slice(source.indexOf('const IMG_BASE'),source.indexOf('const imageCache'));
const manifest=vm.runInNewContext(prefix.replace(/^export /gm,'')+';({SPRITE_FILES,HERO_FILES,CHAPTER_SPRITE_KEYS,COMMON_SPRITE_KEYS,ELEMENT_SKILL_NAMES,UI2_SKILL_NAMES})',{Image:class{}});

test('each chapter includes all enemy frames, props, floors and boss effects, including chapter 3 shared shot',()=>{
  for(let n=1;n<=4;n++){
    const keys=new Set([...manifest.COMMON_SPRITE_KEYS,...manifest.CHAPTER_SPRITE_KEYS[n]]);
    const refs=[];
    const visit=o=>{if(typeof o==='string'&&/^(t[1-4]_|item_)/.test(o))refs.push(o);else if(o&&typeof o==='object')Object.values(o).forEach(visit);};
    visit([T1_ENEMIES,T2_ENEMIES,T3_ENEMIES,T4_ENEMIES][n-1]);
    visit([T1_BOSS,T2_BOSS,T3_BOSS,T4_BOSS][n-1]);
    for(const key of Object.keys(manifest.SPRITE_FILES).filter(k=>k.startsWith(`t${n}_`))) refs.push(key);
    for(const key of refs){assert.ok(keys.has(key),`chapter ${n}: ${key}`);assert.ok(fs.existsSync(path.join(root,'game',manifest.SPRITE_FILES[key])));}
  }
  assert.ok(manifest.CHAPTER_SPRITE_KEYS[3].includes('t1_fx_trashball'));
  assert.ok(!manifest.CHAPTER_SPRITE_KEYS[1].some(k=>/^t[234]_/.test(k)));
});
test('common effect manifest covers every original/UI2 effect file',()=>{
  for(const [folder,names] of [['sprites',manifest.ELEMENT_SKILL_NAMES],['ui2',manifest.UI2_SKILL_NAMES]]){
    assert.deepEqual([...names].sort(),fs.readdirSync(path.join(root,`game/assets/${folder}/skills`)).filter(n=>/\.(png|webp)$/.test(n)).map(n=>n.replace(/\.(png|webp)$/,'')).sort());
  }
});
test('HTML/CSS versions match the one asset version and static headers survive sync',()=>{
  const version=source.match(/ASSET_VERSION = "([^"]+)"/)[1];
  for(const file of ['index.html','src/rework.css','src/ui-v2.css']){
    const text=fs.readFileSync(path.join(root,'game',file),'utf8');
    for(const match of text.matchAll(/(?:\.\/|\.\.\/)assets\/[\w./-]+\.(?:webp|png|jpg|svg|woff2)([^'"\s)]*)/g)) {
      if(file==='index.html' && match[0].includes('.woff2'))continue; // D owns only index image paths.
      assert.equal(match[1],`?v=${version}`,`${file}: ${match[0]}`);
    }
  }
  assert.match(fs.readFileSync(path.join(root,'dist_web/_headers'),'utf8'),/max-age=31536000, immutable/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/^dist_web\/$|_headers/m);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'game/tools/sync-dist.ps1'),'utf8'),/Remove-Item.*_headers/);
});

test('D converted and retained image references exist and match the explicit PNG/JPG allowlist',()=>{
  const report=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/measurements/D/convert.json'),'utf8'));
  const before=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/measurements/D/inventory-D-before.json'),'utf8'));
  // Second pass (Claude, assets-diet-lossy.py): lossless WebP with hidden RGB discarded over D's retained files.
  const second=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/measurements/D/convert-claude.json'),'utf8'));
  for(const row of second.files){
    if(row.status!=='convert')continue;
    const d=report.files.find(r=>r.source==='game/'+row.source);
    if(d)Object.assign(d,{status:'converted',target:'game/'+row.webp,beforeBytes:row.before,afterBytes:row.after,alphaExact:row.chosen.alphaMax===0,maxChannelDelta:row.chosen.max,lossless:row.chosen.lossless});
  }
  const rows=new Map(report.files.map(row=>[row.source,row]));
  const allowed=new Set(report.files.filter(row=>row.status!=='converted').map(row=>row.source));
  assert.equal(ASSET_VERSION,'20261012d2');
  for(const original of Object.keys(before.references)){
    const row=rows.get(original);
    assert.ok(fs.existsSync(path.join(root,row?.target||original)),original);
    if(row?.status==='converted'){
      assert.ok(!fs.existsSync(path.join(root,original)),`original not removed: ${original}`);
      assert.ok(row.afterBytes<=row.beforeBytes*.8,original);
      assert.equal(row.alphaExact,true,original);
      assert.ok(row.maxChannelDelta<=24,original);
      if(row.lossless) assert.equal(row.maxChannelDelta,0,original);
    }
  }
  const files=[...fs.readdirSync(path.join(root,'game/src')).filter(n=>/\.(js|css)$/.test(n)).map(n=>'game/src/'+n),'game/index.html',...fs.readdirSync(path.join(root,'game/admin')).filter(n=>/\.(js|css|html)$/.test(n)).map(n=>'game/admin/'+n)];
  for(const file of files){
    const text=fs.readFileSync(path.join(root,file),'utf8').replace(/^\s*\/\/.*$/gm,'');
    const refs=[...text.matchAll(/(?:\.?\.?\/)?assets\/([\w./-]+\.(?:webp|png|jpe?g|svg))/g)].map(m=>'game/assets/'+m[1]);
    if(file==='game/src/assets.js')for(const m of text.matchAll(/(IMG_BASE|UI_BASE)\s*\+\s*"([^"]+)"/g))refs.push('game/assets/'+(m[1]==='IMG_BASE'?'sprites/':'ui/')+m[2]);
    for(const ref of refs){
      // Exception-table WebP keys are virtual URLs, resolved to their retained original by assetURL.
      if(ref.endsWith('.webp')&&!fs.existsSync(path.join(root,ref))){
        assert.equal(file,'game/src/assets.js',`${file}: static URL cannot use a virtual exception ${ref}`);
        const resolved=assetURL('./'+ref.replace(/^game\//,''));
        assert.notEqual(resolved.split('?')[0],'./'+ref.replace(/^game\//,''),ref);
        assert.ok(fs.existsSync(path.join(root,'game',resolved.split('?')[0])),ref);
      }else assert.ok(fs.existsSync(path.join(root,ref)),`${file}: ${ref}`);
      // Story portraits (E) are cut into game/assets/story/ outside the diet passes.
      if(/\.(png|jpe?g)$/.test(ref))assert.ok(allowed.has(ref)||ref.startsWith('game/assets/story/'),`${file}: outside allowlist ${ref}`);
    }
  }
});

test('WebP version stamping is idempotent and preserves query/hash and data URI content',()=>{
  const url='./assets/ui2/icons/cur_coin.webp?mode=large&v=old#icon';
  const expected=`./assets/ui2/icons/cur_coin.webp?mode=large&v=${ASSET_VERSION}#icon`;
  assert.equal(assetURL(url),expected);
  assert.equal(assetURL(expected),expected);
  assert.equal(assetURL('data:image/webp;base64,AAAA'),'data:image/webp;base64,AAAA');
  assert.equal(versionStaticContent('./assets/ui2/bg_hq.webp?v=old',ASSET_VERSION),`./assets/ui2/bg_hq.webp?v=${ASSET_VERSION}`);
});
test('URL stamping is idempotent, keeps data URIs intact and versions generated result literals',()=>{
  const url=assetURL('./assets/ui/emblem.png');assert.equal(assetURL(url),url);
  assert.equal(assetURL('data:image/png;base64,AA=='),'data:image/png;base64,AA==');
  const markup='<img src="./assets/ui2/icons/cur_coin.png" />';
  assert.equal(versionStaticContent(markup,ASSET_VERSION),`<img src="./assets/ui2/icons/cur_coin.png?v=${ASSET_VERSION}" />`);
  assert.equal(versionStaticContent(versionStaticContent(markup,ASSET_VERSION),ASSET_VERSION),versionStaticContent(markup,ASSET_VERSION));
});
