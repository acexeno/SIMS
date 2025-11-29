<?php
/**
 * Fix chat_sessions foreign key constraint to preserve sessions after user logout/deletion
 * This script ensures chat sessions persist even if the user account is deleted or logged out
 * 
 * Run this script once to update the database schema
 */

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = get_db_connection();
    echo "✅ Connected to database\n\n";
    
    // Check if foreign key already exists
    $checkFK = $pdo->query("
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'chat_sessions' 
        AND CONSTRAINT_NAME = 'fk_chat_sessions_user_id'
    ");
    
    if ($checkFK->rowCount() > 0) {
        echo "⚠️  Foreign key constraint already exists. Skipping...\n";
    } else {
        // Drop existing foreign key if it exists with different name
        $existingFKs = $pdo->query("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'chat_sessions' 
            AND COLUMN_NAME = 'user_id'
            AND REFERENCED_TABLE_NAME = 'users'
        ");
        
        if ($existingFKs->rowCount() > 0) {
            $fk = $existingFKs->fetch(PDO::FETCH_ASSOC);
            $fkName = $fk['CONSTRAINT_NAME'];
            echo "⚠️  Dropping existing foreign key: $fkName\n";
            $pdo->exec("ALTER TABLE chat_sessions DROP FOREIGN KEY $fkName");
        }
        
        // Add index on user_id if it doesn't exist
        $checkIndex = $pdo->query("
            SHOW INDEX FROM chat_sessions WHERE Key_name = 'idx_user_id'
        ");
        
        if ($checkIndex->rowCount() === 0) {
            echo "📝 Adding index on user_id...\n";
            $pdo->exec("ALTER TABLE chat_sessions ADD INDEX idx_user_id (user_id)");
            echo "✅ Index added\n";
        }
        
        // Add foreign key constraint with ON DELETE SET NULL
        echo "📝 Adding foreign key constraint with ON DELETE SET NULL...\n";
        $pdo->exec("
            ALTER TABLE chat_sessions 
            ADD CONSTRAINT fk_chat_sessions_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ");
        echo "✅ Foreign key constraint added successfully\n";
    }
    
    echo "\n✅ Migration completed successfully!\n";
    echo "📋 Chat sessions will now persist even if user accounts are deleted or logged out.\n";
    
} catch (PDOException $e) {
    echo "❌ Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}

