<?php
require 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Update all admin accounts to have full access
    $stmt = $pdo->prepare("
        UPDATE users 
        SET can_access_inventory = 1, 
            can_access_orders = 1, 
            can_access_chat_support = 1
        WHERE role IN ('admin', 'super_admin') 
        OR id IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('Admin', 'Super Admin'))
    ");
    $updated = $stmt->execute();
    
    $count = $stmt->rowCount();
    
    echo "✅ Successfully updated $count admin accounts with full access.\n";
    
    // Verify the changes
    $stmt = $pdo->query("
        SELECT u.id, u.username, u.role, 
               u.can_access_inventory, u.can_access_orders, u.can_access_chat_support
        FROM users u
        WHERE u.role IN ('admin', 'super_admin') 
        OR u.id IN (SELECT user_id FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.name IN ('Admin', 'Super Admin'))
    ");
    
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\nAdmin Accounts Access After Update:\n";
    echo str_repeat("-", 80) . "\n";
    echo str_pad("ID", 5) . str_pad("Username", 20) . str_pad("Role", 15) . 
         str_pad("Inventory", 10) . str_pad("Orders", 10) . str_pad("Chat", 10) . "\n";
    echo str_repeat("-", 80) . "\n";
    
    foreach ($admins as $admin) {
        echo str_pad($admin['id'], 5) . 
             str_pad($admin['username'], 20) . 
             str_pad($admin['role'], 15) . 
             str_pad($admin['can_access_inventory'] ? 'Yes' : 'No', 10) . 
             str_pad($admin['can_access_orders'] ? 'Yes' : 'No', 10) . 
             str_pad($admin['can_access_chat_support'] ? 'Yes' : 'No', 10) . "\n";
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    if (strpos($e->getMessage(), 'SQLSTATE') !== false) {
        echo "SQL Error Code: " . $e->errorInfo[1] . "\n";
        echo "SQL Error Message: " . $e->errorInfo[2] . "\n";
    }
}
?>
