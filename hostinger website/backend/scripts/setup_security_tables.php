<?php
/**
 * Setup Security Tables
 * Creates all necessary security tables for the PC Building System
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';

try {
    $pdo = get_db_connection();
    echo "🔒 Setting up security tables...\n";
    
    // Create login_attempts table
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
    echo "✅ Created login_attempts table\n";
    
    // Create security_logs table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS security_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event VARCHAR(100) NOT NULL,
            details TEXT,
            user_id INT NULL,
            ip_address VARCHAR(45) NOT NULL,
            user_agent TEXT,
            severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_event_time (event, created_at),
            INDEX idx_user_time (user_id, created_at),
            INDEX idx_severity_time (severity, created_at)
        )
    ");
    echo "✅ Created security_logs table\n";
    
    // Create blocked_ips table
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
    echo "✅ Created blocked_ips table\n";
    
    // Create rate_limits table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rate_limits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            identifier VARCHAR(255) NOT NULL,
            action VARCHAR(100) NOT NULL,
            ip_address VARCHAR(45) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_identifier_action_time (identifier, action, created_at),
            INDEX idx_ip_time (ip_address, created_at)
        )
    ");
    echo "✅ Created rate_limits table\n";
    
    // Create user_sessions table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            session_token VARCHAR(255) NOT NULL UNIQUE,
            ip_address VARCHAR(45) NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NULL,
            is_active TINYINT(1) DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_user_active (user_id, is_active),
            INDEX idx_token (session_token),
            INDEX idx_expires (expires_at)
        )
    ");
    echo "✅ Created user_sessions table\n";
    
    // Create logs directory if it doesn't exist
    $logsDir = __DIR__ . '/../logs';
    if (!is_dir($logsDir)) {
        mkdir($logsDir, 0755, true);
        echo "✅ Created logs directory\n";
    }
    
    echo "\n🔒 Security tables setup completed successfully!\n";
    
} catch (Exception $e) {
    echo "❌ Error setting up security tables: " . $e->getMessage() . "\n";
    exit(1);
}
