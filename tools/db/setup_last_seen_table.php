<?php
require_once 'backend/config/database.php';

try {
    $pdo = get_db_connection();
    
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
    
    echo "Last seen chat table created successfully!\n";
    
} catch (PDOException $e) {
    die("DB ERROR: " . $e->getMessage());
}
?>
