# 화면 캡처(헤드리스 Edge, game/tools/shot.cjs). 결과: game/tools/qa/out/<Name>.png (git에 안 올림)
# 예) 로컬 로비 PC·휴대폰:  capture.ps1 -Kind lobby -Name lobby_pc ;  capture.ps1 -Kind lobby -Name lobby_phone -Phone
#     로컬 전투(스킬 넣기):   capture.ps1 -Kind battle -Name evo -Skills "['EVO_F1','EVO_W1']" -Supports "{S5:3}" -Play 1.6 -Zoom
#     실서버(로비·출동만):    capture.ps1 -Kind start -Base https://seoho-pangpang.seoho-pangpang-server.workers.dev -User <임시계정> -Pw <비번> -Phone
#       실서버 임시 계정은 확인 뒤 반드시 삭제(관리 API /api/admin/delete).
# 로컬 계정 기본값 테스트/1234(로컬 서버에서 가입해 둔 것). battle·special은 로컬(localhost)에서만 된다.
param(
  [ValidateSet("lobby", "book", "start", "battle", "special")][string]$Kind = "lobby",
  [string]$Name = "",
  [string]$Base = "http://localhost:8797",
  [string]$User = "테스트", [string]$Pw = "1234",
  [ValidateSet("easy", "normal", "hard")][string]$Diff = "normal",
  [string]$Stage = "CH01", [ValidateSet("melee", "ranged")][string]$Mode = "melee",
  [string]$Skills = "[]", [string]$Supports = "{}", [string]$Play = "1.5",
  [switch]$Phone, [switch]$Zoom
)
. "$PSScriptRoot\..\env.ps1"
Require-Node
$outDir = Join-Path $PSScriptRoot "out"; New-Item -ItemType Directory -Force $outDir | Out-Null
if (-not $Name) { $Name = "$Kind" + $(if ($Phone) { "_phone" } else { "" }) }
$enc = New-Object System.Text.UTF8Encoding $false
$js = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "capture.js"), $enc)
foreach ($kv in @(@("__KIND__", $Kind), @("__DIFF__", $Diff), @("__SKILLS__", $Skills), @("__SUPPORTS__", $Supports), @("__PLAY__", $Play), @("__STAGE__", $Stage), @("__MODE__", $Mode), @("__UID__", $User), @("__UPW__", $Pw))) { $js = $js.Replace($kv[0], $kv[1]) }
$case = Join-Path $env:TEMP ("seoho_capture_" + [guid]::NewGuid().ToString("N") + ".js")
[IO.File]::WriteAllText($case, $js, $enc)
$out = Join-Path $outDir "$Name.png"
$argsList = @((Join-Path $ProjectRoot "game\tools\shot.cjs"), "--url", "$Base/", "--out", $out, "--evalfile", $case, "--wait", "3500", "--after", "900")
if ($Phone) { $argsList += "--phone" }
if ($Kind -in @("start", "battle", "special")) { $argsList += @("--postevalfile", (Join-Path $PSScriptRoot "post.js"), "--postwait", "1500") }
& node @argsList
Remove-Item $case -Force -ErrorAction SilentlyContinue   # 계정 비밀번호가 들어 있으므로 바로 지운다
if ($Zoom -and (Test-Path $out)) {
  if ($Python) { & $Python (Join-Path $PSScriptRoot "crop.py") $out (Join-Path $outDir "$Name`_zoom.png") 640 440 1 } else { Write-Host "(확대 생략: Python 없음)" }
}
# 헤드리스 Edge가 남지 않게 정리(안 그러면 PC가 느려진다)
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-shot-*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
