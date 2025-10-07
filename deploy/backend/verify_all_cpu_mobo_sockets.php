<?php
// Script to print all CPUs and motherboards with their id, name, brand, and socket for verification
require_once __DIR__ . '/config/database.php';
$pdo = get_db_connection();

// Get all CPUs and motherboards (by brand or likely category in name)
$stmt = $pdo->query("SELECT id, name, brand, socket FROM components WHERE brand = 'AMD' OR brand = 'Intel' OR name LIKE '%B450%' OR name LIKE '%A520%' OR name LIKE '%B550%' OR name LIKE '%X570%' OR name LIKE '%H510%' OR name LIKE '%B460%' OR name LIKE '%B560%' OR name LIKE '%Z490%' OR name LIKE '%Z590%' OR name LIKE '%H610%' OR name LIKE '%B660%' OR name LIKE '%Z690%' OR name LIKE '%Z790%' ORDER BY brand, name");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

printf("%-5s | %-40s | %-10s | %-10s\n", 'ID', 'Name', 'Brand', 'Socket');
echo str_repeat('-', 75) . "\n";
foreach ($rows as $row) {
    printf("%-5d | %-40s | %-10s | %-10s\n", $row['id'], $row['name'], $row['brand'], $row['socket']);
}
echo "\nDone.\n"; 