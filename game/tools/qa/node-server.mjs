// Isolated QA only: actual Worker handlers + in-memory SQLite binding. No production credentials.
// Never part of dist_web/src or production routes. Bind loopback, refuse non-loopback clients.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SEOHO_QA_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const port=Number(process.env.PORT||8797);
const worker=(await import(pathToFileURL(path.join(root,'server/src/index.js')))).default;
const {migrate}=await import(pathToFileURL(path.join(root,'server/src/guardian.js')));
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(path.join(root,'server/schema.sql'),'utf8'));}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(key){const row=db.sql.prepare(sql).get(...this.args)||null;return key?row?.[key]:row;},async all(){return {results:db.sql.prepare(sql).all(...this.args)};},async run(){return {success:true,meta:{changes:Number(db.sql.prepare(sql).run(...this.args).changes)}};}};}
 async batch(statements){this.sql.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());this.sql.exec('COMMIT');return out;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const DB=new D1();await migrate(DB);
// QA credentials are generated locally, ignored by git, and never read from production .dev.vars.
const varsPath=path.join(root,'game/tools/qa/.dev.vars');
if(!fs.existsSync(varsPath))fs.writeFileSync(varsPath,`ADMIN_ID=qa-admin\nADMIN_PW=${crypto.randomUUID()}\nADMIN_KEY=${crypto.randomUUID()}\nTEACHER_ID=qa-teacher\nTEACHER_PW=${crypto.randomUUID()}\n`);
const localSecrets=Object.fromEntries(fs.readFileSync(varsPath,'utf8').split(/\r?\n/).filter(s=>/^(ADMIN_KEY|ADMIN_ID|ADMIN_PW|TEACHER_ID|TEACHER_PW)=/.test(s)).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const assetRoot=path.join(root,'game');
const env={DB,...localSecrets,LOCAL_TEST_CLOCK:'true',ASSETS:{async fetch(request){let name=decodeURIComponent(new URL(request.url).pathname);if(name.endsWith('/'))name+='index.html';const file=path.resolve(assetRoot,'.'+name);if(!file.startsWith(assetRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});return new Response(fs.readFileSync(file),{headers:{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}});}}};
// Browser markup injection is tested against real Workers separately; preserve presence script in this local adapter.
globalThis.HTMLRewriter=class {on(){return this;} transform(response){return new Response(new ReadableStream({async start(controller){const text=await response.text();controller.enqueue(new TextEncoder().encode(text.replace('</body>','<script src="/presence.js?v=1" defer></script></body>')));controller.close();}}),{headers:response.headers,status:response.status});}};
http.createServer(async(req,res)=>{
 try{
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)){res.writeHead(403);res.end();return;}
  const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
  const qaUrl=new URL(req.url,'http://localhost');
  if(qaUrl.pathname==='/_qa/runs'&&req.method==='GET'){
   const id=qaUrl.searchParams.get('id');if(!/^qa[a-z0-9_]{0,10}$/.test(id||''))throw new Error('QA IDs only');
   res.setHeader('content-type','application/json');res.end(JSON.stringify(DB.sql.prepare('SELECT stage,status,result FROM play_runs WHERE user_id=? ORDER BY started_at,rowid').all(id)));return;
  }
  if(req.url==='/_qa/stats-fixture'&&req.method==='POST'){
   // Entirely synthetic, anonymous aggregation fixture; never register/login these IDs.
   const now=Date.now(),buckets=[320,375,768,1024,1280,1600],base={v:'qa-synthetic',fps:55,p1:25,long33:.03,long50:.0123,q:2,qmax:3,ratio:.85,dev:'tablet',w:1024,h:768,dpr:1.5,sec:180};
   for(let i=0;i<120;i++){const id='fixture'+i;DB.sql.prepare("INSERT OR IGNORE INTO users(id,display_id,salt,pw_hash,created_at) VALUES(?,'synthetic','qa','qa',?)").run(id,now);DB.sql.prepare('INSERT OR REPLACE INTO guardian_profiles(user_id,state) VALUES(?,?)').run(id,JSON.stringify({stages:Object.fromEntries(Array.from({length:i%20},(_,j)=>['CH'+String(j+1).padStart(2,'0'),{cleared:true}]))}));}
   for(let i=0;i<5000;i++){const stage='CH'+String(i%20+1).padStart(2,'0'),won=i%3===0,event={loadout:{difficulty:['easy','normal','hard'][i%3]},perf:{...base,dev:['phone','tablet','pc'][i%3],w:buckets[Math.floor(i/3)%6],h:buckets[Math.floor(i/18)%6]},...(!won?{cause:{id:'zone',kind:'hazard',at:60}}:{})};DB.sql.prepare('INSERT OR REPLACE INTO play_runs(id,user_id,stage,started_at,duration,status,result) VALUES(?,?,?,?,?,?,?)').run('fixture-run'+i,'fixture'+i%120,stage,now,180,won?'won':'lost',JSON.stringify(event));}
   res.setHeader('content-type','application/json');res.end('{"ok":true,"students":120,"runs":5000,"synthetic":true}');return;
  }
  // 자동 조종 모의는 판마다 새 계정을 만든다 → 가입·로그인 시도 제한(한 시간)을 비운다(격리 서버 전용)
  if(req.url==='/_qa/reset-attempts'&&req.method==='POST'){DB.sql.prepare('DELETE FROM attempts').run();res.setHeader('content-type','application/json');res.end('{"ok":true}');return;}
  if(req.url==='/_qa/profile'&&req.method==='POST'){
   const {id,profile}=JSON.parse(body);if(!/^(qa|확인대원)/.test(id))throw new Error('QA IDs only');
   DB.sql.prepare('INSERT INTO guardian_profiles(user_id,state) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,revision=revision+1').run(id,JSON.stringify(profile));
   DB.sql.prepare("UPDATE play_runs SET status='expired' WHERE user_id=? AND status='active'").run(id);
   res.setHeader('content-type','application/json');res.end('{"ok":true}');return;
  }
  const request=new Request(`http://localhost:${port}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}: {})});
  const response=await worker.fetch(request,env);res.statusCode=response.status;
  for(const [k,v]of response.headers)if(k!=='set-cookie')res.setHeader(k,v);const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){console.error(e);res.statusCode=500;res.end(String(e));}
}).listen(port,'127.0.0.1',()=>console.log(`QA-only server http://localhost:${port}; in-memory records`));
