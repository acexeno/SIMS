<?php
// This script will import the new CSV with image URLs into your MySQL database, replacing the old data.
// Make sure to backup your database before running in production!

require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();
$csvFile = __DIR__ . '/data/components_database_with_images.csv';

if (!file_exists($csvFile)) {
    die("CSV file not found: $csvFile\n");
}

$handle = fopen($csvFile, 'r');

// Skip comment/invalid header lines
while (($header = fgetcsv($handle)) !== false) {
    if (in_array('Category', $header) && in_array('DETAILS', $header)) {
        break;
    }
}

if (!$header || !in_array('Category', $header) || !in_array('DETAILS', $header)) {
    die("Could not find a valid header row in the CSV.\n");
}



// Category name to ID mapping (from all_components_db.txt)
$categoryMap = [
    'Aio' => 9, 'Cable' => 10, 'Case' => 7, 'Case Gaming' => 11, 'Cooler' => 8, 'CPU' => 1, 'GPU' => 3, 'Motherboard' => 2, 'PSU' => 6, 'RAM' => 4, 'Storage' => 5,
    // Add more as needed
];

$table = 'components';
$pdo->exec("DELETE FROM $table");

$sql = "INSERT INTO $table (`name`, `category_id`, `brand`, `price`, `stock_quantity`, `image_url`) VALUES (?, ?, ?, ?, ?, ?)";
$stmt = $pdo->prepare($sql);

$count = 0;
while (($row = fgetcsv($handle)) !== false) {
    $rowAssoc = array_combine($header, $row);
    $name = $rowAssoc['DETAILS'] ?? null;
    $categoryName = $rowAssoc['Category'] ?? null;
    $brand = $rowAssoc['BRAND'] ?? null;
    $priceRaw = $rowAssoc['VAT-INC (SRP)'] ?? null;
    $stock = $rowAssoc['CURRENT BUL stocks'] ?? null;
    $imageUrl = $rowAssoc['image_url'] ?? null;

    // Map category name to ID (case-insensitive)
    $categoryId = null;
    foreach ($categoryMap as $catName => $catId) {
        if (strcasecmp(trim($categoryName), $catName) === 0) {
            $categoryId = $catId;
            break;
        }
    }
    if (!$categoryId) continue; // skip if category not mapped

    // Clean price (remove currency symbols, commas)
    $price = null;
    if ($priceRaw) {
        $price = preg_replace('/[^0-9.]/', '', $priceRaw);
    }

    // Clean stock (remove parentheses, non-numeric)
    $stockQty = null;
    if ($stock) {
        $stockQty = preg_replace('/[^0-9-]/', '', $stock);
    }

    $stmt->execute([$name, $categoryId, $brand, $price, $stockQty, $imageUrl]);
    $count++;
}
fclose($handle);

echo "Imported $count components with images into $table.\n";
