#!/usr/bin/env pwsh
<#
.SYNOPSIS
  为 assets/photos/ 下已有的网页版照片生成响应式缩略图：
  assets/photos/thumbs/<分类路径>/<文件名>-800.jpg / -1400.jpg

.DESCRIPTION
  只读取 assets/photos/ 下现有的 JPG（不含 thumbs 目录），不会改动原图。
  缩略图用于图库网格（手机加载 -800，桌面加载 -1400），灯箱仍用原图。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\make-thumbs.ps1
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$photoRoot = (Resolve-Path 'assets/photos').Path
$thumbRoot = Join-Path $photoRoot 'thumbs'
$sizes = @(
  @{ Name = '-800';  Max = 800;  Quality = 76 },
  @{ Name = '-1400'; Max = 1400; Quality = 78 }
)

function New-Thumbnail([System.Drawing.Bitmap]$src, [string]$dst, [int]$maxEdge, [int]$quality) {
  $w = $src.Width; $h = $src.Height
  $scale = [double]$maxEdge / [double][Math]::Max($w, $h)
  if ($scale -gt 1) { $scale = 1 }
  $nw = [Math]::Max(1, [int][Math]::Round($w * $scale))
  $nh = [Math]::Max(1, [int][Math]::Round($h * $scale))

  $nb = New-Object System.Drawing.Bitmap($nw, $nh)
  $g = [System.Drawing.Graphics]::FromImage($nb)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($src, 0, 0, $nw, $nh)
  $g.Dispose()

  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$quality)
  $nb.Save($dst, $codec, $ep)
  $nb.Dispose()
}

$files = @(Get-ChildItem -LiteralPath $photoRoot -Recurse -File -Filter *.jpg |
  Where-Object { $_.FullName -notlike "$thumbRoot*" })
$n = 0
foreach ($f in $files) {
  $relDir = $f.Directory.FullName.Substring($photoRoot.Length).TrimStart('\', '/')
  $outDir = Join-Path $thumbRoot $relDir
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)

  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    foreach ($s in $sizes) {
      $dst = Join-Path $outDir ($stem + $s.Name + '.jpg')
      New-Thumbnail $bmp $dst $s.Max $s.Quality
    }
    $n++
    if ($n % 40 -eq 0) { Write-Host ("Generated {0} thumbs..." -f $n) }
  } catch {
    Write-Warning ("Skipped: {0} ({1})" -f $f.FullName, $_.Exception.Message)
  } finally {
    if ($bmp) { $bmp.Dispose() }
  }
}

Write-Host ("Done: generated thumbs for {0} photos in {1}" -f $n, $thumbRoot)
