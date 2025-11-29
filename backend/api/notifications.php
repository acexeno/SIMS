<?php
// Notifications API endpoints for SIMS

// Error reporting controlled by environment
require_once __DIR__ . '/../config/env.php';
$appDebug = env('APP_DEBUG', '0');
if ($appDebug === '1' || strtolower($appDebug) === 'true') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
    ini_set('display_errors', 0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../utils/jwt_helper.php';

// Local helper: safely extract user_id from JWT from multiple sources
function getUserIdFromRequest() {
    // Use the centralized getBearerToken function which handles all token sources
    $token = null;
    if (function_exists('getBearerToken')) {
        $token = getBearerToken();
    } else {
        error_log("getUserIdFromRequest: getBearerToken function not found");
        // Fallback implementation
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
        
        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = trim($matches[1]);
        }
        
        if (!$token) {
            $xAuthToken = $headers['X-Auth-Token'] ?? $headers['x-auth-token'] ?? null;
            if ($xAuthToken) {
                $token = trim($xAuthToken);
            }
        }
        
        if (!$token && isset($_GET['token']) && !empty($_GET['token'])) {
            $token = trim($_GET['token']);
        }
    }

    if (!$token) {
        error_log("getUserIdFromRequest: No token found in request");
        return null;
    }
    
    // DEBUG: Log token source and first few characters for debugging
    $tokenSource = 'unknown';
    if (isset($_GET['token']) && !empty($_GET['token'])) {
        $tokenSource = 'query_param';
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $tokenSource = 'auth_header';
    } elseif (isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        $tokenSource = 'x_auth_header';
    }
    error_log("getUserIdFromRequest: Token from $tokenSource: " . substr($token, 0, 20) . "...");
    
    try {
        $decoded = verifyJWT($token);
        if (!$decoded) {
            error_log("getUserIdFromRequest: Token verification failed for token: " . substr($token, 0, 20) . "...");
            return null;
        }
        
        error_log("getUserIdFromRequest: Token verification successful for user: " . ($decoded['user_id'] ?? 'unknown'));
        
        $userId = $decoded['user_id'] ?? null;
        if (!$userId) {
            error_log("getUserIdFromRequest: No user_id in decoded token");
            return null;
        }
        
        // Additional validation: ensure user exists and is active
        global $pdo;
        if ($pdo) {
            $stmt = $pdo->prepare("SELECT id, is_active FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            
            if (!$user) {
                error_log("getUserIdFromRequest: User not found in database: $userId");
                return null;
            }
            
            if (!$user['is_active']) {
                error_log("getUserIdFromRequest: User account is deactivated: $userId");
                return null;
            }
        }
        
        error_log("getUserIdFromRequest: Successfully authenticated user $userId");
        return $userId;
    } catch (Throwable $t) {
        error_log("getUserIdFromRequest: Exception during token verification: " . $t->getMessage());
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

    // Check if we should generate notifications (only once per day to prevent spam)
    $lastCheck = $pdo->query("SELECT MAX(created_at) as last_check FROM notifications WHERE type = 'stock'")->fetchColumn();
    if ($lastCheck && strtotime($lastCheck) > strtotime('-1 day')) {
        return; // Skip if notifications were generated in the last 24 hours
    }

    // Clean up old stock notifications before generating new ones
    $pdo->query("DELETE FROM notifications WHERE type = 'stock' AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)");
    
    // Check if any user already has stock notifications today
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND type = 'stock' AND created_at >= CURDATE()");
    $hasRecentNotifications = false;
    foreach ($users as $user) {
        $stmt->execute([$user['id']]);
        $dailyCount = $stmt->fetchColumn();
        if ($dailyCount > 0) {
            $hasRecentNotifications = true;
            break;
        }
    }
    
    // If any user has recent notifications, skip generation
    if ($hasRecentNotifications) {
        return;
    }

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

    // Helper to build a readable, categorized message with bullet points
    $buildMessage = function ($intro, $groups, $footer = '') {
        if (empty($groups)) return '';
        ksort($groups);
        $lines = [$intro];
        foreach ($groups as $category => $names) {
            sort($names);
            $count = count($names);
            $lines[] = "\n• {$category} ({$count} items):";
            
            // Limit to first 10 entries for readability; mention the remainder
            $display = array_slice($names, 0, 10);
            foreach ($display as $name) {
                $lines[] = "  - {$name}";
            }
            
            if ($count > 10) {
                $lines[] = "  ... and " . ($count - 10) . " more items";
            }
        }
        if ($footer !== '') $lines[] = "\n" . $footer;
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
                $insert = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, created_at) VALUES (?, 'stock', ?, ?, 'high', NOW())");
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
                $insert = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, created_at) VALUES (?, 'stock', ?, ?, 'medium', NOW())");
                $insert->execute([$user['id'], $lowTitle, $lowMessage]);
            }
        }
    }
}

// Get user notifications
function handleGetNotifications($pdo) {
    // Generate stock notifications in real-time on each fetch
    generateStockNotifications($pdo);
    $userId = getUserIdFromRequest();
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized', 'message' => 'Invalid or missing authentication token']);
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