# ============================================================
# Nexus Video Platform — Release Script (版本发布)
# Usage: .\scripts\release.ps1 -Version "2.3.0" -Message "feat: new feature"
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    
    [Parameter(Mandatory = $true)]
    [string]$Message,
    
    [switch]$DryRun,          # 只显示会做什么，不实际执行
    [switch]$SkipPush         # 只提交不推送
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "  📦 NEXUS PLATFORM — Release v$Version" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor DarkGray
Write-Host ""

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "  ❌ Invalid version format. Use: X.Y.Z (e.g. 2.3.0)" -ForegroundColor Red
    exit 1
}

# Check for uncommitted changes
Set-Location $ROOT
$status = git status --porcelain
if (-not $status -and -not $DryRun) {
    Write-Host "  ❌ No changes to commit!" -ForegroundColor Red
    exit 1
}

# Show what will be committed
Write-Host "  📋 Changes to commit:" -ForegroundColor Yellow
git status --short | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
Write-Host ""

if ($DryRun) {
    Write-Host "  🏃 DRY RUN — No changes will be made" -ForegroundColor Yellow
    Write-Host "  Would: bump version → $Version, commit, tag v$Version, push" -ForegroundColor DarkGray
    exit 0
}

# Step 1: Bump version in package.json
Write-Host "  [1/5] 📝 Bumping version to $Version..." -ForegroundColor Yellow
$pkgPath = Join-Path $ROOT "package.json"
$pkg = Get-Content $pkgPath -Raw
$pkg = $pkg -replace '"version":\s*"[^"]*"', "`"version`": `"$Version`""
Set-Content $pkgPath -Value $pkg -NoNewline -Encoding UTF8
Write-Host "        ✅ package.json updated" -ForegroundColor Green

# Step 2: Update CHANGELOG.md
Write-Host "  [2/5] 📖 Updating CHANGELOG..." -ForegroundColor Yellow
$changelogPath = Join-Path $ROOT "CHANGELOG.md"
$date = Get-Date -Format "yyyy-MM-dd"
$header = "## [$Version] - $date"
$entry = @"

$header

### Changes
- $Message

---

"@

$changelog = Get-Content $changelogPath -Raw -Encoding UTF8
$changelog = $changelog -replace '(All notable changes to this project will be documented in this file\.\r?\n)', "`$1`n$entry"
Set-Content $changelogPath -Value $changelog -NoNewline -Encoding UTF8
Write-Host "        ✅ CHANGELOG.md updated" -ForegroundColor Green

# Step 3: Git add all
Write-Host "  [3/5] 📂 Staging changes..." -ForegroundColor Yellow
git add -A
Write-Host "        ✅ All changes staged" -ForegroundColor Green

# Step 4: Commit and tag
Write-Host "  [4/5] 💾 Committing and tagging..." -ForegroundColor Yellow
$commitMsg = "release(v$Version): $Message"
git commit -m $commitMsg
git tag "v$Version"
Write-Host "        ✅ Committed and tagged v$Version" -ForegroundColor Green

# Step 5: Push
if (-not $SkipPush) {
    Write-Host "  [5/5] 🚀 Pushing to GitHub..." -ForegroundColor Yellow
    git push origin main --tags
    Write-Host "        ✅ Pushed to origin/main" -ForegroundColor Green
}
else {
    Write-Host "  [5/5] ⏭️  Push skipped (use 'git push origin main --tags' later)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "  🎉 Release v$Version complete!" -ForegroundColor Green
Write-Host ""
