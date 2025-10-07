<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();

try {
    $stmt = $pdo->query('SELECT c.id, c.name, c.brand, c.category_id, c.price, c.image_url, c.specs, cat.name as category FROM components c JOIN component_categories cat ON c.category_id = cat.id');
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Decode specs JSON if present
    foreach ($components as &$component) {
        if (isset($component['specs']) && is_string($component['specs'])) {
            $decoded = json_decode($component['specs'], true);
            $component['specs'] = is_array($decoded) ? $decoded : [];
        } else {
            $component['specs'] = [];
        }
    }
    echo json_encode(['success' => true, 'data' => $components], JSON_NUMERIC_CHECK);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $e->getMessage()]);
} 