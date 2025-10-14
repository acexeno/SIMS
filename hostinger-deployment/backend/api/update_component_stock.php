<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/branch_helper.php';
require_once __DIR__ . '/notifications.php';

$pdo = get_db_connection();

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$componentId = $input['component_id'] ?? ($_GET['component_id'] ?? null);
$newStock = $input['stock_quantity'] ?? ($_GET['stock_quantity'] ?? null);
$branchCode = $input['branch'] ?? ($_GET['branch'] ?? null);
$branchIdParam = $input['branch_id'] ?? ($_GET['branch_id'] ?? null);

if (!$componentId || !is_numeric($newStock)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid input']);
    exit;
}

try {
    $componentId = (int)$componentId;
    $newStock = (int)$newStock;

    $branchId = null;
    if ($branchIdParam && is_numeric($branchIdParam)) {
        $branchId = (int)$branchIdParam;
    } elseif (!empty($branchCode)) {
        $branchId = get_branch_id_by_code($pdo, $branchCode);
    }

    if ($branchId) {
        // Update branch-specific stock, then recalc total into components.stock_quantity
        upsert_branch_stock($pdo, $componentId, $branchId, $newStock);
        $total = recalc_total_stock($pdo, $componentId);
        // Generate stock notifications after updating stock (based on total)
        generateStockNotifications($pdo);
        echo json_encode(['success' => true, 'message' => 'Branch stock updated', 'branch_id' => $branchId, 'branch' => ($branchCode ?? null), 'total_stock' => $total]);
    } else {
        // Global update (backward compatible)
        $stmt = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
        $stmt->execute([$newStock, $componentId]);
        // Optionally, if there are branch rows, proportionally adjust? For now, leave as-is; admins should use branch param.
        generateStockNotifications($pdo);
        echo json_encode(['success' => true, 'message' => 'Global stock updated']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}