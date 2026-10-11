const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stage=id=>{const n=Number(id.slice(2));return `${Math.ceil(n/5)}-${(n-1)%5+1}`;};
const flagNames={kills:'처치 수',kills_integer:'처치 수 형식',litter:'목표 수',seconds:'시간',hpFraction:'남은 체력',bossSeconds:'대왕 시간',bossSeconds_required:'대왕 시간 누락',perf_kills:'성능·처치 기록 확인',success_seconds:'성공 시간'};
const time=t=>new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
export function installRankingAdmin(api,isOwner,toast){
 const host=document.getElementById('online-panel');
 host.insertAdjacentHTML('beforebegin',`<div class="panel" id="ranking-settings-panel"><b>이번 주 단계 · 전교 협동 목표</b><form id="ranking-settings-form" class="row"><label>단계 <select id="ranking-stage"></select></label><label>목표 판 수 <input id="ranking-goal" type="number" min="1" max="100000" value="300" required></label><button>저장</button><span id="ranking-week"></span></form><div class="note">이번 주에만 단계가 바뀌어요. 협동 목표는 표시만 하며 보상은 없어요.</div></div><div class="panel" id="nicknames-panel"><b>닉네임 승인</b><div class="note">실명 대신 닉네임을 쓰도록 도와 주세요. 변경 요청은 다시 승인이 필요해요.</div><div class="tablewrap"><table><thead><tr><th>시험/학생 아이디</th><th>요청 닉네임</th><th>시각</th><th>사유 · 결정</th></tr></thead><tbody id="nicknames-body"></tbody></table></div></div><div class="panel" id="anomalies-panel"><b>이상 판</b><div class="note">깃발은 확인 참고용이에요. 불가능한 값만 보상이 보류돼요. 보상 지급·그대로 결정은 최고 관리자만 할 수 있어요.</div><div class="tablewrap"><table><thead><tr><th>시험/학생</th><th>단계</th><th>까닭</th><th>시각</th><th>보류 · 결정</th></tr></thead><tbody id="anomalies-body"></tbody></table></div></div>`);
 let nicknames=[],runs=[];
 const load=async()=>{
  const [n,a,s]=await Promise.all([api('nicknames'),api('anomalies'),api('ranking-settings')]);nicknames=n.users;runs=a.runs;
  document.getElementById('ranking-stage').innerHTML=s.stages.map(t=>`<option value="${esc(t.id)}" ${t.id===s.stage?'selected':''}>${esc(t.label)}</option>`).join('');
  document.getElementById('ranking-goal').value=s.goal;document.getElementById('ranking-week').textContent=s.week;
  document.getElementById('nicknames-body').innerHTML=nicknames.length?nicknames.map((u,i)=>`<tr><td>${esc(u.display_id)}</td><td>${esc(u.nickname)}</td><td>${esc(time(u.nickname_set_at))}</td><td><input id="nickname-note-${i}" maxlength="100" placeholder="거절 사유 한 줄" aria-label="${esc(u.nickname)} 거절 사유"><button data-nick="${i}" data-status="approved">승인</button><button data-nick="${i}" data-status="rejected">거절</button></td></tr>`).join(''):'<tr><td colspan="4">대기 중인 닉네임이 없어요.</td></tr>';
  document.getElementById('anomalies-body').innerHTML=runs.length?runs.map((r,i)=>`<tr><td>${esc(r.user)}</td><td>${stage(r.stage)}</td><td style="white-space:normal;max-width:320px">${r.flags.map(f=>`${esc(flagNames[f.code]||f.code)}: ${esc(f.value??'누락')} / ${esc(f.limit)}`).join('<br>')}</td><td>${esc(time(r.at))}</td><td>${r.held?'기록 확인 중':'보류 없음'} ${r.decision?`· ${r.decision==='release'?'지급 완료':'그대로'}`:isOwner()?`${r.held?`<button data-run="${i}" data-decision="release">보상 지급</button>`:''}<button data-run="${i}" data-decision="keep">그대로</button>`:'· 최고 관리자 확인'}</td></tr>`).join(''):'<tr><td colspan="5">확인할 판이 없어요.</td></tr>';
 };
 document.getElementById('ranking-settings-form').onsubmit=async e=>{e.preventDefault();try{await api('ranking-settings',{stage:document.getElementById('ranking-stage').value,goal:Number(document.getElementById('ranking-goal').value)});await load();toast('이번 주 설정을 저장했어요.');}catch(e){toast(e.message);}};
 document.getElementById('nicknames-body').onclick=async e=>{
  const b=e.target.closest('[data-nick]');if(!b)return;const u=nicknames[Number(b.dataset.nick)];
  b.disabled=true;try{await api('nicknames/decide',{id:u.id,nickname:u.nickname,setAt:u.nickname_set_at,status:b.dataset.status,note:document.getElementById('nickname-note-'+b.dataset.nick).value});await load();toast('결정을 저장했어요.');}catch(e){toast(e.message);b.disabled=false;}
 };
 document.getElementById('anomalies-body').onclick=async e=>{
  const b=e.target.closest('[data-run]');if(!b||!isOwner())return;
  b.disabled=true;try{await api('anomalies/release',{runId:runs[Number(b.dataset.run)].id,decision:b.dataset.decision});await load();toast('결정을 저장했어요.');}catch(e){toast(e.message);b.disabled=false;}
 };
 return load;
}
