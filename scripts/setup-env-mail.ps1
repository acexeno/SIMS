Param(
    [string]$GmailUser = $env:GMAIL_USER,
    [string]$GmailAppPassword = $env:GMAIL_APP_PASSWORD,
    [string]$MailFrom = $env:MAIL_FROM_ADDRESS,
    [string]$MailFromName = $(if ($env:MAIL_FROM_NAME) { $env:MAIL_FROM_NAME } else { 'SIMS' })
)

$ErrorActionPreference = 'Stop'

# Project root is the parent of this script's parent (scripts/..)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$EnvLocal = Join-Path $Root '.env.local'

Write-Host "[setup-env-mail] Project root: $Root"

# Ensure base .env exists; if not, create minimal
$EnvBase = Join-Path $Root '.env'
if (-not (Test-Path $EnvBase)) {
    @(
        'APP_NAME=SIMS',
        'APP_TIMEZONE=Asia/Manila',
        'APP_DEBUG=1'
    ) | Set-Content -Encoding UTF8 $EnvBase
    Write-Host "[setup-env-mail] Created base .env"
}

$lines = @()
$lines += 'APP_ENV=local'
$lines += 'APP_DEBUG=1'
$lines += 'MAIL_AUTH=gmail_password'
$lines += 'MAIL_HOST=smtp.gmail.com'
$lines += 'MAIL_PORT=587'
$lines += 'MAIL_ENCRYPTION=tls'

if (-not [string]::IsNullOrWhiteSpace($GmailUser)) { $lines += "GMAIL_USER=$GmailUser" } else { $lines += 'GMAIL_USER=' }
if (-not [string]::IsNullOrWhiteSpace($GmailAppPassword)) { $lines += "GMAIL_APP_PASSWORD=$GmailAppPassword" } else { $lines += 'GMAIL_APP_PASSWORD=' }
if (-not [string]::IsNullOrWhiteSpace($MailFrom)) { $lines += "MAIL_FROM_ADDRESS=$MailFrom" } else { $lines += 'MAIL_FROM_ADDRESS=' }
if (-not [string]::IsNullOrWhiteSpace($MailFromName)) { $lines += "MAIL_FROM_NAME=$MailFromName" } else { $lines += 'MAIL_FROM_NAME=SIMS' }

$lines += 'OTP_TTL_MINUTES=5'
$lines += 'OTP_REQUEST_COOLDOWN=60'
$lines += 'OTP_MAX_PER_HOUR=5'

$content = ($lines -join "`n") + "`n"
Set-Content -Encoding UTF8 -Path $EnvLocal -Value $content
Write-Host "[setup-env-mail] Wrote $EnvLocal"

Write-Host "[setup-env-mail] Done. You can now test mail via backend/tools/mail_test_cli.php"

