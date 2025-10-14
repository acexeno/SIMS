<?php
// Run this script ONCE to auto-detect and fill socket fields for all CPUs and motherboards in the database
require_once __DIR__ . '/config/database.php';
$pdo = get_db_connection();

function detect_socket($row) {
    $name = strtolower($row['name'] ?? '');
    $brand = strtolower($row['brand'] ?? '');
    // AMD AM4
    if ($brand === 'amd' && (
        strpos($name, '3200g') !== false || strpos($name, '3400g') !== false || strpos($name, '3500') !== false || strpos($name, '3600') !== false || strpos($name, '3700x') !== false || strpos($name, '3800x') !== false || strpos($name, '3900x') !== false || strpos($name, '4650g') !== false || strpos($name, '5600g') !== false || strpos($name, '5600x') !== false || strpos($name, '5700g') !== false || strpos($name, '5700x') !== false || strpos($name, '5800x') !== false || strpos($name, '5950x') !== false || strpos($name, 'b450') !== false || strpos($name, 'b550') !== false || strpos($name, 'a320') !== false || strpos($name, 'a520') !== false || strpos($name, 'x470') !== false || strpos($name, 'x570') !== false
    )) return 'AM4';
    // AMD AM5
    if ($brand === 'amd' && (
        strpos($name, '7600') !== false || strpos($name, '7700') !== false || strpos($name, '7900') !== false || strpos($name, 'b650') !== false || strpos($name, 'x670') !== false
    )) return 'AM5';
    // Intel LGA1200
    if ($brand === 'intel' && (
        strpos($name, 'i3-10') !== false || strpos($name, 'i5-10') !== false || strpos($name, 'i7-10') !== false || strpos($name, 'i9-10') !== false || strpos($name, 'i3-11') !== false || strpos($name, 'i5-11') !== false || strpos($name, 'i7-11') !== false || strpos($name, 'i9-11') !== false || strpos($name, 'h410') !== false || strpos($name, 'h510') !== false || strpos($name, 'b460') !== false || strpos($name, 'b560') !== false || strpos($name, 'z490') !== false || strpos($name, 'z590') !== false
    )) return 'LGA1200';
    // Intel LGA1700
    if ($brand === 'intel' && (
        strpos($name, 'i3-12') !== false || strpos($name, 'i5-12') !== false || strpos($name, 'i7-12') !== false || strpos($name, 'i9-12') !== false || strpos($name, 'i3-13') !== false || strpos($name, 'i5-13') !== false || strpos($name, 'i7-13') !== false || strpos($name, 'i9-13') !== false || strpos($name, 'h610') !== false || strpos($name, 'b660') !== false || strpos($name, 'z690') !== false || strpos($name, 'z790') !== false
    )) return 'LGA1700';
    // Already set
    if (!empty($row['socket'])) return $row['socket'];
    return null;
}

$stmt = $pdo->query("SELECT * FROM components");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
$updated = 0;
foreach ($rows as $row) {
    $newSocket = detect_socket($row);
    if ($newSocket && $row['socket'] !== $newSocket) {
        $update = $pdo->prepare("UPDATE components SET socket = ? WHERE id = ?");
        $update->execute([$newSocket, $row['id']]);
        $updated++;
        echo "Updated ID {$row['id']}: socket='{$newSocket}'\n";
    }
}
echo "Done. Updated $updated components.\n"; 