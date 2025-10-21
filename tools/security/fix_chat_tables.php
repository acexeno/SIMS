<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database configuration
$host = 'localhost';
$dbname = 'builditpc_db';
$user = 'root';
$pass = '';

try {
    // Create connection
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    echo "<h2>Fixing Chat Tables</h2>";

    // Create chat_sessions table if it doesn't exist
    $sql = "CREATE TABLE IF NOT EXISTS `chat_sessions` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `user_id` int(11) DEFAULT NULL,
        `guest_name` varchar(100) DEFAULT NULL,
        `guest_email` varchar(255) DEFAULT NULL,
        `status` enum('open','resolved') NOT NULL DEFAULT 'open',
        `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
        `resolution_notes` text DEFAULT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `user_id` (`user_id`),
        KEY `status` (`status`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $pdo->exec($sql);
    echo "<p>✅ Created/updated chat_sessions table</p>";

    // Create chat_messages table if it doesn't exist
    $sql = "CREATE TABLE IF NOT EXISTS `chat_messages` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `session_id` int(11) NOT NULL,
        `sender` enum('user','admin','system') NOT NULL,
        `message` text NOT NULL,
        `message_type` enum('text','image','file','system') NOT NULL DEFAULT 'text',
        `read_status` enum('read','unread') NOT NULL DEFAULT 'unread',
        `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (`id`),
        KEY `session_id` (`session_id`),
        KEY `sender` (`sender`),
        KEY `read_status` (`read_status`),
        KEY `sent_at` (`sent_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $pdo->exec($sql);
    echo "<p>✅ Created/updated chat_messages table</p>";

    // Create last_seen_chat table if it doesn't exist
    $sql = "CREATE TABLE IF NOT EXISTS `last_seen_chat` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `user_id` int(11) NOT NULL,
        `session_id` int(11) NOT NULL,
        `last_seen_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `user_session` (`user_id`,`session_id`),
        KEY `session_id` (`session_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $pdo->exec($sql);
    echo "<p>✅ Created/updated last_seen_chat table</p>";

    // Add foreign key constraints if they don't exist
    try {
        $sql = "ALTER TABLE `chat_sessions`
            ADD CONSTRAINT `chat_sessions_ibfk_1` 
            FOREIGN KEY (`user_id`) 
            REFERENCES `users` (`id`) 
            ON DELETE SET NULL";
        $pdo->exec($sql);
        echo "<p>✅ Added foreign key to chat_sessions.user_id</p>";
    } catch (PDOException $e) {
        if ($e->getCode() != 'HY000' || strpos($e->getMessage(), 'already exists') === false) {
            throw $e;
        }
        echo "<p>ℹ️ Foreign key chat_sessions_ibfk_1 already exists</p>";
    }

    try {
        $sql = "ALTER TABLE `chat_messages`
            ADD CONSTRAINT `chat_messages_ibfk_1` 
            FOREIGN KEY (`session_id`) 
            REFERENCES `chat_sessions` (`id`) 
            ON DELETE CASCADE";
        $pdo->exec($sql);
        echo "<p>✅ Added foreign key to chat_messages.session_id</p>";
    } catch (PDOException $e) {
        if ($e->getCode() != 'HY000' || strpos($e->getMessage(), 'already exists') === false) {
            throw $e;
        }
        echo "<p>ℹ️ Foreign key chat_messages_ibfk_1 already exists</p>";
    }

    // Add can_access_chat_support column to users table if it doesn't exist
    $stmt = $pdo->query("SHOW COLUMNS FROM `users` LIKE 'can_access_chat_support'");
    if ($stmt->rowCount() == 0) {
        $pdo->exec("ALTER TABLE `users` ADD `can_access_chat_support` TINYINT(1) NOT NULL DEFAULT '1'");
        echo "<p>✅ Added can_access_chat_support column to users table</p>";
    } else {
        echo "<p>ℹ️ can_access_chat_support column already exists in users table</p>";
    }

    echo "<h3 style='color: green;'>✅ Chat tables have been successfully created/updated!</h3>";

} catch (PDOException $e) {
    echo "<h3 style='color: red;'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</h3>";
    
    if ($e->getCode() == '42S02') {
        echo "<p>It seems the 'users' table is missing. Please ensure your authentication system is properly set up.</p>";
    } elseif ($e->getCode() == '1049') {
        echo "<p>The database '$dbname' does not exist. Please create it first.</p>";
    } elseif ($e->getCode() == '1045') {
        echo "<p>Access denied for user '$user'. Please check your MySQL username and password.</p>";
    } elseif ($e->getCode() == '2002') {
        echo "<p>Could not connect to the MySQL server. Make sure MySQL is running in XAMPP.</p>";
    }
}
?>
