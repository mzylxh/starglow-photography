#!/usr/bin/env pwsh
<#
.SYNOPSIS
  从照片中提取光圈 / 快门 / 焦距（EXIF），输出可直接填入 config.js 的参数文本。

.DESCRIPTION
  使用系统自带的 System.Drawing 读取 EXIF，无需安装任何依赖。
  支持 .jpg / .jpeg / .tif / .tiff / .png（PNG 多数没有 EXIF，会提示“无 EXIF”）。
  RAW（CR2/ARW/NEF 等）请先导出 JPG 再提取。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\extract-exif.ps1 -Folder "D:\照片\山岳"

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\extract-exif.ps1 -Folder "D:\照片" -Recurse -Json
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Folder,

  [switch]$Recurse,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

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

if (-not (Test-Path -LiteralPath $Folder)) {
  Write-Error "找不到文件夹：$Folder"
  exit 1
}

$files = Get-ChildItem -LiteralPath $Folder -File -Recurse:$Recurse |
  Where-Object { $_.Extension -match '^\.(jpe?g|tiff?|png)$' }

if ($files.Count -eq 0) {
  Write-Host "该文件夹下没有找到 JPG/TIFF/PNG 图片：$Folder"
  exit 0
}

$results = @()
foreach ($f in $files) {
  $aperture = ''; $exposure = ''; $focal = ''
  $bmp = $null
  try {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $dict = @{}
    foreach ($it in $bmp.PropertyItems) { $dict[$it.Id] = $it.Value }

    if ($dict.ContainsKey(0x829D)) {
      $r = Get-Rational $dict[0x829D]
      if ($r) { $aperture = Format-Aperture $r.Num $r.Den }
    }
    if ($dict.ContainsKey(0x829A)) {
      $r = Get-Rational $dict[0x829A]
      if ($r) { $exposure = Format-Exposure $r.Num $r.Den }
    }
    if ($dict.ContainsKey(0x920A)) {
      $r = Get-Rational $dict[0x920A]
      if ($r) { $focal = Format-Focal $r.Num $r.Den }
    }
  } catch {
    Write-Warning ("读取失败，已跳过：{0}（{1}）" -f $f.Name, $_.Exception.Message)
  } finally {
    if ($bmp) { $bmp.Dispose() }
  }

  $parts = @($aperture, $exposure, $focal) | Where-Object { $_ }
  $meta = $parts -join ' · '
  $results += [PSCustomObject]@{
    File = $f.Name
    Meta = $meta
    Aperture = $aperture
    Exposure = $exposure
    Focal = $focal
  }
}

if ($Json) {
  $results | ConvertTo-Json -Depth 3
} else {
  foreach ($r in $results) {
    if ($r.Meta) {
      Write-Host ("{0}`t{1}" -f $r.File, $r.Meta)
    } else {
      Write-Host ("{0}`t无 EXIF 参数" -f $r.File)
    }
  }
  Write-Host ""
  Write-Host ("共 {0} 张，其中 {1} 张识别到参数。" -f $results.Count, @($results | Where-Object { $_.Meta }).Count)
}
