<?php
require_once __DIR__ . '/../backend/config/cors.php';
require_once __DIR__ . '/../backend/config/database.php';

$pdo = get_db_connection();

$ids_str = $_GET['ids'] ?? '';

if (empty($ids_str)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No component IDs specified']);
    exit;
}

// Sanitize the input IDs to ensure they are all integers
$ids = array_filter(explode(',', $ids_str), 'is_numeric');
$ids = array_map('intval', $ids);

if (empty($ids)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid component IDs specified']);
    exit;
}

// Create placeholders for the IN clause
$placeholders = implode(',', array_fill(0, count($ids), '?'));

try {
    // Fetch components for the given IDs and join with categories
    $stmt = $pdo->prepare("
        SELECT c.*, cat.name as category 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE c.id IN ($placeholders)
    ");
    $stmt->execute($ids);
    $components = $stmt->fetchAll();

    // Decode specs JSON string into an object for each component
    foreach ($components as &$component) {
        if (isset($component['specs']) && is_string($component['specs'])) {
            $component['specs'] = json_decode($component['specs']);
        }
    }

    echo json_encode(['success' => true, 'data' => $components], JSON_NUMERIC_CHECK);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $e->getMessage()]);
}
?> 