<?php
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();

// Delete placeholder/sample rows
$deleted = $pdo->exec("DELETE FROM components WHERE name LIKE 'Sample %'");
echo "Deleted $deleted sample components.\n";
