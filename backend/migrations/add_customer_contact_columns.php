<?php
/**
 * Migration: Add customer_name and customer_phone columns to order_financial_details
 *
 * Usage:
 *   php backend/migrations/add_customer_contact_columns.php
 */

// Ensure HOST is set so database.php detects local environment correctly
if (!isset($_SERVER['HTTP_HOST'])) {
    $_SERVER['HTTP_HOST'] = 'localhost';
}

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = get_db_connection();

    $columnsToAdd = [
        'customer_name' => "ALTER TABLE order_financial_details ADD COLUMN customer_name VARCHAR(255) NULL AFTER purchase_date",
        'customer_phone' => "ALTER TABLE order_financial_details ADD COLUMN customer_phone VARCHAR(50) NULL AFTER customer_name",
    ];

    foreach ($columnsToAdd as $column => $alterSql) {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM order_financial_details LIKE ?");
        $stmt->execute([$column]);
        $exists = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($exists) {
            echo "✓ Column '$column' already exists. Skipping.\n";
            continue;
        }

        echo "Adding column '$column'...\n";
        $pdo->exec($alterSql);
        echo "✓ Column '$column' added successfully.\n";
    }

    echo "Migration completed.\n";
} catch (PDOException $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}

