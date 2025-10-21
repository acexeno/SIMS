<?php
/**
 * Simple Security Middleware
 * Basic security protection for API endpoints
 */

require_once __DIR__ . '/../config/security.php';

class SimpleSecurityMiddleware {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * Basic security check
     */
    public function checkSecurity($endpoint = null) {
        $this->setSecurityHeaders();
        $this->checkBasicSecurity();
    }
    
    /**
     * Set security headers
     */
    private function setSecurityHeaders() {
        setSecurityHeaders();
    }
    
    /**
     * Basic security checks
     */
    private function checkBasicSecurity() {
        // Check for suspicious patterns in GET parameters
        foreach ($_GET as $key => $value) {
            if (is_string($value)) {
                // Check for SQL injection patterns
                if (preg_match('/(union|select|insert|update|delete|drop|create|alter|exec|script)/i', $value)) {
                    $this->logSecurityEvent('suspicious_input', "Suspicious input detected in parameter: $key", null, $this->getClientIP());
                    $this->sendErrorResponse(400, 'Invalid request');
                }
                
                // Check for XSS patterns
                if (preg_match('/<script|javascript:|on\w+\s*=/i', $value)) {
                    $this->logSecurityEvent('xss_attempt', "XSS attempt detected in parameter: $key", null, $this->getClientIP());
                    $this->sendErrorResponse(400, 'Invalid request');
                }
            }
        }
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
     * Log security event
     */
    private function logSecurityEvent($event, $details, $userId, $ipAddress) {
        try {
            logSecurityEvent($this->pdo, $event, $details, $userId, $ipAddress);
        } catch (Exception $e) {
            // Silently fail if logging fails
        }
    }
    
    /**
     * Send error response
     */
    private function sendErrorResponse($code, $message) {
        http_response_code($code);
        echo json_encode(['error' => $message]);
        exit();
    }
}

// Global security middleware instance
$simpleSecurityMiddleware = null;

/**
 * Initialize simple security middleware
 */
function initSimpleSecurityMiddleware($pdo) {
    global $simpleSecurityMiddleware;
    $simpleSecurityMiddleware = new SimpleSecurityMiddleware($pdo);
}

/**
 * Check security for current request
 */
function checkSimpleSecurity($endpoint = null) {
    global $simpleSecurityMiddleware;
    if ($simpleSecurityMiddleware) {
        $simpleSecurityMiddleware->checkSecurity($endpoint);
    }
}
