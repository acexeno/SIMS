<?php
/**
 * Fix image_url column to support base64 data URLs
 * Base64 data URLs can be very long (10,000+ characters)
 * VARCHAR(500) is too small, need TEXT or LONGTEXT
 */

// Set HTTP_HOST for database connection detection
if (!isset($_SERVER['HTTP_HOST'])) {
    $_SERVER['HTTP_HOST'] = 'localhost';
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Check current column type
    $stmt = $pdo->query("SHOW COLUMNS FROM components WHERE Field = 'image_url'");
    $column = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($column) {
        echo "Current image_url column type: " . $column['Type'] . "\n";
        
        // Check if we need to update
        if (strpos(strtolower($column['Type']), 'varchar') !== false || 
            strpos(strtolower($column['Type']), 'char') !== false) {
            
            echo "Updating image_url column to TEXT to support base64 data URLs...\n";
            
            // Update column to TEXT (can store up to 65,535 characters)
            $pdo->exec("ALTER TABLE components MODIFY COLUMN image_url TEXT");
            
            echo "✓ Successfully updated image_url column to TEXT\n";
            echo "✓ Column can now store base64 data URLs (up to 65KB)\n";
        } else {
            echo "✓ Column is already TEXT or LONGTEXT, no update needed\n";
        }
    } else {
        echo "ERROR: image_url column not found in components table\n";
    }
    
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

