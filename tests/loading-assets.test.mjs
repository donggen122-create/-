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
    assert.deepEqual([...names].sort(),fs.readdirSync(path.join(root,`game/assets/${folder}/skills`)).filter(n=>n.endsWith('.png')).map(n=>n.slice(0,-4)).sort());
  }
});
test('HTML/CSS versions match the one asset version and static headers survive sync',()=>{
  const version=source.match(/ASSET_VERSION = "([^"]+)"/)[1];
  for(const file of ['index.html','src/rework.css','src/ui-v2.css']){
    const text=fs.readFileSync(path.join(root,'game',file),'utf8');
    for(const match of text.matchAll(/(?:\.\/|\.\.\/)assets\/[\w./-]+\.(?:png|jpg|svg|woff2)([^'"\s)]*)/g)) assert.equal(match[1],`?v=${version}`,`${file}: ${match[0]}`);
  }
  assert.match(fs.readFileSync(path.join(root,'dist_web/_headers'),'utf8'),/max-age=31536000, immutable/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/^dist_web\/$|_headers/m);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'game/tools/sync-dist.ps1'),'utf8'),/Remove-Item.*_headers/);
});
test('URL stamping is idempotent, keeps data URIs intact and versions generated result literals',()=>{
  const url=assetURL('./assets/ui/emblem.png');assert.equal(assetURL(url),url);
  assert.equal(assetURL('data:image/png;base64,AA=='),'data:image/png;base64,AA==');
  const markup='<img src="./assets/ui2/icons/cur_coin.png" />';
  assert.equal(versionStaticContent(markup,ASSET_VERSION),`<img src="./assets/ui2/icons/cur_coin.png?v=${ASSET_VERSION}" />`);
  assert.equal(versionStaticContent(versionStaticContent(markup,ASSET_VERSION),ASSET_VERSION),versionStaticContent(markup,ASSET_VERSION));
});
