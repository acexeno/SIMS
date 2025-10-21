<?php
require 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Get all admin users with their access controls
    $stmt = $pdo->query("
        SELECT 
            u.id, 
            u.username, 
            u.role,
            u.can_access_inventory,
            u.can_access_orders,
            u.can_access_chat_support,
            GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('Admin', 'Super Admin') OR u.role IN ('admin', 'super_admin')
        GROUP BY u.id
    ");
    
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($admins)) {
        echo "No admin users found.\n";
    } else {
        echo "Admin Users and Their Access Controls:\n\n";
        foreach ($admins as $admin) {
            echo "ID: " . $admin['id'] . "\n";
            echo "Username: " . $admin['username'] . "\n";
            echo "Role: " . $admin['role'] . "\n";
            echo "Roles: " . $admin['roles'] . "\n";
            echo "Can Access Inventory: " . ($admin['can_access_inventory'] ? 'Yes' : 'No') . "\n";
            echo "Can Access Orders: " . ($admin['can_access_orders'] ? 'Yes' : 'No') . "\n";
            echo "Can Access Chat Support: " . ($admin['can_access_chat_support'] ? 'Yes' : 'No') . "\n";
            echo str_repeat("-", 50) . "\n\n";
        }
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    if (strpos($e->getMessage(), 'SQLSTATE') !== false) {
        echo "SQL Error Code: " . $e->errorInfo[1] . "\n";
        echo "SQL Error Message: " . $e->errorInfo[2] . "\n";
    }
}
?>
