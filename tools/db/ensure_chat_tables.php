<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database configuration
$host = 'localhost';
$db   = 'builditpc_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    // Connect to database
    $pdo = new PDO($dsn, $user, $pass, $options);
    echo "✅ Connected to database: $db\n\n";
    
    // Create chat_sessions table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        guest_name VARCHAR(255),
        guest_email VARCHAR(255),
        status ENUM('open', 'resolved') DEFAULT 'open',
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        resolution_notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    echo "✅ Created/Verified chat_sessions table\n";
    
    // Create chat_messages table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender ENUM('user', 'admin', 'system') NOT NULL,
        message TEXT NOT NULL,
        message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
        read_status ENUM('read', 'unread') DEFAULT 'unread',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    echo "✅ Created/Verified chat_messages table\n";
    
    // Create last_seen_chat table if it doesn't exist
    $sql = "
    CREATE TABLE IF NOT EXISTS last_seen_chat (
        user_id INT NOT NULL,
        session_id INT NOT NULL,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, session_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    echo "✅ Created/Verified last_seen_chat table\n\n";
    
    // Add any missing columns to existing tables
    $alterStatements = [
        // Add missing columns to chat_sessions
        "ALTER TABLE chat_sessions 
         ADD COLUMN IF NOT EXISTS priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal' AFTER status,
         ADD COLUMN IF NOT EXISTS resolution_notes TEXT NULL AFTER priority,
         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
         
        // Add missing columns to chat_messages
        "ALTER TABLE chat_messages
         ADD COLUMN IF NOT EXISTS message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text' AFTER message,
         ADD COLUMN IF NOT EXISTS read_status ENUM('read', 'unread') DEFAULT 'unread' AFTER message_type"
    ];
    
    foreach ($alterStatements as $alterSql) {
        try {
            $pdo->exec($alterSql);
            echo "✅ Applied schema updates\n";
        } catch (PDOException $e) {
            echo "ℹ️ Schema update not needed or failed (this might be normal): " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n✅ Chat tables are ready to use!\n";
    
} catch (PDOException $e) {
    die("❌ Error: " . $e->getMessage() . "\n");
}
?>
