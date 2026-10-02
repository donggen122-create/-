# Balance-team gear experiment (2026-10-02): turns the teacher-created accounts test1..test4 into gear test accounts with the admin API.
# No pet, no parts, training 80, stage 2-5 (CH10) hard only. Each account has ONE fixed gear grade (both sets, 12 items):
#   test1 = rare(1), test2 = unique(2), test3 = epic(3), test4 = legend(4)
# The student only switches the set (melee / ranged) in the lobby: 10 runs per set (the server blocks an 11th), 20 test passes
# per account (one per start, never refilled). Every run records its set and grade.
# Re-running resets the account (melee equipped) and restarts the 20-pass budget. -Only limits which accounts are touched.
# Uses ADMIN_KEY from server/.dev.vars (never printed).
# Usage: powershell -File game\tools\qa\gear-test-accounts.ps1 [-Training 80] [-Stage CH10] [-Difficulty hard] [-Only test2,test3] [-Base https://...]
param([string]$Base = "https://seoho-pangpang.seoho-pangpang-server.workers.dev", [int]$Training = 0, [string]$Stage = "", [string]$Difficulty = "", [string[]]$Only = @())
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
$accounts = @(@('test1', 1), @('test2', 2), @('test3', 3), @('test4', 4))
foreach ($a in $accounts) {
  if ($Only.Count -and ($Only -notcontains $a[0])) { Write-Host ("{0,-6} skipped" -f $a[0]); continue }
  $req = @{ id = $a[0]; testGear = 'melee'; grade = $a[1] }
  if ($Training -gt 0) { $req.training = $Training }
  if ($Stage) { $req.stage = $Stage }
  if ($Difficulty) { $req.difficulty = $Difficulty }
  $r = Post "test-profile" $req
  if ($r.status -eq 200) {
    $t = $r.body.training
    Write-Host ("{0,-6} OK  hero={1} gearGrade={2} training={3}/{4}/{5} pets={6} testMode={7}" -f $a[0], $r.body.hero, $r.body.gearGrade, $t.attack, $t.hp, $t.speed, (@($r.body.petCopies.PSObject.Properties).Count), ($r.body.testMode | ConvertTo-Json -Compress))
  } elseif ($r.status -eq 404) { Write-Host ("{0,-6} NOT SIGNED UP YET" -f $a[0]) }
  else { Write-Host ("{0,-6} FAIL {1} {2}" -f $a[0], $r.status, $r.body) }
}
$key = $null; $hdr = $null
