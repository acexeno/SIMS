<?php
/**
 * Migration: Update order_financial_details table to make fields nullable
 * Only purchase_date remains required
 */

require_once '../config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "Starting migration: Update order_financial_details schema...\n";
    
    // Make fields nullable except purchase_date
    $alterQueries = [
        "ALTER TABLE order_financial_details MODIFY COLUMN invoice_number VARCHAR(255) NULL",
        "ALTER TABLE order_financial_details MODIFY COLUMN component_price DECIMAL(10,2) NULL DEFAULT 0.00",
        "ALTER TABLE order_financial_details MODIFY COLUMN acquisition_date DATE NULL",
        "ALTER TABLE order_financial_details MODIFY COLUMN acquisition_price DECIMAL(10,2) NULL DEFAULT 0.00",
        "ALTER TABLE order_financial_details MODIFY COLUMN purchase_order VARCHAR(255) NULL",
        "ALTER TABLE order_financial_details MODIFY COLUMN acquisition_type ENUM('purchase', 'lease', 'rental', 'donation', 'trade') NULL"
    ];
    
    foreach ($alterQueries as $query) {
        echo "Executing: $query\n";
        $pdo->exec($query);
        echo "✓ Success\n";
    }
    
    echo "\nMigration completed successfully!\n";
    echo "All fields except purchase_date are now nullable.\n";
    
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
