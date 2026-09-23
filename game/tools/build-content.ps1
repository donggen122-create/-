# data/*.csv, data/*.json → game/src/content.data.js
# docs/14 §10 "CSV/JSON → content.bundle.json(검증 후)" 파이프라인의 PowerShell 판.
# (이 PC에 Node가 없어 빌드 스크립트를 PowerShell로 작성)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # game/
$dataDir = Join-Path (Split-Path -Parent $root) "data"
$outFile = Join-Path $root "src\content.data.js"

function Read-Csv($name) {
  $p = Join-Path $dataDir $name
  return Import-Csv -Path $p -Encoding UTF8
}
function Read-Json($name) {
  $p = Join-Path $dataDir $name
  $raw = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
  return $raw | ConvertFrom-Json
}
function JsStr($s) {
  if ($null -eq $s) { return '""' }
  $t = [string]$s
  $t = $t.Replace('\', '\\').Replace('"', '\"').Replace("`r", "").Replace("`n", '\n')
  return '"' + $t + '"'
}
function JsNum($s, $fallback = 0) {
  if ($null -eq $s -or $s -eq "" -or $s -eq "-") { return $fallback }
  $v = 0.0
  # "999", "1.11", "0.3/s" 같은 값에서 앞쪽 숫자만
  $m = [regex]::Match([string]$s, '^-?\d+(\.\d+)?')
  if ($m.Success -and [double]::TryParse($m.Value, [ref]$v)) { return $v }
  return $fallback
}
# "10:00" / "15:00" / "10:00(고정 튜토리얼)" → 초
function TimeToSec($s) {
  $m = [regex]::Match([string]$s, '(\d+):(\d+)')
  if ($m.Success) { return [int]$m.Groups[1].Value * 60 + [int]$m.Groups[2].Value }
  return 900
}
# "EL01(2:00);BS01m(5:00)" → @( @{id;atS} )
function ParseTimedIds($s) {
  $out = @()
  foreach ($part in ([string]$s -split ';')) {
    $m = [regex]::Match($part.Trim(), '^([A-Z]+\d+[a-z]?)\s*\((\d+):(\d+)\)')
    if ($m.Success) {
      $out += @{ id = $m.Groups[1].Value; atS = [int]$m.Groups[2].Value * 60 + [int]$m.Groups[3].Value }
    }
  }
  return $out
}
# "금화 500; 별가루 30; ..." → @{gold;dust}
function ParseReward($s) {
  $gold = 0; $dust = 0
  $mg = [regex]::Match([string]$s, '금화\s*([\d,]+)')
  if ($mg.Success) { $gold = [int]($mg.Groups[1].Value -replace ',', '') }
  $md = [regex]::Match([string]$s, '별가루\s*([\d,]+)')
  if ($md.Success) { $dust = [int]($md.Groups[1].Value -replace ',', '') }
  return @{ gold = $gold; dust = $dust }
}
# "density=0.6;elite_int=999;dark=0" → @{}
function ParseParams($s) {
  $h = @{}
  foreach ($kv in ([string]$s -split ';')) {
    $p = $kv -split '='
    if ($p.Count -eq 2) { $h[$p[0].Trim()] = $p[1].Trim() }
  }
  return $h
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("// 자동 생성 파일 — 직접 수정하지 말 것.")
[void]$sb.AppendLine("// 생성: game/tools/build-content.ps1  (원본: data/*.csv, data/*.json)")
[void]$sb.AppendLine("// 생성 시각: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("")

# ---------------- 적 ----------------
$enemies = Read-Csv "enemies.csv"
[void]$sb.AppendLine("export const RAW_ENEMIES = {")
foreach ($e in $enemies) {
  $line = '  {0}: {{ id: {0}, name: {1}, type: {2}, behavior: {3}, hpMult: {4}, atkMult: {5}, spdU: {6}, radiusU: {7}, mass: {8}, xp: {9}, env: {10}, firstChapter: {11}, ability: {12} }},' -f `
    (JsStr $e.id), (JsStr $e.name), (JsStr $e.type), (JsStr $e.behavior), `
    (JsNum $e.hp_mult 1), (JsNum $e.atk_mult 1), (JsNum $e.spd_u 2.5), (JsNum $e.radius_u 0.35), `
    (JsNum $e.mass 1), (JsNum $e.xp 2), (JsStr $e.env_home), (JsStr $e.first_chapter), (JsStr $e.ability)
  # 키 이름은 따옴표 없이
  $line = $line -replace '^  "([A-Z0-9]+)":', '  $1:'
  [void]$sb.AppendLine($line)
}
[void]$sb.AppendLine("};")
[void]$sb.AppendLine("")

# ---------------- 보스 ----------------
$bossJson = Read-Json "bosses.json"
[void]$sb.AppendLine("export const RAW_BOSSES = {")
foreach ($b in $bossJson.bosses) {
  [void]$sb.AppendLine(("  {0}: {{" -f $b.id))
  [void]$sb.AppendLine(("    id: {0}, name: {1}, env: {2}, hpMult: {3}, atkMult: {4}, radiusU: {5}, spdU: {6}, restS: {7}," -f `
    (JsStr $b.id), (JsStr $b.name), (JsStr $b.env), (JsNum $b.hp_mult 300), (JsNum $b.atk_mult 2), `
    (JsNum $b.radius_u 1.3), (JsNum $b.spd_u 1.5), (JsNum $b.rest_s 2)))
  [void]$sb.AppendLine("    patterns: [")
  foreach ($p in $b.patterns) {
    [void]$sb.AppendLine(("      {{ name: {0}, telegraph: {1}, telegraphS: {2}, dmg: {3}, cooldownS: {4}, dodge: {5} }}," -f `
      (JsStr $p.name), (JsStr $p.telegraph), (JsNum $p.telegraph_s 1), (JsNum $p.dmg 1), (JsNum $p.cooldown_s 7), (JsStr $p.dodge)))
  }
  [void]$sb.AppendLine("    ],")
  $ph = 50
  if ($b.phases -and $b.phases.Count -gt 0) { $ph = JsNum $b.phases[0].hp_pct 50 }
  [void]$sb.AppendLine(("    phase2Pct: {0}, summons: {1}," -f $ph, (JsStr $b.summons)))
  [void]$sb.AppendLine("  },")
}
[void]$sb.AppendLine("};")
[void]$sb.AppendLine("")

# ---------------- 스킬 ----------------
$skills = Read-Csv "skills.csv"
[void]$sb.AppendLine("export const RAW_SKILLS = {")
foreach ($s in $skills) {
  $line = '  {0}: {{ id: {0}, name: {1}, role: {2}, tags: {3}, aim: {4}, dmgCoef: {5}, intervalS: {6}, projectiles: {7}, pierce: {8}, rangeU: {9}, durationS: {10}, lv: [{11}, {12}, {13}, {14}], evoPassive: {15}, evoId: {16}, strength: {17}, weakness: {18}, perfCost: {19} }},' -f `
    (JsStr $s.id), (JsStr $s.name), (JsStr $s.role), (JsStr $s.tags), (JsStr $s.aim), `
    (JsNum $s.dmg_coef 1), (JsNum $s.interval_s 1), (JsNum $s.projectiles 1), (JsNum $s.pierce 0), `
    (JsNum $s.range_u 8), (JsNum $s.duration_s 0), `
    (JsStr $s.lv2), (JsStr $s.lv3), (JsStr $s.lv4), (JsStr $s.lv5), `
    (JsStr $s.evo_passive), (JsStr $s.evo_id), (JsStr $s.strength), (JsStr $s.weakness), (JsNum $s.perf_cost 2)
  $line = $line -replace '^  "([A-Z0-9]+)":', '  $1:'
  [void]$sb.AppendLine($line)
}
[void]$sb.AppendLine("};")
[void]$sb.AppendLine("")

# ---------------- 패시브 ----------------
$passives = Read-Csv "passives.csv"
[void]$sb.AppendLine("export const RAW_PASSIVES = {")
foreach ($p in $passives) {
  $line = '  {0}: {{ id: {0}, name: {1}, stat: {2}, lv: [{3}, {4}, {5}, {6}, {7}], cap: {8}, appliesTo: {9}, stackType: {10} }},' -f `
    (JsStr $p.id), (JsStr $p.name), (JsStr $p.stat), `
    (JsStr $p.lv1), (JsStr $p.lv2), (JsStr $p.lv3), (JsStr $p.lv4), (JsStr $p.lv5), `
    (JsStr $p.cap), (JsStr $p.applies_to), (JsStr $p.stack_type)
  $line = $line -replace '^  "([A-Z0-9]+)":', '  $1:'
  [void]$sb.AppendLine($line)
}
[void]$sb.AppendLine("};")
[void]$sb.AppendLine("")

# ---------------- 진화 ----------------
$evos = Read-Csv "evolutions.csv"
[void]$sb.AppendLine("export const RAW_EVOLUTIONS = {")
foreach ($e in $evos) {
  $line = '  {0}: {{ id: {0}, name: {1}, type: {2}, sourceA: {3}, sourceB: {4}, behaviorChange: {5}, dmgCoef: {6}, intervalS: {7}, upgrades: {8} }},' -f `
    (JsStr $e.id), (JsStr $e.name), (JsStr $e.type), (JsStr $e.source_a), (JsStr $e.source_b), `
    (JsStr $e.behavior_change), (JsNum $e.dmg_coef 1), (JsNum $e.interval_s 1), (JsStr $e.upgrades)
  $line = $line -replace '^  "([A-Z0-9]+)":', '  $1:'
  [void]$sb.AppendLine($line)
}
[void]$sb.AppendLine("};")
[void]$sb.AppendLine("")

# ---------------- 캐릭터 ----------------
$charJson = Read-Json "characters.json"
[void]$sb.AppendLine("export const RAW_CHARACTERS = [")
foreach ($c in $charJson.characters) {
  $tags = ($c.affinity_tags | ForEach-Object { JsStr $_ }) -join ', '
  $locked = ($c.locked_skills | ForEach-Object { JsStr $_ }) -join ', '
  [void]$sb.AppendLine(("  {{ id: {0}, name: {1}, title: {2}, role: {3}, baseWeapon: {4}, unlock: {5}, atk: {6}, hp: {7}, spd: {8}, def: {9}, passive: {10}, abilityName: {11}, abilityEffect: {12}, affinity: [{13}], locked: [{14}], note: {15}, promo3: {16}, promo5: {17}, awaken2: {18}, awaken3: {19} }}," -f `
    (JsStr $c.id), (JsStr $c.name), (JsStr $c.title), (JsStr $c.role), (JsStr $c.base_weapon), (JsStr $c.unlock), `
    (JsNum $c.base_stats.atk 100), (JsNum $c.base_stats.hp 1000), (JsNum $c.base_stats.spd 5), (JsNum $c.base_stats.def 0), `
    (JsStr $c.passive), (JsStr $c.unique_ability.name), (JsStr $c.unique_ability.effect), $tags, $locked, (JsStr $c.design_note), (JsStr $c.promo_bonus.'3'), (JsStr $c.promo_bonus.'5'), (JsStr $c.awaken_bonus.'2'), (JsStr $c.awaken_bonus.'3')))
}
[void]$sb.AppendLine("];")
[void]$sb.AppendLine("")

# ---------------- 장비 ----------------
$equip = Read-Csv "equipment.csv"
[void]$sb.AppendLine("export const RAW_EQUIPMENT = [")
foreach ($e in $equip) {
  [void]$sb.AppendLine(("  {{ id: {0}, slot: {1}, name: {2}, setId: {3}, mainStat: {4}, baseValue: {5}, optRare: {6}, optEpic: {7}, legendEffect: {8}, source: {9} }}," -f `
    (JsStr $e.id), (JsStr $e.slot), (JsStr $e.name), (JsStr $e.set_id), (JsStr $e.main_stat), `
    (JsNum $e.base_value 20), (JsStr $e.opt1_rare), (JsStr $e.opt2_epic), (JsStr $e.legend_effect), (JsStr $e.source_hint)))
}
[void]$sb.AppendLine("];")
[void]$sb.AppendLine("")

# ---------------- 나머지 테이블(행 전체를 그대로 직렬화) ----------------
function Emit-Table($varName, $rows, $cols) {
  [void]$sb.AppendLine("export const $varName = [")
  foreach ($r in $rows) {
    $parts = @()
    foreach ($c in $cols) {
      $segs = $c -split '_'
      $key = $segs[0]
      for ($k = 1; $k -lt $segs.Count; $k++) { $key += $segs[$k].Substring(0,1).ToUpper() + $segs[$k].Substring(1) }
      $parts += ("{0}: {1}" -f $key, (JsStr $r.$c))
    }
    [void]$sb.AppendLine("  { " + ($parts -join ", ") + " },")
  }
  [void]$sb.AppendLine("];")
  [void]$sb.AppendLine("")
}
Emit-Table "RAW_TALENTS" (Read-Csv "talents.csv") @('id','branch','tier','name','type','effect_per_rank','max_rank','cost_tp','cost_gold','prereq','unlock_cond')
Emit-Table "RAW_PETS" (Read-Csv "pets.csv") @('id','name','ai_type','role','deploy_skill','deploy_interval_s','deploy_coef','assist_skill','hp_pct_of_player','speed_u','unlock')
Emit-Table "RAW_MISSIONS" (Read-Csv "missions.csv") @('id','type','name','condition','target','reward','weight','unlock','leads_to_mode')
Emit-Table "RAW_ACHIEVEMENTS" (Read-Csv "achievements.csv") @('id','category','name','condition','target','reward','hidden')
Emit-Table "RAW_RULES" (Read-Csv "challenge_rules.csv") @('id','name','category','effect','param_default','counter_axis')
Emit-Table "RAW_CHALLENGES" (Read-Csv "challenges.csv") @('id','chapter_id','tier','name','rules','params','reward','unlock')
Emit-Table "RAW_COLLECTIBLES" (Read-Csv "collectibles.csv") @('id','set_id','name','rarity','effect_type','effect','lv5_effect','cap','source')
Emit-Table "RAW_SETS" (Read-Csv "sets.csv") @('id','name','theme','bonus_3','bonus_5','build_axis','source')
Emit-Table "RAW_MODES" (Read-Csv "modes.csv") @('id','name','unlock','entry_cost','duration','win_condition','lose_condition','unique_rules','rewards','repeat_limit')

Emit-Table "RAW_REWARDS" (Read-Csv "rewards.csv") @('table_id','kind','roll_type','entry','item_ref','weight_or_price','qty','pity_or_limit','notes')
Emit-Table "RAW_PARTS" (Read-Csv "parts.csv") @('id','name','skill_id','stat_type','stat_common','stat_fine','stat_rare','stat_epic','stat_legend','stat_myth','behavior_epic','behavior_legend','behavior_myth','resonance_lv30')
$bJson = Read-Json "builds.json"
[void]$sb.AppendLine("export const RAW_BUILDS = [")
foreach ($b in $bJson.builds) {
  $arr = { param($a) '[' + (($a | ForEach-Object { JsStr $_ }) -join ', ') + ']' }
  [void]$sb.AppendLine(("  {{ id: {0}, name: {1}, character: {2}, attack: {3}, passive: {4}, essential: {5}, early: {6}, evo: {7}, parts: {8}, supportParts: {9}, sets: {10}, modes: {11}, deployPet: {12}, assistPets: {13}, equipment: {14} }}," -f `
    (JsStr $b.id), (JsStr $b.name), (JsStr $b.character), (& $arr $b.attack), (& $arr $b.passive), (& $arr $b.essential), (& $arr $b.early_priority), (& $arr $b.evo_order), `
    (& $arr $b.parts), (& $arr $b.support_parts), (& $arr $b.sets), (& $arr $b.modes), (JsStr $b.pets.deploy), (& $arr $b.pets.assist), (& $arr $b.equipment)))
}
[void]$sb.AppendLine("];")
[void]$sb.AppendLine("")
$evJson = Read-Json "events.json"
[void]$sb.AppendLine("export const RAW_EVENTS = [")
foreach ($e in $evJson.templates) {
  [void]$sb.AppendLine(("  {{ id: {0}, name: {1}, days: {2}, tokenId: {3}, tokenName: {4}, sources: {5}, dailyCap: {6}, participation: {7}, progress: {8}, shop: {9}, leftover: {10}, unlock: {11} }}," -f `
    (JsStr $e.id), (JsStr $e.name), (JsNum $e.duration_days 7), (JsStr $e.token.id), (JsStr $e.token.name), (JsStr (($e.token.sources) -join ' / ')), (JsNum $e.token.daily_cap 50), `
    (JsStr $e.participation), (JsStr $e.progress), (JsStr $e.shop), (JsStr $e.leftover_policy), (JsStr $e.unlock)))
}
[void]$sb.AppendLine("];")
[void]$sb.AppendLine("")

# ---------------- 챕터 ----------------
$chapters = Read-Csv "chapters.csv"
[void]$sb.AppendLine("export const RAW_CHAPTERS = [")
foreach ($c in $chapters) {
  $mix = ($c.enemy_mix -split ';' | ForEach-Object { JsStr $_.Trim() }) -join ', '
  $mids = ParseTimedIds $c.mid_bosses
  $midJs = ($mids | ForEach-Object { "{{ id: {0}, atS: {1} }}" -f (JsStr $_.id), $_.atS }) -join ', '
  $first = ParseReward $c.first_clear_reward
  $rep = ParseReward $c.repeat_reward
  $prm = ParseParams $c.wave_params
  $density = 0.7
  if ($prm.ContainsKey('density')) { $density = [double]$prm['density'] }
  $dark = 0
  if ($prm.ContainsKey('dark')) { $dark = [double]$prm['dark'] }
  $finalBoss = ([string]$c.final_boss -replace 'v\d+$', '')

  [void]$sb.AppendLine(("  {{ id: {0}, name: {1}, env: {2}, structure: {3}, timeLimitS: {4}, enemyMult: {5}, mix: [{6}], midBosses: [{7}], boss: {8}, bossRaw: {9}, density: {10}, dark: {11}, gimmick: {12}, firstGold: {13}, firstDust: {14}, repeatGold: {15}, unlocks: {16}, firstRaw: {17}, repeatRaw: {18} }}," -f `
    (JsStr $c.id), (JsStr $c.name), (JsStr $c.env), (JsStr $c.map_structure), (TimeToSec $c.time_limit), `
    (JsNum $c.enemy_mult 1), $mix, $midJs, (JsStr $finalBoss), (JsStr $c.final_boss), `
    $density, $dark, (JsStr $c.gimmick), $first.gold, $first.dust, $rep.gold, (JsStr $c.unlocks), (JsStr $c.first_clear_reward), (JsStr $c.repeat_reward)))
}
[void]$sb.AppendLine("];")

[System.IO.File]::WriteAllText($outFile, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))

Write-Host "생성 완료: $outFile"
Write-Host ("  적 {0} / 보스 {1} / 스킬 {2} / 패시브 {3} / 진화 {4} / 챕터 {5}" -f `
  $enemies.Count, $bossJson.bosses.Count, $skills.Count, $passives.Count, $evos.Count, $chapters.Count)
