<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Add is_public column to user_builds table
    $sql = "ALTER TABLE user_builds ADD COLUMN is_public TINYINT(1) DEFAULT 0 AFTER total_price";
    $pdo->exec($sql);
    echo "Successfully added is_public field to user_builds table\n";
} catch (PDOException $e) {
    if ($e->getCode() == '42S11') {
        echo "Column is_public already exists in user_builds table\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
?> 