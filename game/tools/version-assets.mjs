// ASSET_VERSION is authored only in assets.js. Stamp parser/CSS URLs before builds.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function stampAssetVersions(root = game) {
  const version = fs.readFileSync(path.join(root,'src/assets.js'),'utf8').match(/export const ASSET_VERSION = "([^"]+)";/)?.[1];
  if (!version) throw new Error('ASSET_VERSION missing');
  for (const name of ['index.html','src/rework.css','src/ui-v2.css']) {
    const file = path.join(root,name), text = fs.readFileSync(file,'utf8');
    // D owns image paths in index.html; preserve its font/audio URLs byte for byte.
    const extensions = name === 'index.html' ? 'webp|png|jpg|svg' : 'webp|png|jpg|svg|woff2|mp3|ogg';
    const stamped = text.replace(new RegExp(`((?:\\./|\\.\\./)assets/[\\w./-]+\\.(?:${extensions}))(?:\\?v=[\\w.-]+)?`, 'g'), `$1?v=${version}`);
    if (text !== stamped) fs.writeFileSync(file, stamped);
  }
}
// Version immutable literal URLs in generated copies, including result markup owned by session A.
// Source files outside B's edit scope stay untouched.
export function versionStaticContent(text, version) {
  return text.replace(/((?:\.\/|\.\.\/)assets\/[\w./-]+\.(?:webp|png|jpg|svg|woff2|mp3|ogg))(?:\?v=[\w.-]+)?/g, `$1?v=${version}`);
}
const main=process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main && process.argv[2] === '--hash') {
  const version=fs.readFileSync(path.join(game,'src/assets.js'),'utf8').match(/ASSET_VERSION = "([^"]+)"/)[1];
  console.log(createHash('sha256').update(versionStaticContent(fs.readFileSync(process.argv[3],'utf8'),version)).digest('hex'));
}
if (main && process.argv[2] === '--dist') {
  const dist=path.resolve(game,'../dist_web');
  const version=fs.readFileSync(path.join(game,'src/assets.js'),'utf8').match(/ASSET_VERSION = "([^"]+)"/)[1];
  const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|css|html)$/.test(p))fs.writeFileSync(p,versionStaticContent(fs.readFileSync(p,'utf8'),version));}};
  walk(path.join(dist,'src')); // Generated game source only; never admin/share/server.
}
if (main && process.argv[2] !== '--hash') stampAssetVersions();
