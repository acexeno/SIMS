<?php
// Orders API for recording sales transactions and integrating with inventory and notifications

require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/../utils/branch_helper.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/stock_notification_trigger.php';
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

/**
 * Restore inventory for all items in an order
 * This function handles both branch-specific and global stock restoration
 */
function restoreOrderInventory($pdo, $orderId, $reason = 'Order cancellation') {
    // Get order items to restore stock
    $stmt = $pdo->prepare("SELECT oi.component_id, oi.quantity, c.stock_quantity FROM order_items oi JOIN components c ON oi.component_id = c.id WHERE oi.order_id = ?");
    $stmt->execute([$orderId]);
    $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($orderItems)) {
        return; // No items to restore
    }
    
    // Determine branch context for stock restoration
    $resolveBranchId = function() use ($pdo) {
        $branchId = null;
        if (isset($_GET['branch_id']) && is_numeric($_GET['branch_id'])) {
            $branchId = (int)$_GET['branch_id'];
        } elseif (!empty($_GET['branch'])) {
            $branchId = get_branch_id_by_code($pdo, $_GET['branch']);
        }
        if (!$branchId) {
            $branchId = get_branch_id_by_code($pdo, 'BULACAN');
        }
        return $branchId ?: null;
    };
    $branchId = $resolveBranchId();
    
    // Prepare queries for stock restoration
    $updStock = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
    $selBranchStock = $pdo->prepare("SELECT stock_quantity FROM component_branch_stock WHERE component_id = ? AND branch_id = ?");
    $insBranchStock = $pdo->prepare("INSERT INTO component_branch_stock (component_id, branch_id, stock_quantity) VALUES (?, ?, ?)");
    $updBranchStock = $pdo->prepare("UPDATE component_branch_stock SET stock_quantity = ? WHERE component_id = ? AND branch_id = ?");
    
    foreach ($orderItems as $item) {
        $quantity = (int)$item['quantity'];
        $componentId = (int)$item['component_id'];
        
        if ($branchId) {
            // Restore branch stock
            $selBranchStock->execute([$componentId, $branchId]);
            $row = $selBranchStock->fetch(PDO::FETCH_NUM);
            if ($row === false) {
                // Initialize branch row with current quantity then add back
                $currentBranchStock = 0;
            } else {
                $currentBranchStock = (int)$row[0];
            }
            $newBranchStock = $currentBranchStock + $quantity;
            if ($row === false) {
                $insBranchStock->execute([$componentId, $branchId, $newBranchStock]);
            } else {
                $updBranchStock->execute([$newBranchStock, $componentId, $branchId]);
            }
            // Recalculate total from branch sums and update components table
            $newTotal = recalc_total_stock($pdo, $componentId);
            // Generate real-time stock notification
            generateComponentStockNotification($pdo, $componentId, (int)$item['stock_quantity'], $newTotal);
        } else {
            // Fallback: global restore
            $currentStock = (int)$item['stock_quantity'];
            $newStock = $currentStock + $quantity;
            $updStock->execute([$newStock, $componentId]);
            // Generate real-time stock notification
            generateComponentStockNotification($pdo, $componentId, $currentStock, $newStock);
        }
    }
}

function handleCreateOrder($pdo) {
    $decoded = requireAuthOr403();
    
    // Check if this is a delete operation
    if (isset($_GET['action']) && $_GET['action'] === 'delete') {
        // Handle delete operation
        if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Order ID required']);
            return;
        }
        
        $orderId = (int)$_GET['id'];
        
        try {
            $pdo->beginTransaction();
            
            // Check if order exists
            $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
            if (!$stmt->fetch()) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Order not found']);
                $pdo->rollBack();
                return;
            }
            
            // Get order items to restore stock
            $stmt = $pdo->prepare("SELECT oi.component_id, oi.quantity, c.stock_quantity FROM order_items oi JOIN components c ON oi.component_id = c.id WHERE oi.order_id = ?");
            $stmt->execute([$orderId]);
            $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Determine branch context for stock restoration
            $resolveBranchId = function() use ($pdo) {
                $branchId = null;
                if (isset($_GET['branch_id']) && is_numeric($_GET['branch_id'])) {
                    $branchId = (int)$_GET['branch_id'];
                } elseif (!empty($_GET['branch'])) {
                    $branchId = get_branch_id_by_code($pdo, $_GET['branch']);
                }
                if (!$branchId) {
                    $branchId = get_branch_id_by_code($pdo, 'BULACAN');
                }
                return $branchId ?: null;
            };
            $branchId = $resolveBranchId();
            
            // Restore stock for each item
            $updStock = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
            $selBranchStock = $pdo->prepare("SELECT stock_quantity FROM component_branch_stock WHERE component_id = ? AND branch_id = ?");
            $insBranchStock = $pdo->prepare("INSERT INTO component_branch_stock (component_id, branch_id, stock_quantity) VALUES (?, ?, ?)");
            $updBranchStock = $pdo->prepare("UPDATE component_branch_stock SET stock_quantity = ? WHERE component_id = ? AND branch_id = ?");
            
            foreach ($orderItems as $item) {
                $quantity = (int)$item['quantity'];
                if ($branchId) {
                    // Restore branch stock
                    $selBranchStock->execute([$item['component_id'], $branchId]);
                    $row = $selBranchStock->fetch(PDO::FETCH_NUM);
                    if ($row === false) {
                        // Initialize branch row with current quantity then add back
                        $currentStock = 0;
                    } else {
                        $currentStock = (int)$row[0];
                    }
                    $newBranchStock = $currentStock + $quantity;
                    if ($row === false) {
                        $insBranchStock->execute([$item['component_id'], $branchId, $newBranchStock]);
                    } else {
                        $updBranchStock->execute([$newBranchStock, $item['component_id'], $branchId]);
                    }
                    // Recalculate total from branch sums and update components table
                    $newTotal = recalc_total_stock($pdo, $item['component_id']);
                    // Generate real-time stock notification
                    generateComponentStockNotification($pdo, $item['component_id'], $item['stock_quantity'], $newTotal);
                } else {
                    // Fallback: global restore
                    $currentStock = (int)$item['stock_quantity'];
                    $newStock = $currentStock + $quantity;
                    $updStock->execute([$newStock, $item['component_id']]);
                    // Generate real-time stock notification
                    generateComponentStockNotification($pdo, $item['component_id'], $currentStock, $newStock);
                }
            }
            
            // Delete order items (due to foreign key constraint)
            $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
            $stmt->execute([$orderId]);
            
            // Delete order
            $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
            
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Order deleted successfully']);
            return;
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to delete order: ' . $e->getMessage()]);
            return;
        }
    }
    
    // Original create order logic
    $input = json_decode(file_get_contents('php://input'), true);

    $userId = isset($input['user_id']) ? (int)$input['user_id'] : (int)$decoded['user_id'];
    // New orders should default to 'pending' status, not 'Completed'
    $status = $input['status'] ?? 'pending';
    $items = $input['items'] ?? [];
    $notes = $input['notes'] ?? null;
    $customerName = $input['customer_name'] ?? null;
    $customerPhone = $input['customer_phone'] ?? null;
    // Set purchase_date to current date if not provided
    $purchaseDate = $input['purchase_date'] ?? date('Y-m-d');

    if (!is_array($items) || count($items) === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order items are required']);
        return;
    }

    try {
        $pdo->beginTransaction();

        // Determine branch context for stock checking (before creating order)
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

        // Prepare queries for stock checking
        $selBranchStock = $pdo->prepare("SELECT stock_quantity FROM component_branch_stock WHERE component_id = ? AND branch_id = ?");
        $getTotalStock = function($componentId) use ($pdo) {
            $stmt = $pdo->prepare("SELECT stock_quantity FROM components WHERE id = ?");
            $stmt->execute([$componentId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? (int)$result['stock_quantity'] : 0;
        };
        $getBranchStock = function($componentId, $branchId) use ($selBranchStock) {
            if (!$branchId) return null;
            $selBranchStock->execute([$componentId, $branchId]);
            $row = $selBranchStock->fetch(PDO::FETCH_NUM);
            return $row !== false ? (int)$row[0] : 0;
        };

        // Compute total from items and validate stock availability
        $totalAmount = 0.0;
        $normalizedItems = [];
        $outOfStockItems = [];
        
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
            
            // Check stock availability BEFORE adding to order
            $availableStock = 0;
            if ($branchId) {
                // Check branch-specific stock
                $availableStock = $getBranchStock($componentId, $branchId);
            } else {
                // Fallback to global stock
                $availableStock = $getTotalStock($componentId);
            }
            
            // Validate stock availability
            if ($availableStock < $qty) {
                $outOfStockItems[] = [
                    'name' => $component['name'],
                    'requested' => $qty,
                    'available' => $availableStock
                ];
            }
            
            $unitPrice = isset($it['unit_price']) ? (float)$it['unit_price'] : (float)$component['price'];
            $lineTotal = $unitPrice * $qty;
            $totalAmount += $lineTotal;
            $normalizedItems[] = [
                'component' => $component,
                'component_id' => $componentId,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'total_price' => $lineTotal,
                'available_stock' => $availableStock
            ];
        }
        
        // If any items are out of stock, reject the order
        if (count($outOfStockItems) > 0) {
            $pdo->rollBack();
            $errorMessages = array_map(function($item) {
                if ($item['available'] === 0) {
                    return $item['name'] . ' is out of stock';
                } else {
                    return $item['name'] . ': requested ' . $item['requested'] . ', but only ' . $item['available'] . ' available';
                }
            }, $outOfStockItems);
            
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Insufficient stock for some components',
                'out_of_stock_items' => $outOfStockItems,
                'details' => $errorMessages
            ]);
            return;
        }

        // Insert into orders
        $stmt = $pdo->prepare("INSERT INTO orders (user_id, order_date, status, total, total_price) VALUES (?, NOW(), ?, ?, ?)");
        $stmt->execute([$userId, $status, $totalAmount, $totalAmount]);
        $orderId = (int)$pdo->lastInsertId();
        
        // Validate order ID was generated correctly
        // If lastInsertId() returns 0, try to fix AUTO_INCREMENT and retry
        if ($orderId <= 0) {
            // Try to fix AUTO_INCREMENT
            try {
                $pdo->exec("ALTER TABLE orders AUTO_INCREMENT = 1");
                // Retry the insert
                $stmt->execute([$userId, $status, $totalAmount, $totalAmount]);
                $orderId = (int)$pdo->lastInsertId();
            } catch (Exception $e) {
                // If fix fails, rollback and return error
                $pdo->rollBack();
                http_response_code(500);
                error_log("Order creation failed - AUTO_INCREMENT issue: " . $e->getMessage());
                echo json_encode([
                    'success' => false,
                    'error' => 'Failed to create order: Database AUTO_INCREMENT is not configured correctly. Please run: ALTER TABLE orders AUTO_INCREMENT = 1; in phpMyAdmin'
                ]);
                return;
            }
            
            // If still 0 after retry, rollback
            if ($orderId <= 0) {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Failed to create order: Invalid order ID generated. Please check database AUTO_INCREMENT settings. Run: ALTER TABLE orders AUTO_INCREMENT = 1;'
                ]);
                return;
            }
        }

        // Insert items and update stock
        // Note: $selBranchStock is already prepared above for stock checking, we'll reuse it
        $insItem = $pdo->prepare("INSERT INTO order_items (order_id, component_id, quantity, price) VALUES (?, ?, ?, ?)");
        $updStock = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
        // Reuse $selBranchStock prepared statement from above (line 200)
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
                // Generate real-time stock notification for this component
                generateComponentStockNotification($pdo, $ni['component_id'], (int)$ni['component']['stock_quantity'], $newTotal);
            } else {
                // Fallback: global decrement (backward compatible)
                $currentStock = (int)$ni['component']['stock_quantity'];
                $newStock = max(0, $currentStock - (int)$ni['quantity']);
                $updStock->execute([$newStock, $ni['component_id']]);
                // Create inventory alert if needed
                insertInventoryAlertIfNeeded($pdo, $ni['component'], $newStock, 'Auto-generated from order #' . $orderId);
                // Generate real-time stock notification for this component
                generateComponentStockNotification($pdo, $ni['component_id'], $currentStock, $newStock);
            }
        }

        // Generate grouped stock notifications for Admin/Employee (backup)
        try { generateStockNotifications($pdo); } catch (Exception $e) { /* ignore */ }

        // Insert financial details - always set purchase_date for new orders
        // Also record optional customer contact details if provided
        if ($purchaseDate || $customerName || $customerPhone) {
            // Build dynamic insert based on provided fields
            $columns = ['order_id'];
            $placeholders = ['?'];
            $values = [$orderId];
            if ($purchaseDate) { $columns[] = 'purchase_date'; $placeholders[] = '?'; $values[] = $purchaseDate; }
            if ($customerName) { $columns[] = 'customer_name'; $placeholders[] = '?'; $values[] = $customerName; }
            if ($customerPhone) { $columns[] = 'customer_phone'; $placeholders[] = '?'; $values[] = $customerPhone; }
            $sql = "INSERT INTO order_financial_details (" . implode(',', $columns) . ") VALUES (" . implode(',', $placeholders) . ")";
            try {
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
            } catch (Exception $e) {
                // If columns don't exist yet, ignore gracefully (frontend can still work without persistence)
            }
        }

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
            $stmt = $pdo->query("
                SELECT 
                    o.*, 
                    MAX(ofd.purchase_date) AS purchase_date,
                    MAX(ofd.customer_name) AS customer_name,
                    MAX(ofd.customer_phone) AS customer_phone,
                    COUNT(oi.id) as item_count,
                    GROUP_CONCAT(CONCAT(oi.quantity, 'x ', c.name) SEPARATOR ', ') as items_summary
                FROM orders o 
                LEFT JOIN order_financial_details ofd ON o.id = ofd.order_id 
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN components c ON oi.component_id = c.id
                GROUP BY o.id
                ORDER BY o.order_date DESC
            ");
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $stmt = $pdo->prepare("
                SELECT 
                    o.*, 
                    MAX(ofd.purchase_date) AS purchase_date,
                    MAX(ofd.customer_name) AS customer_name,
                    MAX(ofd.customer_phone) AS customer_phone,
                    COUNT(oi.id) as item_count,
                    GROUP_CONCAT(CONCAT(oi.quantity, 'x ', c.name) SEPARATOR ', ') as items_summary
                FROM orders o 
                LEFT JOIN order_financial_details ofd ON o.id = ofd.order_id 
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN components c ON oi.component_id = c.id
                WHERE o.user_id = ? 
                GROUP BY o.id
                ORDER BY o.order_date DESC
            ");
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
        
        // Fetch financial details including purchase_date and optional contact info
        $financialStmt = $pdo->prepare("SELECT purchase_date, customer_name, customer_phone FROM order_financial_details WHERE order_id = ?");
        $financialStmt->execute([$id]);
        $financialDetails = $financialStmt->fetch(PDO::FETCH_ASSOC);
        if ($financialDetails) {
            $order['purchase_date'] = $financialDetails['purchase_date'];
            if (isset($financialDetails['customer_name'])) $order['customer_name'] = $financialDetails['customer_name'];
            if (isset($financialDetails['customer_phone'])) $order['customer_phone'] = $financialDetails['customer_phone'];
        }
        
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
    $purchaseDate = $input['purchase_date'] ?? null;
    $items = $input['items'] ?? null;
    $notes = $input['notes'] ?? null;
    $customerName = $input['customer_name'] ?? null;
    $customerPhone = $input['customer_phone'] ?? null;
    
    if ($id <= 0 || !$status) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID and status are required']);
        return;
    }

    try {
        $pdo->beginTransaction();
        
        // If items are provided, update order items and recalculate total
        if ($items !== null && is_array($items) && count($items) > 0) {
            // First, get old order items to restore stock
            $oldItemsStmt = $pdo->prepare("SELECT oi.*, c.stock_quantity FROM order_items oi JOIN components c ON oi.component_id = c.id WHERE oi.order_id = ?");
            $oldItemsStmt->execute([$id]);
            $oldItems = $oldItemsStmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Restore stock from old items
            foreach ($oldItems as $oldItem) {
                $oldQuantity = (int)$oldItem['quantity'];
                $oldStock = (int)$oldItem['stock_quantity'];
                $newStock = $oldStock + $oldQuantity;
                
                $updStock = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
                $updStock->execute([$newStock, $oldItem['component_id']]);
            }
            
            // Delete old order items (but keep the transaction for now - we'll validate stock first)
            // Note: We restore stock first, then validate new items have sufficient stock
            
            // Compute total from new items and validate stock availability
            $totalAmount = 0.0;
            $normalizedItems = [];
            $outOfStockItems = [];
            
            // Get current stock after restoration (stock was already restored above)
            $getCurrentStock = function($componentId) use ($pdo) {
                $stmt = $pdo->prepare("SELECT stock_quantity FROM components WHERE id = ?");
                $stmt->execute([$componentId]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                return $result ? (int)$result['stock_quantity'] : 0;
            };
            
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
                
                // Check stock availability AFTER restoration
                $availableStock = $getCurrentStock($componentId);
                
                // Validate stock availability
                if ($availableStock < $qty) {
                    $outOfStockItems[] = [
                        'name' => $component['name'],
                        'requested' => $qty,
                        'available' => $availableStock
                    ];
                }
                
                $unitPrice = isset($it['unit_price']) ? (float)$it['unit_price'] : (float)$component['price'];
                $lineTotal = $unitPrice * $qty;
                $totalAmount += $lineTotal;
                $normalizedItems[] = [
                    'component' => $component,
                    'component_id' => $componentId,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'total_price' => $lineTotal,
                    'available_stock' => $availableStock
                ];
            }
            
            // If any items are out of stock, reject the update
            if (count($outOfStockItems) > 0) {
                $pdo->rollBack();
                $errorMessages = array_map(function($item) {
                    if ($item['available'] === 0) {
                        return $item['name'] . ' is out of stock';
                    } else {
                        return $item['name'] . ': requested ' . $item['requested'] . ', but only ' . $item['available'] . ' available';
                    }
                }, $outOfStockItems);
                
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'Insufficient stock for some components',
                    'out_of_stock_items' => $outOfStockItems,
                    'details' => $errorMessages
                ]);
                return;
            }
            
            // Delete old order items (now safe to do so)
            $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
            $stmt->execute([$id]);
            
            // Insert new order items and update stock
            $insItem = $pdo->prepare("INSERT INTO order_items (order_id, component_id, quantity, price) VALUES (?, ?, ?, ?)");
            $updStock = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
            
            foreach ($normalizedItems as $ni) {
                $insItem->execute([$id, $ni['component_id'], $ni['quantity'], $ni['unit_price']]);
                // Decrement stock
                $currentStock = (int)$ni['component']['stock_quantity'];
                $newStock = max(0, $currentStock - (int)$ni['quantity']);
                $updStock->execute([$newStock, $ni['component_id']]);
                // Create inventory alert if needed
                insertInventoryAlertIfNeeded($pdo, $ni['component'], $newStock, 'Auto-generated from order update #' . $id);
                // Generate real-time stock notification
                generateComponentStockNotification($pdo, $ni['component_id'], $currentStock, $newStock);
            }
            
            // Update order total
            $stmt = $pdo->prepare("UPDATE orders SET total = ?, total_price = ? WHERE id = ?");
            $stmt->execute([$totalAmount, $totalAmount, $id]);
        }
        
        // Get current order status before update
        $getCurrentStatusStmt = $pdo->prepare("SELECT status FROM orders WHERE id = ?");
        $getCurrentStatusStmt->execute([$id]);
        $currentOrder = $getCurrentStatusStmt->fetch(PDO::FETCH_ASSOC);
        $currentStatus = $currentOrder ? strtolower($currentOrder['status']) : '';
        $newStatusLower = strtolower($status);
        
        // If status is changing to "Cancelled" or "cancelled", restore inventory
        // Only restore if it wasn't already cancelled (to avoid double restoration)
        if (($newStatusLower === 'cancelled' || $newStatusLower === 'canceled') && 
            $currentStatus !== 'cancelled' && $currentStatus !== 'canceled' && 
            $currentStatus !== 'completed' && $currentStatus !== 'delivered') {
            restoreOrderInventory($pdo, $id, 'Order status changed to Cancelled');
        }
        
        // Update order status (notes column may or may not exist)
        $stmt = $pdo->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$status, $id]);
        
        // Update or insert financial details if provided
        if ($purchaseDate || $customerName !== null || $customerPhone !== null) {
            $checkStmt = $pdo->prepare("SELECT id FROM order_financial_details WHERE order_id = ?");
            $checkStmt->execute([$id]);
            $existing = $checkStmt->fetch();
            
            if ($existing) {
                // Update existing financial details - build set clause dynamically
                $sets = [];
                $vals = [];
                if ($purchaseDate) { $sets[] = "purchase_date = ?"; $vals[] = $purchaseDate; }
                if ($customerName !== null) { $sets[] = "customer_name = ?"; $vals[] = $customerName; }
                if ($customerPhone !== null) { $sets[] = "customer_phone = ?"; $vals[] = $customerPhone; }
                if (count($sets) > 0) {
                    $sql = "UPDATE order_financial_details SET " . implode(',', $sets) . ", updated_at = NOW() WHERE order_id = ?";
                    $vals[] = $id;
                    try {
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($vals);
                    } catch (Exception $e) {
                        // Ignore if columns not present
                    }
                }
            } else {
                // Insert new financial details
                $columns = ['order_id'];
                $placeholders = ['?'];
                $values = [$id];
                if ($purchaseDate) { $columns[] = 'purchase_date'; $placeholders[] = '?'; $values[] = $purchaseDate; }
                if ($customerName !== null) { $columns[] = 'customer_name'; $placeholders[] = '?'; $values[] = $customerName; }
                if ($customerPhone !== null) { $columns[] = 'customer_phone'; $placeholders[] = '?'; $values[] = $customerPhone; }
                $sql = "INSERT INTO order_financial_details (" . implode(',', $columns) . ") VALUES (" . implode(',', $placeholders) . ")";
                try {
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($values);
                } catch (Exception $e) {
                    // Ignore if columns not present
                }
            }
        }
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Order updated successfully']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update order: ' . $e->getMessage()]);
    }
}

// Optional: allow calling this file directly for routing (useful for testing)
function handleCancelOrder($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID required']);
        return;
    }
    
    $orderId = (int)$_GET['id'];
    
    try {
        $pdo->beginTransaction();
        
        // Check if order exists and belongs to the user
        $stmt = $pdo->prepare("SELECT id, user_id, status FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            $pdo->rollBack();
            return;
        }
        
        // Verify order belongs to user
        if ((int)$order['user_id'] !== $userId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You can only cancel your own orders']);
            $pdo->rollBack();
            return;
        }
        
        $currentStatus = strtolower($order['status']);
        
        // Only allow cancellation for pending or processing orders
        $cancellableStatuses = ['pending', 'processing'];
        if (!in_array($currentStatus, $cancellableStatuses)) {
            http_response_code(400);
            echo json_encode([
                'success' => false, 
                'error' => 'Order cannot be cancelled. Only pending or processing orders can be cancelled.',
                'current_status' => $order['status']
            ]);
            $pdo->rollBack();
            return;
        }
        
        // Restore inventory before updating status
        restoreOrderInventory($pdo, $orderId, 'Order cancelled by customer');
        
        // Update order status to Cancelled
        $stmt = $pdo->prepare("UPDATE orders SET status = 'Cancelled', updated_at = NOW() WHERE id = ?");
        $stmt->execute([$orderId]);
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Order cancelled successfully. Inventory has been restored.']);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to cancel order: ' . $e->getMessage()]);
    }
}

function handleDeleteOrder($pdo) {
    $decoded = requireAuthOr403();
    $userId = (int)$decoded['user_id'];
    
    // Check if user has Admin or Super Admin permissions
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    $isAdmin = in_array('Admin', $roles) || in_array('Super Admin', $roles);
    
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID required']);
        return;
    }
    
    $orderId = (int)$_GET['id'];
    
    try {
        $pdo->beginTransaction();
        
        // Check if order exists and get customer information
        $stmt = $pdo->prepare("SELECT id, user_id, status, total FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Order not found']);
            $pdo->rollBack();
            return;
        }
        
        $orderUserId = (int)$order['user_id'];
        
        // If not admin, verify the order belongs to the user
        if (!$isAdmin && $orderUserId !== $userId) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'You can only delete your own orders']);
            $pdo->rollBack();
            return;
        }
        
        $orderTotal = number_format((float)$order['total'], 2);
        
        // Restore inventory before deletion (unless already cancelled/completed)
        $currentStatus = strtolower($order['status']);
        if ($currentStatus !== 'cancelled' && $currentStatus !== 'canceled') {
            $deleteReason = $isAdmin ? 'Order deleted by admin' : 'Order deleted by customer';
            restoreOrderInventory($pdo, $orderId, $deleteReason);
        }
        
        // Send notification to customer before deleting the order (only if admin deleted it)
        if ($isAdmin && $orderUserId !== $userId) {
            try {
                $notificationTitle = 'Order #' . $orderId . ' Deleted';
                $notificationMessage = 'Your order #' . $orderId . ' (Total: P' . $orderTotal . ') has been deleted by an administrator. If you have any questions, please contact support.';
                
                // Log notification creation attempt
                error_log("Creating notification for deleted order #{$orderId} - User ID: {$orderUserId}");
                
                $stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, created_at) VALUES (?, 'order', ?, ?, 'high', NOW())");
                $stmt->execute([$orderUserId, $notificationTitle, $notificationMessage]);
                
                $notificationId = $pdo->lastInsertId();
                error_log("Notification created successfully for order #{$orderId} - Notification ID: {$notificationId}");
            } catch (Exception $e) {
                // Log error but don't fail the deletion if notification fails
                error_log('Failed to create notification for deleted order #' . $orderId . ': ' . $e->getMessage());
                error_log('Exception trace: ' . $e->getTraceAsString());
            }
        }
        
        // Delete order items first (due to foreign key constraint)
        $stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
        $stmt->execute([$orderId]);
        
        // Delete order financial details if exists
        $stmt = $pdo->prepare("DELETE FROM order_financial_details WHERE order_id = ?");
        $stmt->execute([$orderId]);
        
        // Delete order
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        
        $pdo->commit();
        $message = $isAdmin && $orderUserId !== $userId 
            ? 'Order deleted successfully. Inventory has been restored. Customer has been notified.'
            : 'Order deleted successfully. Inventory has been restored.';
        echo json_encode(['success' => true, 'message' => $message]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to delete order: ' . $e->getMessage()]);
    }
}

if (basename($_SERVER['SCRIPT_NAME']) === 'orders.php') {
    $pdo = get_db_connection();
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Check for cancellation action
    if (isset($_GET['action']) && $_GET['action'] === 'cancel') {
        handleCancelOrder($pdo);
    } elseif ($method === 'GET') {
        if (isset($_GET['id'])) {
            handleGetOrder($pdo);
        } else {
            handleGetOrders($pdo);
        }
    } elseif ($method === 'POST') {
        handleCreateOrder($pdo);
    } elseif ($method === 'PUT') {
        handleUpdateOrderStatus($pdo);
    } elseif ($method === 'DELETE') {
        handleDeleteOrder($pdo);
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    }
}
