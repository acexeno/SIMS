<?php
// List all components with a price of 0.00
require_once __DIR__ . '/config/database.php';

try {
    $stmt = $pdo->query('SELECT id, name, price, category_id FROM components WHERE price = 0.00');
    $rows = $stmt->fetchAll();
    if (count($rows) === 0) {
        echo "No components with price 0.00 found.\n";
    } else {
        echo "ID | Name | Price | Category ID\n";
        echo str_repeat('-', 60) . "\n";
        foreach ($rows as $row) {
            echo "{$row['id']} | {$row['name']} | ₱{$row['price']} | {$row['category_id']}\n";
        }
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
} 