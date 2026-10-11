// Teacher review remains required; normalize case and reject substrings so
// attaching digits does not bypass the list. Keep the list out of student UI.
export const BANNED_WORDS = ['시발','씨발','씨팔','시팔','병신','븅신','지랄','개새','새끼','좆','보지','자지','섹스','강간','창녀','장애인','찐따','왕따','fuck','shit','bitch','sex','admin','teacher','선생님','관리자','교장','운영자'];
export function validateNickname(value,id){
 const nickname=typeof value==='string'?value.trim():'';
 if(!/^[가-힣a-zA-Z0-9]{2,8}$/.test(nickname))return {error:'닉네임은 한글·영문·숫자로 2~8자 적어 주세요.'};
 const lower=nickname.toLowerCase();
 if(lower===String(id).toLowerCase()||BANNED_WORDS.some(w=>lower.includes(w)))return {error:'다른 닉네임을 골라 주세요.'};
 return {nickname,...(/^[가-힣]{3}$/.test(nickname)?{warning:'실명은 쓰지 않는 게 좋아요'}:{})};
}
