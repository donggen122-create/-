// ASSET_VERSION is authored only in assets.js. Stamp parser/CSS URLs before builds.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function stampAssetVersions(root = game) {
  const version = fs.readFileSync(path.join(root,'src/assets.js'),'utf8').match(/export const ASSET_VERSION = "([^"]+)";/)?.[1];
  if (!version) throw new Error('ASSET_VERSION missing');
  for (const name of ['index.html','src/rework.css','src/ui-v2.css']) {
    const file = path.join(root,name), text = fs.readFileSync(file,'utf8');
    const stamped = text.replace(/((?:\.\/|\.\.\/)assets\/[\w./-]+\.(?:png|jpg|svg|woff2|mp3|ogg))(?:\?v=[\w.-]+)?/g, `$1?v=${version}`);
    if (text !== stamped) fs.writeFileSync(file, stamped);
  }
}
// Version immutable literal URLs in generated copies, including result markup owned by session A.
// Source files outside B's edit scope stay untouched.
export function versionStaticContent(text, version) {
  return text.replace(/((?:\.\/|\.\.\/)assets\/[\w./-]+\.(?:png|jpg|svg|woff2|mp3|ogg))(?:\?v=[\w.-]+)?/g, `$1?v=${version}`);
}
if (process.argv[2] === '--dist') {
  const dist=path.resolve(game,'../dist_web');
  const version=fs.readFileSync(path.join(game,'src/assets.js'),'utf8').match(/ASSET_VERSION = "([^"]+)"/)[1];
  const walk=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(js|css|html)$/.test(p))fs.writeFileSync(p,versionStaticContent(fs.readFileSync(p,'utf8'),version));}};
  walk(path.join(dist,'src')); // Generated game source only; never admin/share/server.
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) stampAssetVersions();
