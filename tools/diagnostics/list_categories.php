<?php
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();
$cats = $pdo->query('SELECT id, name FROM component_categories')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($cats, JSON_PRETTY_PRINT);
