<?php
/**
 * Cleanup Script - Remove Duplicate or Orphaned Users
 * Use this if you're getting "username or email already exists" errors
 */

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "=== User Cleanup Script ===\n\n";
    
    // Find users with 'sample' or specific patterns
    $username_pattern = 'sample%';
    
    echo "Searching for users with username like '{$username_pattern}'...\n";
    
    $stmt = $pdo->prepare("SELECT u.id, u.username, u.email, u.is_active, GROUP_CONCAT(r.name) as roles
                           FROM users u
                           LEFT JOIN user_roles ur ON u.id = ur.user_id
                           LEFT JOIN roles r ON ur.role_id = r.id
                           WHERE u.username LIKE ?
                           GROUP BY u.id");
    $stmt->execute([$username_pattern]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($users)) {
        echo "No users found matching pattern.\n";
    } else {
        echo "Found " . count($users) . " user(s):\n\n";
        
        foreach ($users as $user) {
            echo "ID: {$user['id']}\n";
            echo "Username: {$user['username']}\n";
            echo "Email: {$user['email']}\n";
            echo "Roles: " . ($user['roles'] ?: 'None') . "\n";
            echo "Active: " . ($user['is_active'] ? 'Yes' : 'No') . "\n";
            
            // Don't delete Super Admins
            if (stripos($user['roles'], 'Super Admin') !== false) {
                echo "⚠️  PROTECTED - This is a Super Admin account, will NOT be deleted\n";
            } else {
                echo "Deleting user...\n";
                
                // Delete user roles first
                $delRoles = $pdo->prepare("DELETE FROM user_roles WHERE user_id = ?");
                $delRoles->execute([$user['id']]);
                
                // Delete user
                $delUser = $pdo->prepare("DELETE FROM users WHERE id = ?");
                $delUser->execute([$user['id']]);
                
                if ($delUser->rowCount() > 0) {
                    echo "✅ User deleted successfully!\n";
                } else {
                    echo "❌ Failed to delete user\n";
                }
            }
            echo "---\n\n";
        }
    }
    
    echo "\n=== Cleanup Complete ===\n";
    echo "You can now try creating the user again with the same username.\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

