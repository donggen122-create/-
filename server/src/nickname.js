import {validateNickname} from './banned-words.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function displayName(user){
 if(user.nickname_status==='approved'&&user.nickname)return user.nickname;
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('seoho-guardian-anonymous-v1:'+user.id)));
 return '수호대원 '+String(((hash[0]<<8)+hash[1])%100).padStart(2,'0');
}
export async function member(db,id){
 const u=await db.prepare('SELECT id,nickname,nickname_status,nickname_set_at,nickname_note,title FROM users WHERE id=?').bind(id).first();
 return {displayName:await displayName(u),nickname:u.nickname,status:u.nickname_status,note:u.nickname_note,title:u.title};
}
export async function nicknameAPI(request,db,id,now=Date.now()){
 let b;try{b=await request.json();}catch{return reply({error:'입력을 확인해 주세요.'},400);}
 const v=validateNickname(b.nickname,id);if(v.error)return reply(v,400);
 await db.prepare("UPDATE users SET nickname=?,nickname_status='pending',nickname_set_at=MAX(?,COALESCE(nickname_set_at,0)+1),nickname_note=NULL WHERE id=?").bind(v.nickname,now,id).run();
 return reply({ok:true,...(v.warning?{warning:v.warning}:{}),member:await member(db,id)});
}
export async function nicknamesAdmin(request,db,sub,method,now=Date.now()){
 if(sub==='nicknames'&&method==='GET'){
  const users=(await db.prepare("SELECT id,display_id,nickname,nickname_set_at FROM users WHERE nickname_status='pending' ORDER BY nickname_set_at LIMIT 200").all()).results;
  return reply({users});
 }
 if(sub==='nicknames/decide'&&method==='POST'){
  let b;try{b=await request.json();}catch{return reply({error:'입력을 확인해 주세요.'},400);}
  if(!['approved','rejected'].includes(b.status))return reply({error:'승인 또는 거절을 골라 주세요.'},400);
  const note=String(b.note||'').trim().slice(0,100);
  if(b.status==='rejected'&&!note)return reply({error:'거절 사유를 한 줄 적어 주세요.'},400);
  const r=await db.prepare("UPDATE users SET nickname_status=?,nickname_note=? WHERE id=? AND nickname_status='pending' AND nickname=? AND nickname_set_at=?").bind(b.status,note||null,String(b.id||''),String(b.nickname||''),b.setAt).run();
  return r.meta.changes?reply({ok:true}):reply({error:'요청이 바뀌었어요. 새로 불러 주세요.'},409);
 }
 return null;
}
