<?php
require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();

function tableExists($pdo, $tableName) {
    $stmt = $pdo->query("SHOW TABLES LIKE '$tableName'");
    return $stmt->rowCount() > 0;
}

$chatTables = ['chat_sessions', 'chat_messages', 'last_seen_chat'];
$missingTables = [];

foreach ($chatTables as $table) {
    if (!tableExists($pdo, $table)) {
        $missingTables[] = $table;
    }
}

if (empty($missingTables)) {
    echo "All chat tables exist in the database.\n";
} else {
    echo "The following chat tables are missing: " . implode(', ', $missingTables) . "\n";
    echo "Please run the chat_schema.sql script to create them.\n";
}

// Check if the tables have the correct structure
if (tableExists($pdo, 'chat_sessions')) {
    $stmt = $pdo->query("SHOW COLUMNS FROM chat_sessions");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $requiredColumns = ['id', 'user_id', 'guest_name', 'guest_email', 'status', 'priority', 'created_at', 'updated_at'];
    $missingColumns = array_diff($requiredColumns, $columns);
    
    if (!empty($missingColumns)) {
        echo "Warning: The chat_sessions table is missing some columns: " . implode(', ', $missingColumns) . "\n";
        echo "Please update the table structure by running the latest chat_schema.sql script.\n";
    }
}
?>
