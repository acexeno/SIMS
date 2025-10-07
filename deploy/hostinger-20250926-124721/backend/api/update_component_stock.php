<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/notifications.php';

$pdo = get_db_connection();

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$componentId = $input['component_id'] ?? null;
$newStock = $input['stock_quantity'] ?? null;

if (!$componentId || !is_numeric($newStock)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

try {
    $stmt = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
    $stmt->execute([$newStock, $componentId]);

    // Generate stock notifications after updating stock
    generateStockNotifications($pdo);

    echo json_encode(['success' => true, 'message' => 'Stock updated']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
} 