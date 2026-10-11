import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateNickname} from '../server/src/banned-words.js';
import {displayName} from '../server/src/nickname.js';
import {rankRuns,weekInfo,defaultWeeklyStage,titlesFor,rankingData,rankingAdmin} from '../server/src/ranking.js';
import {migrate} from '../server/src/guardian.js';
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec(fs.readFileSync(new URL('../server/schema.sql',import.meta.url),'utf8'));this.queries=[];this.returned=0;}
 prepare(sql){const db=this;return {args:[],bind(...args){this.args=args;return this;},async first(){db.queries.push(sql);const row=db.sql.prepare(sql).get(...this.args)||null;db.returned+=row?1:0;return row;},async all(){db.queries.push(sql);const results=db.sql.prepare(sql).all(...this.args);db.returned+=results.length;return {results};},async run(){db.queries.push(sql);return {meta:{changes:Number(db.sql.prepare(sql).run(...this.args).changes)}};}};}
 async batch(statements){this.sql.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());this.sql.exec('COMMIT');return r;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
test('nickname length characters trimmed case bans impersonation and warning',()=>{
 for(const value of ['a','abcdefghi','두 글','도원_','도원!','선생님2','관리자1','FuCk2','왕따','qaf'])assert.ok(validateNickname(value,'qaf').error,value);
 assert.equal(validateNickname(' 강바람 ','student').nickname,'강바람');
 assert.equal(validateNickname('김도원','student').warning,'실명은 쓰지 않는 게 좋아요');
 assert.ok(!validateNickname('맑은바람','student').warning);
});
test('100 students 1000 runs/day: weekly indexed range and cached query budget',async()=>{
 const db=new D1();await migrate(db);const now=Date.parse('2026-10-12T01:00Z'),week=weekInfo(now);
 for(let i=0;i<100;i++){
  const id='fixtureload'+i;
  db.sql.prepare("INSERT INTO users(id,display_id,pw_hash,salt,created_at) VALUES(?,?,'qa','qa',0)").run(id,id);
  db.sql.prepare('INSERT INTO guardian_profiles(user_id,state) VALUES(?,?)').run(id,JSON.stringify({runs:140}));
 }
 const insert=db.sql.prepare("INSERT INTO play_runs(id,user_id,stage,started_at,duration,status,settled_at,result) VALUES(?,?,?,0,300,'won',?,?)");
 db.sql.exec('BEGIN');for(let i=0;i<14000;i++){
  insert.run('volume'+i,'fixtureload'+i%100,'CH'+String(i%20+1).padStart(2,'0'),week.start+(i<7000?-7*86400000:0)+(i%7000)*60000,JSON.stringify({cleared:true,kills:100+i%500,litter:5}));
 }db.sql.exec('COMMIT');
 db.queries=[];db.returned=0;await rankingData(db,'fixtureload0',now);const cold={queries:db.queries.length,returnedRows:db.returned};
 assert.equal(cold.queries,6);
 const plan=db.sql.prepare("EXPLAIN QUERY PLAN SELECT id FROM play_runs INDEXED BY play_settled WHERE settled_at>=? AND settled_at<? AND status='won'").all(week.start,week.end).map(r=>r.detail).join(';');
 assert.match(plan,/SEARCH play_runs USING INDEX play_settled/);
 db.queries=[];db.returned=0;await rankingData(db,'fixtureload1',now+1000);const hot={queries:db.queries.length,returnedRows:db.returned};
 assert.equal(hot.queries,3);assert.equal(hot.returnedRows,101);
 console.log('F_QUERY_BUDGET '+JSON.stringify({students:100,dailyRuns:1000,fixtureRuns:14000,cold,hot,plan}));
});
test('anonymous name stable and never contains ID; only approved names public',async()=>{
 const u={id:'hiddenaccount',nickname:'새싹',nickname_status:'pending'};
 assert.equal(await displayName(u),await displayName({...u}));assert.match(await displayName(u),/^수호대원 \d{2}$/);
 assert.equal(await displayName({...u,nickname_status:'approved'}),'새싹');
});
test('KST Monday and ISO year edges; cycle starts 1-3',()=>{
 assert.equal(weekInfo(Date.parse('2026-10-11T14:59:59Z')).key,'2026-W41');
 assert.equal(weekInfo(Date.parse('2026-10-11T15:00:00Z')).key,'2026-W42');
 assert.equal(weekInfo(Date.parse('2027-01-03T14:59:59Z')).key,'2026-W53');
 assert.equal(weekInfo(Date.parse('2027-01-03T15:00:00Z')).key,'2027-W01');
 assert.equal(defaultWeeklyStage(Date.parse('2026-10-12T00:00Z')),'CH03');
 assert.equal(defaultWeeklyStage(Date.parse('2026-10-19T00:00Z')),'CH08');
});
const run=(id,kills,litter=0,at=1,extra={})=>({id:'run-'+id,user_id:id,stage:'CH03',status:'won',settled_at:at,result:{cleared:true,kills,litter,...extra}});
test('single best, ties litter then first timestamp; qa held and impossible excluded',()=>{
 const rows=[run('early',50,4,1),run('late',50,4,2),run('morelitter',50,5,3),run('most',51),run('most',1),run('qafoo',100),run('test1',100),run('held',100,0,1,{held:true}),run('bad',100,0,1,{flags:[{code:'kills',value:100,limit:10}]}),{...run('lost',300),status:'lost'}];
 assert.deepEqual(rankRuns(rows,'CH03').map(r=>r.id),['most','morelitter','early','late']);
});
test('cosmetic titles require boss clears, at least one run or prior winner',()=>{
 assert.deepEqual(titlesFor({bosses:['CH05','CH20'],runs:1,winner:true}).map(t=>t.id),['village','forest','weekly','first']);
 assert.deepEqual(titlesFor({}),[]);
});
test('old DB auto migration repeatable, private top10 and own12, hall goal and 60s cache',async()=>{
 const db=new D1();db.sql.exec('DROP INDEX play_flagged; ALTER TABLE play_runs DROP COLUMN flagged; ALTER TABLE users DROP COLUMN nickname; ALTER TABLE users DROP COLUMN nickname_status; ALTER TABLE users DROP COLUMN nickname_set_at; ALTER TABLE users DROP COLUMN nickname_note; ALTER TABLE users DROP COLUMN title;');
 await migrate(db);await migrate(db);
 const now=Date.parse('2026-10-12T01:00Z'),at=weekInfo(now).start+10;
 for(let i=0;i<12;i++){
  const id='fixture'+i;
  db.sql.prepare("INSERT INTO users(id,display_id,pw_hash,salt,created_at,nickname,nickname_status) VALUES(?,?,'qa','qa',0,?,?)").run(id,id,'맑은바람'+i,i<2?'approved':'pending');
  db.sql.prepare("INSERT INTO guardian_profiles(user_id,state) VALUES(?,?)").run(id,JSON.stringify({runs:2}));
  for(const [j,stage] of ['CH03','CH05'].entries())db.sql.prepare("INSERT INTO play_runs(id,user_id,stage,started_at,duration,status,settled_at,result) VALUES(?,?,?,0,300,'won',?,?)").run(id+'-'+j,id,stage,at+i,JSON.stringify({cleared:true,kills:100-i,litter:5}));
 }
 db.queries=[];const data=await rankingData(db,'fixture11',now),cold=db.queries.length;
 assert.equal(data.top.length,10);assert.equal(data.me.rank,12);assert.equal(data.hall[0].others,10);assert.equal(data.hall[0].names.length,2);assert.equal(data.cooperation.successes,24);assert.equal(data.cooperation.goal,300);
 assert.equal(data.titles.length,2);assert.ok(!JSON.stringify(data).includes('fixture'));assert.ok(!JSON.stringify(data).includes('pw_hash'));
 db.queries=[];await rankingData(db,'fixture10',now+1000);assert.equal(db.queries.length,3);assert.equal(cold,6);
 // Approved name is revoked immediately, even during weekly cache lifetime.
 db.sql.prepare("UPDATE users SET nickname_status='rejected' WHERE id='fixture0'").run();const updated=await rankingData(db,'fixture11',now+2000);assert.match(updated.top[0].name,/수호대원/);
 db.sql.prepare("DELETE FROM users WHERE id='fixture0'").run();
 const withoutDeleted=await rankingData(db,'fixture11',now+2500);assert.equal(withoutDeleted.top[0].kills,99);assert.equal(withoutDeleted.me.rank,11);
 const res=await rankingAdmin(new Request('http://localhost',{method:'POST',body:JSON.stringify({stage:'CH08',goal:12})}),db,'POST',now);assert.equal(res.status,200);
 const changed=await rankingData(db,'fixture11',now+3000);assert.equal(changed.stage,'CH08');assert.equal(changed.cooperation.goal,12);
 const next=await rankingData(db,'fixture11',now+7*86400000);assert.equal(next.stage,'CH08');assert.equal(next.cooperation.successes,0);
});
