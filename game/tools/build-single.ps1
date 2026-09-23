# game/ → dist_single/LUMEN.html (서버 없이 더블클릭으로 열리는 단일 파일판)
# ES 모듈은 file:// 에서 브라우저가 막기 때문에, 모듈 8개를 의존 순서대로 하나의 일반 스크립트로 합치고
# 이미지·효과음은 data: URI로 박아 넣는다. 원본 코드(game/src)는 건드리지 않는다.
# 사용: powershell -ExecutionPolicy Bypass -File game/tools/build-single.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # game/
$outDir = Join-Path (Split-Path -Parent $root) "dist_single"
$utf8 = New-Object System.Text.UTF8Encoding $false

function ReadText($p) { return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }
function DataUri($p) {
  $ext = [System.IO.Path]::GetExtension($p).ToLower()
  $mime = @{ ".png" = "image/png"; ".ogg" = "audio/ogg"; ".jpg" = "image/jpeg"; ".woff2" = "font/woff2"; ".svg" = "image/svg+xml" }[$ext]
  if (-not $mime) { throw "알 수 없는 에셋 형식: $p" }
  return "data:$mime;base64," + [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($p))
}

# 의존 순서(앞 모듈이 뒤 모듈에 쓰인다). rework-*는 Codex 개편(Guardian v1) 모듈: core ← content·ui ← main
$order = @("content.data", "themes", "content", "meta", "save", "assets", "cloud", "economy", "ecoui", "theme-effects", "element-content", "rework-core", "rework-content", "element-effects", "element-combat", "weapon-effects", "rework-ui", "main")
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("var __m = {};")

# 템플릿 문자열로 만든 그림 경로(`./assets/seoho_v1/pets/${id}_idle.png` 등)는 정적으로 못 바꾸므로,
# 해당 폴더의 파일을 전부 표(__ASSETS)로 넣고 __asset("seoho_v1/...")로 찾게 한다
$assetMap = New-Object System.Text.StringBuilder
[void]$assetMap.AppendLine("var __ASSETS = {")
foreach ($dir in @("seoho_v1", "elements_v2", "sprites\heroes", "sprites\skills")) {
  $base = Join-Path $root "assets\$dir"
  if (-not (Test-Path $base)) { continue }
  foreach ($f in (Get-ChildItem $base -Recurse -File)) {
    $rel = $f.FullName.Substring((Join-Path $root "assets").Length + 1).Replace("\", "/")
    [void]$assetMap.AppendLine('"' + $rel + '": "' + (DataUri $f.FullName) + '",')
  }
}
[void]$assetMap.AppendLine("};")
[void]$assetMap.AppendLine('var __asset = function (p) { return __ASSETS[p] || ("./assets/" + p); };')
[void]$sb.Append($assetMap.ToString())

foreach ($name in $order) {
  $src = ReadText (Join-Path $root "src\$name.js")

  # 에셋 경로 → data URI (assets.js는 BASE + "파일명" 형태로 경로를 만든다)
  $src = [regex]::Replace($src, '(IMG_BASE|AUDIO_BASE|UI_BASE) \+ "([^"]+)"', {
    param($m)
    $dir = @{ IMG_BASE = "sprites"; AUDIO_BASE = "audio"; UI_BASE = "ui" }[$m.Groups[1].Value]
    return '"' + (DataUri (Join-Path $root "assets\$dir\$($m.Groups[2].Value)")) + '"'
  })
  # 템플릿 문자열 안의 ./assets/seoho_v1/…, elements_v2/…, sprites/heroes/…, ./assets/${폴더식}/icons/… → ${__asset(`…`)}
  # 경로 뒤쪽은 ${…} 식(안에 따옴표가 있을 수 있음) 또는 따옴표·공백·$ 가 아닌 글자들로 이어진다
  $src = [regex]::Replace($src, '(?:\./)?assets/((?:seoho_v1|elements_v2|sprites/heroes|sprites/skills|\$\{[^}]*\})/(?:\$\{[^}]*\}|[^`"''\s$])*)', {
    param($m) return '${__asset(`' + $m.Groups[1].Value + '`)}'
  })

  # import { a, b } from "./x.js";  →  const { a, b } = __m["x"];   (따옴표는 " 또는 ')
  $src = [regex]::Replace($src, '(?s)import\s*\{([^}]*)\}\s*from\s*["'']\./([\w.\-]+)\.js["''];', {
    param($m)
    $list = $m.Groups[1].Value -replace '(\w+)\s+as\s+(\w+)', '$1: $2'   # import { icon as sgIcon } → { icon: sgIcon }
    return "const {$list} = __m[`"$($m.Groups[2].Value)`"];"
  })
  # import * as X from "./x.js";  →  const X = __m["x"];
  $src = [regex]::Replace($src, 'import\s+\*\s+as\s+(\w+)\s+from\s*["'']\./([\w.\-]+)\.js["''];', {
    param($m) return "const $($m.Groups[1].Value) = __m[`"$($m.Groups[2].Value)`"];"
  })
  if ($src -match '(?m)^\s*import\s') { throw "$name.js: 변환하지 못한 import 구문이 있음" }

  # export const/function X  →  const/function X  (이름은 모아서 모듈 객체로 반환)
  $names = [regex]::Matches($src, '(?m)^export\s+(?:async\s+)?(?:const|let|function|class)\s+(\w+)') | ForEach-Object { $_.Groups[1].Value }
  $src = [regex]::Replace($src, '(?m)^export\s+', '')
  if ($src -match '(?m)^\s*export\s') { throw "$name.js: 변환하지 못한 export 구문이 있음" }

  [void]$sb.AppendLine("// ===== src/$name.js =====")
  [void]$sb.AppendLine("__m[`"$name`"] = (function () {")
  [void]$sb.AppendLine('"use strict";')
  [void]$sb.AppendLine($src)
  [void]$sb.AppendLine("return { $($names -join ', ') };")
  [void]$sb.AppendLine("})();")
}
$js = $sb.ToString()
if ($js -match '</script') { throw "스크립트 안에 </script 문자열이 있어 인라인 불가" }

# index.html: 모듈 스크립트 태그를 합친 스크립트로 교체, CSS·img의 에셋 경로를 data URI로
$html = ReadText (Join-Path $root "index.html")
# ./assets/ui/x.png, ./assets/sprites/heroes/x.png 처럼 하위 폴더가 있는 경로도 통째로 잡는다
$html = [regex]::Replace($html, '\./assets/((?:[\w\-]+/)+[\w.\-]+\.(?:png|ogg|jpg|woff2|svg))', {
  param($m) return (DataUri (Join-Path $root ("assets\" + $m.Groups[1].Value.Replace("/", "\"))))
})
# Codex 개편 CSS(rework.css)는 <link>로 붙어 있으므로 인라인 <style>로 바꾼다(안의 ../assets/ 경로도 data URI)
$cssTag = '<link rel="stylesheet" href="./src/rework.css" />'
if ($html.Contains($cssTag)) {
  $css = ReadText (Join-Path $root "src\rework.css")
  $css = [regex]::Replace($css, '\.\./assets/((?:[\w\-]+/)+[\w.\-]+\.(?:png|ogg|jpg|woff2|svg))', {
    param($m) return (DataUri (Join-Path $root ("assets\" + $m.Groups[1].Value.Replace("/", "\"))))
  })
  if ($css -match '</style') { throw "rework.css 안에 </style 문자열이 있어 인라인 불가" }
  $html = $html.Replace($cssTag, "<style>`n$css`n</style>")
}
$tag = '<script type="module" src="./src/main.js"></script>'
if (-not $html.Contains($tag)) { throw "index.html에서 main.js 스크립트 태그를 찾지 못함" }
$html = $html.Replace($tag, "<script>`n$js</script>")

New-Item -ItemType Directory -Force $outDir | Out-Null
$out = Join-Path $outDir "LUMEN.html"
[System.IO.File]::WriteAllText($out, $html, $utf8)
Copy-Item (Join-Path $root "ASSET_CREDITS.md") $outDir -Force
"생성: $out ($([Math]::Round((Get-Item $out).Length / 1KB)) KB)"
