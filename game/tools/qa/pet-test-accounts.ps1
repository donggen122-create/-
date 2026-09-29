# Balance-team test accounts (2026-09-29): the teacher signs up test1..test4 in the game, then this script turns on test mode
# with the admin API: test1=turtle, test2=cat, test3=otter, test4=deer (one pet each, grade chosen in the lobby by the student),
# 1-5 hard only, training 40, melee gear x6 unique, no parts, everything else locked. 25 test passes per account (one per start, never refilled).
# Re-running resets them to the same baseline (grade back to -Grade) and restarts the 25-pass budget. -Training / -GearGrade change the baseline for all four.
# Uses ADMIN_KEY from server/.dev.vars (never printed).
# Usage: powershell -File game\tools\qa\pet-test-accounts.ps1 [-Training 40] [-GearGrade 2] [-Grade 0] [-Base https://...]
param([string]$Base = "https://seoho-pangpang.seoho-pangpang-server.workers.dev", [int]$Training = 40, [int]$GearGrade = 2, [int]$Grade = 0)
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
$accounts = @(@('test1', 'turtle'), @('test2', 'cat'), @('test3', 'otter'), @('test4', 'deer'))
foreach ($a in $accounts) {
  $r = Post "test-profile" @{ id = $a[0]; testPet = $a[1]; grade = $Grade; training = $Training; gearGrade = $GearGrade }
  if ($r.status -eq 200) {
    $t = $r.body.training
    Write-Host ("{0,-6} OK  pet={1} cards={2} training={3}/{4}/{5} parts={6} testMode={7}" -f $a[0], $a[1], ($r.body.petCopies.PSObject.Properties | ForEach-Object { $_.Value }), $t.attack, $t.hp, $t.speed, $r.body.parts, ($r.body.testMode | ConvertTo-Json -Compress))
  } elseif ($r.status -eq 404) { Write-Host ("{0,-6} NOT SIGNED UP YET" -f $a[0]) }
  else { Write-Host ("{0,-6} FAIL {1} {2}" -f $a[0], $r.status, $r.body) }
}
$key = $null; $hdr = $null
