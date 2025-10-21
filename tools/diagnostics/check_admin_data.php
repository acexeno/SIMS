<?php
require 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Get all admin users
    $stmt = $pdo->query("
        SELECT u.*, GROUP_CONCAT(r.name) as roles 
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE r.name IN ('Admin', 'Super Admin') OR u.role = 'admin' OR u.role = 'super_admin'
        GROUP BY u.id
    ");
    
    $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($admins)) {
        echo "No admin users found.\n";
    } else {
        echo "Admin users found:\n\n";
        foreach ($admins as $admin) {
            echo "ID: " . $admin['id'] . "\n";
            echo "Username: " . $admin['username'] . "\n";
            echo "Email: " . $admin['email'] . "\n";
            echo "First Name: " . $admin['first_name'] . "\n";
            echo "Last Name: " . $admin['last_name'] . "\n";
            echo "Role: " . $admin['role'] . "\n";
            echo "Roles: " . $admin['roles'] . "\n";
            echo "Is Active: " . ($admin['is_active'] ? 'Yes' : 'No') . "\n";
            echo "Created At: " . $admin['created_at'] . "\n";
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
