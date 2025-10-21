<?php
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();
$rows = $pdo->query('SELECT * FROM components WHERE category_id=1')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($rows, JSON_PRETTY_PRINT);
