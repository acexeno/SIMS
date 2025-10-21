<?php
require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();

// Check users table structure
$stmt = $pdo->query("SHOW COLUMNS FROM users");
$columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
echo "Users table columns: " . implode(', ', $columns) . "\n\n";

// Check admin user
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute(['admin@builditpc.com']);
$admin = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Admin user data:\n";
print_r($admin);

// Check all users and their roles
$stmt = $pdo->query("SELECT id, username, email, role, is_active FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "\nAll users and their roles:\n";
foreach ($users as $user) {
    echo "ID: {$user['id']}, Username: {$user['username']}, Email: {$user['email']}, Role: {$user['role']}, Active: {$user['is_active']}\n";
}
?>
