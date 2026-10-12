// Read-only generated bundle validation plus a small measured report.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const bundle=fs.readFileSync(path.join(root,'dist_single/LUMEN.html'),'utf8');
const literal=bundle.match(/var __ASSETS = (\{[\s\S]*?\n\});/)?.[1];
assert.ok(literal,'embedded table present');
const table=vm.runInNewContext('('+literal+')',{}, {timeout:10000});
const convert=JSON.parse(fs.readFileSync(path.join(root,'docs/codex/measurements/D/convert.json'),'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
let converted=0;
for(const row of convert.files.filter(row=>row.status==='converted')){
  const key=row.target.replace(/^game\/assets\//,'');
  assert.ok(table[key]?.startsWith('data:image/webp;base64,'),key);
  assert.equal(sha(Buffer.from(table[key].split(',')[1],'base64')),sha(fs.readFileSync(path.join(root,row.target))),key);
  converted++;
}
const mimeCounts={};
for(const value of Object.values(table)){const mime=value.match(/^data:([^;]+);/)?.[1];mimeCounts[mime]=(mimeCounts[mime]||0)+1;}
const result={success:true,bytes:fs.statSync(path.join(root,'dist_single/LUMEN.html')).size,convertedWebPDataURIs:converted,inlineConvertedSha256Pass:true,mimeCounts};
fs.writeFileSync(path.join(root,'docs/codex/measurements/D/build.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
