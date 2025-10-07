<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';
require_once '../config/cors.php';
require_once '../utils/jwt_helper.php';
require_once '../utils/notification_helper.php';

// Verify JWT token
function verifyToken() {
    $token = null;
    
    // Use the same approach as other API files
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    
    if ($authHeader && preg_match('/Bearer\s+(\S+)/', $authHeader, $matches)) {
        $token = $matches[1];
    }
    
    // Fallback: X-Auth-Token custom header
    if (!$token) {
        $xAuthToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? null;
        if ($xAuthToken) {
            $token = $xAuthToken;
        }
    }
    
    // Fallback: token in JSON POST body
    if (!$token) {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['token'])) {
            $token = $input['token'];
        }
    }
    
    // Fallback: token in query string
    if (!$token && isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        exit();
    }
    
    try {
        $decoded = verifyJWT($token);
        if (!$decoded) {
            throw new Exception('Invalid token');
        }
        return (object) $decoded;
    } catch (Exception $e) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token: ' . $e->getMessage()]);
        exit();
    }
}

// Get user from token
function getUserFromToken($token) {
    $decoded = verifyJWT($token);
    if (!$decoded) {
        throw new Exception('Invalid token');
    }
    return (object) $decoded;
}

// Check if user has admin privileges
function checkAdminAccess($user) {
    // Handle both string and array roles
    $roles = [];
    if (is_string($user->roles)) {
        $roles = explode(',', $user->roles);
    } elseif (is_array($user->roles)) {
        $roles = $user->roles;
    } else {
        $roles = [$user->roles];
    }
    
    // Clean up roles (remove whitespace)
    $roles = array_map('trim', $roles);
    
    return in_array('Admin', $roles) || in_array('Super Admin', $roles);
}

$method = $_SERVER['REQUEST_METHOD'];
$endpoint = $_GET['endpoint'] ?? '';

try {
    $pdo = get_db_connection();
    $user = verifyToken();
    
    if (!checkAdminAccess($user)) {
        http_response_code(403);
        echo json_encode(['error' => 'Insufficient privileges']);
        exit();
    }
    
    switch ($endpoint) {
        case 'suppliers':
            if ($method === 'GET') {
                // Get all suppliers
                $stmt = $pdo->prepare("SELECT * FROM suppliers ORDER BY name");
                $stmt->execute();
                $suppliers = $stmt->fetchAll();
                echo json_encode(['success' => true, 'suppliers' => $suppliers]);
            } elseif ($method === 'POST') {
                // Create new supplier
                $data = json_decode(file_get_contents('php://input'), true);
                
                $stmt = $pdo->prepare("
                    INSERT INTO suppliers (name, contact_person, email, phone, address, 
                    communication_method, communication_handle, payment_terms, lead_time_days, 
                    minimum_order_amount, notes) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $stmt->execute([
                    $data['name'],
                    $data['contact_person'] ?? null,
                    $data['email'] ?? null,
                    $data['phone'] ?? null,
                    $data['address'] ?? null,
                    $data['communication_method'] ?? 'email',
                    $data['communication_handle'] ?? null,
                    $data['payment_terms'] ?? null,
                    $data['lead_time_days'] ?? 7,
                    $data['minimum_order_amount'] ?? 0.00,
                    $data['notes'] ?? null
                ]);
                
                $supplierId = $pdo->lastInsertId();
                echo json_encode(['success' => true, 'supplier_id' => $supplierId]);
            }
            break;
            
        case 'supplier':
            if ($method === 'GET') {
                // Get specific supplier
                $id = $_GET['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Supplier ID required']);
                    exit();
                }
                
                $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
                $stmt->execute([$id]);
                $supplier = $stmt->fetch();
                
                if (!$supplier) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Supplier not found']);
                    exit();
                }
                
                echo json_encode(['success' => true, 'supplier' => $supplier]);
            } elseif ($method === 'PUT') {
                // Update supplier
                $id = $_GET['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Supplier ID required']);
                    exit();
                }
                
                $data = json_decode(file_get_contents('php://input'), true);
                
                $stmt = $pdo->prepare("
                    UPDATE suppliers SET 
                    name = ?, contact_person = ?, email = ?, phone = ?, address = ?,
                    communication_method = ?, communication_handle = ?, payment_terms = ?,
                    lead_time_days = ?, minimum_order_amount = ?, notes = ?, is_active = ?
                    WHERE id = ?
                ");
                
                $stmt->execute([
                    $data['name'],
                    $data['contact_person'] ?? null,
                    $data['email'] ?? null,
                    $data['phone'] ?? null,
                    $data['address'] ?? null,
                    $data['communication_method'] ?? 'email',
                    $data['communication_handle'] ?? null,
                    $data['payment_terms'] ?? null,
                    $data['lead_time_days'] ?? 7,
                    $data['minimum_order_amount'] ?? 0.00,
                    $data['notes'] ?? null,
                    $data['is_active'] ?? 1,
                    $id
                ]);
                
                echo json_encode(['success' => true]);
            } elseif ($method === 'DELETE') {
                // Delete supplier
                $id = $_GET['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Supplier ID required']);
                    exit();
                }
                
                // Check if supplier has orders
                $stmt = $pdo->prepare("SELECT COUNT(*) FROM supplier_orders WHERE supplier_id = ?");
                $stmt->execute([$id]);
                $orderCount = $stmt->fetchColumn();
                
                if ($orderCount > 0) {
                    // Soft delete - just mark as inactive
                    $stmt = $pdo->prepare("UPDATE suppliers SET is_active = 0 WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Supplier marked as inactive (has existing orders)']);
                } else {
                    // Hard delete
                    $stmt = $pdo->prepare("DELETE FROM suppliers WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true]);
                }
            }
            break;
            
        case 'notify-supplier':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $supplierId = $data['supplier_id'] ?? null;
                $subject = $data['subject'] ?? 'Notification from BuildIT';
                $message = $data['message'] ?? '';
                $notificationType = $data['type'] ?? 'general';
                
                if (!$supplierId || !$message) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Supplier ID and message are required']);
                    exit();
                }
                
                // Get supplier details
                $stmt = $pdo->prepare("SELECT * FROM suppliers WHERE id = ?");
                $stmt->execute([$supplierId]);
                $supplier = $stmt->fetch();
                
                if (!$supplier) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Supplier not found']);
                    exit();
                }
                
                // Log the notification
                $stmt = $pdo->prepare("
                    INSERT INTO supplier_communications 
                    (supplier_id, communication_type, subject, message, direction, status, created_by)
                    VALUES (?, ?, ?, ?, 'outgoing', 'sent', ?)
                ");
                
                $stmt->execute([
                    $supplierId,
                    'email', // Default to email, can be extended based on supplier preference
                    $subject,
                    $message,
                    $user->id
                ]);
                
                $notificationId = $pdo->lastInsertId();
                
                // Send the actual notification (in a real app, this would send an email/API call)
                $notificationSent = sendSupplierNotification([
                    'to' => $supplier['email'],
                    'subject' => $subject,
                    'message' => $message,
                    'supplier_id' => $supplierId,
                    'notification_id' => $notificationId
                ]);
                
                if ($notificationSent) {
                    // Update the notification status
                    $stmt = $pdo->prepare("
                        UPDATE supplier_communications 
                        SET status = 'delivered', sent_at = NOW() 
                        WHERE id = ?
                    ");
                    $stmt->execute([$notificationId]);
                    
                    echo json_encode([
                        'success' => true, 
                        'message' => 'Notification sent successfully',
                        'notification_id' => $notificationId
                    ]);
                } else {
                    // Update the notification status to failed
                    $stmt = $pdo->prepare("
                        UPDATE supplier_communications 
                        SET status = 'failed', notes = 'Failed to send notification' 
                        WHERE id = ?
                    ");
                    $stmt->execute([$notificationId]);
                    
                    http_response_code(500);
                    echo json_encode(['error' => 'Failed to send notification']);
                }
            }
            break;
            
        case 'supplier-notifications':
            if ($method === 'GET') {
                $supplierId = $_GET['supplier_id'] ?? null;
                $limit = min(50, (int)($_GET['limit'] ?? 10));
                $offset = max(0, (int)($_GET['offset'] ?? 0));
                
                $params = [];
                $whereClause = "";
                
                if ($supplierId) {
                    $whereClause = "WHERE supplier_id = ?";
                    $params[] = $supplierId;
                }
                
                // Get notifications
                $stmt = $pdo->prepare("
                    SELECT sc.*, u.first_name, u.last_name 
                    FROM supplier_communications sc
                    LEFT JOIN users u ON sc.created_by = u.id
                    $whereClause
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                ");
                
                $stmt->execute(array_merge($params, [$limit, $offset]));
                $notifications = $stmt->fetchAll();
                
                // Get total count for pagination
                $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM supplier_communications $whereClause");
                $countStmt->execute($params);
                $total = $countStmt->fetch()['total'];
                
                echo json_encode([
                    'success' => true,
                    'notifications' => $notifications,
                    'total' => $total,
                    'limit' => $limit,
                    'offset' => $offset
                ]);
            }
            break;
            
        case 'supplier-orders':
            if ($method === 'GET') {
                // Get all supplier orders
                $stmt = $pdo->prepare("
                    SELECT so.*, s.name as supplier_name, s.contact_person, u.first_name, u.last_name
                    FROM supplier_orders so
                    JOIN suppliers s ON so.supplier_id = s.id
                    JOIN users u ON so.created_by = u.id
                    ORDER BY so.order_date DESC
                ");
                $stmt->execute();
                $orders = $stmt->fetchAll();
                
                // Get order items for each order
                foreach ($orders as &$order) {
                    $stmt = $pdo->prepare("
                        SELECT soi.*, c.name as component_name, c.category_id
                        FROM supplier_order_items soi
                        JOIN components c ON soi.component_id = c.id
                        WHERE soi.supplier_order_id = ?
                    ");
                    $stmt->execute([$order['id']]);
                    $order['items'] = $stmt->fetchAll();
                }
                
                echo json_encode(['success' => true, 'orders' => $orders]);
            } elseif ($method === 'POST') {
                // Create new supplier order
                $data = json_decode(file_get_contents('php://input'), true);
                
                $pdo->beginTransaction();
                try {
                    // Create the order
                    $stmt = $pdo->prepare("
                        INSERT INTO supplier_orders (supplier_id, order_number, expected_delivery_date, 
                        notes, total_amount, created_by) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    
                    $orderNumber = 'SO-' . date('Y') . '-' . str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
                    $totalAmount = 0;
            
            // Calculate total from items
            if (isset($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $item) {
                    $totalAmount += $item['quantity_ordered'] * $item['unit_price'];
                }
            }
            
            $stmt->execute([
                $data['supplier_id'],
                $orderNumber,
                $data['expected_delivery_date'] ?? null,
                $data['notes'] ?? null,
                $totalAmount,
                $user->user_id
            ]);
            
            $orderId = $pdo->lastInsertId();
            
            // Add order items
            if (isset($data['items']) && is_array($data['items'])) {
                $stmt = $pdo->prepare("
                    INSERT INTO supplier_order_items (supplier_order_id, component_id, 
                    quantity_ordered, unit_price, total_price, notes) 
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                
                foreach ($data['items'] as $item) {
                    $itemTotal = $item['quantity_ordered'] * $item['unit_price'];
                    $stmt->execute([
                        $orderId,
                        $item['component_id'],
                        $item['quantity_ordered'],
                        $item['unit_price'],
                        $itemTotal,
                        $item['notes'] ?? null
                    ]);
                }
            }
            
            $pdo->commit();
            echo json_encode(['success' => true, 'order_id' => $orderId, 'order_number' => $orderNumber]);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
    break;
    
    case 'supplier-order':
        if ($method === 'GET') {
            // Get specific supplier order
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'Order ID required']);
                exit();
            }
            
            $stmt = $pdo->prepare("
                SELECT so.*, s.name as supplier_name, s.contact_person, u.first_name, u.last_name
                FROM supplier_orders so
                JOIN suppliers s ON so.supplier_id = s.id
                JOIN users u ON so.created_by = u.id
                WHERE so.id = ?
            ");
            $stmt->execute([$id]);
            $order = $stmt->fetch();
            
            if (!$order) {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
                exit();
            }
            
            // Get order items
            $stmt = $pdo->prepare("
                SELECT soi.*, c.name as component_name, c.category_id
                FROM supplier_order_items soi
                        JOIN components c ON soi.component_id = c.id
                        WHERE soi.supplier_order_id = ?
                    ");
                    $stmt->execute([$id]);
                    $order['items'] = $stmt->fetchAll();
                    
                    echo json_encode(['success' => true, 'order' => $order]);
                } elseif ($method === 'PUT') {
                    // Update supplier order
                    $id = $_GET['id'] ?? null;
                    if (!$id) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Order ID required']);
                        exit();
                    }
                    
                    $data = json_decode(file_get_contents('php://input'), true);
                    
                    $pdo->beginTransaction();
                    try {
                        // Update the order
                        $stmt = $pdo->prepare("
                            UPDATE supplier_orders SET 
                            expected_delivery_date = ?, notes = ?, status = ?, updated_by = ?
                            WHERE id = ?
                        ");
                        
                        $stmt->execute([
                            $data['expected_delivery_date'] ?? null,
                            $data['notes'] ?? null,
                            $data['status'] ?? 'draft',
                            $user->user_id,
                            $id
                        ]);
                        
                        // Update order items if provided
                        if (isset($data['items']) && is_array($data['items'])) {
                            // Delete existing items
                            $stmt = $pdo->prepare("DELETE FROM supplier_order_items WHERE supplier_order_id = ?");
                            $stmt->execute([$id]);
            
            // Add new items
            $stmt = $pdo->prepare("
                INSERT INTO supplier_order_items (supplier_order_id, component_id, 
                quantity_ordered, unit_price, total_price, notes) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            
            $totalAmount = 0;
            foreach ($data['items'] as $item) {
                $itemTotal = $item['quantity_ordered'] * $item['unit_price'];
                $totalAmount += $itemTotal;
                $stmt->execute([
                    $id,
                    $item['component_id'],
                    $item['quantity_ordered'],
                    $item['unit_price'],
                    $itemTotal,
                    $item['notes'] ?? null
                ]);
            }
            
            // Update total amount
            $stmt = $pdo->prepare("UPDATE supplier_orders SET total_amount = ? WHERE id = ?");
            $stmt->execute([$totalAmount, $id]);
        }
        
        $pdo->commit();
        echo json_encode(['success' => true]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
break;

case 'inventory-alerts':
    if ($method === 'GET') {
        // Get inventory alerts
        $resolved = $_GET['resolved'] ?? null;
        
        if ($resolved !== null) {
            $stmt = $pdo->prepare("
                SELECT ia.*, c.name as component_name, c.category_id, c.stock_quantity,
                u.first_name, u.last_name
                FROM inventory_alerts ia
                JOIN components c ON ia.component_id = c.id
                LEFT JOIN users u ON ia.resolved_by = u.id
                WHERE ia.is_resolved = ?
                ORDER BY ia.created_at DESC
            ");
            $stmt->execute([$resolved ? 1 : 0]);
        } else {
            $stmt = $pdo->prepare("
                SELECT ia.*, c.name as component_name, c.category_id, c.stock_quantity,
                u.first_name, u.last_name
                FROM inventory_alerts ia
                JOIN components c ON ia.component_id = c.id
                LEFT JOIN users u ON ia.resolved_by = u.id
                ORDER BY ia.is_resolved ASC, ia.created_at DESC
            ");
            $stmt->execute();
        }
        
        $alerts = $stmt->fetchAll();
        echo json_encode(['success' => true, 'alerts' => $alerts]);
    } elseif ($method === 'POST') {
        // Create inventory alert
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $pdo->prepare("
            INSERT INTO inventory_alerts (component_id, alert_type, current_stock, 
            threshold_level, notes) 
            VALUES (?, ?, ?, ?, ?)
        ");
        
        $stmt->execute([
            $data['component_id'],
            $data['alert_type'],
            $data['current_stock'],
            $data['threshold_level'],
            $data['notes'] ?? null
        ]);
        
        echo json_encode(['success' => true, 'alert_id' => $pdo->lastInsertId()]);
    }
    break;
    
    case 'resolve-alert':
        if ($method === 'POST') {
            // Resolve inventory alert
            $data = json_decode(file_get_contents('php://input'), true);
            
            $stmt = $pdo->prepare("
                UPDATE inventory_alerts SET 
                is_resolved = 1, resolved_by = ?, resolved_at = NOW(), notes = ?
                WHERE id = ?
            ");
            
            $stmt->execute([
                $user->user_id,
                $data['notes'] ?? null,
                $data['alert_id']
            ]);
            
            echo json_encode(['success' => true]);
        }
        break;
        
    case 'low-stock-components':
        if ($method === 'GET') {
            // Get components with low stock
            $stmt = $pdo->prepare("
                SELECT c.*, cc.name as category_name,
                CASE 
                    WHEN c.stock_quantity <= 0 THEN 'out_of_stock'
                    WHEN c.stock_quantity <= c.min_stock_level THEN 'low_stock'
                    ELSE 'adequate'
                END as stock_status
                FROM components c
                JOIN component_categories cc ON c.category_id = cc.id
                WHERE c.stock_quantity <= c.min_stock_level
                ORDER BY c.stock_quantity ASC
            ");
            $stmt->execute();
            $components = $stmt->fetchAll();
            
            echo json_encode(['success' => true, 'components' => $components]);
        }
        break;
        
    case 'supplier-communication':
        if ($method === 'POST') {
            // Log supplier communication
            $data = json_decode(file_get_contents('php://input'), true);
            
            $stmt = $pdo->prepare("
                INSERT INTO supplier_communications (supplier_id, communication_type, 
                subject, message, direction, status, scheduled_for, notes, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $data['supplier_id'],
                $data['communication_type'],
                $data['subject'] ?? null,
                $data['message'] ?? null,
                $data['direction'],
                $data['status'] ?? 'sent',
                $data['scheduled_for'] ?? null,
                $data['notes'] ?? null,
                $user->user_id
            ]);
            
            echo json_encode(['success' => true, 'communication_id' => $pdo->lastInsertId()]);
        }
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error: ' . $e->getMessage()]);
}
?>

