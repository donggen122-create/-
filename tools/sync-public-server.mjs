// Publish only reviewed source/config files, never secrets or runtime databases.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'share/server');
await fs.mkdir(out,{recursive:true});
for(const name of await fs.readdir(path.join(root,'server/src'))){
 if(name.endsWith('.js'))await fs.copyFile(path.join(root,'server/src',name),path.join(out,name));
}
for(const name of ['wrangler.toml','schema.sql','README.md'])await fs.copyFile(path.join(root,'server',name),path.join(out,name));
try{await fs.cp(path.join(root,'server/migrations'),path.join(out,'migrations'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.copyFile(path.join(root,'game/admin/index.html'),path.join(out,'admin_index.html'));
console.log('Synced reviewed server source and admin UI into share/server.');
