<?php
// Simple maintenance tool to delete a component by exact name
// Usage (preview):   /tools/delete_component_by_name.php?name=text%201
// Usage (delete):    /tools/delete_component_by_name.php?name=text%201&confirm=1

require_once __DIR__ . '/../backend/config/cors.php';
require_once __DIR__ . '/../backend/config/database.php';

header('Content-Type: application/json');

$name = isset($_GET['name']) ? trim($_GET['name']) : '';
$confirm = isset($_GET['confirm']) ? (int)$_GET['confirm'] : 0;

if ($name === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required parameter: name'
    ]);
    exit;
}

try {
    $pdo = get_db_connection();

    // Preview matching rows
    $stmt = $pdo->prepare('SELECT id, name, brand, price, category_id FROM components WHERE name = ?');
    $stmt->execute([$name]);
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$confirm) {
        echo json_encode([
            'success' => true,
            'mode' => 'preview',
            'count' => count($matches),
            'matches' => $matches,
            'hint' => 'Add &confirm=1 to delete these rows.'
        ], JSON_NUMERIC_CHECK);
        exit;
    }

    if (count($matches) === 0) {
        echo json_encode([
            'success' => true,
            'deleted' => 0,
            'message' => 'No rows matched the given name.'
        ]);
        exit;
    }

    // Delete action
    $del = $pdo->prepare('DELETE FROM components WHERE name = ?');
    $del->execute([$name]);
    echo json_encode([
        'success' => true,
        'deleted' => $del->rowCount(),
        'name' => $name
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


