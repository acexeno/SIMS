# 🚨 HOSTINGER DEPLOYMENT FIX - 401 Unauthorized Error

## Problem Identified
Your SIMS system is getting a **401 Unauthorized** error because the `.env` file on Hostinger is missing the critical **JWT_SECRET** and **REFRESH_JWT_SECRET** configuration.

## Root Cause
From the image you showed, I can see that your `.env` file on Hostinger has:
- ✅ Database configuration (correct)
- ❌ **Missing JWT_SECRET** (causing 401 error)
- ❌ **Missing REFRESH_JWT_SECRET** (causing 401 error)

## Solution

### Step 1: Update Your .env File on Hostinger

Replace your current `.env` file content with this complete configuration:

```env
# Environment Configuration for PC Building System - PRODUCTION
# This file contains production settings for Hostinger deployment

# Application Environment
APP_ENV=production
APP_DEBUG=0
APP_TIMEZONE=Asia/Manila
APP_NAME=SIMS

# Database Configuration - PRODUCTION SETTINGS
DB_HOST=localhost
DB_NAME=u709288172_builditpc_db
DB_USER=u709288172_sims
DB_PASS=Egiesims1@
DB_PORT=3306
DB_CHARSET=utf8mb4
DB_NAME_PREFIX=u709288172

# JWT Configuration - PRODUCTION SECRETS (CRITICAL FOR AUTHENTICATION!)
JWT_SECRET=builditpc_super_secure_jwt_secret_key_2024_production_ready_12345
JWT_EXPIRY=7200
REFRESH_JWT_SECRET=builditpc_refresh_token_secret_key_2024_production_ready_67890
REFRESH_JWT_EXPIRY=1209600

# OTP Configuration
OTP_REQUEST_COOLDOWN=60
OTP_MAX_PER_HOUR=5
OTP_TTL_MINUTES=5

# Email Configuration (for Gmail)
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_AUTH=gmail_oauth
GMAIL_USER=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# From details
MAIL_FROM_ADDRESS=
MAIL_FROM_NAME="SIMS"

# Security Configuration
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_TIME=900
SESSION_TIMEOUT=3600
PASSWORD_MIN_LENGTH=8

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# CORS Configuration - PRODUCTION DOMAIN
CORS_ALLOWED_ORIGINS=https://egiesims.shop,https://www.egiesims.shop

# Logging Configuration
LOG_LEVEL=error
LOG_FILE=logs/app.log

# Cache Configuration
CACHE_ENABLED=1
CACHE_TTL=3600
```

### Step 2: Upload the Fix Script (Optional)

Upload the `fix-hostinger-deployment.php` file to your Hostinger server and run it to verify the configuration:

```bash
php fix-hostinger-deployment.php
```

### Step 3: Test Login

After updating the `.env` file:
1. Clear your browser cache
2. Try logging in again with:
   - Username: `admin@example.com`
   - Password: `Admin2024!@#`

## Why This Fixes the Issue

The 401 Unauthorized error occurs because:

1. **JWT_SECRET Missing**: The backend can't generate or verify JWT tokens
2. **REFRESH_JWT_SECRET Missing**: Token refresh fails
3. **Authentication Flow Breaks**: Without proper JWT secrets, the login process fails

## Additional Notes

- **npm run build** is NOT needed - this is a backend configuration issue
- The frontend build is already correct
- The issue is purely in the server-side environment configuration

## Verification

After applying the fix, you should see:
- ✅ Login works without 401 errors
- ✅ JWT tokens are generated properly
- ✅ Authentication flow completes successfully

## If Still Having Issues

1. Check that the `.env` file is in the root directory of your website
2. Verify file permissions (should be readable by PHP)
3. Check Hostinger error logs for any PHP errors
4. Run the diagnostic script: `php fix-hostinger-deployment.php`

---

**This fix should resolve your 401 Unauthorized error immediately!** 🚀
