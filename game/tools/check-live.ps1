# 배포 전 확인: 실서버(Cloudflare Worker seoho-pangpang)의 마지막 배포가 내 것인지 본다.
# Codex(ChatGPT)도 같은 Worker에 배포하므로, 마지막 배포가 내 것이 아니면 상대 변경을 먼저 합쳐야 한다(HANDOFF.md).
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File game/tools/check-live.ps1 [-Pull]
#   -Pull : 마지막 배포가 내 것이 아닐 때 그 버전의 주요 파일을 %TEMP%\seoho_live_<버전8자>\ 에 내려받고 game/ 과 다른 파일을 표시한다.
param([switch]$Pull)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))   # 프로젝트 루트
if (Test-Path (Join-Path $PSScriptRoot "env.ps1")) { . (Join-Path $PSScriptRoot "env.ps1") }       # node 찾기(PC마다 설치 위치가 달라도 됨)
# server/.last_deploy_version = 이 저장소(모든 PC 공용)에서 마지막으로 배포한 버전. 배포 뒤 git commit·push, 작업 전 git pull 로 PC끼리 맞춘다.
$mineFile = Join-Path $root "server\.last_deploy_version"
$mine = if (Test-Path $mineFile) { (Get-Content $mineFile -Raw).Trim() } else { "" }

Push-Location (Join-Path $root "server")
$txt = (npx wrangler deployments list 2>&1 | Out-String)
Pop-Location
$blocks = [regex]::Matches($txt, 'Created:\s+(\S+)[\s\S]*?Version\(s\):\s+\(100%\)\s+([0-9a-f\-]{36})[\s\S]*?Message:\s+([^\r\n]*)')
if ($blocks.Count -eq 0) { Write-Host "배포 목록을 읽지 못했습니다:`n$txt"; exit 2 }
$last = $blocks[$blocks.Count - 1]
$ver = $last.Groups[2].Value; $created = $last.Groups[1].Value; $msg = $last.Groups[3].Value.Trim()
$kst = ([DateTime]::Parse($created)).ToUniversalTime().AddHours(9).ToString("MM-dd HH:mm")
Write-Host "마지막 배포: $ver  ($kst KST)  메시지: $msg"
Write-Host "내 마지막 배포: $(if ($mine) { $mine } else { '(기록 없음)' })"
if ($mine -and $ver -eq $mine) { Write-Host "OK — 마지막 배포가 내 것입니다. 배포해도 됩니다." -ForegroundColor Green; exit 0 }

Write-Host "주의 — 마지막 배포가 이 저장소 기록과 다릅니다. 다른 PC에서 배포했다면 git pull 후 다시 확인하고, 아니면 Codex 배포일 수 있으니 먼저 합치세요." -ForegroundColor Yellow
$pv = "https://$($ver.Substring(0,8))-seoho-pangpang.seoho-pangpang-server.workers.dev"
Write-Host "미리보기 주소: $pv/   (공유 폴더: $pv/share/)"
if (-not $Pull) { exit 1 }

$dst = Join-Path $env:TEMP ("seoho_live_" + $ver.Substring(0, 8))
New-Item -ItemType Directory -Force $dst | Out-Null
$files = @("index.html", "admin/index.html", "share/index.html", "share/briefing_for_gpt.md", "share/STATUS.md", "share/HANDOFF.md") +
  ((Get-ChildItem (Join-Path $root "game\src") -Filter *.js | ForEach-Object { "src/" + $_.Name }))
foreach ($f in $files) {
  $out = Join-Path $dst ($f -replace '/', '\'); New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null
  $u = if ($f -eq "index.html") { "$pv/" } elseif ($f -eq "share/index.html") { "$pv/share/" } else { "$pv/$f" }
  $code = curl.exe -s -L -o "$out.dl" -w "%{http_code}" -m 60 $u
  if ($code -eq "200") { Move-Item "$out.dl" $out -Force } else { continue }
  $local = if ($f -like "share/*" -or $f -eq "admin/index.html") { Join-Path $root ("dist_web\" + ($f -replace '/', '\')) } else { Join-Path $root ("game\" + ($f -replace '/', '\')) }
  $st = if (-not (Test-Path $local)) { "NEW (내 쪽에 없음)" } elseif ((Get-FileHash $out -Algorithm MD5).Hash -eq (Get-FileHash $local -Algorithm MD5).Hash) { "same" } else { "DIFFERENT" }
  Write-Host ("{0,-32} {1}" -f $f, $st)
}
# 상대가 새 모듈을 추가했는지: 내려받은 index.html·main.js에서 import 되는 src 파일명 확인
$txt2 = ""; foreach ($f in @("index.html", "src\main.js")) { $p = Join-Path $dst $f; if (Test-Path $p) { $txt2 += [IO.File]::ReadAllText($p) } }
$mods = [regex]::Matches($txt2, 'from\s+"\./([\w.\-]+)\.js"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
foreach ($m in $mods) { if (-not (Test-Path (Join-Path $root "game\src\$m.js"))) { Write-Host "새 모듈(내 쪽에 없음): src/$m.js  → $pv/src/$m.js" -ForegroundColor Yellow } }
Write-Host "내려받은 위치: $dst"
exit 1
