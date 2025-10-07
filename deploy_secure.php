<?php
// Secure deployment script for Hostinger
// This script ensures all security measures are in place before deployment

require_once __DIR__ . '/backend/config/env.php';

function checkSecurityRequirements() {
    $errors = [];
    $warnings = [];
    
    echo "🔒 Security Deployment Check\n";
    echo str_repeat("=", 40) . "\n\n";
    
    // Check JWT secrets
    $jwtSecret = env('JWT_SECRET', '');
    $refreshJwtSecret = env('REFRESH_JWT_SECRET', '');
    
    if (empty($jwtSecret) || $jwtSecret === 'builditpc_secret_key_2024_change_in_production') {
        $errors[] = "JWT_SECRET is not set or using default value";
    }
    
    if (empty($refreshJwtSecret) || $refreshJwtSecret === 'builditpc_secret_key_2024_change_in_production') {
        $errors[] = "REFRESH_JWT_SECRET is not set or using default value";
    }
    
    if ($jwtSecret === $refreshJwtSecret) {
        $errors[] = "JWT_SECRET and REFRESH_JWT_SECRET must be different";
    }
    
    // Check environment
    $appEnv = env('APP_ENV', '');
    if ($appEnv !== 'production') {
        $warnings[] = "APP_ENV is not set to 'production'";
    }
    
    // Check debug mode
    $debugMode = env('APP_DEBUG', '0');
    if ($debugMode === '1' || strtolower($debugMode) === 'true') {
        $errors[] = "APP_DEBUG is enabled - disable in production";
    }
    
    // Check CORS origins
    $corsOrigins = env('CORS_ALLOWED_ORIGINS', '');
    if (empty($corsOrigins)) {
        $warnings[] = "CORS_ALLOWED_ORIGINS not configured";
    } elseif (strpos($corsOrigins, '*') !== false) {
        $warnings[] = "CORS_ALLOWED_ORIGINS contains wildcard - restrict to specific domains";
    }
    
    // Check database credentials
    $dbPass = env('DB_PASS', '');
    if (empty($dbPass)) {
        $warnings[] = "Database password is empty";
    }
    
    // Check HTTPS requirement
    if (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on') {
        $warnings[] = "HTTPS not detected - ensure SSL is configured on Hostinger";
    }
    
    // Display results
    if (!empty($errors)) {
        echo "❌ CRITICAL ERRORS (must fix before deployment):\n";
        foreach ($errors as $error) {
            echo "   • $error\n";
        }
        echo "\n";
    }
    
    if (!empty($warnings)) {
        echo "⚠️  WARNINGS (recommended to fix):\n";
        foreach ($warnings as $warning) {
            echo "   • $warning\n";
        }
        echo "\n";
    }
    
    if (empty($errors) && empty($warnings)) {
        echo "✅ All security checks passed!\n\n";
    }
    
    return empty($errors);
}

function generateSecureEnvFile() {
    echo "🔧 Generating secure .env file...\n";
    
    $envContent = "# Production Environment Configuration\n";
    $envContent .= "APP_ENV=production\n";
    $envContent .= "APP_DEBUG=0\n";
    $envContent .= "APP_TIMEZONE=Asia/Manila\n\n";
    
    $envContent .= "# Database Configuration\n";
    $envContent .= "DB_HOST=localhost\n";
    $envContent .= "DB_NAME=builditpc_db\n";
    $envContent .= "DB_USER=your_db_user\n";
    $envContent .= "DB_PASS=your_secure_db_password\n";
    $envContent .= "DB_PORT=3306\n";
    $envContent .= "DB_CHARSET=utf8mb4\n\n";
    
    $envContent .= "# JWT Configuration (CHANGE THESE!)\n";
    $envContent .= "JWT_SECRET=" . bin2hex(random_bytes(32)) . "\n";
    $envContent .= "JWT_EXPIRY=3600\n";
    $envContent .= "REFRESH_JWT_SECRET=" . bin2hex(random_bytes(32)) . "\n";
    $envContent .= "REFRESH_JWT_EXPIRY=1209600\n\n";
    
    $envContent .= "# OTP Configuration\n";
    $envContent .= "OTP_REQUEST_COOLDOWN=60\n";
    $envContent .= "OTP_MAX_PER_HOUR=5\n";
    $envContent .= "OTP_TTL_MINUTES=5\n\n";
    
    $envContent .= "# Email Configuration\n";
    $envContent .= "SMTP_HOST=smtp.gmail.com\n";
    $envContent .= "SMTP_PORT=587\n";
    $envContent .= "SMTP_USERNAME=your_email@gmail.com\n";
    $envContent .= "SMTP_PASSWORD=your_app_password\n";
    $envContent .= "SMTP_FROM_EMAIL=noreply@yourdomain.com\n";
    $envContent .= "SMTP_FROM_NAME=BuildItPC\n\n";
    
    $envContent .= "# Security Configuration\n";
    $envContent .= "LOGIN_MAX_ATTEMPTS=5\n";
    $envContent .= "LOGIN_LOCKOUT_TIME=900\n";
    $envContent .= "SESSION_TIMEOUT=3600\n";
    $envContent .= "PASSWORD_MIN_LENGTH=8\n\n";
    
    $envContent .= "# CORS Configuration (UPDATE WITH YOUR DOMAIN)\n";
    $envContent .= "CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com\n\n";
    
    $envContent .= "# File Upload Configuration\n";
    $envContent .= "MAX_FILE_SIZE=5242880\n";
    $envContent .= "ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif\n\n";
    
    $envContent .= "# Logging Configuration\n";
    $envContent .= "LOG_LEVEL=error\n";
    $envContent .= "LOG_FILE=logs/app.log\n\n";
    
    $envContent .= "# Cache Configuration\n";
    $envContent .= "CACHE_ENABLED=1\n";
    $envContent .= "CACHE_TTL=3600\n";
    
    file_put_contents(__DIR__ . '/.env.production', $envContent);
    echo "✅ Generated .env.production file\n";
    echo "   Please review and update the values before deployment\n\n";
}

function createSecureHtaccess() {
    echo "🔧 Creating secure .htaccess file...\n";
    
    $htaccessContent = '# Security-focused .htaccess for Hostinger
# PC Building System

# Disable directory browsing
Options -Indexes -MultiViews

# Set default index
DirectoryIndex dist/index.html

# Security headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Content-Security-Policy "default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; font-src \'self\' data:; connect-src \'self\'; frame-ancestors \'none\';"
    
    # HSTS (only over HTTPS)
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains" env=HTTPS
</IfModule>

# Protect sensitive files
<Files ".env*">
    Require all denied
</Files>

<Files "*.log">
    Require all denied
</Files>

<Files "*.sql">
    Require all denied
</Files>

<Files "*.md">
    Require all denied
</Files>

# Protect directories
<Directory "logs">
    Require all denied
</Directory>

<Directory "vendor">
    Require all denied
</Directory>

<Directory "backend/config">
    Require all denied
</Directory>

# Correct MIME types
<IfModule mod_mime.c>
    AddType application/javascript .js .mjs
    AddType text/css .css
    AddType application/wasm .wasm
    AddType application/json .json
    AddType image/svg+xml .svg
    AddType application/manifest+json .webmanifest .manifest
</IfModule>

# URL Rewriting
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    
    # Pass Authorization header
    SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1
    RewriteCond %{HTTP:Authorization} ^(.*)
    RewriteRule ^(.*)$ - [E=HTTP_AUTHORIZATION:%1]
    
    # Do not rewrite backend requests
    RewriteCond %{REQUEST_URI} ^/backend/ [NC]
    RewriteRule ^ - [L]
    
    # Map assets to dist folder
    RewriteRule ^assets/(.*)$ dist/assets/$1 [L]
    RewriteRule ^images/(.*)$ dist/images/$1 [L]
    
    # Never rewrite static asset folders
    RewriteRule ^(assets|images|css|js|fonts|static)/ - [L]
    
    # Serve existing files directly
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]
    
    # Root path -> SPA entry
    RewriteRule ^$ dist/index.html [L]
    
    # All other routes go to the SPA entry
    RewriteRule ^ dist/index.html [L]
</IfModule>

# Cache control for static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/javascript "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
    ExpiresByType font/woff2 "access plus 1 year"
</IfModule>
';
    
    file_put_contents(__DIR__ . '/.htaccess.secure', $htaccessContent);
    echo "✅ Created secure .htaccess file\n\n";
}

function generateDeploymentChecklist() {
    echo "📋 Pre-Deployment Security Checklist:\n";
    echo str_repeat("-", 40) . "\n";
    echo "□ Update .env file with production values\n";
    echo "□ Change all default passwords and secrets\n";
    echo "□ Set CORS_ALLOWED_ORIGINS to your domain\n";
    echo "□ Enable HTTPS on Hostinger\n";
    echo "□ Set proper file permissions (755 for dirs, 644 for files)\n";
    echo "□ Test all security features\n";
    echo "□ Run security monitoring script\n";
    echo "□ Set up regular security monitoring\n";
    echo "□ Configure email settings for OTP\n";
    echo "□ Test file upload security\n";
    echo "□ Verify all security headers are working\n";
    echo "□ Test rate limiting\n";
    echo "□ Test login lockout functionality\n";
    echo "□ Verify JWT token security\n";
    echo "□ Test CORS configuration\n";
    echo "□ Set up log rotation\n";
    echo "□ Create database backups\n";
    echo "□ Test SSL certificate\n";
    echo "□ Verify no debug information is exposed\n";
    echo "\n";
}

// Main execution
echo "🚀 Secure Deployment Preparation\n";
echo str_repeat("=", 50) . "\n\n";

// Check current security status
$securityOK = checkSecurityRequirements();

if (!$securityOK) {
    echo "❌ Security check failed. Please fix the errors above before deploying.\n";
    exit(1);
}

// Generate secure configuration files
generateSecureEnvFile();
createSecureHtaccess();
generateDeploymentChecklist();

echo "🎉 Secure deployment preparation completed!\n";
echo "\nNext steps:\n";
echo "1. Review and update .env.production with your actual values\n";
echo "2. Copy .env.production to .env on your server\n";
echo "3. Copy .htaccess.secure to .htaccess on your server\n";
echo "4. Run setup_security.php on your server\n";
echo "5. Test all functionality\n";
echo "6. Set up regular security monitoring\n";
