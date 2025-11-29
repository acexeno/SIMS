<?php
/**
 * Security Configuration
 * Centralized security settings for the PC Building System
 */

// Security levels
define('SECURITY_LEVEL_DEVELOPMENT', 'development');
define('SECURITY_LEVEL_PRODUCTION', 'production');

// Get current security level
$securityLevel = env('APP_ENV', SECURITY_LEVEL_DEVELOPMENT);

// Security configuration based on environment
$securityConfig = [
    'development' => [
        'cors_allow_origins' => ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
        'rate_limits' => [
            'login' => ['max' => 10, 'window' => 900],
            'register' => ['max' => 5, 'window' => 3600],
            'otp_request' => ['max' => 10, 'window' => 3600],
            'api_call' => ['max' => 1000, 'window' => 3600],
        ],
        'password_requirements' => [
            'min_length' => 8,
            'max_length' => null, // No maximum limit - allows stronger passwords and passphrases
            'require_uppercase' => true,
            'require_lowercase' => true,
            'require_numbers' => true,
            'require_special' => true,
        ],
        'session_timeout' => 7200, // 2 hours
        'jwt_expiry' => 7200, // 2 hours
        'debug_mode' => true,
    ],
    'production' => [
        'cors_allow_origins' => env('CORS_ALLOWED_ORIGINS', ''),
        'rate_limits' => [
            'login' => ['max' => 5, 'window' => 900],
            'register' => ['max' => 3, 'window' => 3600],
            'otp_request' => ['max' => 5, 'window' => 3600],
            'api_call' => ['max' => 100, 'window' => 3600],
        ],
        'password_requirements' => [
            'min_length' => 8,
            'max_length' => null, // No maximum limit - allows stronger passwords and passphrases
            'require_uppercase' => true,
            'require_lowercase' => true,
            'require_numbers' => true,
            'require_special' => true,
        ],
        'session_timeout' => 3600, // 1 hour
        'jwt_expiry' => 3600, // 1 hour
        'debug_mode' => false,
    ]
];

// Get current security configuration
$currentConfig = $securityConfig[$securityLevel] ?? $securityConfig[SECURITY_LEVEL_DEVELOPMENT];

// Security functions
function getSecurityConfig($key = null) {
    global $currentConfig;
    if ($key === null) {
        return $currentConfig;
    }
    return $currentConfig[$key] ?? null;
}

function isProduction() {
    return env('APP_ENV', 'development') === 'production';
}

function isDevelopment() {
    return env('APP_ENV', 'development') === 'development';
}

// Enhanced security headers for production
function getSecurityHeaders() {
    $headers = [
        'X-Frame-Options' => 'DENY',
        'X-Content-Type-Options' => 'nosniff',
        'X-XSS-Protection' => '1; mode=block',
        'Referrer-Policy' => 'strict-origin-when-cross-origin',
        'X-Permitted-Cross-Domain-Policies' => 'none',
    ];
    
    if (isProduction()) {
        $headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
        $headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
        $headers['Cross-Origin-Opener-Policy'] = 'same-origin';
        $headers['Cross-Origin-Resource-Policy'] = 'same-origin';
    }
    
    return $headers;
}

// Content Security Policy
function getContentSecurityPolicy() {
    // Allow Google reCAPTCHA domains for both production and development
    $recaptchaDomains = "https://www.google.com https://www.gstatic.com";
    
    if (isProduction()) {
        return "default-src 'self'; " .
               "script-src 'self' {$recaptchaDomains} 'unsafe-eval'; " .
               "style-src 'self' 'unsafe-inline'; " .
               "img-src 'self' data: https: {$recaptchaDomains}; " .
               "font-src 'self' data:; " .
               "connect-src 'self' {$recaptchaDomains}; " .
               "frame-src {$recaptchaDomains}; " .
               "frame-ancestors 'none'; " .
               "base-uri 'self'; " .
               "form-action 'self';";
    } else {
        return "default-src 'self'; " .
               "script-src 'self' 'unsafe-inline' 'unsafe-eval' {$recaptchaDomains}; " .
               "style-src 'self' 'unsafe-inline'; " .
               "img-src 'self' data: https: {$recaptchaDomains}; " .
               "font-src 'self' data:; " .
               "connect-src 'self' {$recaptchaDomains}; " .
               "frame-src {$recaptchaDomains}; " .
               "frame-ancestors 'none';";
    }
}

// Rate limiting configuration
function getRateLimitConfig($action) {
    $rateLimits = getSecurityConfig('rate_limits');
    return $rateLimits[$action] ?? ['max' => 10, 'window' => 3600];
}

// Password requirements
function getPasswordRequirements() {
    return getSecurityConfig('password_requirements');
}

// Session configuration
function getSessionConfig() {
    return [
        'timeout' => getSecurityConfig('session_timeout'),
        'jwt_expiry' => getSecurityConfig('jwt_expiry'),
        'secure' => isProduction(),
        'httponly' => true,
        'samesite' => isProduction() ? 'Strict' : 'Lax',
    ];
}

// File upload security
function getFileUploadConfig() {
    return [
        'max_size' => env('MAX_FILE_SIZE', 5242880), // 5MB
        'allowed_types' => explode(',', env('ALLOWED_FILE_TYPES', 'image/jpeg,image/png,image/gif')),
        'scan_content' => isProduction(),
        'quarantine_suspicious' => isProduction(),
    ];
}

// Database security
function getDatabaseSecurityConfig() {
    return [
        'use_prepared_statements' => true,
        'escape_output' => true,
        'validate_input' => true,
        'log_queries' => isDevelopment(),
        'connection_timeout' => 30,
        'query_timeout' => 60,
    ];
}

// Logging configuration
function getLoggingConfig() {
    return [
        'log_level' => isProduction() ? 'error' : 'debug',
        'log_file' => env('LOG_FILE', 'logs/app.log'),
        'log_security_events' => true,
        'log_failed_attempts' => true,
        'log_suspicious_activity' => true,
        'retention_days' => isProduction() ? 90 : 7,
    ];
}

// CORS configuration
function getCORSConfig() {
    $origins = getSecurityConfig('cors_allow_origins');
    if (is_string($origins)) {
        $origins = explode(',', $origins);
    }
    
    return [
        'allowed_origins' => $origins,
        'allow_credentials' => true,
        'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
        'max_age' => 86400, // 24 hours
    ];
}

// Security monitoring
function getSecurityMonitoringConfig() {
    return [
        'monitor_failed_logins' => true,
        'monitor_suspicious_ips' => true,
        'monitor_rate_limits' => true,
        'monitor_file_uploads' => true,
        'alert_threshold' => 10, // Failed attempts before alert
        'block_threshold' => 20, // Failed attempts before blocking
        'block_duration' => 3600, // 1 hour
    ];
}

// Apply security configuration
function applySecurityConfiguration() {
    // Set security headers
    $headers = getSecurityHeaders();
    foreach ($headers as $name => $value) {
        header("$name: $value");
    }
    
    // Set Content Security Policy
    header('Content-Security-Policy: ' . getContentSecurityPolicy());
    
    // Configure session security
    $sessionConfig = getSessionConfig();
    ini_set('session.cookie_secure', $sessionConfig['secure'] ? '1' : '0');
    ini_set('session.cookie_httponly', $sessionConfig['httponly'] ? '1' : '0');
    ini_set('session.cookie_samesite', $sessionConfig['samesite']);
    ini_set('session.gc_maxlifetime', $sessionConfig['timeout']);
    
    // Configure error reporting
    if (isProduction()) {
        error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
        ini_set('display_errors', '0');
        ini_set('log_errors', '1');
    } else {
        error_reporting(E_ALL);
        ini_set('display_errors', '1');
    }
}

// Initialize security configuration
applySecurityConfiguration();
