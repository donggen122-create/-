# 로컬 개발 서버(게임 + API, http://localhost:8797): game/ → dist_web 동기화 후 wrangler dev.
# .claude/launch.json 의 "wrangler"가 이것을 부른다. 로컬 DB는 server/.wrangler(PC마다 따로, git에 안 올림).
. "$PSScriptRoot\env.ps1"
Require-Node
& "$PSScriptRoot\sync-dist.ps1"
Set-Location (Join-Path $ProjectRoot "server")
if (-not (Test-Path "node_modules")) { npm install --no-audit --no-fund }
npx wrangler dev --port 8797 --local
