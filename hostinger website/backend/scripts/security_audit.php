<?php
/**
 * Security Audit Script
 * Comprehensive security check for the PC Building System
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/security_config.php';

class SecurityAudit {
    private $pdo;
    private $issues = [];
    private $warnings = [];
    private $recommendations = [];
    
    public function __construct() {
        try {
            $this->pdo = get_db_connection();
        } catch (Exception $e) {
            $this->issues[] = "Database connection failed: " . $e->getMessage();
        }
    }
    
    /**
     * Run complete security audit
     */
    public function runAudit() {
        echo "🔒 Security Audit for PC Building System\n";
        echo "==========================================\n\n";
        
        $this->checkEnvironmentConfiguration();
        $this->checkDatabaseSecurity();
        $this->checkAuthenticationSecurity();
        $this->checkInputValidation();
        $this->checkFileUploadSecurity();
        $this->checkCORSConfiguration();
        $this->checkRateLimiting();
        $this->checkSessionSecurity();
        $this->checkLoggingConfiguration();
        $this->checkDependencies();
        
        $this->generateReport();
    }
    
    /**
     * Check environment configuration
     */
    private function checkEnvironmentConfiguration() {
        echo "📋 Checking Environment Configuration...\n";
        
        // Check for .env file
        if (!file_exists(__DIR__ . '/../../.env')) {
            $this->issues[] = "No .env file found - using default values";
        }
        
        // Check JWT secrets
        $jwtSecret = env('JWT_SECRET', '');
        if (empty($jwtSecret) || strpos($jwtSecret, 'CHANGE_THIS') !== false) {
            $this->issues[] = "JWT_SECRET is not properly configured";
        }
        
        $refreshSecret = env('REFRESH_JWT_SECRET', '');
        if (empty($refreshSecret) || strpos($refreshSecret, 'CHANGE_THIS') !== false) {
            $this->issues[] = "REFRESH_JWT_SECRET is not properly configured";
        }
        
        // Check database credentials
        $dbPass = env('DB_PASS', '');
        if (empty($dbPass)) {
            $this->warnings[] = "Database password is empty - consider using a strong password";
        }
        
        // Check CORS configuration
        $corsOrigins = env('CORS_ALLOWED_ORIGINS', '');
        if (empty($corsOrigins)) {
            $this->warnings[] = "CORS_ALLOWED_ORIGINS not configured - using defaults";
        }
        
        // Check debug mode
        $debug = env('APP_DEBUG', '0');
        if ($debug === '1' && isProduction()) {
            $this->issues[] = "Debug mode is enabled in production";
        }
        
        echo "✅ Environment configuration check completed\n\n";
    }
    
    /**
     * Check database security
     */
    private function checkDatabaseSecurity() {
        echo "🗄️ Checking Database Security...\n";
        
        if (!$this->pdo) {
            $this->issues[] = "Cannot check database security - no connection";
            return;
        }
        
        // Check for security tables
        $securityTables = ['login_attempts', 'security_logs', 'blocked_ips', 'rate_limits'];
        foreach ($securityTables as $table) {
            try {
                $stmt = $this->pdo->prepare("SHOW TABLES LIKE :table");
                $stmt->execute([':table' => $table]);
                if (!$stmt->fetch()) {
                    $this->warnings[] = "Security table '$table' does not exist";
                }
            } catch (Exception $e) {
                $this->warnings[] = "Could not check for table '$table': " . $e->getMessage();
            }
        }
        
        // Check for default users
        try {
            $stmt = $this->pdo->prepare("SELECT username FROM users WHERE username IN ('admin', 'root', 'test')");
            $stmt->execute();
            $defaultUsers = $stmt->fetchAll();
            if (!empty($defaultUsers)) {
                $this->warnings[] = "Default usernames found: " . implode(', ', array_column($defaultUsers, 'username'));
            }
        } catch (Exception $e) {
            $this->warnings[] = "Could not check for default users: " . $e->getMessage();
        }
        
        // Check for weak passwords (basic check)
        try {
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as count FROM users WHERE password_hash LIKE '$2y$%'");
            $stmt->execute();
            $result = $stmt->fetch();
            if ($result['count'] == 0) {
                $this->issues[] = "No users found with bcrypt password hashing";
            }
        } catch (Exception $e) {
            $this->warnings[] = "Could not check password hashing: " . $e->getMessage();
        }
        
        echo "✅ Database security check completed\n\n";
    }
    
    /**
     * Check authentication security
     */
    private function checkAuthenticationSecurity() {
        echo "🔐 Checking Authentication Security...\n";
        
        // Check JWT configuration
        $jwtExpiry = env('JWT_EXPIRY', '7200');
        if ($jwtExpiry > 7200) {
            $this->warnings[] = "JWT expiry time is longer than recommended (2 hours)";
        }
        
        // Check password requirements
        $minLength = env('PASSWORD_MIN_LENGTH', '8');
        if ($minLength < 8) {
            $this->issues[] = "Password minimum length is too short";
        }
        
        // Check rate limiting configuration
        $loginAttempts = env('LOGIN_MAX_ATTEMPTS', '5');
        if ($loginAttempts > 10) {
            $this->warnings[] = "Login attempt limit is too high";
        }
        
        echo "✅ Authentication security check completed\n\n";
    }
    
    /**
     * Check input validation
     */
    private function checkInputValidation() {
        echo "🛡️ Checking Input Validation...\n";
        
        // Check if security middleware is included
        $indexFile = __DIR__ . '/../api/index.php';
        if (file_exists($indexFile)) {
            $content = file_get_contents($indexFile);
            if (strpos($content, 'security_middleware') === false) {
                $this->issues[] = "Security middleware not included in main API router";
            }
            if (strpos($content, 'checkSecurity') === false) {
                $this->issues[] = "Security checks not implemented in main API router";
            }
        }
        
        // Check for prepared statements usage
        $apiFiles = glob(__DIR__ . '/../api/*.php');
        foreach ($apiFiles as $file) {
            $content = file_get_contents($file);
            if (strpos($content, 'prepare(') === false && strpos($content, 'query(') !== false) {
                $this->warnings[] = "Potential SQL injection risk in " . basename($file);
            }
        }
        
        echo "✅ Input validation check completed\n\n";
    }
    
    /**
     * Check file upload security
     */
    private function checkFileUploadSecurity() {
        echo "📁 Checking File Upload Security...\n";
        
        $maxSize = env('MAX_FILE_SIZE', '5242880');
        if ($maxSize > 10485760) { // 10MB
            $this->warnings[] = "Maximum file size is too large";
        }
        
        $allowedTypes = env('ALLOWED_FILE_TYPES', 'image/jpeg,image/png,image/gif');
        if (strpos($allowedTypes, 'php') !== false || strpos($allowedTypes, 'exe') !== false) {
            $this->issues[] = "Dangerous file types allowed";
        }
        
        echo "✅ File upload security check completed\n\n";
    }
    
    /**
     * Check CORS configuration
     */
    private function checkCORSConfiguration() {
        echo "🌐 Checking CORS Configuration...\n";
        
        $corsFile = __DIR__ . '/../config/cors.php';
        if (file_exists($corsFile)) {
            $content = file_get_contents($corsFile);
            if (strpos($content, "Access-Control-Allow-Origin: *") !== false) {
                $this->issues[] = "Wildcard CORS origin found - security risk";
            }
        }
        
        $corsOrigins = env('CORS_ALLOWED_ORIGINS', '');
        if (empty($corsOrigins)) {
            $this->warnings[] = "CORS origins not configured";
        }
        
        echo "✅ CORS configuration check completed\n\n";
    }
    
    /**
     * Check rate limiting
     */
    private function checkRateLimiting() {
        echo "⏱️ Checking Rate Limiting...\n";
        
        if (!$this->pdo) {
            $this->warnings[] = "Cannot check rate limiting - no database connection";
            return;
        }
        
        // Check if rate limiting tables exist
        try {
            $stmt = $this->pdo->prepare("SHOW TABLES LIKE 'rate_limits'");
            $stmt->execute();
            if (!$stmt->fetch()) {
                $this->warnings[] = "Rate limiting table does not exist";
            }
        } catch (Exception $e) {
            $this->warnings[] = "Could not check rate limiting table: " . $e->getMessage();
        }
        
        echo "✅ Rate limiting check completed\n\n";
    }
    
    /**
     * Check session security
     */
    private function checkSessionSecurity() {
        echo "🔒 Checking Session Security...\n";
        
        $sessionTimeout = env('SESSION_TIMEOUT', '3600');
        if ($sessionTimeout > 7200) {
            $this->warnings[] = "Session timeout is too long";
        }
        
        // Check session configuration
        if (ini_get('session.cookie_secure') == '0' && isProduction()) {
            $this->issues[] = "Session cookies not secure in production";
        }
        
        if (ini_get('session.cookie_httponly') == '0') {
            $this->warnings[] = "Session cookies not HTTP-only";
        }
        
        echo "✅ Session security check completed\n\n";
    }
    
    /**
     * Check logging configuration
     */
    private function checkLoggingConfiguration() {
        echo "📝 Checking Logging Configuration...\n";
        
        $logLevel = env('LOG_LEVEL', 'error');
        if ($logLevel === 'debug' && isProduction()) {
            $this->warnings[] = "Debug logging enabled in production";
        }
        
        $logFile = env('LOG_FILE', 'logs/app.log');
        if (!is_dir(dirname($logFile))) {
            $this->warnings[] = "Log directory does not exist";
        }
        
        echo "✅ Logging configuration check completed\n\n";
    }
    
    /**
     * Check dependencies
     */
    private function checkDependencies() {
        echo "📦 Checking Dependencies...\n";
        
        // Check for composer.json
        if (file_exists(__DIR__ . '/../../composer.json')) {
            $composer = json_decode(file_get_contents(__DIR__ . '/../../composer.json'), true);
            if (isset($composer['require'])) {
                foreach ($composer['require'] as $package => $version) {
                    if (strpos($package, 'php') === false && strpos($version, 'dev') !== false) {
                        $this->warnings[] = "Development dependency in production: $package";
                    }
                }
            }
        }
        
        echo "✅ Dependencies check completed\n\n";
    }
    
    /**
     * Generate security report
     */
    private function generateReport() {
        echo "📊 Security Audit Report\n";
        echo "=======================\n\n";
        
        $totalIssues = count($this->issues);
        $totalWarnings = count($this->warnings);
        
        if ($totalIssues > 0) {
            echo "🚨 CRITICAL ISSUES ($totalIssues):\n";
            foreach ($this->issues as $issue) {
                echo "  ❌ $issue\n";
            }
            echo "\n";
        }
        
        if ($totalWarnings > 0) {
            echo "⚠️ WARNINGS ($totalWarnings):\n";
            foreach ($this->warnings as $warning) {
                echo "  ⚠️ $warning\n";
            }
            echo "\n";
        }
        
        if ($totalIssues == 0 && $totalWarnings == 0) {
            echo "✅ No security issues found!\n";
        } else {
            echo "📋 RECOMMENDATIONS:\n";
            echo "  1. Fix all critical issues immediately\n";
            echo "  2. Address warnings when possible\n";
            echo "  3. Run this audit regularly\n";
            echo "  4. Keep dependencies updated\n";
            echo "  5. Monitor security logs\n";
        }
        
        echo "\n🔒 Security audit completed.\n";
    }
}

// Run the audit
$audit = new SecurityAudit();
$audit->runAudit();
