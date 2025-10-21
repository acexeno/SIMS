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
    echo "✅ Successfully connected to database: $db\n\n";
    
    // Check if users table exists
    $tables = [
        'users' => [
            'description' => 'Users table (required for authentication)',
            'required_columns' => ['id', 'username', 'email', 'password_hash', 'is_active']
        ],
        'chat_sessions' => [
            'description' => 'Stores chat sessions',
            'required_columns' => ['id', 'user_id', 'status', 'priority', 'created_at', 'updated_at']
        ],
        'chat_messages' => [
            'description' => 'Stores chat messages',
            'required_columns' => ['id', 'session_id', 'sender', 'message', 'sent_at', 'read_status']
        ],
        'last_seen_chat' => [
            'description' => 'Tracks when users last viewed chats',
            'required_columns' => ['user_id', 'session_id', 'last_seen_at']
        ]
    ];
    
    // Check each table
    foreach ($tables as $table => $info) {
        echo "Checking table: $table\n";
        echo "  - Description: {$info['description']}\n";
        
        // Check if table exists
        $stmt = $pdo->query("SHOW TABLES LIKE '$table'");
        if ($stmt->rowCount() === 0) {
            echo "  ❌ Table does not exist\n\n";
            continue;
        }
        
        echo "  ✅ Table exists\n";
        
        // Check columns
        $stmt = $pdo->query("SHOW COLUMNS FROM $table");
        $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $missingColumns = [];
        
        foreach ($info['required_columns'] as $col) {
            if (!in_array($col, $columns)) {
                $missingColumns[] = $col;
            }
        }
        
        if (!empty($missingColumns)) {
            echo "  ⚠ Missing columns: " . implode(', ', $missingColumns) . "\n";
        } else {
            echo "  ✅ All required columns exist\n";
        }
        
        // Show table structure
        echo "  Table structure:\n";
        $stmt = $pdo->query("SHOW CREATE TABLE $table");
        $createTable = $stmt->fetch();
        echo "  " . str_replace("\n", "\n  ", $createTable["Create Table"]) . "\n\n";
    }
    
    // Check if there are any users in the database
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as user_count FROM users");
        $userCount = $stmt->fetch()['user_count'];
        echo "\n👥 Total users in database: $userCount\n";
        
        if ($userCount === 0) {
            echo "⚠ No users found in the database. You'll need to create at least one user to use the chat system.\n";
        }
    } catch (Exception $e) {
        echo "⚠ Could not check users table: " . $e->getMessage() . "\n";
    }
    
    echo "\n✅ Database structure verification complete\n";
    
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    
    if ($e->getCode() == 1049) {
        echo "\nThe database '$db' does not exist. Would you like to create it? (y/n): ";
        $handle = fopen('php://stdin', 'r');
        $response = trim(fgets($handle));
        
        if (strtolower($response) === 'y') {
            try {
                $pdo = new PDO("mysql:host=$host", $user, $pass, $options);
                $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET $charset COLLATE utf8mb4_unicode_ci");
                echo "\n✅ Database '$db' created successfully.\n";
                echo "Please run this script again to verify the database structure.\n";
            } catch (PDOException $e) {
                echo "❌ Failed to create database: " . $e->getMessage() . "\n";
            }
        }
    }
}
?>
