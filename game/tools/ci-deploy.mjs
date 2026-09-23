// GitHub Actions 배포 도우미(.github/workflows/seoho-deploy.yml): deploy.ps1·sync-dist.ps1·check-live.ps1과 같은 일을 리눅스에서 한다.
// 사용: node game/tools/ci-deploy.mjs check [force] | sync | record <wrangler 출력 파일> | health
// 비밀값(Cloudflare 토큰)은 환경 변수로만 wrangler에 전달되고, 이 스크립트는 읽거나 출력하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const at = (...p) => path.join(root, ...p);
const LIVE = 'https://seoho-pangpang.seoho-pangpang-server.workers.dev';
const recordFile = at('server', '.last_deploy_version');

// check-live.ps1과 같은 정규식: wrangler deployments list의 마지막(가장 최근) 배포 버전
export function latestDeployment(text) {
  const blocks = [...text.matchAll(/Created:\s+(\S+)[\s\S]*?Version\(s\):\s+\(100%\)\s+([0-9a-f-]{36})[\s\S]*?Message:\s+([^\r\n]*)/g)];
  const last = blocks.at(-1);
  return last ? {created: last[1], version: last[2], message: last[3].trim()} : null;
}
// deploy.ps1과 같은 정규식: wrangler deploy 출력의 새 버전 번호
export function deployedVersion(text) { return text.match(/Current Version ID:\s*([0-9a-f-]{36})/)?.[1] || null; }

function mirror(from, to) { fs.rmSync(to, {recursive: true, force: true}); fs.cpSync(from, to, {recursive: true}); }
export function sync() {
  const g = at('game'), d = at('dist_web');
  for (const sub of ['src', 'assets', 'admin']) mirror(path.join(g, sub), path.join(d, sub));
  for (const f of ['index.html', 'ASSET_CREDITS.md']) fs.copyFileSync(path.join(g, f), path.join(d, f));
  for (const f of fs.readdirSync(d)) if (/^zz_.*\.html$/.test(f)) fs.rmSync(path.join(d, f));
  // 공유 폴더(/share/) 사본 — sync-dist.ps1 -Share와 같은 목록
  const s = path.join(d, 'share'), ss = path.join(s, 'server');
  fs.mkdirSync(ss, {recursive: true});
  for (const f of fs.readdirSync(at('server', 'src'))) if (f.endsWith('.js')) fs.copyFileSync(at('server', 'src', f), path.join(ss, f));
  for (const f of ['schema.sql', 'wrangler.toml', 'README.md']) fs.copyFileSync(at('server', f), path.join(ss, f));
  fs.copyFileSync(at('game', 'tools', 'check-live.ps1'), path.join(ss, 'check-live.ps1'));
  fs.copyFileSync(at('game', 'admin', 'index.html'), path.join(ss, 'admin_index.html'));
  fs.copyFileSync(at('game', 'admin', 'upload.html'), path.join(ss, 'admin_upload.html'));
  fs.copyFileSync(at('game', 'STATUS.md'), path.join(s, 'STATUS.md'));
  fs.copyFileSync(at('game', 'ASSET_CREDITS.md'), path.join(s, 'ASSET_CREDITS.md'));
  fs.copyFileSync(at('HANDOFF.md'), path.join(s, 'HANDOFF.md'));
  fs.copyFileSync(at('GPT_협업_브리핑.md'), path.join(s, 'briefing_for_gpt.md'));
  const plan = at('docs', '22_원소_스킬_체계_기획.md');
  if (fs.existsSync(plan)) { fs.mkdirSync(path.join(s, 'docs'), {recursive: true}); fs.copyFileSync(plan, path.join(s, 'docs', '22_env_skill_plan.md')); }
  console.log('dist_web 동기화 완료 (+ 공유 폴더 사본)');
}

function check(force) {
  const text = execFileSync('npx', ['wrangler', 'deployments', 'list'], {cwd: at('server'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  const live = latestDeployment(text), mine = fs.existsSync(recordFile) ? fs.readFileSync(recordFile, 'utf8').trim() : '';
  if (!live) { console.error('배포 목록을 읽지 못했어요.'); process.exit(2); }
  console.log(`마지막 배포: ${live.version} (${live.created}) 메시지: ${live.message}`);
  console.log(`저장소 기록: ${mine || '(없음)'}`);
  if (live.version === mine) { console.log('OK — 마지막 배포가 저장소 기록과 같아요.'); return; }
  const note = '마지막 배포가 저장소 기록과 달라요. 다른 PC 배포라면 그 기록을 먼저 올리고, Codex 배포라면 check-live.ps1 -Pull로 받아 합친 뒤 deploy-force- 태그로 배포하세요.';
  if (force) { console.log(`주의 — ${note} (강제 배포 태그라 계속합니다)`); return; }
  console.error(`::error::${note}`); process.exit(1);
}

function record(file) {
  const version = deployedVersion(fs.readFileSync(file, 'utf8'));
  if (!version) { console.error('::error::배포 결과에서 버전 번호를 찾지 못했어요(배포 실패일 수 있음).'); process.exit(1); }
  fs.writeFileSync(recordFile, version);
  console.log(`배포 버전 기록: ${version}`);
}

async function health() {
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try { const r = await fetch(`${LIVE}/api/health?nc=${Date.now()}`); const t = await r.text(); console.log(`실서버 응답 ${r.status}: ${t.slice(0, 200)}`); if (r.ok) return; } catch (e) { console.log(`실서버 확인 재시도: ${e.message}`); }
  }
  console.error('::error::실서버 상태 확인 실패'); process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'check') check(arg === 'true' || arg === 'force');
  else if (cmd === 'sync') sync();
  else if (cmd === 'record') record(arg);
  else if (cmd === 'health') await health();
  else { console.error('사용: check [force] | sync | record <파일> | health'); process.exit(2); }
}
