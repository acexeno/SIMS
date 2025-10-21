<?php
require_once __DIR__ . '/../backend/config/cors.php';
require_once __DIR__ . '/../backend/config/database.php';

$pdo = get_db_connection();

try {
    $stmt = $pdo->query('SELECT id, name FROM component_categories ORDER BY name ASC');
    $categories = $stmt->fetchAll();
    echo json_encode(['success' => true, 'data' => $categories], JSON_NUMERIC_CHECK);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $e->getMessage()]);
} 