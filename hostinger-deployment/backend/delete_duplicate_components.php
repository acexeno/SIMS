<?php
// Script to delete duplicate components (same name and brand), keeping only the one with the lowest id
require_once __DIR__ . '/config/database.php';
$pdo = get_db_connection();

// Find duplicates by name and brand
$sql = "SELECT name, brand, MIN(id) as keep_id, COUNT(*) as cnt
        FROM components
        GROUP BY name, brand
        HAVING cnt > 1";
$dupes = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
$totalDeleted = 0;
foreach ($dupes as $dupe) {
    $name = $dupe['name'];
    $brand = $dupe['brand'];
    $keep_id = $dupe['keep_id'];
    // Delete all except the one with the lowest id
    $del = $pdo->prepare("DELETE FROM components WHERE name = ? AND brand = ? AND id != ?");
    $del->execute([$name, $brand, $keep_id]);
    $deleted = $del->rowCount();
    if ($deleted > 0) {
        echo "Deleted $deleted duplicates for '$name' ($brand), kept id $keep_id\n";
        $totalDeleted += $deleted;
    }
}
echo "\nDone. Deleted $totalDeleted duplicate components.\n"; 