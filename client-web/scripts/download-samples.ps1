# 批量下载示例视频到 public/videos/samples 目录
# 使用说明：在 PowerShell 里执行此脚本，自动创建目录并下载。
# 注意：示例链接多为公开测试源，带宽和可用性不保证。建议先小批量验证，再扩充到100条。

param(
  [string]$OutputDir = "D:\new_sp\video-platform\client-web\public\videos\samples"
)

$ErrorActionPreference = "Stop"

# 创建输出目录
if (!(Test-Path -Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# 示例源列表（可继续追加）
$urls = @(
  "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4",
  "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4",
  "https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4",
  "https://filesamples.com/samples/video/mp4/sample_640x360.mp4",
  "https://filesamples.com/samples/video/mp4/sample_960x540.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
)

# 下载函数
function Download-File($url, $destPath) {
  Write-Host "Downloading: $url" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $destPath -UseBasicParsing
}

# 执行下载
$idx = 1
foreach ($u in $urls) {
  try {
    $name = Split-Path -Path $u -Leaf
    $dest = Join-Path $OutputDir $name
    Download-File -url $u -destPath $dest
    $idx++
  } catch {
    Write-Warning "Failed: $u => $($_.Exception.Message)"
  }
}

Write-Host "Done. Saved to: $OutputDir" -ForegroundColor Green