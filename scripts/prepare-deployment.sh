#!/bin/bash
# BuildIt PC - Hostinger Deployment Script
# This script prepares the deployment package for Hostinger

echo "🚀 BuildIt PC - Hostinger Deployment Preparation"
echo "=============================================="

# Check if we're in the right directory
if [ ! -d "hostinger-deployment" ]; then
    echo "❌ Error: hostinger-deployment folder not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

echo "✅ Found hostinger-deployment folder"

# Create production environment file
echo "📝 Creating production environment file..."
cat > hostinger-deployment/.env << 'EOF'
# Environment Configuration for PC Building System - PRODUCTION
# This file contains production settings for Hostinger deployment

# Application Environment
APP_ENV=production
APP_DEBUG=0
APP_TIMEZONE=Asia/Manila
APP_NAME=SIMS

# Database Configuration - UPDATE THESE WITH YOUR HOSTINGER CREDENTIALS
DB_HOST=localhost
DB_NAME=u709288172_builditpc_db
DB_USER=u709288172_sims
DB_PASS=YOUR_HOSTINGER_DB_PASSWORD_HERE
DB_PORT=3306
DB_CHARSET=utf8mb4

# JWT Configuration - PRODUCTION SECRETS (CHANGE THESE!)
JWT_SECRET=builditpc_production_jwt_secret_2024_change_this_immediately
JWT_EXPIRY=7200
REFRESH_JWT_SECRET=builditpc_production_refresh_jwt_secret_2024_change_this_too
REFRESH_JWT_EXPIRY=1209600

# OTP Configuration
OTP_REQUEST_COOLDOWN=60
OTP_MAX_PER_HOUR=5
OTP_TTL_MINUTES=5

# Email Configuration (Optional - for OTP and notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=noreply@builditpc.com
SMTP_FROM_NAME=BuildItPC

# Security Configuration
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_TIME=900
SESSION_TIMEOUT=3600
PASSWORD_MIN_LENGTH=8

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif

# CORS Configuration - UPDATE WITH YOUR DOMAIN
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Logging Configuration
LOG_LEVEL=error
LOG_FILE=logs/app.log

# Cache Configuration
CACHE_ENABLED=1
CACHE_TTL=3600
EOF

echo "✅ Created .env file with production settings"

# Verify deployment package structure
echo "🔍 Verifying deployment package structure..."

required_files=(
    "hostinger-deployment/.htaccess"
    "hostinger-deployment/.env"
    "hostinger-deployment/dist/index.html"
    "hostinger-deployment/backend/health.php"
    "hostinger-deployment/backend/api/index.php"
    "hostinger-deployment/vendor/autoload.php"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
    fi
done

# Count images
image_count=$(find hostinger-deployment/dist/images -name "*.png" -o -name "*.svg" | wc -l)
echo "📸 Component images: $image_count files"

# Check build files
if [ -f "hostinger-deployment/dist/assets/index-"*.css ]; then
    echo "✅ CSS bundle found"
else
    echo "❌ CSS bundle missing"
fi

if [ -f "hostinger-deployment/dist/assets/index-"*.js ]; then
    echo "✅ JS bundle found"
else
    echo "❌ JS bundle missing"
fi

echo ""
echo "🎯 DEPLOYMENT PACKAGE READY!"
echo "============================="
echo ""
echo "📋 NEXT STEPS:"
echo "1. Update database credentials in hostinger-deployment/.env"
echo "2. Update CORS origins with your domain"
echo "3. Change JWT secrets for security"
echo "4. Zip the hostinger-deployment folder"
echo "5. Upload to Hostinger public_html/"
echo "6. Extract and test with /backend/health.php"
echo ""
echo "📖 See DEPLOYMENT_READY.md for detailed instructions"
echo ""
echo "🚀 Ready for Hostinger deployment!"

