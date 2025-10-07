<?php
// Security setup script
// Run this script to set up security tables and initial configuration

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/config/security.php';

echo "Setting up security features...\n";

try {
    $pdo = get_db_connection();
    
    // Set up security tables
    setupSecurityTables($pdo);
    echo "✓ Security tables created successfully\n";
    
    // Clean old login attempts
    cleanOldLoginAttempts($pdo);
    echo "✓ Cleaned old login attempts\n";
    
    // Generate secure JWT secrets if not set
    $jwtSecret = env('JWT_SECRET', '');
    $refreshJwtSecret = env('REFRESH_JWT_SECRET', '');
    
    if (empty($jwtSecret) || $jwtSecret === 'builditpc_secret_key_2024_change_in_production') {
        echo "⚠️  WARNING: JWT_SECRET is not set or using default value!\n";
        echo "   Please update your .env file with a secure JWT secret.\n";
        echo "   Generated secure secret: " . generateSecureToken(64) . "\n";
    }
    
    if (empty($refreshJwtSecret) || $refreshJwtSecret === 'builditpc_secret_key_2024_change_in_production') {
        echo "⚠️  WARNING: REFRESH_JWT_SECRET is not set or using default value!\n";
        echo "   Please update your .env file with a secure refresh JWT secret.\n";
        echo "   Generated secure secret: " . generateSecureToken(64) . "\n";
    }
    
    // Create logs directory if it doesn't exist
    $logsDir = __DIR__ . '/logs';
    if (!is_dir($logsDir)) {
        mkdir($logsDir, 0755, true);
        echo "✓ Created logs directory\n";
    }
    
    // Set up .htaccess for additional security
    $htaccessContent = '# Additional security rules
<Files "*.env*">
    Require all denied
</Files>

<Files "*.log">
    Require all denied
</Files>

<Files "*.sql">
    Require all denied
</Files>

# Prevent access to sensitive directories
<Directory "logs">
    Require all denied
</Directory>

<Directory "vendor">
    Require all denied
</Directory>

# Security headers
<IfModule mod_headers.c>
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
';
    
    file_put_contents(__DIR__ . '/.htaccess', $htaccessContent, FILE_APPEND);
    echo "✓ Updated .htaccess with security rules\n";
    
    echo "\n🎉 Security setup completed successfully!\n";
    echo "\nNext steps:\n";
    echo "1. Update your .env file with secure JWT secrets\n";
    echo "2. Set CORS_ALLOWED_ORIGINS to your production domain\n";
    echo "3. Enable HTTPS in production\n";
    echo "4. Regularly monitor security logs\n";
    echo "5. Keep your dependencies updated\n";
    
} catch (Exception $e) {
    echo "❌ Error setting up security: " . $e->getMessage() . "\n";
    exit(1);
}
