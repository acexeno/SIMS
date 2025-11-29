<?php
/**
 * Fix archive_components table timestamp columns
 * This script updates the existing archive_components table to allow NULL for created_at and updated_at
 * Run this once to fix the existing table structure
 */

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Check if archive_components table exists
    $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
    if ($checkTable->rowCount() === 0) {
        echo "✓ Archive components table does not exist. It will be created automatically when needed.\n";
        exit(0);
    }
    
    echo "Found archive_components table. Checking column definitions...\n";
    
    // Get current column definitions
    $columns = $pdo->query("SHOW COLUMNS FROM archive_components")->fetchAll(PDO::FETCH_ASSOC);
    
    $needsFix = false;
    
    foreach ($columns as $column) {
        if ($column['Field'] === 'created_at' || $column['Field'] === 'updated_at') {
            // Check if NULL is allowed
            if ($column['Null'] !== 'YES') {
                echo "⚠ Column '{$column['Field']}' does not allow NULL. Fixing...\n";
                $needsFix = true;
                
                // Alter column to allow NULL
                $pdo->exec("ALTER TABLE archive_components MODIFY COLUMN {$column['Field']} TIMESTAMP NULL");
                echo "✓ Fixed column '{$column['Field']}'\n";
            } else {
                echo "✓ Column '{$column['Field']}' already allows NULL\n";
            }
        }
    }
    
    if (!$needsFix) {
        echo "\n✓ Archive table structure is correct. No changes needed.\n";
    } else {
        echo "\n✓ Archive table has been updated successfully!\n";
        echo "You can now delete components and they will be archived properly.\n";
    }
    
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>

