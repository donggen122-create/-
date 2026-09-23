# game/ → dist_web/ 복사(서버가 서빙하는 배포 사본). deploy.ps1·dev-server.ps1이 자동으로 부른다.
# dist_web의 src·assets·admin·index.html·ASSET_CREDITS.md는 git에 올리지 않는 "만들어지는 것"이고, dist_web/share·robots.txt만 원본이다.
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\sync-dist.ps1 [-Share]
#   -Share : 공유 폴더(/share/)의 사본(서버 원본·관리 페이지·STATUS·HANDOFF·브리핑)도 새로 고친다(배포 때).
param([switch]$Share)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\env.ps1"
$g = Join-Path $ProjectRoot "game"; $d = Join-Path $ProjectRoot "dist_web"

# 폴더는 거울처럼 맞춘다(game에서 지운 파일은 dist_web에서도 지워짐)
foreach ($sub in @("src", "assets", "admin")) {
  robocopy (Join-Path $g $sub) (Join-Path $d $sub) /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "복사 실패: game\$sub → dist_web\$sub (robocopy $LASTEXITCODE)" }
}
Copy-Item (Join-Path $g "index.html"), (Join-Path $g "ASSET_CREDITS.md") $d -Force
Get-ChildItem $d -Filter "zz_*.html" -File -ErrorAction SilentlyContinue | Remove-Item -Force   # 캡처하다 남은 임시 페이지

if ($Share) {
  $s = Join-Path $d "share"; $ss = Join-Path $s "server"
  New-Item -ItemType Directory -Force $ss | Out-Null
  Copy-Item (Join-Path $ProjectRoot "server\src\*.js") $ss -Force
  foreach ($f in @("schema.sql", "wrangler.toml", "README.md")) { Copy-Item (Join-Path $ProjectRoot "server\$f") $ss -Force }
  Copy-Item (Join-Path $PSScriptRoot "check-live.ps1") $ss -Force
  Copy-Item (Join-Path $g "admin\index.html") (Join-Path $ss "admin_index.html") -Force
  Copy-Item (Join-Path $g "admin\upload.html") (Join-Path $ss "admin_upload.html") -Force
  Copy-Item (Join-Path $g "STATUS.md") (Join-Path $s "STATUS.md") -Force
  Copy-Item (Join-Path $g "ASSET_CREDITS.md") (Join-Path $s "ASSET_CREDITS.md") -Force
  Copy-Item (Join-Path $ProjectRoot "HANDOFF.md") (Join-Path $s "HANDOFF.md") -Force
  Copy-Item (Join-Path $ProjectRoot "GPT_협업_브리핑.md") (Join-Path $s "briefing_for_gpt.md") -Force
  $plan = Join-Path $ProjectRoot "docs\22_원소_스킬_체계_기획.md"
  if (Test-Path $plan) { New-Item -ItemType Directory -Force (Join-Path $s "docs") | Out-Null; Copy-Item $plan (Join-Path $s "docs\22_env_skill_plan.md") -Force }
}
$global:LASTEXITCODE = 0
Write-Host ("dist_web 동기화 완료" + $(if ($Share) { " (+ 공유 폴더 사본)" } else { "" }))
