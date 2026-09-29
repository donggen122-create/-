# Pet-grade test accounts for the balance team (2026-09-29, 1-5 hard).
# The teacher signs up these IDs in the game first (any password). This script then sets each one with the admin API:
#   qanormal=Normal, qarare=Rare, qaunique=Unique, qaepic=Epic, qalegend=Legend pets (all 4 pets at that grade);
#   everything else identical (hard-ready baseline: training 40/40/20, 3 unique parts Lv1, ranged gear x6 normal, hard mode).
# Uses ADMIN_KEY from server/.dev.vars (never printed). Re-running resets the accounts to the same baseline.
# Usage: powershell -File game\tools\qa\pet-test-accounts.ps1 [-Passes 20] [-Base https://...]
param([string]$Base = "https://seoho-pangpang.seoho-pangpang-server.workers.dev", [int]$Passes = 0)
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
$vars = Join-Path $root "server\.dev.vars"
$line = Get-Content $vars -Encoding UTF8 | Where-Object { $_ -match '^\s*ADMIN_KEY\s*=' } | Select-Object -First 1
$key = ($line -replace '^\s*ADMIN_KEY\s*=\s*', '').Trim().Trim('"')
if (-not $key) { throw "ADMIN_KEY missing in server/.dev.vars" }
$hdr = @{ "X-Admin-Key" = $key }
function Post($path, $obj) {
  $body = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress))
  try { $r = Invoke-WebRequest -Uri "$Base/api/admin/$path" -Method Post -Headers $hdr -ContentType "application/json; charset=utf-8" -Body $body -UseBasicParsing -TimeoutSec 30; return @{ status = [int]$r.StatusCode; body = ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json) } }
  catch { $resp = $_.Exception.Response; if ($resp) { $sr = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8); return @{ status = [int]$resp.StatusCode; body = $sr.ReadToEnd() } } throw }
}
$accounts = @(@('qanormal', 0), @('qarare', 1), @('qaunique', 2), @('qaepic', 3), @('qalegend', 4))
foreach ($a in $accounts) {
  $r = Post "test-profile" @{ id = $a[0]; petGrade = $a[1] }
  if ($r.status -eq 200) {
    $pc = $r.body.petCopies; $t = $r.body.training
    $msg = "{0,-10} OK   petGrade={1} cards={2} training={3}/{4}/{5} parts={6}" -f $a[0], $a[1], $pc.turtle, $t.attack, $t.hp, $t.speed, $r.body.parts
    if ($Passes -gt 0) { $g = Post "grant-passes" @{ id = $a[0]; passes = $Passes; requestId = [guid]::NewGuid().ToString(); note = "pet balance test" }; $msg += "  passes+" + $(if ($g.status -eq 200) { $Passes } else { "FAIL " + $g.status }) }
    Write-Host $msg
  } elseif ($r.status -eq 404) { Write-Host ("{0,-10} NOT SIGNED UP YET" -f $a[0]) }
  else { Write-Host ("{0,-10} FAIL {1} {2}" -f $a[0], $r.status, $r.body) }
}
$key = $null; $hdr = $null
