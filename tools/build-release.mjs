import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './sync-public-server.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'dist_web');
await fs.mkdir(out,{recursive:true});
for(const name of ['index.html','src','assets','admin','robots.txt'])await fs.cp(path.join(root,'game',name),path.join(out,name),{recursive:true});
// Known public hand-off documents remain reachable after deployment.
const share=path.join(root,'share');
try{await fs.cp(share,path.join(out,'share'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
console.log('Built game, admin and assets in dist_web.');
