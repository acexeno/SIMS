<?php
require 'backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Get admin user with all fields
    $stmt = $pdo->query("SELECT * FROM users WHERE username = 'Admin'");
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "Admin user details:\n";
    print_r($admin);
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
