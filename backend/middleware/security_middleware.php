<?php
/**
 * Security Middleware
 * This middleware provides comprehensive security protection for all API endpoints
 */

require_once __DIR__ . '/../config/security.php';

class SecurityMiddleware {
    private $pdo;
    private $rateLimits = [
        'login' => ['max' => 5, 'window' => 900], // 5 attempts per 15 minutes
        'register' => ['max' => 3, 'window' => 3600], // 3 attempts per hour
        'otp_request' => ['max' => 5, 'window' => 3600], // 5 attempts per hour
        'api_call' => ['max' => 100, 'window' => 3600], // 100 calls per hour
    ];
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->setupSecurityTables();
    }
    
    /**
     * Main security check - call this for every request
     */
    public function checkSecurity($endpoint = null, $userId = null) {
        $this->setEnhancedSecurityHeaders();
        $this->checkIPBlocking();
        $this->checkRateLimiting($endpoint);
        $this->validateRequest();
        $this->logRequest($endpoint, $userId);
    }
    
    /**
     * Set enhanced security headers
     */
    private function setEnhancedSecurityHeaders() {
        setSecurityHeaders();
    }
    
    /**
     * Check if IP is blocked
     */
    private function checkIPBlocking() {
        $ipAddress = $this->getClientIP();
        
        if (isIPBlocked($this->pdo, $ipAddress)) {
            $this->logSecurityEvent('ip_blocked', "Blocked IP attempted access: $ipAddress", null, $ipAddress, 'high');
            $this->sendErrorResponse(403, 'Access denied');
        }
    }
    
    /**
     * Check rate limiting
     */
    private function checkRateLimiting($endpoint) {
        $ipAddress = $this->getClientIP();
        $identifier = $this->getIdentifier();
        
        // Check general API rate limiting
        if (!$this->checkRateLimit('api_call', $identifier, $ipAddress)) {
            $this->logSecurityEvent('rate_limit_exceeded', "API rate limit exceeded for: $identifier", null, $ipAddress, 'medium');
            $this->sendErrorResponse(429, 'Too many requests');
        }
        
        // Check endpoint-specific rate limiting
        if ($endpoint && isset($this->rateLimits[$endpoint])) {
            $limit = $this->rateLimits[$endpoint];
            if (!$this->checkRateLimit($endpoint, $identifier, $ipAddress, $limit['max'], $limit['window'])) {
                $this->logSecurityEvent('endpoint_rate_limit_exceeded', "Rate limit exceeded for endpoint: $endpoint", null, $ipAddress, 'medium');
                $this->sendErrorResponse(429, 'Too many requests for this endpoint');
            }
        }
    }
    
    /**
     * Validate request for security issues
     */
    private function validateRequest() {
        // Check for suspicious headers
        $suspiciousHeaders = ['X-Forwarded-For', 'X-Real-IP', 'X-Originating-IP'];
        foreach ($suspiciousHeaders as $header) {
            if (isset($_SERVER['HTTP_' . str_replace('-', '_', strtoupper($header))])) {
                $this->logSecurityEvent('suspicious_header', "Suspicious header detected: $header", null, $this->getClientIP(), 'medium');
            }
        }
        
        // Check for SQL injection patterns in GET parameters
        foreach ($_GET as $key => $value) {
            if (is_string($value) && $this->containsSQLInjectionPattern($value)) {
                $this->logSecurityEvent('sql_injection_attempt', "SQL injection attempt in GET parameter: $key", null, $this->getClientIP(), 'high');
                $this->sendErrorResponse(400, 'Invalid request');
            }
        }
        
        // Check for XSS patterns
        foreach ($_GET as $key => $value) {
            if (is_string($value) && $this->containsXSSPattern($value)) {
                $this->logSecurityEvent('xss_attempt', "XSS attempt in GET parameter: $key", null, $this->getClientIP(), 'high');
                $this->sendErrorResponse(400, 'Invalid request');
            }
        }
    }
    
    /**
     * Log the request for security monitoring
     */
    private function logRequest($endpoint, $userId) {
        $ipAddress = $this->getClientIP();
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'unknown';
        
        // Log all requests for monitoring
        $this->logSecurityEvent('api_request', "API request: $method $endpoint", $userId, $ipAddress, 'low');
        
        // Log suspicious user agents
        if ($this->isSuspiciousUserAgent($userAgent)) {
            $this->logSecurityEvent('suspicious_user_agent', "Suspicious user agent: $userAgent", $userId, $ipAddress, 'medium');
        }
    }
    
    /**
     * Check rate limit for specific action
     */
    private function checkRateLimit($action, $identifier, $ipAddress, $maxAttempts = 10, $timeWindow = 3600) {
        return checkLoginRateLimit($this->pdo, $identifier, $maxAttempts, $timeWindow);
    }
    
    /**
     * Record rate limit attempt
     */
    public function recordRateLimitAttempt($action, $identifier = null, $ipAddress = null) {
        $identifier = $identifier ?: $this->getIdentifier();
        $ipAddress = $ipAddress ?: $this->getClientIP();
        recordRateLimitAttempt($this->pdo, $identifier, $action, $ipAddress);
    }
    
    /**
     * Get client IP address
     */
    private function getClientIP() {
        $ipKeys = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED', 'HTTP_X_CLUSTER_CLIENT_IP', 'HTTP_FORWARDED_FOR', 'HTTP_FORWARDED', 'REMOTE_ADDR'];
        
        foreach ($ipKeys as $key) {
            if (array_key_exists($key, $_SERVER) === true) {
                $ip = $_SERVER[$key];
                if (strpos($ip, ',') !== false) {
                    $ip = explode(',', $ip)[0];
                }
                $ip = trim($ip);
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
    
    /**
     * Get identifier for rate limiting (username, email, or IP)
     */
    private function getIdentifier() {
        // Try to get from Authorization header first
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
            $payload = verifyJWT($token);
            if ($payload && isset($payload['username'])) {
                return $payload['username'];
            }
        }
        
        // Fall back to IP address
        return $this->getClientIP();
    }
    
    /**
     * Check for SQL injection patterns
     */
    private function containsSQLInjectionPattern($input) {
        $patterns = [
            '/(\bunion\b.*\bselect\b)/i',
            '/(\bselect\b.*\bfrom\b)/i',
            '/(\binsert\b.*\binto\b)/i',
            '/(\bupdate\b.*\bset\b)/i',
            '/(\bdelete\b.*\bfrom\b)/i',
            '/(\bdrop\b.*\btable\b)/i',
            '/(\balter\b.*\btable\b)/i',
            '/(\bcreate\b.*\btable\b)/i',
            '/(\bexec\b|\bexecute\b)/i',
            '/(\bscript\b.*\balert\b)/i',
            '/(\bwaitfor\b.*\bdelay\b)/i',
            '/(\bxp_cmdshell\b)/i',
            '/(\bsp_executesql\b)/i',
            '/(\b--|\b#|\b\/\*|\*\/)/i',
            '/(\bor\b.*\b1\s*=\s*1\b)/i',
            '/(\band\b.*\b1\s*=\s*1\b)/i',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $input)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check for XSS patterns
     */
    private function containsXSSPattern($input) {
        $patterns = [
            '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/mi',
            '/javascript:/i',
            '/vbscript:/i',
            '/onload\s*=/i',
            '/onerror\s*=/i',
            '/onclick\s*=/i',
            '/onmouseover\s*=/i',
            '/<iframe/i',
            '/<object/i',
            '/<embed/i',
            '/<link/i',
            '/<meta/i',
            '/<style/i',
        ];
        
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $input)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Check if user agent is suspicious
     */
    private function isSuspiciousUserAgent($userAgent) {
        $suspiciousPatterns = [
            '/bot/i',
            '/crawler/i',
            '/spider/i',
            '/scraper/i',
            '/curl/i',
            '/wget/i',
            '/python/i',
            '/php/i',
            '/java/i',
            '/perl/i',
        ];
        
        foreach ($suspiciousPatterns as $pattern) {
            if (preg_match($pattern, $userAgent)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Log security event
     */
    private function logSecurityEvent($event, $details, $userId, $ipAddress, $severity = 'medium') {
        logSecurityEvent($this->pdo, $event, $details, $userId, $ipAddress, $severity);
    }
    
    /**
     * Send error response
     */
    private function sendErrorResponse($code, $message) {
        http_response_code($code);
        echo json_encode(['error' => $message]);
        exit();
    }
    
    /**
     * Setup security tables
     */
    private function setupSecurityTables() {
        setupEnhancedSecurityTables($this->pdo);
    }
}

// Global security middleware instance
$securityMiddleware = null;

/**
 * Initialize security middleware
 */
function initSecurityMiddleware($pdo) {
    global $securityMiddleware;
    $securityMiddleware = new SecurityMiddleware($pdo);
}

/**
 * Check security for current request
 */
function checkSecurity($endpoint = null, $userId = null) {
    global $securityMiddleware;
    if ($securityMiddleware) {
        $securityMiddleware->checkSecurity($endpoint, $userId);
    }
}

/**
 * Record rate limit attempt
 */
function recordSecurityAttempt($action, $identifier = null, $ipAddress = null) {
    global $securityMiddleware;
    if ($securityMiddleware) {
        $securityMiddleware->recordRateLimitAttempt($action, $identifier, $ipAddress);
    }
}
