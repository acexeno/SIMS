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
    
    // Check if users table exists (required for foreign keys)
    $tables = [
        'users' => "The 'users' table is required for the chat system to work. This table should be created by your authentication system.",
        'chat_sessions' => "The 'chat_sessions' table will be created for storing chat sessions.",
        'chat_messages' => "The 'chat_messages' table will be created for storing chat messages.",
        'last_seen_chat' => "The 'last_seen_chat' table will track when users last viewed a chat."
    ];
    
    $missingTables = [];
    
    foreach ($tables as $table => $description) {
        $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($stmt->rowCount() > 0) {
            echo "✅ Table '$table' exists\n";
        } else {
            echo "❌ Table '$table' is missing\n";
            $missingTables[$table] = $description;
        }
    }
    
    if (empty($missingTables)) {
        echo "\n✅ All required database tables exist. The chat system should work correctly.\n";
    } else {
        echo "\n⚠️  Some required tables are missing. Here's what needs to be done:\n\n";
        foreach ($missingTables as $table => $description) {
            echo "- $description\n";
        }
        
        echo "\nWould you like to create the missing chat tables? (y/n): ";
        $handle = fopen('php://stdin', 'r');
        $response = trim(fgets($handle));
        
        if (strtolower($response) === 'y') {
            // Create chat tables
            $sql = [];
            
            if (isset($missingTables['chat_sessions'])) {
                $sql[] = "CREATE TABLE IF NOT EXISTS chat_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    guest_name VARCHAR(255) NULL,
                    guest_email VARCHAR(255) NULL,
                    status ENUM('open', 'resolved') DEFAULT 'open',
                    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
                    resolution_notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
                ) ENGINE=InnoDB;";
            }
            
            if (isset($missingTables['chat_messages'])) {
                $sql[] = "CREATE TABLE IF NOT EXISTS chat_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    session_id INT NOT NULL,
                    sender ENUM('user', 'admin', 'system') NOT NULL,
                    message TEXT NOT NULL,
                    message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
                    read_status ENUM('read', 'unread') DEFAULT 'unread',
                    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
                    INDEX idx_session_sender (session_id, sender),
                    INDEX idx_read_status (read_status)
                ) ENGINE=InnoDB;";
            }
            
            if (isset($missingTables['last_seen_chat'])) {
                $sql[] = "CREATE TABLE IF NOT EXISTS last_seen_chat (
                    user_id INT NOT NULL,
                    session_id INT NOT NULL,
                    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, session_id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
                ) ENGINE=InnoDB;";
            }
            
            // Execute SQL statements
            $pdo->beginTransaction();
            try {
                foreach ($sql as $query) {
                    $pdo->exec($query);
                    echo "✅ Created table: " . explode(' ', $query)[5] . "\n";
                }
                $pdo->commit();
                echo "\n✅ All missing tables have been created successfully!\n";
            } catch (PDOException $e) {
                $pdo->rollBack();
                echo "\n❌ Error creating tables: " . $e->getMessage() . "\n";
                if (strpos($e->getMessage(), 'users') !== false) {
                    echo "\nThe error suggests that the 'users' table is missing or has a different structure.";
                    echo "\nPlease ensure your authentication system is properly set up with a 'users' table.";
                    echo "\nThe 'users' table should have at least an 'id' column as a primary key.";
                }
            }
        } else {
            echo "\n⚠️  Tables were not created. The chat system may not work correctly without these tables.\n";
        }
    }
    
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    
    if ($e->getCode() == 1049) {
        echo "The database 'builditpc_db' does not exist. Would you like to create it? (y/n): ";
        $handle = fopen('php://stdin', 'r');
        $response = trim(fgets($handle));
        
        if (strtolower($response) === 'y') {
            try {
                $pdo = new PDO("mysql:host=$host", $user, $pass, $options);
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET $charset COLLATE utf8mb4_unicode_ci");
                echo "✅ Database '$db' created successfully.\n";
                echo "Please run this script again to set up the required tables.\n";
            } catch (PDOException $e) {
                echo "❌ Failed to create database: " . $e->getMessage() . "\n";
            }
        }
    }
}
?>
