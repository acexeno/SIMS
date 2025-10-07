# Build and package a clean ZIP for Hostinger deployment
# Usage: Right-click -> Run with PowerShell, or:
#   powershell -ExecutionPolicy Bypass -File scripts/package-for-hostinger.ps1

$ErrorActionPreference = 'Stop'

# Paths
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$DistDir     = Join-Path $ProjectRoot 'dist'
$BackendDir  = Join-Path $ProjectRoot 'backend'
$OutRoot     = Join-Path $ProjectRoot 'deploy'
$Stamp       = Get-Date -Format 'yyyyMMdd-HHmmss'
$OutDir      = Join-Path $OutRoot "hostinger-$Stamp"
$ZipPath     = Join-Path $OutRoot "builditpc-hostinger-$Stamp.zip"

# Ensure output dirs
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

Write-Host "[1/5] Installing frontend deps (npm install)" -ForegroundColor Cyan
Push-Location $ProjectRoot
# Ensure the dev server isn't locking esbuild.exe
try {
  $owning = Get-NetTCPConnection -LocalPort 5175 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
  if ($owning) { Write-Host "Stopping dev server PID $owning"; Stop-Process -Id $owning -Force }
} catch {}
Stop-Process -Name esbuild -ErrorAction SilentlyContinue -Force
npm install

Write-Host "[2/5] Building frontend (npm run build)" -ForegroundColor Cyan
npm run build
Pop-Location

# Copy minimal files
Write-Host "[3/5] Preparing staging directory" -ForegroundColor Cyan

# DO NOT copy the repository .htaccess.
# Instead, generate a deployment-optimized .htaccess that assumes the build is flattened to the web root.
if (Test-Path (Join-Path $ProjectRoot '.env')) {
  Write-Warning 'Skipping copying .env automatically. Create it manually on Hostinger.'
}

# Flatten frontend build into the deploy root so /assets/* and /images/* exist physically
Copy-Item (Join-Path $DistDir 'index.html') -Destination (Join-Path $OutDir 'index.html') -Force
if (Test-Path (Join-Path $DistDir 'assets')) { Copy-Item (Join-Path $DistDir 'assets') -Destination (Join-Path $OutDir 'assets') -Recurse -Force }
if (Test-Path (Join-Path $DistDir 'images')) { Copy-Item (Join-Path $DistDir 'images') -Destination (Join-Path $OutDir 'images') -Recurse -Force }

# Generate a simple, safe SPA .htaccess that will not rewrite /assets or /images requests
$htaccess = @'
Options -Indexes -MultiViews
DirectoryIndex index.html

<IfModule mod_mime.c>
  AddType application/javascript .js .mjs
  AddType text/css .css
  AddType application/wasm .wasm
  AddType application/json .json
  AddType image/svg+xml .svg
  AddType application/manifest+json .webmanifest .manifest
</IfModule>

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Pass Authorization header (for JWT in PHP)
  SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1
  RewriteCond %{HTTP:Authorization} ^(.*)
  RewriteRule ^(.*)$ - [E=HTTP_AUTHORIZATION:%1]

  # Never rewrite static assets
  RewriteRule ^assets/ - [L]
  RewriteRule ^images/ - [L]
  RewriteRule ^favicon\.ico$ - [L]
  RewriteRule ^.*\.(js|mjs|css|png|jpg|jpeg|gif|svg|webp|ico|ttf|woff|woff2|json|map)$ - [L]

  # Do not rewrite backend or api requests
  RewriteCond %{REQUEST_URI} ^/(backend|api)/ [NC]
  RewriteRule ^ - [L]

  # Serve existing files directly
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # SPA fallback
  RewriteRule ^ index.html [L]
</IfModule>
'@
Set-Content -Path (Join-Path $OutDir '.htaccess') -Value $htaccess -NoNewline

# Copy backend selective (lives at /backend in production)
$OutBackend = Join-Path $OutDir 'backend'
New-Item -ItemType Directory -Path $OutBackend -Force | Out-Null

# Include backend essentials
$include = @(
  'api',
  'config',
  'database',
  'public',
  'middleware',
  'migrations',
  'scripts',
  'index.php',
  '.htaccess'
)
foreach ($item in $include) {
  $src = Join-Path $BackendDir $item
  if (Test-Path $src) {
    Copy-Item $src -Destination $OutBackend -Recurse -Force
  }
}

# Remove dev/unnecessary files from staging
Write-Host "[4/5] Cleaning staging" -ForegroundColor Cyan
$patternsToRemove = @(
  # Logs and debug outputs
  'logs',
  '*.log',
  'backend/api/*debug*.log',
  # Vendor (composer) - not used by current code; include if you wire email later
  'backend/vendor',
  # Local tools, datasets, docs, python helpers
  'node_modules',
  '.git',
  '.github',
  'docs',
  'PCAssemblyimages',
  '*.csv',
  '*.txt',
  '*.md',
  '*.bak',
  '*~'
)

foreach ($pat in $patternsToRemove) {
  Get-ChildItem -Path $OutDir -Recurse -Force -Include $pat -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Ensure DB installer exists
$installer = Join-Path $OutBackend 'scripts/install_database.php'
if (-not (Test-Path $installer)) {
  Write-Warning 'Database installer missing. Schema import must be done manually via phpMyAdmin.'
}

# Zip it
Write-Host "[5/5] Creating ZIP: $ZipPath" -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($OutDir, $ZipPath)

Write-Host "Done. Upload $ZipPath to Hostinger public_html/." -ForegroundColor Green
