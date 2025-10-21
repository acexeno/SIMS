<?php
require_once __DIR__ . '/backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Check if the role column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'");
    if ($stmt->rowCount() === 0) {
        // Add the role column if it doesn't exist
        $pdo->exec("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'client' AFTER email");
        echo "Added 'role' column to users table\n";
    }
    
    // Update the admin user's role
    $stmt = $pdo->prepare("UPDATE users SET role = 'admin' WHERE email = ?");
    $stmt->execute(['admin@builditpc.com']);
    $updated = $stmt->rowCount();
    
    if ($updated > 0) {
        echo "Successfully updated admin@builditpc.com to have 'admin' role\n";
    } else {
        echo "No rows updated. Checking if user exists...\n";
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute(['admin@builditpc.com']);
        $user = $stmt->fetch();
        
        if ($user) {
            echo "User found but not updated. Current role: " . ($user['role'] ?? 'not set') . "\n";
        } else {
            echo "User admin@builditpc.com not found in database.\n";
            
            // List all users for debugging
            $users = $pdo->query("SELECT id, email, username, role FROM users")->fetchAll();
            echo "\nAll users in database:\n";
            foreach ($users as $u) {
                echo "ID: {$u['id']}, Email: {$u['email']}, Username: {$u['username']}, Role: " . ($u['role'] ?? 'not set') . "\n";
            }
        }
    }
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
}
?>
