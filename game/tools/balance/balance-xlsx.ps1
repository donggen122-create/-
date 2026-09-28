param([string]$Spec, [string]$Out)
$ErrorActionPreference = "Stop"
$json = [IO.File]::ReadAllText($Spec, [Text.Encoding]::UTF8) | ConvertFrom-Json
function RGB([string]$hex) { $h = $hex.TrimStart('#'); $r = [Convert]::ToInt32($h.Substring(0,2),16); $g = [Convert]::ToInt32($h.Substring(2,2),16); $b = [Convert]::ToInt32($h.Substring(4,2),16); return $r + $g*256 + $b*65536 }
$FILL = @{ g0 = RGB 'EDEDED'; g1 = RGB 'DDEBF7'; g2 = RGB 'E4DFEC'; g3 = RGB 'FCE4D6'; g4 = RGB 'FFF2CC'; warn = RGB 'FFF59D'; input = RGB 'FFFBEA'; h = RGB '2F5597' }
$BORDER = RGB 'BFBFBF'
function Apply($rng, $styles) {
  foreach ($s in $styles) {
    switch ($s) {
      'title'   { $rng.Font.Size = 16; $rng.Font.Bold = $true; $rng.Font.Color = (RGB '1F3864') }
      'section' { $rng.Font.Size = 12; $rng.Font.Bold = $true; $rng.Font.Color = (RGB '2F5597') }
      'note'    { $rng.Font.Italic = $true; $rng.Font.Size = 9; $rng.Font.Color = (RGB '595959') }
      'h'       { $rng.Font.Bold = $true; $rng.Font.Color = (RGB 'FFFFFF'); $rng.Interior.Color = $FILL.h; $rng.Borders.LineStyle = 1; $rng.Borders.Color = $BORDER; $rng.VerticalAlignment = -4108 }
      'cell'    { $rng.Borders.LineStyle = 1; $rng.Borders.Color = $BORDER; $rng.VerticalAlignment = -4108 }
      'bold'    { $rng.Font.Bold = $true }
      'center'  { $rng.HorizontalAlignment = -4108 }
      'wrap'    { $rng.WrapText = $true }
      'input'   { $rng.Font.Color = (RGB '0000FF'); $rng.Interior.Color = $FILL.input }
      default   { if ($FILL.ContainsKey($s)) { $rng.Interior.Color = $FILL[$s]; if ($styles -contains 'h') { $rng.Font.Color = (RGB '1F1F1F') } } }
    }
  }
}
function Fmt([string]$nf) { if ($nf.StartsWith('+')) { $b = $nf.Substring(1); return "+$b;-$b;$b" } return $nf }
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false; $xl.DisplayAlerts = $false; $xl.ScreenUpdating = $false
try {
  $wb = $xl.Workbooks.Add()
  $wb.Styles.Item("Normal").Font.Name = $json.font; $wb.Styles.Item("Normal").Font.Size = 10
  while ($wb.Worksheets.Count -lt $json.sheets.Count) { [void]$wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)) }
  $tabs = @('1F3864','2F5597','70AD47','ED7D31','7030A0','BF8F00')
  for ($i = 0; $i -lt $json.sheets.Count; $i++) {
    $sh = $json.sheets[$i]; $ws = $wb.Worksheets.Item($i + 1); $ws.Name = $sh.name
    $ws.Tab.Color = (RGB $tabs[$i % $tabs.Count])
    $ws.Cells.Font.Name = $json.font
    foreach ($p in $sh.widths.PSObject.Properties) { $ws.Columns.Item([int]$p.Name + 1).ColumnWidth = [double]$p.Value }
    foreach ($c in $sh.cells) {
      $cell = $ws.Cells.Item([int]$c.r, [int]$c.c + 1)
      if ($c.nf) { $cell.NumberFormat = (Fmt $c.nf) }
      $v = $c.v
      if ($v -is [string]) {
        if ($v.StartsWith('=')) { $cell.Formula = $v }
        elseif ($v -ne '') { if ($v -match '^[\d\s\-\/\.:]+$') { $cell.Value2 = "'" + $v } else { $cell.Value2 = $v } }
      } elseif ($null -ne $v) { $cell.Value2 = [double]$v }
      if ($c.s.Count) { Apply $cell $c.s }
    }
    foreach ($g in $sh.ranges) {
      $rng = $ws.Range($g.a1)
      if ($g.merge) { $rng.Merge() }
      if ($g.s.Count) { Apply $rng $g.s }
      if ($g.valign -eq 'center') { $rng.VerticalAlignment = -4108 }
    }
    foreach ($p in $sh.heights.PSObject.Properties) { $ws.Rows.Item([int]$p.Name).RowHeight = [double]$p.Value }
    $ws.Activate(); try { $xl.ActiveWindow.DisplayGridlines = $false; $xl.ActiveWindow.Zoom = 100 } catch {}
    if ($sh.freeze) { try { $xl.ActiveWindow.FreezePanes = $false; $ws.Range($sh.freeze).Select(); $xl.ActiveWindow.FreezePanes = $true } catch { Write-Host "freeze failed $($sh.name)" } }
    try { $ps = $ws.PageSetup; $ps.Orientation = 2; $ps.Zoom = $false; $ps.FitToPagesWide = 1; $ps.FitToPagesTall = $false } catch { Write-Host "pagesetup skipped $($sh.name)" }
    [void]$ws.Range("A1").Select()
  }
  $guide = $wb.Worksheets.Item(1); [void]$guide.Range("A5:C25").Rows.AutoFit()
  $wb.Worksheets.Item(1).Activate()
  $xl.Calculate()
  $errors = @(); $formulas = 0
  foreach ($ws in $wb.Worksheets) {
    $used = $ws.UsedRange
    foreach ($cell in $used.Cells) { if ($cell.HasFormula) { $formulas++; $t = $cell.Text; if ($t -match '^#') { $errors += "$($ws.Name)!$($cell.Address($false,$false)) $t" } } }
  }
  $train = $wb.Worksheets.Item(5); $coin = $wb.Worksheets.Item(6)
  Write-Host ("formulas=" + $formulas + " errors=" + $errors.Count)
  $errors | Select-Object -First 10 | ForEach-Object { Write-Host $_ }
  Write-Host ("check training level40 cumulative (F55)=" + $train.Range("F55").Value2 + " speed100 (D115)=" + $train.Range("D115").Value2 + " attack100 (B115)=" + $train.Range("B115").Value2)
  Write-Host ("check coin 1-3 normal repeat+goal (E19)=" + $coin.Range("E19").Value2 + " calc days=" + $coin.Range("B35").Text + " / " + $coin.Range("B36").Text)
  $dir = Split-Path $Out -Parent; if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
  if (Test-Path $Out) { [IO.File]::Delete($Out) }
  $wb.SaveAs($Out, 51)
  $wb.Close($false)
  Write-Host "saved"
} finally {
  $xl.ScreenUpdating = $true; $xl.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl); [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
