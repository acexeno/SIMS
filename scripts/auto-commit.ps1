param(
  [Parameter(Position=0, ValueFromRemainingArguments=$true)]
  [string[]]$MessageParts,
  [switch]$NoPush
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
  # Move to the script directory so double-click works from anywhere
  if ($PSCommandPath) {
    Set-Location -Path (Split-Path -Parent $PSCommandPath)
  }
} catch {}

# Verify we are in a git repository
try {
  $inside = git rev-parse --is-inside-work-tree 2>$null
  if (-not $inside) { throw 'Not inside a git work tree' }
} catch {
  Write-Error "Not a git repository. Open a terminal in your repo root or place this script there."
  exit 1
}

# Normalize to repo root
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot
$repoName = Split-Path -Leaf $repoRoot
$branch = git rev-parse --abbrev-ref HEAD

# Check git identity (best-effort)
$userName = try { git config user.name } catch { '' }
$userEmail = try { git config user.email } catch { '' }
if (-not $userName -or -not $userEmail) {
  Write-Warning "Git identity not set. Recommended: git config user.name \"Your Name\"; git config user.email \"you@example.com\""
}

# Build commit message
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
$message = if ($MessageParts -and $MessageParts.Count -gt 0) {
  [string]::Join(' ', $MessageParts)
} else {
  "chore($repoName): automated commit at $ts"
}

# Stage and commit if there are changes
$pending = git status --porcelain
if ($pending) {
  Write-Host "Staging changes..." -ForegroundColor Cyan
  git add -A

  $stagedCount = (git diff --cached --name-only | Measure-Object -Line).Lines
  if (-not $stagedCount) { $stagedCount = 0 }
  Write-Host "Creating commit ($stagedCount files)..." -ForegroundColor Cyan
  git commit -m $message
} else {
  Write-Host "No local changes to commit." -ForegroundColor Yellow
}

# Ensure origin exists
$origin = try { git remote get-url origin } catch { '' }
if (-not $origin) {
  Write-Warning "No 'origin' remote configured. Add one: git remote add origin <url>"
  exit 2
}

# Push unless disabled
if (-not $NoPush) {
  Write-Host "Pushing to origin/$branch..." -ForegroundColor Cyan
  try {
    git push -u origin $branch
  } catch {
    Write-Warning ("Push failed: {0}" -f $_.Exception.Message)
    exit 3
  }
  Write-Host "Done." -ForegroundColor Green
} else {
  Write-Host "Skipping push (NoPush switch)." -ForegroundColor Yellow
}

exit 0
