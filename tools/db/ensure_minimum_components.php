<?php
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();

function insertIfMissing($pdo, $categoryName, $fields) {
    // Get category id
    $stmt = $pdo->prepare('SELECT id FROM component_categories WHERE UPPER(name)=UPPER(?)');
    $stmt->execute([$categoryName]);
    $cat = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$cat) { echo "Category $categoryName not found.\n"; return; }
    $catId = (int)$cat['id'];

    // Check if any exist
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM components WHERE category_id = ? AND is_active=1');
    $stmt->execute([$catId]);
    $count = (int)$stmt->fetchColumn();
    if ($count > 0) { echo "Category $categoryName already has $count item(s).\n"; return; }

    // Build insert using known columns
    $columns = ['name','category_id','brand','model','price','stock_quantity','min_stock_level','image_url','specs','socket','cores','threads','tdp','ram_type','form_factor','memory','speed','capacity','wattage','efficiency','fans','type','is_active'];
    $placeholders = implode(',', array_fill(0, count($columns), '?'));
    $sql = 'INSERT INTO components ('.implode(',', $columns).') VALUES ('.$placeholders.')';
    $stmt = $pdo->prepare($sql);

    $base = array_merge([
        'name' => 'Sample '.$categoryName,
        'category_id' => $catId,
        'brand' => 'SampleBrand',
        'model' => 'ModelX',
        'price' => 1000,
        'stock_quantity' => 10,
        'min_stock_level' => 2,
        'image_url' => '',
        'specs' => '{}',
        'socket' => null,
        'cores' => null,
        'threads' => null,
        'tdp' => null,
        'ram_type' => null,
        'form_factor' => null,
        'memory' => null,
        'speed' => null,
        'capacity' => null,
        'wattage' => null,
        'efficiency' => null,
        'fans' => null,
        'type' => $categoryName,
        'is_active' => 1
    ], $fields);

    $values = [];
    foreach ($columns as $c) { $values[] = $base[$c] ?? null; }
    $stmt->execute($values);
    echo "Inserted sample for $categoryName.\n";
}

insertIfMissing($pdo, 'CPU', ['socket' => 'AM4', 'cores' => 6, 'threads' => 12, 'tdp' => 65, 'ram_type' => 'DDR4', 'type' => 'Processor', 'price' => 5000]);
insertIfMissing($pdo, 'Motherboard', ['socket' => 'AM4', 'ram_type' => 'DDR4', 'form_factor' => 'ATX', 'type' => 'Motherboard', 'price' => 3500]);
insertIfMissing($pdo, 'RAM', ['memory' => '16GB', 'speed' => '3200MHz', 'ram_type' => 'DDR4', 'type' => 'RAM', 'price' => 2000]);
insertIfMissing($pdo, 'Storage', ['capacity' => '512GB', 'type' => 'SSD', 'price' => 2500]);
insertIfMissing($pdo, 'PSU', ['wattage' => 550, 'efficiency' => '80+ Bronze', 'type' => 'ATX PSU', 'price' => 2200]);
insertIfMissing($pdo, 'Case', ['form_factor' => 'ATX', 'fans' => 2, 'type' => 'ATX Mid Tower', 'price' => 1800]);
insertIfMissing($pdo, 'Cooler', ['type' => 'Air Cooler', 'tdp' => 95, 'price' => 1200]);
