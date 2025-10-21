<?php
require_once 'backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Create chat_sessions table
    $sql = "
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        guest_name VARCHAR(255),
        guest_email VARCHAR(255),
        status ENUM('open', 'resolved') DEFAULT 'open',
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    
    // Create chat_messages table
    $sql = "
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        sender ENUM('user', 'admin', 'system') NOT NULL,
        message TEXT NOT NULL,
        message_type ENUM('text', 'system', 'welcome') DEFAULT 'text',
        read_status ENUM('read', 'unread') DEFAULT 'unread',
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;";
    
    $pdo->exec($sql);
    
    echo "Chat tables created successfully!\n";
    
} catch (PDOException $e) {
    die("DB ERROR: " . $e->getMessage());
}
?>
