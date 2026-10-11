// Never enabled on a public host. Synthetic aliases let a QA account test real
// ranking inclusion while ordinary qa/test accounts remain excluded.
import {invalidateRanking,weekInfo} from './ranking.js';
export async function qaRanking(request,env){
 const url=new URL(request.url);
 if(url.pathname!=='/_qa/runs'||request.method!=='POST')return null;
 if(env.LOCAL_TEST_CLOCK!=='true'||!['localhost','127.0.0.1'].includes(url.hostname)||request.headers.get('X-Admin-Key')!==env.ADMIN_KEY)return new Response('Not found',{status:404});
 const b=await request.json(),db=env.DB;
 if(!/^qafrank\d{2}$/.test(b.qaId||'')||!Number.isInteger(b.index)||b.index<0||b.index>=12)return Response.json({error:'QA fixture only'},{status:400});
 const id='fixturef'+String(b.index).padStart(2,'0');
 const source=await db.prepare('SELECT * FROM users WHERE id=?').bind(b.qaId).first();
 if(!source)return Response.json({error:'Register QA source first'},{status:400});
 const statements=[db.prepare("INSERT OR IGNORE INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,?,?,?)").bind(id,'시험번호'+String(b.index+1).padStart(2,'0'),source.pw_hash,source.salt,Date.now()),
 db.prepare("UPDATE users SET nickname=NULL,nickname_status='none',nickname_note=NULL,nickname_set_at=NULL,title=NULL WHERE id=?").bind(id),
 db.prepare('DELETE FROM play_runs WHERE user_id=?').bind(id),
 db.prepare('INSERT INTO guardian_profiles(user_id,state) SELECT ?,state FROM guardian_profiles WHERE user_id=? ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,revision=revision+1').bind(id,b.qaId)];
 for(const [i,r] of (b.runs||[]).entries()){
  if(!/^CH(0[1-9]|1[0-9]|20)$/.test(r.stage)||!['won','lost'].includes(r.status))return Response.json({error:'Invalid fixture'},{status:400});
  const at=weekInfo().start+60000+b.index*1000+i;
  statements.push(db.prepare('INSERT OR REPLACE INTO play_runs(id,user_id,stage,started_at,duration,status,settled_at,result,flagged) VALUES(?,?,?,?,?,?,?,?,?)').bind('fixturef-run-'+b.index+'-'+i,id,r.stage,at-300000,300,r.status,r.at??at,JSON.stringify(r.result),r.result.flags?.length?1:0));
 }
 await db.batch(statements);invalidateRanking(db);
 return Response.json({ok:true,syntheticId:id,display:'시험번호'+String(b.index+1).padStart(2,'0')});
}
