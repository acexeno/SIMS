<?php
// Orders API for recording sales transactions and integrating with inventory and notifications

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/../utils/branch_helper.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/auth.php'; // for getBearerToken()

header('Content-Type: application/json');

function getDecodedToken() {
    // Prefer robust extraction from auth.php
    $token = getBearerToken();
    if (!$token && isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    if (!$token) return null;
    try {
        $decoded = verifyJWT($token);
        return $decoded ?: null;
    } catch (Exception $e) {
        return null;
    }
}

function requireAuthOr403() {
    $decoded = getDecodedToken();
    if (!$decoded || !isset($decoded['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
    return $decoded;
}

function fetchComponent($pdo, $componentId) {
    $stmt = $pdo->prepare("SELECT id, name, price, stock_quantity, min_stock_level FROM components WHERE id = ? AND (is_active IS NULL OR is_active = 1)");
    $stmt->execute([$componentId]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function insertInventoryAlertIfNeeded($pdo, $component, $newStock, $note) {
    $minLevel = isset($component['min_stock_level']) ? (int)$component['min_stock_level'] : 5;
    $alertType = null;
    if ($newStock <= 0) {
        $alertType = 'out_of_stock';
    } else if ($newStock <= $minLevel) {
        $alertType = 'low_stock';
    }
    if ($alertType) {
        $stmt = $pdo->prepare("INSERT INTO inventory_alerts (component_id, alert_type, current_stock, threshold_level, notes) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$component['id'], $alertType, $newStock, $minLevel, $note]);
    }
}

function handleCreateOrder($pdo) {
    $decoded = requireAuthOr403();
    $input = json_decode(file_get_contents('php://input'), true);

    $userId = isset($input['user_id']) ? (int)$input['user_id'] : (int)$decoded['user_id'];
    $status = $input['status'] ?? 'Completed';
    $items = $input['items'] ?? [];
    $notes = $input['notes'] ?? null;

    if (!is_array($items) || count($items) === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order items are required']);
        return;
    }

    try {
        $pdo->beginTransaction();

        // Compute total from items (use component price if unit_price not provided)
        $totalAmount = 0.0;
        $normalizedItems = [];
        foreach ($items as $it) {
            $componentId = isset($it['component_id']) ? (int)$it['component_id'] : 0;
            $qty = isset($it['quantity']) ? max(1, (int)$it['quantity']) : 1;
            if ($componentId <= 0) {
                throw new Exception('Invalid component_id in items');
            }
            $component = fetchComponent($pdo, $componentId);
            if (!$component) {
                throw new Exception('Component not found: ID ' . $componentId);
            }
            $unitPrice = isset($it['unit_price']) ? (float)$it['unit_price'] : (float)$component['price'];
            $lineTotal = $unitPrice * $qty;
            $totalAmount += $lineTotal;
            $normalizedItems[] = [
                'component' => $component,
                'component_id' => $componentId,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'total_price' => $lineTotal
            ];
        }

        // Insert into orders
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, order_date, status, total, total_price) VALUES (?, NOW(), ?, ?, ?)");
        $stmt->execute([$userId, $status, $totalAmount, $totalAmount]);
        $orderId = (int)$pdo->lastInsertId();

        // Determine branch context (optional). If branches exist but none specified, default to BULACAN for consistency.
        $resolveBranchId = function() use ($pdo) {
            $branchId = null;
            if (isset($_GET['branch_id']) && is_numeric($_GET['branch_id'])) {
                $branchId = (int)$_GET['branch_id'];
            } elseif (!empty($_GET['branch'])) {
                $branchId = get_branch_id_by_code($pdo, $_GET['branch']);
            }
            if (!$branchId) {
                // Default to BULACAN if exists
                $branchId = get_branch_id_by_code($pdo, 'BULACAN');
            }
            return $branchId ?: null;
        };
        $branchId = $resolveBranchId();

        // Insert items and update stock
        $insItem = $pdo->prepare("INSERT INTO order_items (order_id, component_id, quantity, price) VALUES (?, ?, ?, ?)");
        $updStock = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
        $selBranchStock = $pdo->prepare("SELECT stock_quantity FROM component_branch_stock WHERE component_id = ? AND branch_id = ?");
        $insBranchStock = $pdo->prepare("INSERT INTO component_branch_stock (component_id, branch_id, stock_quantity) VALUES (?, ?, ?)");
        $updBranchStock = $pdo->prepare("UPDATE component_branch_stock SET stock_quantity = ? WHERE component_id = ? AND branch_id = ?");

        foreach ($normalizedItems as $ni) {
            $insItem->execute([$orderId, $ni['component_id'], $ni['quantity'], $ni['unit_price']]);
            // Decrement stock (branch-aware if possible)
            if ($branchId) {
                $selBranchStock->execute([$ni['component_id'], $branchId]);
                $row = $selBranchStock->fetch(PDO::FETCH_NUM);
                if ($row === false) {
                    // Initialize branch row with 0 then decrement
                    $insBranchStock->execute([$ni['component_id'], $branchId, 0]);
                    $currentBranchStock = 0;
                } else {
                    $currentBranchStock = (int)$row[0];
                }
                $newBranchStock = max(0, $currentBranchStock - (int)$ni['quantity']);
                $updBranchStock->execute([$newBranchStock, $ni['component_id'], $branchId]);
                // Recalculate total from branch sums and update components table
                $newTotal = recalc_total_stock($pdo, $ni['component_id']);
                // Create inventory alert on total stock
                insertInventoryAlertIfNeeded($pdo, $ni['component'], $newTotal, 'Auto-generated from order #' . $orderId . ' (branch)');
            } else {
                // Fallback: global decrement (backward compatible)
                $currentStock = (int)$ni['component']['stock_quantity'];
                $newStock = max(0, $currentStock - (int)$ni['quantity']);
                $updStock->execute([$newStock, $ni['component_id']]);
                // Create inventory alert if needed
                insertInventoryAlertIfNeeded($pdo, $ni['component'], $newStock, 'Auto-generated from order #' . $orderId);
            }
        }

        // Generate grouped stock notifications for Admin/Employee
        try { generateStockNotifications($pdo); } catch (Exception $e) { /* ignore */ }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Order created successfully',
            'order_id' => $orderId,
            'total' => $totalAmount
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create order: ' . $e->getMessage()]);
    }
}

function handleGetOrders($pdo) {
    // Auth required but any authenticated role can view their own orders; Admin/Employee can view all
    $decoded = requireAuthOr403();
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    $isStaff = in_array('Admin', $roles) || in_array('Super Admin', $roles) || in_array('Employee', $roles);

    try {
        if ($isStaff) {
            $stmt = $pdo->query("SELECT * FROM orders ORDER BY order_date DESC");
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC");
            $stmt->execute([$decoded['user_id']]);
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode(['success' => true, 'data' => $orders]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch orders']);
    }
}

function handleGetOrder($pdo) {
    $decoded = requireAuthOr403();
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID required']);
        return;
    }

    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    $isStaff = in_array('Admin', $roles) || in_array('Super Admin', $roles) || in_array('Employee', $roles);

    try {
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
        $stmt->execute([$id]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            return;
        }
        if (!$isStaff && (int)$order['user_id'] !== (int)$decoded['user_id']) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden']);
            return;
        }
        $itemsStmt = $pdo->prepare("SELECT oi.*, c.name as component_name FROM order_items oi JOIN components c ON oi.component_id = c.id WHERE oi.order_id = ?");
        $itemsStmt->execute([$id]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        $order['items'] = $items;
        echo json_encode(['success' => true, 'data' => $order]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch order']);
    }
}

function handleUpdateOrderStatus($pdo) {
    $decoded = requireAuthOr403();
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    // Only Employee/Admin/Super Admin can update order status
    if (!(in_array('Admin', $roles) || in_array('Super Admin', $roles) || in_array('Employee', $roles))) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
        return;
    }

    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    $input = json_decode(file_get_contents('php://input'), true);
    $status = $input['status'] ?? null;
    if ($id <= 0 || !$status) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID and status are required']);
        return;
    }

    try {
        $stmt = $pdo->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$status, $id]);
        echo json_encode(['success' => true, 'message' => 'Order status updated']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update status']);
    }
}

// Optional: allow calling this file directly for routing (useful for testing)
if (basename($_SERVER['SCRIPT_NAME']) === 'orders.php') {
    $pdo = get_db_connection();
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET') {
        if (isset($_GET['id'])) {
            handleGetOrder($pdo);
        } else {
            handleGetOrders($pdo);
        }
    } elseif ($method === 'POST') {
        handleCreateOrder($pdo);
    } elseif ($method === 'PUT') {
        handleUpdateOrderStatus($pdo);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    }
}
