<?php
// Real-time stock notification system
// This file provides functions to generate stock notifications when stock levels change

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/notifications.php';

/**
 * Generate stock notifications for all relevant users when stock levels change
 * This function should be called whenever component stock is updated
 */
function generateRealTimeStockNotifications($pdo, $componentId = null) {
    try {
        // Get all users with Admin, Super Admin, or Employee roles
        $stmt = $pdo->query("SELECT u.id, u.username FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name IN ('Admin', 'Super Admin', 'Employee')");
        $users = $stmt->fetchAll();
        if (!$users) return;

        // Get components with low stock or out of stock
        $query = "SELECT c.id, c.name, c.stock_quantity, cc.name AS category_name
                  FROM components c
                  LEFT JOIN component_categories cc ON c.category_id = cc.id
                  WHERE c.is_active IS NULL OR c.is_active = 1";
        
        if ($componentId) {
            $query .= " AND c.id = ?";
            $stmt = $pdo->prepare($query);
            $stmt->execute([$componentId]);
        } else {
            $stmt = $pdo->query($query);
        }
        
        $components = $stmt->fetchAll();
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
        
        return true;
    } catch (Exception $e) {
        error_log("Error generating real-time stock notifications: " . $e->getMessage());
        return false;
    }
}

/**
 * Generate notification for a specific component when its stock changes
 */
function generateComponentStockNotification($pdo, $componentId, $oldStock, $newStock) {
    try {
        // Get component details
        $stmt = $pdo->prepare("SELECT c.id, c.name, c.stock_quantity, cc.name AS category_name
                               FROM components c
                               LEFT JOIN component_categories cc ON c.category_id = cc.id
                               WHERE c.id = ?");
        $stmt->execute([$componentId]);
        $component = $stmt->fetch();
        
        if (!$component) return false;
        
        // Get all users with Admin, Super Admin, or Employee roles
        $stmt = $pdo->query("SELECT u.id, u.username FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name IN ('Admin', 'Super Admin', 'Employee')");
        $users = $stmt->fetchAll();
        
        if (!$users) return false;
        
        $componentName = $component['name'];
        $category = $component['category_name'] ?: 'Uncategorized';
        
        // Determine notification type and message
        $notificationType = null;
        $title = null;
        $message = null;
        $priority = 'medium';
        
        if ($newStock === 0 && $oldStock > 0) {
            // Just went out of stock
            $notificationType = 'out_of_stock';
            $title = "Component Out of Stock: {$componentName}";
            $message = "The component '{$componentName}' in category '{$category}' is now out of stock. Please restock immediately.";
            $priority = 'high';
        } elseif ($newStock > 0 && $newStock <= 5 && $oldStock > 5) {
            // Just went to low stock
            $notificationType = 'low_stock';
            $title = "Component Low Stock: {$componentName}";
            $message = "The component '{$componentName}' in category '{$category}' is now low on stock ({$newStock} remaining). Consider restocking soon.";
            $priority = 'medium';
        } elseif ($newStock > 5 && $oldStock <= 5 && $oldStock > 0) {
            // Stock was replenished
            $notificationType = 'stock_replenished';
            $title = "Stock Replenished: {$componentName}";
            $message = "The component '{$componentName}' in category '{$category}' has been restocked ({$newStock} available).";
            $priority = 'low';
        }
        
        if (!$notificationType) return false;
        
        // Create notifications for all relevant users (with spam prevention)
        foreach ($users as $user) {
            // Check if user already has a similar notification today
            $checkStmt = $pdo->prepare("
                SELECT COUNT(*) FROM notifications 
                WHERE user_id = ? AND type = 'stock' AND component_id = ? 
                AND created_at >= CURDATE()
            ");
            $checkStmt->execute([$user['id'], $componentId]);
            $existingCount = $checkStmt->fetchColumn();
            
            // Only create notification if user doesn't have one for this component today
            if ($existingCount == 0) {
                $stmt = $pdo->prepare("INSERT INTO notifications (user_id, type, title, message, priority, component_id) VALUES (?, 'stock', ?, ?, ?, ?)");
                $stmt->execute([$user['id'], $title, $message, $priority, $componentId]);
            }
        }
        
        return true;
    } catch (Exception $e) {
        error_log("Error generating component stock notification: " . $e->getMessage());
        return false;
    }
}
?>
