<?php
/**
 * Script to create the .env file with corrected email configuration
 * Run this script to generate the .env file locally
 */

$envContent = '# Environment Configuration for PC Building System
# Production settings for Hostinger deployment

# Application Environment
APP_ENV=production
APP_DEBUG=0
APP_TIMEZONE=Asia/Manila
APP_NAME=SIMS

# Database Configuration
DB_HOST=localhost
DB_NAME=u709288172_builditpc_db
DB_USER=u709288172_sims
DB_PASS=Egiesims1@
DB_PORT=3306
DB_CHARSET=utf8mb4
DB_NAME_PREFIX=u709288172s

# JWT Configuration
JWT_SECRET=builditpc_super_secure_jwt_secret_key_2024_production_ready_12345
JWT_EXPIRY=3600
REFRESH_JWT_SECRET=builditpc_refresh_token_secret_key_2024_production_ready_67890
REFRESH_JWT_EXPIRY=1209600

# OTP Configuration
OTP_REQUEST_COOLDOWN=60
OTP_MAX_PER_HOUR=5
OTP_TTL_MINUTES=5

# Email Configuration - FIXED TO USE APP PASSWORD
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_ENCRYPTION=tls
MAIL_AUTH=gmail_password
MAIL_FROM_ADDRESS=kenniellmart@gmail.com
MAIL_FROM_NAME=SIMS

# Gmail App Password Configuration
GMAIL_USER=kenniellmart@gmail.com
GMAIL_APP_PASSWORD=xhprtcECHSZQIOVS

# Legacy SMTP settings (for compatibility)
MAIL_USERNAME=kenniellmart@gmail.com
MAIL_PASSWORD=xhprtcECHSZQIOVS

# Security Configuration
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_TIME=900
SESSION_TIMEOUT=3600
PASSWORD_MIN_LENGTH=8

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Logging Configuration
LOG_LEVEL=error
LOG_FILE=logs/app.log

# Cache Configuration
CACHE_ENABLED=1
CACHE_TTL=3600';

// Write the .env file
if (file_put_contents('.env', $envContent)) {
    echo "✅ .env file created successfully!\n";
    echo "📝 Remember to replace 'your_gmail@gmail.com' with your actual Gmail address.\n";
    echo "🔒 The .env file contains sensitive information - make sure it's in your .gitignore!\n";
} else {
    echo "❌ Failed to create .env file. Please check file permissions.\n";
}
?>
