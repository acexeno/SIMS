<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database configuration
$host = 'localhost';
$dbname = 'builditpc_db';
$user = 'root';
$pass = '';

// Create connection
$conn = new mysqli($host, $user, $pass, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "<h2>Chat System Setup</h2>";
echo "<p>Connected to database: $dbname</p>";

// SQL to create chat_sessions table
$sql = "CREATE TABLE IF NOT EXISTS `chat_sessions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) DEFAULT NULL,
    `guest_name` varchar(255) DEFAULT NULL,
    `guest_email` varchar(255) DEFAULT NULL,
    `status` enum('open','resolved') DEFAULT 'open',
    `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
    `resolution_notes` text DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_status` (`status`),
    KEY `idx_priority` (`priority`),
    KEY `idx_updated_at` (`updated_at`),
    CONSTRAINT `chat_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql) === TRUE) {
    echo "<p>✅ Table 'chat_sessions' created or already exists</p>";
} else {
    echo "<p>❌ Error creating table chat_sessions: " . $conn->error . "</p>";
}

// SQL to create chat_messages table
$sql = "CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `session_id` int(11) NOT NULL,
    `sender` enum('user','admin','system') NOT NULL,
    `message` text NOT NULL,
    `message_type` enum('text','image','file','system') DEFAULT 'text',
    `read_status` enum('read','unread') DEFAULT 'unread',
    `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `session_id` (`session_id`),
    KEY `idx_session_sender` (`session_id`,`sender`),
    KEY `idx_read_status` (`read_status`),
    KEY `idx_sent_at` (`sent_at`),
    CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql) === TRUE) {
    echo "<p>✅ Table 'chat_messages' created or already exists</p>";
} else {
    echo "<p>❌ Error creating table chat_messages: " . $conn->error . "</p>";
}

// SQL to create last_seen_chat table
$sql = "CREATE TABLE IF NOT EXISTS `last_seen_chat` (
    `user_id` int(11) NOT NULL,
    `session_id` int(11) NOT NULL,
    `last_seen_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`user_id`,`session_id`),
    KEY `session_id` (`session_id`),
    CONSTRAINT `last_seen_chat_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `last_seen_chat_ibfk_2` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";

if ($conn->query($sql) === TRUE) {
    echo "<p>✅ Table 'last_seen_chat' created or already exists</p>";
} else {
    echo "<p>❌ Error creating table last_seen_chat: " . $conn->error . "</p>";
}

// Add chat-related columns to users table if they don't exist
$columns = [
    'can_access_chat_support' => "TINYINT(1) NOT NULL DEFAULT 1"
];

foreach ($columns as $column => $definition) {
    $check = $conn->query("SHOW COLUMNS FROM `users` LIKE '$column'");
    if ($check->num_rows == 0) {
        $sql = "ALTER TABLE `users` ADD COLUMN `$column` $definition";
        if ($conn->query($sql) === TRUE) {
            echo "<p>✅ Added column '$column' to 'users' table</p>";
        } else {
            echo "<p>❌ Error adding column '$column' to 'users' table: " . $conn->error . "</p>";
        }
    } else {
        echo "<p>ℹ️ Column '$column' already exists in 'users' table</p>";
    }
}

$conn->close();

echo "<h3>Chat System Setup Complete!</h3>";
?>
