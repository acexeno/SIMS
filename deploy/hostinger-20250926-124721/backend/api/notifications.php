<?php
// Notifications API endpoints for SIMS

// Local helper: safely extract user_id from JWT in either Authorization header or query string
function getUserIdFromRequest() {
    // Prefer the common helper if available
    if (function_exists('getBearerToken')) {
        $token = getBearerToken();
    } else {
        $token = null;
    }
    if (!$token && isset($_GET['token']) && $_GET['token']) {
        $token = $_GET['token'];
    }
    if (!$token) return null;
    try {
        $decoded = verifyJWT($token);
        if (!$decoded) return null;
        return $decoded['user_id'] ?? null;
    } catch (Throwable $t) {
        return null;
    }
}

// Helper: Generate persistent stock notifications for all relevant users
function generateStockNotifications($pdo) {
    // Get all users with Admin, Super Admin, or Employee roles
    $stmt = $pdo->query("SELECT u.id, u.username FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('Admin', 'Super Admin', 'Employee')");
    $users = $stmt->fetchAll();
    if (!$users) return;

    // Get all components with category for better grouping in notifications
    $components = $pdo->query("SELECT c.id, c.name, c.stock_quantity, cc.name AS category_name
                               FROM components c
                               LEFT JOIN component_categories cc ON c.category_id = cc.id")->fetchAll();
    if (!$components) return;

    // Group components by stock status and by category
    $lowStockByCat = [];
    $outOfStockByCat = [];
    foreach ($components as $component) {
        $stock = (int)($component['stock_quantity'] ?? 0);
        $cat = $component['category_name'] ?: 'Uncategorized';
        if ($stock === 0) {
            $outOfStockByCat[$cat][] = $component['name'];
        } else if ($stock > 0 && $stock <= 5) {
            $lowStockByCat[$cat][] = $component['name'];
        }
    }

    // Helper to build a readable, categorized message
    $buildMessage = function ($intro, $groups, $footer = '') {
        if (empty($groups)) return '';
        ksort($groups);
        $lines = [$intro];
        foreach ($groups as $category => $names) {
            sort($names);
            $count = count($names);
            // Limit to first 12 entries for readability; mention the remainder
            $display = array_slice($names, 0, 12);
            $suffix = $count > 12 ? (" … and " . ($count - 12) . " more") : '';
            $lines[] = "- {$category} ({$count}): " . implode(', ', $display) . $suffix;
        }
        if ($footer !== '') $lines[] = $footer;
        return implode("\n", $lines);
    };

    $outTitle = "Out of Stock: Multiple Components";
    $outMessage = $buildMessage(
        "The following components are out of stock:",
        $outOfStockByCat,
        "Please restock as soon as possible."
    );

    $lowTitle = "Low Stock: Multiple Components";
    $lowMessage = $buildMessage(
        "The following components are nearly out of stock (≤ 5 left):",
        $lowStockByCat
    );

    foreach ($users as $user) {
        // Create or update grouped Out of Stock notification
        if (!empty($outMessage)) {
            $check = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'stock' AND title = ?");
            $check->execute([$user['id'], $outTitle]);
            $existing = $check->fetch();
            if ($existing) {
                $upd = $pdo->prepare("UPDATE notifications SET message = ?, priority = 'high', read_status = 0, updated_at = NOW() WHERE id = ?");
                $upd->execute([$outMessage, $existing['id']]);
            } else {
                $insert = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority) VALUES (?, 'stock', ?, ?, 'high')");
                $insert->execute([$user['id'], $outTitle, $outMessage]);
            }
        }

        // Create or update grouped Low Stock notification
        if (!empty($lowMessage)) {
            $check = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? AND type = 'stock' AND title = ?");
            $check->execute([$user['id'], $lowTitle]);
            $existing = $check->fetch();
            if ($existing) {
                $upd = $pdo->prepare("UPDATE notifications SET message = ?, priority = 'medium', read_status = 0, updated_at = NOW() WHERE id = ?");
                $upd->execute([$lowMessage, $existing['id']]);
            } else {
                $insert = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority) VALUES (?, 'stock', ?, ?, 'medium')");
                $insert->execute([$user['id'], $lowTitle, $lowMessage]);
            }
        }
    }
}

// Get user notifications
function handleGetNotifications($pdo) {
    // generateStockNotifications($pdo); // Removed to prevent duplicate notifications on fetch
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, type, title, message, priority, read_status as is_read, created_at as timestamp
            FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        ");
        $stmt->execute([$userId]);
        $notifications = $stmt->fetchAll();

        // Convert read_status to boolean
        foreach ($notifications as &$notification) {
            $notification['read'] = (bool)$notification['is_read'];
            unset($notification['is_read']);
            $notification['timestamp'] = (new DateTime($notification['timestamp']))->format('c');
        }

        echo json_encode(['success' => true, 'data' => $notifications]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch notifications']);
    }
}

// Mark notification as read
function handleMarkAsRead($pdo) {
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $notificationId = $data['notification_id'] ?? null;

    if (!$notificationId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Notification ID required']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE notifications 
            SET read_status = 1 
            WHERE id = ? AND user_id = ?
        ");
        $result = $stmt->execute([$notificationId, $userId]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Notification marked as read']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Notification not found']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to mark notification as read']);
    }
}

// Mark all notifications as read
function handleMarkAllAsRead($pdo) {
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE notifications 
            SET read_status = 1 
            WHERE user_id = ? AND read_status = 0
        ");
        $stmt->execute([$userId]);

        echo json_encode(['success' => true, 'message' => 'All notifications marked as read']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to mark notifications as read']);
    }
}

// Delete notification
function handleDeleteNotification($pdo) {
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    // Support deleting all notifications
    if (isset($_GET['all']) && $_GET['all'] == '1') {
        try {
            $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = ?");
            $stmt->execute([$userId]);
            echo json_encode(['success' => true, 'message' => 'All notifications deleted']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Failed to delete all notifications']);
        }
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    $notificationId = $data['notification_id'] ?? null;

    if (!$notificationId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Notification ID required']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?");
        $result = $stmt->execute([$notificationId, $userId]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Notification deleted']);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Notification not found']);
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to delete notification']);
    }
}

// Get unread count
function handleGetUnreadCount($pdo) {
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as count
            FROM notifications 
            WHERE user_id = ? AND read_status = 0
        ");
        $stmt->execute([$userId]);
        $result = $stmt->fetch();
        echo json_encode(['success' => true, 'count' => (int)$result['count']]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to get unread count']);
    }
}

// Create notification (for admin/system use)
function handleCreateNotification($pdo) {
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    // Check if user has admin privileges
    $stmt = $pdo->prepare("
        SELECT r.name 
        FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = ?
    ");
    $stmt->execute([$userId]);
    $roles = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('Admin', $roles) && !in_array('Super Admin', $roles)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
        return;
    }

    $data = json_decode(file_get_contents('php://input'), true);
    
    $targetUserId = $data['user_id'] ?? null;
    $type = $data['type'] ?? null;
    $title = $data['title'] ?? null;
    $message = $data['message'] ?? null;
    $priority = $data['priority'] ?? 'low';

    if (!$targetUserId || !$type || !$title || !$message) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO notifications (user_id, type, title, message, priority)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$targetUserId, $type, $title, $message, $priority]);

        echo json_encode(['success' => true, 'message' => 'Notification created']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create notification']);
    }
}
?> 