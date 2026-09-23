# 난이도 밸런스 자동 조종(로컬 서버 http://localhost:8797 에서만): 5분 판 결과를 30초 단위로 출력한다.
# 예) sim.ps1 -Stage CH04 -Mode ranged -Diff hard            (적을 피하는 플레이)
#     sim.ps1 -Stage CH02 -Mode melee -Diff normal -Avoid 0  (안 피하는 플레이)
# 판마다 초반에 뽑힌 스킬에 따라 결과가 크게 달라지므로 같은 조건을 2~3판 돌려 본다.
# 1-3 이상을 고르려면 테스트 계정이 앞 단계를 성공해 있어야 한다(아니면 "stage not selectable" 오류).
param(
  [string]$Stage = "CH01", [ValidateSet("melee", "ranged")][string]$Mode = "melee",
  [ValidateSet("easy", "normal", "hard")][string]$Diff = "normal", [int]$Avoid = 2,
  [string]$Base = "http://localhost:8797", [string]$User = "테스트", [string]$Pw = "1234"
)
. "$PSScriptRoot\..\env.ps1"
Require-Node
$outDir = Join-Path $PSScriptRoot "out"; New-Item -ItemType Directory -Force $outDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding $false
$js = [IO.File]::ReadAllText((Join-Path $PSScriptRoot "sim.js"), $enc)
foreach ($kv in @(@("__STAGE__", $Stage), @("__MODE__", $Mode), @("__DIFF__", $Diff), @("__AVOID__", "$Avoid"), @("__UID__", $User), @("__UPW__", $Pw))) { $js = $js.Replace($kv[0], $kv[1]) }
$case = Join-Path $env:TEMP ("seoho_sim_" + [guid]::NewGuid().ToString("N") + ".js")
[IO.File]::WriteAllText($case, $js, $enc)
$out = Join-Path $outDir "sim_$Stage`_$Diff`_a$Avoid.png"
& node (Join-Path $ProjectRoot "game\tools\shot.cjs") --url "$Base/" --out $out --evalfile $case --wait 3500 --after 900
Remove-Item $case -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-shot-*' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
