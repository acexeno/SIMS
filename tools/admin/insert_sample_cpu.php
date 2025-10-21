<?php
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();

// Check if there are any CPUs
$cpuCount = $pdo->query("SELECT COUNT(*) FROM components WHERE category_id=1 AND is_active=1")->fetchColumn();

if ($cpuCount == 0) {
    // Insert a default CPU with only the columns that exist
    $sql = "INSERT INTO components (name, category_id, brand, model, price, stock_quantity, min_stock_level, image_url, specs, socket, cores, threads, tdp, ram_type, form_factor, memory, speed, capacity, wattage, efficiency, fans, type, is_active)
            VALUES ('Sample CPU', 1, 'SampleBrand', 'ModelX', 5000, 10, 2, '', '{}', 'AM4', 6, 12, 65, 'DDR4', '', '', '', '', '', '', '', 'Processor', 1)";
    $pdo->exec($sql);
    echo "Inserted a sample CPU component for testing.\n";
} else {
    echo "CPU components already exist.\n";
}
