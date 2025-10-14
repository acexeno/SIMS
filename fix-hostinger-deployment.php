<?php
// Fix Hostinger Deployment - Environment Configuration
// This script helps fix the 401 Unauthorized error by ensuring proper JWT configuration

echo "🔧 SIMS Hostinger Deployment Fix\n";
echo "================================\n\n";

// Check if .env file exists
$envPath = __DIR__ . '/.env';
if (!file_exists($envPath)) {
    echo "❌ .env file not found! Creating it...\n";
    
    $envContent = '# Environment Configuration for PC Building System - PRODUCTION
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
CACHE_TTL=3600';

    if (file_put_contents($envPath, $envContent)) {
        echo "✅ .env file created successfully!\n";
    } else {
        echo "❌ Failed to create .env file. Please create it manually.\n";
        exit(1);
    }
} else {
    echo "✅ .env file exists\n";
}

// Load environment configuration
require_once __DIR__ . '/backend/config/env.php';

// Test JWT configuration
echo "\n🔍 Testing JWT Configuration...\n";
$jwtSecret = env('JWT_SECRET');
$refreshSecret = env('REFRESH_JWT_SECRET');

if (empty($jwtSecret) || $jwtSecret === 'builditpc_secret_key_2024_change_in_production') {
    echo "❌ JWT_SECRET is not properly configured!\n";
    echo "   Current value: " . ($jwtSecret ?: 'EMPTY') . "\n";
    echo "   This is causing the 401 Unauthorized error!\n";
} else {
    echo "✅ JWT_SECRET is configured: " . substr($jwtSecret, 0, 20) . "...\n";
}

if (empty($refreshSecret) || $refreshSecret === 'builditpc_secret_key_2024_change_in_production') {
    echo "❌ REFRESH_JWT_SECRET is not properly configured!\n";
    echo "   Current value: " . ($refreshSecret ?: 'EMPTY') . "\n";
} else {
    echo "✅ REFRESH_JWT_SECRET is configured: " . substr($refreshSecret, 0, 20) . "...\n";
}

// Test database connection
echo "\n🔍 Testing Database Connection...\n";
try {
    require_once __DIR__ . '/backend/config/database.php';
    $pdo = get_db_connection();
    echo "✅ Database connection successful!\n";
    
    // Test if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✅ Users table exists\n";
        
        // Check if admin user exists
        $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM users WHERE username = 'admin' OR email = 'admin@example.com'");
        $stmt->execute();
        $result = $stmt->fetch();
        
        if ($result['count'] > 0) {
            echo "✅ Admin user exists\n";
        } else {
            echo "⚠️  Admin user not found. You may need to create one.\n";
        }
    } else {
        echo "❌ Users table not found! Database may not be properly set up.\n";
    }
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}

// Test CORS configuration
echo "\n🔍 Testing CORS Configuration...\n";
$corsOrigins = env('CORS_ALLOWED_ORIGINS');
if (empty($corsOrigins)) {
    echo "⚠️  CORS_ALLOWED_ORIGINS not configured\n";
} else {
    echo "✅ CORS_ALLOWED_ORIGINS: " . $corsOrigins . "\n";
}

echo "\n📋 SUMMARY:\n";
echo "===========\n";
echo "The 401 Unauthorized error is likely caused by:\n";
echo "1. Missing or incorrect JWT_SECRET in .env file\n";
echo "2. Missing or incorrect REFRESH_JWT_SECRET in .env file\n";
echo "3. Database connection issues\n";
echo "4. Missing admin user\n\n";

echo "🔧 NEXT STEPS:\n";
echo "1. Upload this fixed .env file to your Hostinger server\n";
echo "2. Make sure the file is in the root directory of your website\n";
echo "3. Test the login again\n";
echo "4. If still having issues, run: php fix-hostinger-deployment.php\n\n";

echo "✅ Fix script completed!\n";
?>
