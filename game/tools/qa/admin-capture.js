// 관리 페이지 캡처(shot.cjs --evalfile): 로그인 창에 비밀번호를 넣지 않고, admin-capture.ps1이 만든 짧은 토큰으로 바로 들어간다.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
TOKEN = "__TOKEN__"; ROLE = "__ROLE__";
sessionStorage.setItem("seoho_admin_token", TOKEN); sessionStorage.setItem("seoho_admin_role", ROLE);
await enter();
await wait(800);
if ("__SECTION__" === "teacher") { const d = document.querySelector("#teacher-panel"); if (d && !d.hidden) { d.open = true; d.scrollIntoView({ block: "center" }); } }
else if ("__SECTION__" === "table") { document.querySelector("#tbl")?.scrollIntoView({ block: "start" }); }
await wait(400);
