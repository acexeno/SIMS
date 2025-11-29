<?php
/**
 * Diagnostic script to check if notification was created after order deletion
 * This will help us understand why the customer didn't receive the notification
 */

// Set environment for CLI execution
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['SERVER_NAME'] = 'localhost';

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    $orderId = 27;
    
    echo "=== Checking Notification Creation for Deleted Order #{$orderId} ===\n\n";
    
    // 1. Check if order still exists (should be deleted)
    $stmt = $pdo->prepare("SELECT id, user_id, status, total FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($order) {
        echo "⚠️  Order #{$orderId} still exists in database!\n";
        echo "   - Customer User ID: {$order['user_id']}\n";
        echo "   - Status: {$order['status']}\n";
        echo "   - Total: P" . number_format($order['total'], 2) . "\n\n";
    } else {
        echo "✅ Order #{$orderId} has been deleted (as expected)\n\n";
        
        // 2. Check if notification was created (check recent notifications)
        echo "=== Checking for Notifications ===\n";
        
        // Get all notifications created in the last hour
        $stmt = $pdo->prepare("
            SELECT 
                n.id,
                n.user_id,
                n.type,
                n.title,
                n.message,
                n.priority,
                n.created_at,
                u.username,
                u.email
            FROM notifications n
            LEFT JOIN users u ON n.user_id = u.id
            WHERE n.type = 'order' 
            AND n.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY n.created_at DESC
        ");
        $stmt->execute();
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($notifications)) {
            echo "❌ NO NOTIFICATIONS FOUND for order deletions in the last hour!\n\n";
            
            // Check if there are ANY order notifications
            $stmt = $pdo->prepare("SELECT COUNT(*) as count FROM notifications WHERE type = 'order'");
            $stmt->execute();
            $count = $stmt->fetch(PDO::FETCH_ASSOC);
            echo "   Total order notifications in database: {$count['count']}\n\n";
            
            // 3. Try to find the customer who owned Order #27
            // Check order_items table for any remaining references
            $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $stmt->execute([$orderId]);
            $orderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($orderItems)) {
                echo "⚠️  WARNING: Order items still exist for Order #{$orderId}!\n";
                echo "   This suggests the order deletion might not have completed properly.\n\n";
            } else {
                echo "✅ Order items have been deleted (as expected)\n\n";
            }
            
            // 4. Check the most recent order to see what user_id it belonged to
            $stmt = $pdo->query("
                SELECT id, user_id, status, total, order_date 
                FROM orders 
                WHERE id = 27 OR user_id = 28
                ORDER BY order_date DESC 
                LIMIT 5
            ");
            $recentOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($recentOrders)) {
                echo "=== Recent Orders (for reference) ===\n";
                foreach ($recentOrders as $ro) {
                    echo "   Order #{$ro['id']} - User ID: {$ro['user_id']} - Status: {$ro['status']} - Total: P" . number_format($ro['total'], 2) . "\n";
                }
                echo "\n";
            }
            
            // 5. Check notifications for user_id 28 (the customer who owned Order #27)
            echo "=== Checking Notifications for User ID 28 ===\n";
            $stmt = $pdo->prepare("
                SELECT 
                    n.id,
                    n.user_id,
                    n.type,
                    n.title,
                    n.message,
                    n.priority,
                    n.created_at,
                    u.username
                FROM notifications n
                LEFT JOIN users u ON n.user_id = u.id
                WHERE n.user_id = 28
                ORDER BY n.created_at DESC
                LIMIT 10
            ");
            $stmt->execute();
            $userNotifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($userNotifications)) {
                echo "❌ User ID 28 has NO notifications at all!\n\n";
            } else {
                echo "   User ID 28 has " . count($userNotifications) . " notification(s):\n";
                foreach ($userNotifications as $un) {
                    echo "   - ID: {$un['id']} | Type: {$un['type']} | Title: {$un['title']} | Created: {$un['created_at']}\n";
                }
                echo "\n";
            }
            
        } else {
            echo "✅ Found " . count($notifications) . " notification(s) in the last hour:\n\n";
            foreach ($notifications as $notif) {
                echo "   Notification ID: {$notif['id']}\n";
                echo "   User ID: {$notif['user_id']}\n";
                echo "   Username: " . ($notif['username'] ?? 'N/A') . "\n";
                echo "   Type: {$notif['type']}\n";
                echo "   Title: {$notif['title']}\n";
                echo "   Message: {$notif['message']}\n";
                echo "   Priority: {$notif['priority']}\n";
                echo "   Created: {$notif['created_at']}\n";
                echo "   ---\n";
            }
            echo "\n";
        }
    }
    
    // 6. Check if there's a user with username "Username One" (from the image)
    echo "=== Checking User 'Username One' ===\n";
    $stmt = $pdo->prepare("SELECT id, username, email FROM users WHERE username LIKE ? OR username = ?");
    $stmt->execute(['%Username One%', 'Username One']);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($users)) {
        echo "   No user found with username containing 'Username One'\n\n";
        
        // Check all users to see who might be the customer
        $stmt = $pdo->query("SELECT id, username, email FROM users ORDER BY id DESC LIMIT 10");
        $allUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "   Recent users in database:\n";
        foreach ($allUsers as $u) {
            echo "   - ID: {$u['id']} | Username: {$u['username']} | Email: {$u['email']}\n";
        }
        echo "\n";
    } else {
        foreach ($users as $u) {
            echo "   Found: ID {$u['id']} | Username: {$u['username']} | Email: {$u['email']}\n";
            
            // Check notifications for this user
            $stmt2 = $pdo->prepare("
                SELECT id, type, title, message, created_at 
                FROM notifications 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            ");
            $stmt2->execute([$u['id']]);
            $userNotifs = $stmt2->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($userNotifs)) {
                echo "   ❌ This user has NO notifications!\n\n";
            } else {
                echo "   ✅ This user has " . count($userNotifs) . " notification(s):\n";
                foreach ($userNotifs as $un) {
                    echo "      - {$un['title']} (Created: {$un['created_at']})\n";
                }
                echo "\n";
            }
        }
    }
    
    echo "=== Diagnosis Summary ===\n";
    echo "1. Check if notification was created in database\n";
    echo "2. Check if user_id matches between order and notification\n";
    echo "3. Check if notification is being filtered correctly\n";
    echo "4. Verify the customer account that should receive notification\n\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace: " . $e->getTraceAsString() . "\n";
    exit(1);
}

