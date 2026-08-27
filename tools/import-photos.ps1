#!/usr/bin/env pwsh
<#
.SYNOPSIS
  把本地照片批量导入网站：压缩为网页版 JPG、读取 EXIF（光圈/快门/焦距）、
  随机打乱顺序，并自动生成 assets/js/config.js。

.DESCRIPTION
  原始照片不会被修改，只会把压缩后的副本写进 assets/photos/。
  检测不到 EXIF 参数的照片不会写入参数。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\import-photos.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\import-photos.ps1 -Only qingyuan -OutConfig "$env:TEMP\test-config.js"
#>
param(
  [string]$OutConfig = "assets/js/config.js",
  [int]$MaxEdge = 1920,
  [int]$Quality = 82,
  [string]$Only = ""
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# ---------- 分类与本地路径（来自《网站上传照片分类及路径.docx》） ----------
$CATS = @(
  @{ id='beijing';    title='北境来信'; en='Letters from the North';    desc='边境线上，有一个夏天。';            src='D:\辽吉山海·边境风光\成品\网站上传' },
  @{ id='jiangzhe';   title='江浙风韵'; en='Jiangnan Charm';            desc='水乡烟雨，桨声灯影，是江南未做完的旧梦。'; src='D:\江浙\成品\网站上传' },
  @{ id='yangtze';    title='雪落长江'; en='Snow on the Yangtze';       desc='江水因寒落，山云为雪凝。';          src='D:\2026寒假\湖北游\照片成品\网站上传' },
  @{ id='hometown';   title='故土情深'; en='Homeland';                  desc='归途即原点，乡愁有相框。';          src='D:\2026寒假\2026.2\合肥老家 照片成品\网站上传' },
  @{ id='guizhou';    title='多彩贵州'; en='Colorful Guizhou';          desc='苗岭深处，色彩泼洒成歌，山水自有神灵。'; src='D:\2026春季\5.2-5.5 贵州\网站上传' },
  @{ id='nanyang';    title='南洋风语'; en='Voices of Southeast Asia';  desc='赤道阳光，椰影婆娑，风里藏着热带的秘密耳语。'; src='D:\2025秋季\新马 10.1-10.7\网站上传' },
  @{ id='qinggan';    title='青甘行纪'; en='Qinghai-Gansu Journey';     desc='车轮碾过戈壁的风，山河流转成磅礴的诗篇。'; src='D:\2025暑假\青甘2025.8.2-10\网站上传' },
  @{ id='qingyuan';   title='清远山水'; en='Qingyuan Landscape';         desc='清波远山，一叶扁舟。';              src='D:\2025暑假\清远2025.7.5-6\网站上传' },
  @{ id='shantou';    title='汕头海韵'; en='Shantou by the Sea';        desc='潮声起落，渔火点点。';              src='D:\2025暑假\汕头2025.6.21-22\网站上传' },
  @{ id='wuhan';      title='江城武汉'; en='Wuhan, City of Rivers';     desc='两江交汇，桥都灯火。';              src='D:\2025暑假\武汉2025.8.13-16\网站上传' },
  @{ id='xiangxi';    title='湘西秘境'; en='Hidden Xiangxi';             desc='吊脚楼影，沱江夜雨。';              src='D:\2025暑假\湘西2025.7.22-26\网站上传' },
  @{ id='chongqing';  title='山城重庆'; en='Mountain City Chongqing';   desc='轻轨穿楼，云雾绕城。';              src='D:\2025暑假\重庆2025.7.9-13\网站上传' },
  @{ id='film';       title='菲林时光'; en='Film Days';                 desc=''; sub=@(
    @{ id='kodak400'; title='柯达全能400'; en='Kodak ColorPlus 400'; src='D:\胶片\柯达全能400\已调整\网站上传' },
    @{ id='kodak200'; title='柯达易拍200'; en='Kodak Easy 200';       src='D:\胶片\柯达易拍200\已调整\网站上传' },
    @{ id='fuji400-1'; title='富士C400-1'; en='Fujifilm C400 · 1';    src='D:\胶片\富士C400\已调整\网站上传' },
    @{ id='fuji400-2'; title='富士C400-2'; en='Fujifilm C400 · 2';    src='D:\胶片\富士C400 2024高三始\网站上传' }
  )}
)

# ---------- EXIF 解析 ----------
function Get-Rational([byte[]]$bytes) {
  if ($null -eq $bytes -or $bytes.Length -lt 8) { return $null }
  $num = [BitConverter]::ToUInt32($bytes, 0)
  $den = [BitConverter]::ToUInt32($bytes, 4)
  if ($den -eq 0) { return $null }
  return @{ Num = $num; Den = $den }
}

function Format-Exposure($num, $den) {
  if ($num -eq 0 -or $den -eq 0) { return '' }
  $v = $num / $den
  if ($v -lt 1) {
    $d = [Math]::Max(1, [Math]::Round($den / $num))
    return "1/${d}s"
  }
  if ($v -lt 10) { return ("{0:0.#}s" -f $v) }
  return ("{0:0}s" -f $v)
}

function Format-Aperture($num, $den) {
  if ($num -eq 0 -or $den -eq 0) { return '' }
  $v = $num / $den
  if ([Math]::Abs($v - [Math]::Round($v)) -lt 0.05) { return ("f/{0:0}" -f $v) }
  return ("f/{0:0.#}" -f $v)
}

function Format-Focal($num, $den) {
  if ($num -eq 0 -or $den -eq 0) { return '' }
  $v = $num / $den
  if ([Math]::Abs($v - [Math]::Round($v)) -lt 0.05) { return ("{0:0}mm" -f $v) }
  return ("{0:0.#}mm" -f $v)
}

function Get-MetaFromFile($path) {
  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $dict = @{}
    foreach ($it in $bmp.PropertyItems) { $dict[$it.Id] = $it.Value }
    $a = ''; $e = ''; $f = ''
    if ($dict.ContainsKey(0x829D)) { $r = Get-Rational $dict[0x829D]; if ($r) { $a = Format-Aperture $r.Num $r.Den } }
    if ($dict.ContainsKey(0x829A)) { $r = Get-Rational $dict[0x829A]; if ($r) { $e = Format-Exposure $r.Num $r.Den } }
    if ($dict.ContainsKey(0x920A)) { $r = Get-Rational $dict[0x920A]; if ($r) { $f = Format-Focal $r.Num $r.Den } }
    return (@($a, $e, $f) | Where-Object { $_ }) -join ' · '
  } catch {
    return ''
  } finally {
    if ($bmp) { $bmp.Dispose() }
  }
}

function Reduce-Ratio($w, $h) {
  $a = [int]$w; $b = [int]$h
  while ($b -ne 0) { $t = $b; $b = $a % $b; $a = $t }
  if ($a -le 0) { $a = 1 }
  return ("{0}/{1}" -f [int]($w / $a), [int]($h / $a))
}

function Resize-Jpeg($src, $dst, $maxEdge, $quality) {
  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($src)
    $orient = 1
    try {
      $pi = $bmp.GetPropertyItem(0x0112)
      if ($pi -and $pi.Value -and $pi.Value.Length -ge 2) { $orient = $pi.Value[1] }
    } catch { }

    $srcW = $bmp.Width; $srcH = $bmp.Height
    if ($orient -eq 6 -or $orient -eq 8) { $sw = $srcH; $sh = $srcW } else { $sw = $srcW; $sh = $srcH }
    $scale = [double]$maxEdge / [double][Math]::Max($sw, $sh)
    if ($scale -gt 1) { $scale = 1 }
    $nw = [Math]::Max(1, [int][Math]::Round($sw * $scale))
    $nh = [Math]::Max(1, [int][Math]::Round($sh * $scale))

    $nb = New-Object System.Drawing.Bitmap($nw, $nh)
    $g = [System.Drawing.Graphics]::FromImage($nb)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Black)

    $rect = New-Object System.Drawing.Rectangle(0, 0, $nw, $nh)
    if ($orient -eq 6) { $g.TranslateTransform($nw, 0); $g.RotateTransform(90) }
    elseif ($orient -eq 8) { $g.TranslateTransform(0, $nh); $g.RotateTransform(-90) }
    elseif ($orient -eq 3) { $g.TranslateTransform($nw, $nh); $g.RotateTransform(180) }
    $g.DrawImage($bmp, $rect)
    $g.Dispose()

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
    $nb.Save($dst, $codec, $ep)
    $nb.Dispose()
    return Reduce-Ratio $nw $nh
  } catch {
    Write-Warning ("跳过失败文件：{0}（{1}）" -f $src, $_.Exception.Message)
    return $null
  } finally {
    if ($bmp) { $bmp.Dispose() }
  }
}

function Process-Dir($src, $targetRoot, $catId, $subId) {
  $target = Join-Path $targetRoot $subId
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  $files = @(Get-ChildItem -LiteralPath $src -File |
    Where-Object { $_.Extension -match '(?i)^\.(jpe?g|tiff?|png)$' } |
    Sort-Object { Get-Random })
  $items = @()
  $idx = 0
  foreach ($f in $files) {
    $idx++
    $name = '{0:D3}.jpg' -f $idx
    $dst = Join-Path $target $name
    $meta = Get-MetaFromFile $f.FullName
    $ratio = Resize-Jpeg $f.FullName $dst $MaxEdge $Quality
    if (-not $ratio) { continue }
    $rel = 'assets/photos/{0}/{1}{2}' -f $catId, $(if ($subId) { $subId + '/' } else { '' }), $name
    $items += [PSCustomObject]@{
      src   = $rel
      ratio = $ratio
      title = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
      meta  = $meta
    }
  }
  return $items
}

# ---------- JSON 生成 ----------
function Convert-JsonUnicode([string]$json) {
  $regex = [regex]'\\u([0-9a-fA-F]{4})'
  $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
    param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16)
  }
  return $regex.Replace($json, $evaluator)
}

# ---------- 主流程 ----------
$photoRoot = Join-Path (Resolve-Path 'assets/photos').Path '.'
$gallery = @()
$n = 0
foreach ($cat in $CATS) {
  if ($Only -and $cat.id -ne $Only) { continue }
  $n++
  Write-Host ("处理分类：{0}（{1}）" -f $cat.title, $cat.src)
  $catRoot = Join-Path $photoRoot $cat.id
  New-Item -ItemType Directory -Force -Path $catRoot | Out-Null
  if ($cat.sub) {
    $subs = @()
    foreach ($s in $cat.sub) {
      $imgs = @(Process-Dir $s.src $catRoot $cat.id $s.id)
      Write-Host ("  · {0}：{1} 张" -f $s.title, $imgs.Count)
      $subs += [PSCustomObject]@{ id = $s.id; title = $s.title; en = $s.en; images = $imgs }
    }
    $gallery += [PSCustomObject]@{ num = ('{0:D2}' -f $n); id = $cat.id; title = $cat.title; en = $cat.en; desc = $cat.desc; sub = $subs }
  } else {
    $imgs = @(Process-Dir $cat.src $catRoot $cat.id '')
    Write-Host ("  · {0} 张" -f $imgs.Count)
    $gallery += [PSCustomObject]@{ num = ('{0:D2}' -f $n); id = $cat.id; title = $cat.title; en = $cat.en; desc = $cat.desc; images = $imgs }
  }
}

$galleryJson = Convert-JsonUnicode ($gallery | ConvertTo-Json -Depth 8)

$siteBlock = @"
/* ============================================================
   站点配置 —— 改这里就能换名字、换分类、换照片
   照片：assets/photos/ 下按分类存放（001.jpg 起，自动压缩为网页版）
   ============================================================ */

window.SITE = {
  name: "满载一缕星辉",
  en: "Starglow",
  role: "风光摄影师 · Landscape Photographer",
  email: "baowenze2007@foxmail.com",
  location: "现居中国 · 常在山野与海岸之间游走",
  socials: [
    { label: "微信", text: "mzylxh070807" }
  ]
};

window.GALLERY = $galleryJson;
"@

[System.IO.File]::WriteAllText($OutConfig, $siteBlock, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ""
Write-Host ("完成：{0} 个分类，配置已写入 {1}" -f $n, $OutConfig)
