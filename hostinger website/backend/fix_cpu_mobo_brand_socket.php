<?php
// Run this script ONCE to normalize all CPU and motherboard brand/socket fields in the database
require_once __DIR__ . '/config/database.php';
$pdo = get_db_connection();

function normalize_brand($row) {
    $fields = strtolower(
        ($row['brand'] ?? '') . ' ' .
        ($row['name'] ?? '') . ' ' .
        ($row['model'] ?? '') . ' ' .
        ($row['type'] ?? '')
    );
    if (strpos($fields, 'amd') !== false) return 'AMD';
    if (strpos($fields, 'intel') !== false) return 'Intel';
    return $row['brand'];
}
function normalize_socket($row) {
    $fields = strtolower(
        ($row['socket'] ?? '') . ' ' .
        ($row['type'] ?? '') . ' ' .
        ($row['model'] ?? '') . ' ' .
        ($row['name'] ?? '')
    );
    if (strpos($fields, 'am4') !== false) return 'AM4';
    if (strpos($fields, 'am5') !== false) return 'AM5';
    if (strpos($fields, 'lga1200') !== false) return 'LGA1200';
    if (strpos($fields, 'lga1700') !== false) return 'LGA1700';
    return $row['socket'];
}

// Get all CPUs and motherboards (adjust category IDs as needed)
$categoryStmt = $pdo->query("SELECT id, name FROM component_categories");
$categories = $categoryStmt->fetchAll(PDO::FETCH_KEY_PAIR);
$cpuCatIds = array_keys(array_filter($categories, function($n) { return stripos($n, 'cpu') !== false || stripos($n, 'procie') !== false; }));
$moboCatIds = array_keys(array_filter($categories, function($n) { return stripos($n, 'mobo') !== false || stripos($n, 'motherboard') !== false; }));
$ids = array_merge($cpuCatIds, $moboCatIds);
if (empty($ids)) die("No CPU or motherboard categories found.\n");
$in = implode(',', array_fill(0, count($ids), '?'));
$stmt = $pdo->prepare("SELECT * FROM components WHERE category_id IN ($in)");
$stmt->execute($ids);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updated = 0;
foreach ($rows as $row) {
    $newBrand = normalize_brand($row);
    $newSocket = normalize_socket($row);
    if ($row['brand'] !== $newBrand || $row['socket'] !== $newSocket) {
        $update = $pdo->prepare("UPDATE components SET brand = ?, socket = ? WHERE id = ?");
        $update->execute([$newBrand, $newSocket, $row['id']]);
        $updated++;
        echo "Updated ID {$row['id']}: brand='{$newBrand}', socket='{$newSocket}'\n";
    }
}
echo "Done. Updated $updated components.\n"; 