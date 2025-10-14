<?php
require_once __DIR__ . '/config/database.php';
header('Content-Type: text/plain');

$pdo = get_db_connection();

echo "Current database: ".$pdo->query('SELECT DATABASE()')->fetchColumn()."\n\n";

try {
    echo "--- component_categories ---\n";
    $cats = $pdo->query('SELECT * FROM component_categories')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cats as $cat) {
        echo "[{$cat['id']}] {$cat['name']}\n";
    }
    echo "\n--- ALL components ---\n";
    $comps = $pdo->query('SELECT id, name, category_id, brand, stock_quantity, price, is_active FROM components')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($comps as $comp) {
        echo "[{$comp['id']}] {$comp['name']} | Category: {$comp['category_id']} | Brand: {$comp['brand']} | Stock: {$comp['stock_quantity']} | Price: ₱{$comp['price']} | Active: {$comp['is_active']}\n";
    }
    $count = count($comps);
    echo "\nTotal components in database: $count\n";
    if ($count === 0) {
        echo "No components found in the database.\n";
    }
} catch (Exception $e) {
    echo "DB ERROR: " . $e->getMessage() . "\n";
} 