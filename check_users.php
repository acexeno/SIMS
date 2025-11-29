<?php
require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();

echo "=== Checking for existing users ===\n\n";

// Check for users with 'admin' or 'sample' in username
$stmt = $pdo->query("SELECT id, username, email, is_active FROM users WHERE username LIKE '%admin%' OR username LIKE '%sample%' OR email LIKE '%admin%' ORDER BY id");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($users)) {
    echo "No users found with 'admin' or 'sample' in username/email\n";
} else {
    echo "Found " . count($users) . " user(s):\n\n";
    foreach ($users as $user) {
        echo "ID: {$user['id']}\n";
        echo "Username: {$user['username']}\n";
        echo "Email: {$user['email']}\n";
        echo "Active: " . ($user['is_active'] ? 'Yes' : 'No') . "\n";
        echo "---\n";
    }
}

echo "\n=== All users in database ===\n\n";
$stmt = $pdo->query("SELECT id, username, email, is_active FROM users ORDER BY id");
$allUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Total users: " . count($allUsers) . "\n\n";
foreach ($allUsers as $user) {
    echo "ID: {$user['id']} | Username: {$user['username']} | Email: {$user['email']} | Active: " . ($user['is_active'] ? 'Yes' : 'No') . "\n";
}

