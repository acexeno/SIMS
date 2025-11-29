<?php
/**
 * Script to create the archive_components table
 * Run this script once to set up the archive table in your database
 */

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Read the SQL schema file
    $sqlFile = __DIR__ . '/database/archive_components_schema.sql';
    if (!file_exists($sqlFile)) {
        die("Error: SQL file not found: $sqlFile\n");
    }
    
    $sql = file_get_contents($sqlFile);
    
    // Execute the SQL
    $pdo->exec($sql);
    
    echo "✓ Archive components table created successfully!\n";
    echo "The archive_components table is now ready to store deleted components.\n";
    
} catch (Exception $e) {
    echo "✗ Error creating archive table: " . $e->getMessage() . "\n";
    exit(1);
}
