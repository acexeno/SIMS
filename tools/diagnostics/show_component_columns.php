<?php
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();
$cols = $pdo->query('SHOW COLUMNS FROM components')->fetchAll(PDO::FETCH_ASSOC);
foreach ($cols as $col) {
    echo $col['Field'] . "\n";
}
