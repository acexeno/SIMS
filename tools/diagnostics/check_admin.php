<?php
require_once 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Check Admin user
    $stmt = $pdo->query("SELECT id, username, email, role, is_active FROM users WHERE username = 'Admin'");
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "Admin user details:\n";
    print_r($admin);
    
    // Check all users with admin role
    echo "\nAll admin users:\n";
    $stmt = $pdo->query("SELECT id, username, email, role, is_active FROM users WHERE role = 'admin'");
    while ($user = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($user);
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
