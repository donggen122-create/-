# 실서버 배포 한 번에: 검사 → Codex·다른 PC 배포 확인 → game/→dist_web 동기화(+공유 폴더 사본) → wrangler deploy → 버전 기록
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\deploy.ps1 -Message "what changed (영문 권장)"
#   -SkipTests : 검사 생략
#   -Force     : 마지막 배포가 이 저장소 기록과 달라도 배포(다른 PC 배포는 git pull, Codex 배포는 합친 뒤에만!)
# 배포 뒤에는 server/.last_deploy_version 이 바뀌므로 git commit·push 로 다른 PC와 공유한다.
param([Parameter(Mandatory = $true)][string]$Message, [switch]$SkipTests, [switch]$Force)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\env.ps1"
Require-Node
Set-Location $ProjectRoot

if (-not $SkipTests) {
  Write-Host "1/4 검사(node --test)…"
  $ErrorActionPreference = "Continue"
  node --test "tests/*.test.mjs" 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 8 | Write-Host
  $testCode = $LASTEXITCODE; $ErrorActionPreference = "Stop"
  if ($testCode -ne 0) { throw "검사 실패 — 배포하지 않았어요." }
}

Write-Host "2/4 마지막 배포 확인…"
& "$PSScriptRoot\check-live.ps1"
if ($LASTEXITCODE -ne 0 -and -not $Force) { throw "마지막 배포가 이 저장소 기록과 달라요. 다른 PC에서 배포했다면 git pull 후 다시, Codex 배포라면 check-live.ps1 -Pull 로 받아 합친 뒤 -Force 로 배포하세요." }

Write-Host "3/4 dist_web 동기화…"
& "$PSScriptRoot\sync-dist.ps1" -Share

Write-Host "4/4 배포…"
Push-Location (Join-Path $ProjectRoot "server")
if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
$ErrorActionPreference = "Continue"
$lines = npx wrangler deploy --message ($Message -replace '"', "'") 2>&1 | ForEach-Object { "$_" }
$ErrorActionPreference = "Stop"
Pop-Location
$out = $lines -join "`n"
$lines | Select-Object -Last 6 | Write-Host
$m = [regex]::Match($out, 'Current Version ID:\s*([0-9a-f\-]{36})')
if (-not $m.Success) { throw "배포 결과에서 버전 번호를 찾지 못했어요(배포 실패일 수 있음). 위 출력을 확인하세요." }
$ver = $m.Groups[1].Value
Set-Content -Path (Join-Path $ProjectRoot "server\.last_deploy_version") -Value $ver -NoNewline -Encoding ascii
Start-Sleep -Seconds 8   # 새 버전이 퍼지는 데 몇 초 걸린다(바로 확인하면 옛 응답이 올 수 있음)
try { $h = Invoke-WebRequest -Uri "https://seoho-pangpang.seoho-pangpang-server.workers.dev/api/health?nc=$(Get-Random)" -UseBasicParsing -TimeoutSec 30; Write-Host "실서버 응답: $($h.Content)" } catch { Write-Host "실서버 상태 확인 실패: $($_.Exception.Message)" -ForegroundColor Yellow }
Write-Host "배포 완료: $ver (server/.last_deploy_version 기록). git commit·push 로 다른 PC와 공유하세요." -ForegroundColor Green
