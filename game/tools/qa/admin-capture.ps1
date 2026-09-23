# 관리 페이지 캡처: 관리자(owner) 또는 선생님(teacher) 화면. 결과: game/tools/qa/out/<Name>.png (git에 안 올림)
# 비밀번호를 쓰지 않는다: server/.dev.vars 의 ADMIN_KEY(스크립트 열쇠)로 10분짜리 관리자 토큰을 만들고, 선생님 토큰은 서버 /api/admin/as-teacher 로 받는다.
# 실서버(-Base https://seoho-pangpang.seoho-pangpang-server.workers.dev)는 이 PC의 ADMIN_KEY가 실서버 값과 같을 때만 된다. 화면에 학생 아이디가 보이니 캡처는 사용자에게만 보낸다.
# 예) admin-capture.ps1 -Role teacher -Name admin_teacher ; admin-capture.ps1 -Role owner -Section teacher -Name admin_owner_teacherpanel ; -Phone 휴대폰 크기
param(
  [ValidateSet("owner", "teacher")][string]$Role = "teacher",
  [ValidateSet("top", "table", "teacher")][string]$Section = "top",
  [string]$Name = "", [string]$Base = "http://localhost:8797", [switch]$Phone
)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\env.ps1"
Require-Node
$vars = Join-Path $ProjectRoot "server\.dev.vars"
if (-not (Test-Path $vars)) { throw "server/.dev.vars 가 없어요(setup.ps1 실행)." }
$line = Get-Content $vars -Encoding UTF8 | Where-Object { $_ -match '^\s*ADMIN_KEY\s*=' } | Select-Object -First 1
$key = ($line -replace '^\s*ADMIN_KEY\s*=\s*', '').Trim().Trim('"')
if (-not $key) { throw "ADMIN_KEY가 비어 있어요." }

if ($Role -eq "owner") {
  $exp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 600000
  $h = New-Object System.Security.Cryptography.HMACSHA256 (, [Text.Encoding]::UTF8.GetBytes($key))
  $token = "$exp." + (-join ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes("admin-session:$exp")) | ForEach-Object { $_.ToString("x2") }))
} else {
  $r = Invoke-WebRequest -Uri "$Base/api/admin/as-teacher" -Method Post -Headers @{ "X-Admin-Key" = $key } -ContentType "application/json" -Body "{}" -UseBasicParsing -TimeoutSec 30
  $token = ($r.Content | ConvertFrom-Json).token
}
$key = $null
if (-not $Name) { $Name = "admin_$Role" + $(if ($Phone) { "_phone" } else { "" }) }
$outDir = Join-Path $PSScriptRoot "out"; New-Item -ItemType Directory -Force $outDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding $false
$js = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "admin-capture.js"), $enc).Replace("__TOKEN__", $token).Replace("__ROLE__", $Role).Replace("__SECTION__", $Section)
$case = Join-Path $env:TEMP ("seoho_admincap_" + [guid]::NewGuid().ToString("N") + ".js")
[IO.File]::WriteAllText($case, $js, $enc)
$argsList = @((Join-Path $ProjectRoot "game\tools\shot.cjs"), "--url", "$Base/admin/", "--out", (Join-Path $outDir "$Name.png"), "--evalfile", $case, "--wait", "2500", "--after", "900")
if ($Phone) { $argsList += "--phone" }
try { & node @argsList } finally { Remove-Item $case -Force -ErrorAction SilentlyContinue; $token = $null }   # 토큰이 들어 있으므로 바로 지운다
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-shot-*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
