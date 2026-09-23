# 공통 준비: 프로젝트 루트, node·git·gh·python 찾기. 다른 스크립트에서  . "$PSScriptRoot\env.ps1"  로 불러 쓴다.
# PC마다 설치 위치가 달라도 되게, PATH에 없으면 기본 설치 위치(winget·설치 프로그램)에서 찾아 PATH에 붙인다.
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Add-ToolPath([string]$dir) { if ($dir -and (Test-Path $dir) -and -not (($env:Path -split ';') -contains $dir)) { $env:Path = "$dir;$env:Path" } }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $wingetPkgs = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  $nodeDir = Get-ChildItem $wingetPkgs -Directory -Filter "OpenJS.NodeJS*" -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ChildItem $_.FullName -Directory -Filter "node-*" -ErrorAction SilentlyContinue } | Select-Object -First 1
  if ($nodeDir) { Add-ToolPath $nodeDir.FullName } else { Add-ToolPath (Join-Path $env:ProgramFiles "nodejs") }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  foreach ($d in @((Join-Path $env:ProgramFiles "Git\cmd"), (Join-Path $env:LOCALAPPDATA "Programs\Git\cmd"))) { if (Test-Path (Join-Path $d "git.exe")) { Add-ToolPath $d; break } }
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  foreach ($d in @((Join-Path $env:ProgramFiles "GitHub CLI"), (Join-Path $env:LOCALAPPDATA "Programs\GitHub CLI"))) { if (Test-Path (Join-Path $d "gh.exe")) { Add-ToolPath $d; break } }
}

# Python(그림 자르기·캡처 확대에만 필요). Microsoft Store 가짜 실행 파일(WindowsApps)은 건너뛴다.
$Python = $null
foreach ($c in @("python", "py")) {
  $cmd = Get-Command $c -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -notlike "*WindowsApps*") { $Python = $cmd.Source; break }
}
if (-not $Python) {
  $Python = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Programs\Python") -Directory -Filter "Python3*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName "python.exe" } | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Require-Node { if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js가 없어요. game/tools/setup.ps1 의 안내대로 설치해 주세요." } }
