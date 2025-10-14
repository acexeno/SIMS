<?php
// Security configuration and helper functions
// This file should be included in all API endpoints

// Security headers
function setSecurityHeaders() {
    // Prevent clickjacking
    header('X-Frame-Options: DENY');
    
    // Prevent MIME type sniffing
    header('X-Content-Type-Options: nosniff');
    
    // Enable XSS protection
    header('X-XSS-Protection: 1; mode=block');
    
    // Referrer policy
    header('Referrer-Policy: strict-origin-when-cross-origin');
    
    // Content Security Policy
    $csp = "default-src 'self'; " .
           "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " .
           "style-src 'self' 'unsafe-inline'; " .
           "img-src 'self' data: https:; " .
           "font-src 'self' data:; " .
           "connect-src 'self'; " .
           "frame-ancestors 'none';";
    header("Content-Security-Policy: $csp");
    
    // HSTS (only in production with HTTPS)
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

// Rate limiting for login attempts
function checkLoginRateLimit($pdo, $identifier, $maxAttempts = 5, $timeWindow = 900) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as attempts 
        FROM login_attempts 
        WHERE identifier = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
    ");
    $stmt->execute([$identifier, $timeWindow]);
    $result = $stmt->fetch();
    
    return (int)$result['attempts'] < $maxAttempts;
}

// Record failed login attempt
function recordLoginAttempt($pdo, $identifier, $ipAddress, $success = false) {
    $stmt = $pdo->prepare("
        INSERT INTO login_attempts (identifier, ip_address, success, created_at) 
        VALUES (?, ?, ?, NOW())
    ");
    $stmt->execute([$identifier, $ipAddress, $success ? 1 : 0]);
}

// Clean old login attempts
function cleanOldLoginAttempts($pdo, $days = 30) {
    $stmt = $pdo->prepare("
        DELETE FROM login_attempts 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    ");
    $stmt->execute([$days]);
}

// Input sanitization
function sanitizeInput($input, $type = 'string') {
    switch ($type) {
        case 'email':
            return filter_var(trim($input), FILTER_SANITIZE_EMAIL);
        case 'int':
            return (int)$input;
        case 'float':
            return (float)$input;
        case 'string':
        default:
            return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
}

// Validate password strength
function validatePasswordStrength($password) {
    $errors = [];
    
    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters long';
    }
    
    if (!preg_match('/[A-Z]/', $password)) {
        $errors[] = 'Password must contain at least one uppercase letter';
    }
    
    if (!preg_match('/[a-z]/', $password)) {
        $errors[] = 'Password must contain at least one lowercase letter';
    }
    
    if (!preg_match('/[0-9]/', $password)) {
        $errors[] = 'Password must contain at least one number';
    }
    
    if (!preg_match('/[^A-Za-z0-9]/', $password)) {
        $errors[] = 'Password must contain at least one special character';
    }
    
    return $errors;
}

// Generate CSRF token
function generateCSRFToken() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    return $token;
}

// Verify CSRF token
function verifyCSRFToken($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token);
}

// Secure random string generation
function generateSecureToken($length = 32) {
    return bin2hex(random_bytes($length));
}

// Log security events
function logSecurityEvent($pdo, $event, $details, $userId = null, $ipAddress = null) {
    $ipAddress = $ipAddress ?: ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    
    $stmt = $pdo->prepare("
        INSERT INTO security_logs (event, details, user_id, ip_address, created_at) 
        VALUES (?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$event, $details, $userId, $ipAddress]);
}

// Check if IP is blocked
function isIPBlocked($pdo, $ipAddress) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count 
        FROM blocked_ips 
        WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > NOW())
    ");
    $stmt->execute([$ipAddress]);
    $result = $stmt->fetch();
    
    return (int)$result['count'] > 0;
}

// Block IP address
function blockIP($pdo, $ipAddress, $reason, $expiresAt = null) {
    $stmt = $pdo->prepare("
        INSERT INTO blocked_ips (ip_address, reason, expires_at, created_at) 
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        reason = VALUES(reason), 
        expires_at = VALUES(expires_at),
        created_at = NOW()
    ");
    $stmt->execute([$ipAddress, $reason, $expiresAt]);
}

// Validate file upload
function validateFileUpload($file, $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], $maxSize = 5242880) {
    $errors = [];
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors[] = 'File upload error';
        return $errors;
    }
    
    if ($file['size'] > $maxSize) {
        $errors[] = 'File too large. Maximum size: ' . ($maxSize / 1024 / 1024) . 'MB';
    }
    
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        $errors[] = 'Invalid file type. Allowed: ' . implode(', ', $allowedTypes);
    }
    
    return $errors;
}

// Set up security tables
function setupSecurityTables($pdo) {
    // Login attempts table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            identifier VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            success TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_identifier_time (identifier, created_at),
            INDEX idx_ip_time (ip_address, created_at)
        )
    ");
    
    // Security logs table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS security_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event VARCHAR(100) NOT NULL,
            details TEXT,
            user_id INT NULL,
            ip_address VARCHAR(45) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_event_time (event, created_at),
            INDEX idx_user_time (user_id, created_at)
        )
    ");
    
    // Blocked IPs table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS blocked_ips (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45) NOT NULL UNIQUE,
            reason VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ip (ip_address)
        )
    ");
}
