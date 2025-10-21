<?php
require_once __DIR__ . '/backend/config/database.php';

header('Content-Type: text/plain');

try {
    $pdo = get_db_connection();
    
    // Get all tables
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables in database: " . implode(', ', $tables) . "\n\n";
    
    if (in_array('users', $tables)) {
        // Get users table structure
        $columns = $pdo->query('DESCRIBE users')->fetchAll(PDO::FETCH_COLUMN);
        echo "Users table columns: " . implode(', ', $columns) . "\n\n";
        
        // Get admin user
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email LIKE '%admin%' OR username LIKE '%admin%'");
        $stmt->execute();
        $adminUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Admin users found: " . count($adminUsers) . "\n";
        foreach ($adminUsers as $user) {
            echo "\nUser ID: " . $user['id'] . "\n";
            echo "Username: " . $user['username'] . "\n";
            echo "Email: " . $user['email'] . "\n";
            echo "Role: " . ($user['role'] ?? 'Not set') . "\n";
            echo "Active: " . ($user['is_active'] ?? '0') . "\n";
        }
        
        // Get all users and their roles
        $allUsers = $pdo->query("SELECT id, username, email, role, is_active FROM users")->fetchAll(PDO::FETCH_ASSOC);
        echo "\nAll users (" . count($allUsers) . "):\n";
        foreach ($allUsers as $user) {
            echo sprintf("ID: %-3d | %-20s | %-30s | Role: %-10s | Active: %d\n", 
                $user['id'], 
                $user['username'], 
                $user['email'], 
                $user['role'] ?? 'N/A',
                $user['is_active'] ?? 0
            );
        }
    } else {
        echo "Users table not found. Available tables: " . implode(', ', $tables) . "\n";
    }
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
}
?>
