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

    echo "<h2>Verifying chat_messages Table</h2>";

    // Check if table exists
    $tableExists = $pdo->query("SHOW TABLES LIKE 'chat_messages'")->rowCount() > 0;
    
    if (!$tableExists) {
        echo "<p style='color: red;'>❌ chat_messages table does not exist. Creating it now...</p>";
        
        $sql = "CREATE TABLE `chat_messages` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `session_id` int(11) NOT NULL,
            `sender` enum('user','admin','system') NOT NULL,
            `message` text NOT NULL,
            `message_type` enum('text','image','file','system') NOT NULL DEFAULT 'text',
            `read_status` enum('read','unread') NOT NULL DEFAULT 'unread',
            `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `session_id` (`session_id`),
            KEY `sender` (`sender`),
            KEY `read_status` (`read_status`),
            KEY `sent_at` (`sent_at`),
            CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
        
        $pdo->exec($sql);
        echo "<p style='color: green;'>✅ Created chat_messages table successfully.</p>";
    } else {
        echo "<p style='color: green;'>✅ chat_messages table exists.</p>";
        
        // Check columns
        $columns = [
            'id' => 'int(11)',
            'session_id' => 'int(11)',
            'sender' => "enum('user','admin','system')",
            'message' => 'text',
            'message_type' => "enum('text','image','file','system')",
            'read_status' => "enum('read','unread')",
            'sent_at' => 'timestamp'
        ];
        
        $stmt = $pdo->query("DESCRIBE chat_messages");
        $existingColumns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $missingColumns = [];
        $incorrectColumns = [];
        
        foreach ($columns as $colName => $colType) {
            $found = false;
            foreach ($existingColumns as $col) {
                if ($col['Field'] === $colName) {
                    $found = true;
                    if (strpos(strtolower($col['Type']), strtolower($colType)) === false) {
                        $incorrectColumns[] = [
                            'name' => $colName,
                            'current' => $col['Type'],
                            'expected' => $colType
                        ];
                    }
                    break;
                }
            }
            if (!$found) {
                $missingColumns[] = $colName;
            }
        }
        
        // Add missing columns
        foreach ($missingColumns as $col) {
            $sql = "";
            switch ($col) {
                case 'id':
                    $sql = "ALTER TABLE `chat_messages` ADD `id` INT NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (`id`)";
                    break;
                case 'session_id':
                    $sql = "ALTER TABLE `chat_messages` ADD `session_id` INT NOT NULL AFTER `id`";
                    break;
                case 'sender':
                    $sql = "ALTER TABLE `chat_messages` ADD `sender` ENUM('user','admin','system') NOT NULL AFTER `session_id`";
                    break;
                case 'message':
                    $sql = "ALTER TABLE `chat_messages` ADD `message` TEXT NOT NULL AFTER `sender`";
                    break;
                case 'message_type':
                    $sql = "ALTER TABLE `chat_messages` ADD `message_type` ENUM('text','image','file','system') NOT NULL DEFAULT 'text' AFTER `message`";
                    break;
                case 'read_status':
                    $sql = "ALTER TABLE `chat_messages` ADD `read_status` ENUM('read','unread') NOT NULL DEFAULT 'unread' AFTER `message_type`";
                    break;
                case 'sent_at':
                    $sql = "ALTER TABLE `chat_messages` ADD `sent_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `read_status`";
                    break;
            }
            
            if ($sql) {
                try {
                    $pdo->exec($sql);
                    echo "<p style='color: green;'>✅ Added missing column: $col</p>";
                } catch (PDOException $e) {
                    echo "<p style='color: orange;'>⚠️ Failed to add column $col: " . $e->getMessage() . "</p>";
                }
            }
        }
        
        // Report incorrect columns
        foreach ($incorrectColumns as $col) {
            echo "<p style='color: orange;'>⚠️ Column '{$col['name']}' has incorrect type: {$col['current']} (expected: {$col['expected']})</p>";
        }
        
        // Check foreign key
        $stmt = $pdo->query("
            SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = '$dbname' 
            AND TABLE_NAME = 'chat_messages' 
            AND REFERENCED_TABLE_NAME IS NOT NULL
        ");
        $foreignKeys = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $hasFk = false;
        foreach ($foreignKeys as $fk) {
            if ($fk['COLUMN_NAME'] === 'session_id' && $fk['REFERENCED_TABLE_NAME'] === 'chat_sessions') {
                $hasFk = true;
                break;
            }
        }
        
        if (!$hasFk) {
            try {
                $pdo->exec("
                    ALTER TABLE `chat_messages`
                    ADD CONSTRAINT `fk_chat_messages_session`
                    FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`)
                    ON DELETE CASCADE
                
                
                
                
                
                ");
                echo "<p style='color: green;'>✅ Added foreign key constraint from chat_messages.session_id to chat_sessions.id</p>";
            } catch (PDOException $e) {
                echo "<p style='color: orange;'>⚠️ Failed to add foreign key: " . $e->getMessage() . "</p>";
            }
        } else {
            echo "<p style='color: green;'>✅ Foreign key constraint exists on session_id</p>";
        }
    }
    
    // Check for any data in the table
    $count = $pdo->query("SELECT COUNT(*) FROM chat_messages")->fetchColumn();
    echo "<p>Total messages in chat_messages table: " . $count . "</p>";
    
    // Show sample data
    if ($count > 0) {
        echo "<h3>Sample Messages (latest 5):</h3>";
        $stmt = $pdo->query("SELECT * FROM chat_messages ORDER BY sent_at DESC LIMIT 5");
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "<table border='1' cellpadding='8' style='border-collapse: collapse; width: 100%; margin-top: 10px;'>";
        echo "<tr><th>ID</th><th>Session ID</th><th>Sender</th><th>Type</th><th>Status</th><th>Sent At</th><th>Message (first 50 chars)</th></tr>";
        
        foreach ($messages as $msg) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($msg['id']) . "</td>";
            echo "<td>" . htmlspecialchars($msg['session_id']) . "</td>";
            echo "<td>" . htmlspecialchars($msg['sender']) . "</td>";
            echo "<td>" . htmlspecialchars($msg['message_type']) . "</td>";
            echo "<td>" . htmlspecialchars($msg['read_status']) . "</td>";
            echo "<td>" . htmlspecialchars($msg['sent_at']) . "</td>";
            echo "<td>" . htmlspecialchars(substr($msg['message'], 0, 50)) . (strlen($msg['message']) > 50 ? '...' : '') . "</td>";
            echo "</tr>";
        }
        
        echo "</table>";
    }
    
} catch (PDOException $e) {
    echo "<h3 style='color: red;'>Error: " . htmlspecialchars($e->getMessage()) . "</h3>";
    
    if (strpos($e->getMessage(), 'SQLSTATE[42S02') !== false) {
        echo "<p>The chat_sessions table might be missing. Make sure to run fix_chat_tables.php first.</p>";
    }
}
?>
