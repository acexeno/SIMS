<?php
require_once __DIR__ . '/backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Update the admin user's role and reset password
    $passwordHash = password_hash('password', PASSWORD_DEFAULT);
    
    // First, try to find the admin user by username
    $stmt = $pdo->prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE username = ?");
    $stmt->execute([$passwordHash, 'Admin']);
    $updated = $stmt->rowCount();
    
    if ($updated > 0) {
        echo "Successfully updated Admin user with username 'Admin' to have 'admin' role and reset password to 'password'\n";
    } else {
        // If not found by username, try by email
        $stmt = $pdo->prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE email LIKE '%admin%'");
        $stmt->execute([$passwordHash]);
        $updated = $stmt->rowCount();
        
        if ($updated > 0) {
            echo "Successfully updated admin user with admin email to have 'admin' role and reset password to 'password'\n";
        } else {
            // If still not found, create a new admin user
            $stmt = $pdo->prepare("
                INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
                VALUES (?, ?, ?, ?, ?, 'admin', 1)
            ");
            $stmt->execute(['Admin', 'admin@builditpc.com', $passwordHash, 'System', 'Administrator']);
            
            $userId = $pdo->lastInsertId();
            echo "Created new admin user with ID: $userId, username: Admin, password: password\n";
        }
    }
    
    // Verify the update
    $stmt = $pdo->query("SELECT id, username, email, role, is_active FROM users WHERE username = 'Admin' OR email LIKE '%admin%'");
    $adminUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "\nAdmin users after update:\n";
    foreach ($adminUsers as $user) {
        echo "ID: {$user['id']}, Username: {$user['username']}, Email: {$user['email']}, Role: {$user['role']}, Active: {$user['is_active']}\n";
    }
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    if (strpos($e->getMessage(), 'SQLSTATE') !== false) {
        echo "SQL Error Code: " . $e->errorInfo[1] . "\n";
        echo "SQL Error Message: " . $e->errorInfo[2] . "\n";
    }
}
?>
