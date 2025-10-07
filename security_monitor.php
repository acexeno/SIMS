<?php
// Security monitoring script
// Run this script to check security status and generate reports

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/config/security.php';

function generateSecurityReport($pdo) {
    echo "🔒 Security Monitoring Report - " . date('Y-m-d H:i:s') . "\n";
    echo str_repeat("=", 50) . "\n\n";
    
    // Check recent failed login attempts
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count, ip_address 
        FROM login_attempts 
        WHERE success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY ip_address 
        ORDER BY count DESC 
        LIMIT 10
    ");
    $stmt->execute();
    $failedAttempts = $stmt->fetchAll();
    
    if (!empty($failedAttempts)) {
        echo "🚨 Recent Failed Login Attempts (Last Hour):\n";
        foreach ($failedAttempts as $attempt) {
            echo "   IP: {$attempt['ip_address']} - {$attempt['count']} attempts\n";
        }
        echo "\n";
    }
    
    // Check for suspicious activity
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as count, ip_address 
        FROM login_attempts 
        WHERE success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY ip_address 
        HAVING count > 20
        ORDER BY count DESC
    ");
    $stmt->execute();
    $suspiciousIPs = $stmt->fetchAll();
    
    if (!empty($suspiciousIPs)) {
        echo "⚠️  Suspicious IPs (20+ failed attempts in 24h):\n";
        foreach ($suspiciousIPs as $ip) {
            echo "   IP: {$ip['ip_address']} - {$ip['count']} attempts\n";
        }
        echo "\n";
    }
    
    // Check blocked IPs
    $stmt = $pdo->prepare("
        SELECT ip_address, reason, created_at, expires_at 
        FROM blocked_ips 
        WHERE expires_at IS NULL OR expires_at > NOW()
        ORDER BY created_at DESC
    ");
    $stmt->execute();
    $blockedIPs = $stmt->fetchAll();
    
    if (!empty($blockedIPs)) {
        echo "🚫 Currently Blocked IPs:\n";
        foreach ($blockedIPs as $ip) {
            $expires = $ip['expires_at'] ? " (expires: {$ip['expires_at']})" : " (permanent)";
            echo "   IP: {$ip['ip_address']} - {$ip['reason']}{$expires}\n";
        }
        echo "\n";
    }
    
    // Check recent security events
    $stmt = $pdo->prepare("
        SELECT event, COUNT(*) as count, MAX(created_at) as last_occurrence
        FROM security_logs 
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY event 
        ORDER BY count DESC
    ");
    $stmt->execute();
    $securityEvents = $stmt->fetchAll();
    
    if (!empty($securityEvents)) {
        echo "📊 Security Events (Last 24 Hours):\n";
        foreach ($securityEvents as $event) {
            echo "   {$event['event']}: {$event['count']} occurrences (last: {$event['last_occurrence']})\n";
        }
        echo "\n";
    }
    
    // Check JWT secret security
    $jwtSecret = env('JWT_SECRET', '');
    if (empty($jwtSecret) || $jwtSecret === 'builditpc_secret_key_2024_change_in_production') {
        echo "⚠️  WARNING: JWT secret is not secure!\n";
        echo "   Please update JWT_SECRET in your .env file\n\n";
    }
    
    // Check CORS configuration
    $corsOrigins = env('CORS_ALLOWED_ORIGINS', '');
    if (empty($corsOrigins)) {
        echo "⚠️  WARNING: CORS origins not configured!\n";
        echo "   Please set CORS_ALLOWED_ORIGINS in your .env file\n\n";
    }
    
    // Check debug mode
    $debugMode = env('APP_DEBUG', '0');
    if ($debugMode === '1' || strtolower($debugMode) === 'true') {
        echo "⚠️  WARNING: Debug mode is enabled!\n";
        echo "   Set APP_DEBUG=0 in production\n\n";
    }
    
    echo "✅ Security check completed\n";
}

function autoBlockSuspiciousIPs($pdo) {
    echo "🛡️  Checking for IPs to auto-block...\n";
    
    // Find IPs with more than 50 failed attempts in 24 hours
    $stmt = $pdo->prepare("
        SELECT ip_address, COUNT(*) as count 
        FROM login_attempts 
        WHERE success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY ip_address 
        HAVING count > 50
    ");
    $stmt->execute();
    $suspiciousIPs = $stmt->fetchAll();
    
    foreach ($suspiciousIPs as $ip) {
        // Check if already blocked
        $checkStmt = $pdo->prepare("
            SELECT COUNT(*) as count 
            FROM blocked_ips 
            WHERE ip_address = ? AND (expires_at IS NULL OR expires_at > NOW())
        ");
        $checkStmt->execute([$ip['ip_address']]);
        $alreadyBlocked = $checkStmt->fetch()['count'] > 0;
        
        if (!$alreadyBlocked) {
            $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));
            blockIP($pdo, $ip['ip_address'], "Auto-blocked: {$ip['count']} failed attempts in 24h", $expiresAt);
            echo "   🚫 Auto-blocked IP: {$ip['ip_address']} ({$ip['count']} failed attempts)\n";
        }
    }
    
    if (empty($suspiciousIPs)) {
        echo "   ✅ No IPs need auto-blocking\n";
    }
}

function cleanOldLogs($pdo) {
    echo "🧹 Cleaning old security logs...\n";
    
    // Clean login attempts older than 30 days
    $stmt = $pdo->prepare("
        DELETE FROM login_attempts 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    ");
    $stmt->execute();
    $deletedAttempts = $stmt->rowCount();
    
    // Clean security logs older than 90 days
    $stmt = $pdo->prepare("
        DELETE FROM security_logs 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    ");
    $stmt->execute();
    $deletedLogs = $stmt->rowCount();
    
    // Clean expired blocked IPs
    $stmt = $pdo->prepare("
        DELETE FROM blocked_ips 
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
    ");
    $stmt->execute();
    $deletedBlocks = $stmt->rowCount();
    
    echo "   🗑️  Cleaned {$deletedAttempts} old login attempts\n";
    echo "   🗑️  Cleaned {$deletedLogs} old security logs\n";
    echo "   🗑️  Cleaned {$deletedBlocks} expired IP blocks\n";
}

// Main execution
try {
    $pdo = get_db_connection();
    
    // Generate security report
    generateSecurityReport($pdo);
    
    // Auto-block suspicious IPs
    autoBlockSuspiciousIPs($pdo);
    
    // Clean old logs
    cleanOldLogs($pdo);
    
    echo "\n🎉 Security monitoring completed successfully!\n";
    
} catch (Exception $e) {
    echo "❌ Error during security monitoring: " . $e->getMessage() . "\n";
    exit(1);
}
