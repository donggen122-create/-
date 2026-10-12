// Run the unchanged QA server with an in-memory WebP MIME extension on D's port only.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const original=path.join(root,'game/tools/qa/node-server.mjs');
process.env.PORT='8797';
process.env.SEOHO_QA_ROOT=root;
let source=fs.readFileSync(original,'utf8');
if (!source.includes("'.png':'image/png'")) throw new Error('QA MIME table changed; review shim');
source=source.replace("'.png':'image/png'", "'.webp':'image/webp','.png':'image/png'")
  .replaceAll('import.meta.url',JSON.stringify(pathToFileURL(original).href))
  .replace("from '../version-assets.mjs'",'from '+JSON.stringify(pathToFileURL(path.join(root,'game/tools/version-assets.mjs')).href));
await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
