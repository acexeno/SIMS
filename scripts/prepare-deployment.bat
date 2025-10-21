@echo off
REM BuildIt PC - Hostinger Deployment Script (Windows)
REM This script prepares the deployment package for Hostinger

echo 🚀 BuildIt PC - Hostinger Deployment Preparation
echo ==============================================

REM Check if we're in the right directory
if not exist "hostinger-deployment" (
    echo ❌ Error: hostinger-deployment folder not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

echo ✅ Found hostinger-deployment folder

REM Create production environment file
echo 📝 Creating production environment file...
(
echo # Environment Configuration for PC Building System - PRODUCTION
echo # This file contains production settings for Hostinger deployment
echo.
echo # Application Environment
echo APP_ENV=production
echo APP_DEBUG=0
echo APP_TIMEZONE=Asia/Manila
echo APP_NAME=SIMS
echo.
echo # Database Configuration - UPDATE THESE WITH YOUR HOSTINGER CREDENTIALS
echo DB_HOST=localhost
echo DB_NAME=u709288172_builditpc_db
echo DB_USER=u709288172_sims
echo DB_PASS=YOUR_HOSTINGER_DB_PASSWORD_HERE
echo DB_PORT=3306
echo DB_CHARSET=utf8mb4
echo.
echo # JWT Configuration - PRODUCTION SECRETS ^(CHANGE THESE!^)
echo JWT_SECRET=builditpc_production_jwt_secret_2024_change_this_immediately
echo JWT_EXPIRY=7200
echo REFRESH_JWT_SECRET=builditpc_production_refresh_jwt_secret_2024_change_this_too
echo REFRESH_JWT_EXPIRY=1209600
echo.
echo # OTP Configuration
echo OTP_REQUEST_COOLDOWN=60
echo OTP_MAX_PER_HOUR=5
echo OTP_TTL_MINUTES=5
echo.
echo # Email Configuration ^(Optional - for OTP and notifications^)
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo SMTP_USERNAME=your_email@gmail.com
echo SMTP_PASSWORD=your_app_password
echo SMTP_FROM_EMAIL=noreply@builditpc.com
echo SMTP_FROM_NAME=BuildItPC
echo.
echo # Security Configuration
echo LOGIN_MAX_ATTEMPTS=5
echo LOGIN_LOCKOUT_TIME=900
echo SESSION_TIMEOUT=3600
echo PASSWORD_MIN_LENGTH=8
echo.
echo # File Upload Configuration
echo MAX_FILE_SIZE=5242880
echo ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif
echo.
echo # CORS Configuration - UPDATE WITH YOUR DOMAIN
echo CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
echo.
echo # Logging Configuration
echo LOG_LEVEL=error
echo LOG_FILE=logs/app.log
echo.
echo # Cache Configuration
echo CACHE_ENABLED=1
echo CACHE_TTL=3600
) > hostinger-deployment\.env

echo ✅ Created .env file with production settings

REM Verify deployment package structure
echo 🔍 Verifying deployment package structure...

if exist "hostinger-deployment\.htaccess" (
    echo ✅ .htaccess
) else (
    echo ❌ Missing: .htaccess
)

if exist "hostinger-deployment\.env" (
    echo ✅ .env
) else (
    echo ❌ Missing: .env
)

if exist "hostinger-deployment\dist\index.html" (
    echo ✅ dist\index.html
) else (
    echo ❌ Missing: dist\index.html
)

if exist "hostinger-deployment\backend\health.php" (
    echo ✅ backend\health.php
) else (
    echo ❌ Missing: backend\health.php
)

if exist "hostinger-deployment\backend\api\index.php" (
    echo ✅ backend\api\index.php
) else (
    echo ❌ Missing: backend\api\index.php
)

if exist "hostinger-deployment\vendor\autoload.php" (
    echo ✅ vendor\autoload.php
) else (
    echo ❌ Missing: vendor\autoload.php
)

REM Count images
for /f %%i in ('dir /s /b hostinger-deployment\dist\images\*.png hostinger-deployment\dist\images\*.svg 2^>nul ^| find /c /v ""') do set image_count=%%i
echo 📸 Component images: %image_count% files

REM Check build files
if exist "hostinger-deployment\dist\assets\index-*.css" (
    echo ✅ CSS bundle found
) else (
    echo ❌ CSS bundle missing
)

if exist "hostinger-deployment\dist\assets\index-*.js" (
    echo ✅ JS bundle found
) else (
    echo ❌ JS bundle missing
)

echo.
echo 🎯 DEPLOYMENT PACKAGE READY!
echo =============================
echo.
echo 📋 NEXT STEPS:
echo 1. Update database credentials in hostinger-deployment\.env
echo 2. Update CORS origins with your domain
echo 3. Change JWT secrets for security
echo 4. Zip the hostinger-deployment folder
echo 5. Upload to Hostinger public_html\
echo 6. Extract and test with /backend/health.php
echo.
echo 📖 See DEPLOYMENT_READY.md for detailed instructions
echo.
echo 🚀 Ready for Hostinger deployment!
echo.
pause

