<?php
// Database configuration
$host = 'localhost';
$dbname = 'builditpc_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    // Connect to database
    $pdo = new PDO($dsn, $user, $pass, $options);
    echo "✅ Connected to database: $dbname\n\n";
    
    // Create chat_sessions table
    $sql = "
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        guest_name VARCHAR(255) NULL,
        guest_email VARCHAR(255) NULL,
        status ENUM('open', 'resolved') DEFAULT 'open',
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        resolution_notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_updated_at (updated_at)
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    echo "✅ Created/Updated chat_sessions table\n";
    
    // Create chat_messages table
    $sql = "
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender ENUM('user', 'admin', 'system') NOT NULL,
        message TEXT NOT NULL,
        message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
        read_status ENUM('read', 'unread') DEFAULT 'unread',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
        INDEX idx_session_sender (session_id, sender),
        INDEX idx_read_status (read_status),
        INDEX idx_sent_at (sent_at)
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    echo "✅ Created/Updated chat_messages table\n";
    
    // Create last_seen_chat table
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
    echo "✅ Created/Updated last_seen_chat table\n\n";
    
    echo "🎉 Chat tables have been successfully created/updated!\n";
    
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    
    if ($e->getCode() == '42S02') {
        if (strpos($e->getMessage(), 'users') !== false) {
            echo "\nThe error suggests that the 'users' table is missing.";
            echo "\nPlease make sure your authentication system is properly set up with a 'users' table.";
            echo "\nThe 'users' table should have an 'id' column as a primary key.";
        }
    } elseif ($e->getCode() == '1049') {
        echo "\nThe database '$dbname' does not exist.";
        echo "\nPlease create the database first or check your database name.";
    } elseif ($e->getCode() == '1045') {
        echo "\nAccess denied for user '$user'.";
        echo "\nPlease check your MySQL username and password in the script.";
    } elseif ($e->getCode() == '2002') {
        echo "\nCould not connect to the MySQL server.";
        echo "\nPlease make sure your MySQL server is running.";
    }
}
?>
