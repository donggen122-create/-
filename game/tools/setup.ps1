# 새 PC 준비(git clone 한 뒤 한 번): 필요한 프로그램 확인 → 서버 도구 설치(npm) → 로컬 비밀값 파일 → 로컬 DB 표 → 클라우드플레어 로그인 안내
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File game\tools\setup.ps1
. "$PSScriptRoot\env.ps1"
$missing = @()
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { $missing += "winget install --id Git.Git -e --source winget" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "winget install --id OpenJS.NodeJS.LTS -e --source winget" }
if ($missing) {
  Write-Host "먼저 설치해 주세요(설치 뒤 터미널을 새로 열기):" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "  $_" }
  exit 1
}
if (-not $Python) { Write-Host "(선택) Python이 없어요 — 그림 자르기·캡처 확대에만 필요: winget install --id Python.Python.3.12 -e 후  python -m pip install pillow numpy scipy fonttools brotli" -ForegroundColor DarkYellow }

Push-Location (Join-Path $ProjectRoot "server")
if (-not (Test-Path "node_modules")) { Write-Host "서버 도구 설치(npm install)…"; npm install --no-audit --no-fund }
if (-not (Test-Path ".dev.vars")) {
  # 로컬 개발 전용 값(실서버 비밀값과 무관 — 실서버 관리자 값은 Cloudflare에 이미 저장되어 있다). 이 파일은 git에 올라가지 않는다.
  $r = -join ((48..57) + (97..122) | Get-Random -Count 16 | ForEach-Object { [char]$_ })
  Set-Content ".dev.vars" -Value @("ADMIN_KEY=local-$r", "ADMIN_ID=localadmin", "ADMIN_PW=local-$r", "TEACHER_ID=localadmin", "TEACHER_PW=teacher-$r") -Encoding ascii
  Write-Host "server/.dev.vars 를 만들었어요(로컬 전용: 관리 페이지 아이디 localadmin / 관리자 비밀번호 local-$r / 선생님 비밀번호 teacher-$r)."
}
Write-Host "로컬 DB 표 만들기…"
npx wrangler d1 execute seoho-pangpang-db --local --file=schema.sql | Out-Null
Pop-Location

Write-Host ""
Write-Host "준비 완료. 남은 것(처음 한 번):" -ForegroundColor Green
Write-Host "  1) 실서버 배포용 로그인: server 폴더에서  npx wrangler login  (브라우저에서 허용)"
Write-Host "  2) 로컬 서버: .claude/launch.json 'wrangler'(game/tools/dev-server.ps1) → http://localhost:8797"
Write-Host "  3) 로컬 테스트 계정: 로컬 서버를 켠 뒤 게임 화면에서 가입(예: 테스트 / 1234)"
