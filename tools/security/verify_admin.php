<?php
require 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Check Admin user
    $stmt = $pdo->query("SELECT id, username, email, role, is_active, password_hash FROM users WHERE username = 'Admin'");
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($admin) {
        echo "Admin user found:\n";
        echo "ID: " . $admin['id'] . "\n";
        echo "Username: " . $admin['username'] . "\n";
        echo "Email: " . $admin['email'] . "\n";
        echo "Role: " . $admin['role'] . "\n";
        echo "Active: " . ($admin['is_active'] ? 'Yes' : 'No') . "\n";
        echo "Password Hash: " . $admin['password_hash'] . "\n";
        
        // Verify if password 'password' works with the hash
        if (password_verify('password', $admin['password_hash'])) {
            echo "\n✅ Password 'password' is CORRECT for this user.\n";
        } else {
            echo "\n❌ Password 'password' is INCORRECT for this user.\n";
        }
    } else {
        echo "Admin user not found.\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
