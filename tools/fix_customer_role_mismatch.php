<?php
/**
 * Fix Role Mismatch: Customer -> Client
 * 
 * This script:
 * 1. Checks for users with "Customer" role instead of "Client"
 * 2. Reports all affected users
 * 3. Fixes the mismatch by updating to "Client"
 * 4. Ensures consistency between roles table, user_roles table, and users.role column
 */

// Determine if running in CLI mode
$isCli = php_sapi_name() === 'cli';

// For CLI mode, create direct database connection
if ($isCli) {
    // Try to load environment variables or use defaults
    require_once __DIR__ . '/../backend/config/env.php';
    
    $host = env('DB_HOST', 'localhost');
    $db   = env('DB_NAME', 'builditpc_db');
    $user = env('DB_USER', 'root');
    $pass = env('DB_PASS', '');
    $port = env('DB_PORT', '3306');
    $charset = env('DB_CHARSET', 'utf8mb4');
    
    // Check if we're on localhost (XAMPP)
    $isLocal = (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false);
    
    if ($isLocal && empty($pass)) {
        // Local XAMPP defaults
        $host = 'localhost';
        $db   = 'builditpc_db';
        $user = 'root';
        $pass = '';
    }
    
    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
    
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        $pdo->exec("SET time_zone = '+08:00'");
    } catch (PDOException $e) {
        echo "❌ Database connection failed: " . $e->getMessage() . "\n";
        echo "Please check your database credentials in .env file or update the script.\n";
        exit(1);
    }
} else {
    // For web mode, use the standard connection
    require_once __DIR__ . '/../backend/config/database.php';
    header('Content-Type: text/plain; charset=utf-8');
    
    try {
        $pdo = get_db_connection();
    } catch (Exception $e) {
        echo "❌ Database connection failed: " . $e->getMessage() . "\n";
        exit(1);
    }
}

echo "========================================\n";
echo "Fix Role Mismatch: Customer -> Client\n";
echo "========================================\n\n";

try {
    
    // Step 1: Check if "Customer" role exists in roles table
    echo "Step 1: Checking roles table...\n";
    $stmt = $pdo->prepare("SELECT id, name FROM roles WHERE name = ?");
    $stmt->execute(['Customer']);
    $customerRole = $stmt->fetch();
    
    if ($customerRole) {
        echo "  ⚠️  Found 'Customer' role in roles table (ID: {$customerRole['id']})\n";
    } else {
        echo "  ✓ No 'Customer' role found in roles table\n";
    }
    
    // Check if "Client" role exists
    $stmt = $pdo->prepare("SELECT id, name FROM roles WHERE name = ?");
    $stmt->execute(['Client']);
    $clientRole = $stmt->fetch();
    
    if (!$clientRole) {
        echo "  ⚠️  'Client' role not found. Creating it...\n";
        $stmt = $pdo->prepare("INSERT INTO roles (name) VALUES (?)");
        $stmt->execute(['Client']);
        $clientRoleId = $pdo->lastInsertId();
        echo "  ✓ Created 'Client' role (ID: $clientRoleId)\n";
    } else {
        $clientRoleId = $clientRole['id'];
        echo "  ✓ 'Client' role exists (ID: $clientRoleId)\n";
    }
    
    echo "\n";
    
    // Step 2: Find users with "Customer" role in user_roles table
    echo "Step 2: Checking user_roles table for 'Customer' assignments...\n";
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.email, u.role as user_role_column, r.name as role_name
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'Customer'
    ");
    $stmt->execute();
    $usersWithCustomerRole = $stmt->fetchAll();
    
    if (count($usersWithCustomerRole) > 0) {
        echo "  ⚠️  Found " . count($usersWithCustomerRole) . " user(s) with 'Customer' role:\n";
        foreach ($usersWithCustomerRole as $user) {
            echo "    - ID: {$user['id']}, Username: {$user['username']}, Email: {$user['email']}\n";
            echo "      User role column: " . ($user['user_role_column'] ?? 'NULL') . "\n";
        }
    } else {
        echo "  ✓ No users found with 'Customer' role in user_roles table\n";
    }
    
    echo "\n";
    
    // Step 3: Find users with "Customer" in users.role column
    echo "Step 3: Checking users.role column for 'Customer' values...\n";
    $stmt = $pdo->query("
        SELECT id, username, email, role 
        FROM users 
        WHERE role = 'Customer'
    ");
    $usersWithCustomerColumn = $stmt->fetchAll();
    
    if (count($usersWithCustomerColumn) > 0) {
        echo "  ⚠️  Found " . count($usersWithCustomerColumn) . " user(s) with 'Customer' in role column:\n";
        foreach ($usersWithCustomerColumn as $user) {
            echo "    - ID: {$user['id']}, Username: {$user['username']}, Email: {$user['email']}\n";
        }
    } else {
        echo "  ✓ No users found with 'Customer' in role column\n";
    }
    
    echo "\n";
    
    // Step 4: Summary of all affected users
    $allAffectedUsers = [];
    
    // Collect from user_roles
    foreach ($usersWithCustomerRole as $user) {
        $allAffectedUsers[$user['id']] = [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'has_customer_in_user_roles' => true,
            'has_customer_in_role_column' => false
        ];
    }
    
    // Collect from role column
    foreach ($usersWithCustomerColumn as $user) {
        if (isset($allAffectedUsers[$user['id']])) {
            $allAffectedUsers[$user['id']]['has_customer_in_role_column'] = true;
        } else {
            $allAffectedUsers[$user['id']] = [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'has_customer_in_user_roles' => false,
                'has_customer_in_role_column' => true
            ];
        }
    }
    
    if (count($allAffectedUsers) === 0) {
        echo "========================================\n";
        echo "✓ No issues found! All users have correct 'Client' role.\n";
        echo "========================================\n";
        exit(0);
    }
    
    echo "========================================\n";
    echo "Summary: " . count($allAffectedUsers) . " user(s) need fixing\n";
    echo "========================================\n\n";
    
    foreach ($allAffectedUsers as $userId => $userInfo) {
        echo "User ID: {$userInfo['id']}\n";
        echo "  Username: {$userInfo['username']}\n";
        echo "  Email: {$userInfo['email']}\n";
        echo "  Issues:\n";
        if ($userInfo['has_customer_in_user_roles']) {
            echo "    - Has 'Customer' role in user_roles table\n";
        }
        if ($userInfo['has_customer_in_role_column']) {
            echo "    - Has 'Customer' in users.role column\n";
        }
        echo "\n";
    }
    
    // Step 5: Fix the issues
    echo "========================================\n";
    echo "Applying fixes...\n";
    echo "========================================\n\n";
    
    $pdo->beginTransaction();
    
    $fixedCount = 0;
    
    try {
        // Fix user_roles table: Update Customer role assignments to Client
        if ($customerRole && count($usersWithCustomerRole) > 0) {
            echo "Fixing user_roles table...\n";
            
            // Update all user_roles entries from Customer to Client
            $stmt = $pdo->prepare("
                UPDATE user_roles 
                SET role_id = ? 
                WHERE role_id = ?
            ");
            $stmt->execute([$clientRoleId, $customerRole['id']]);
            $updated = $stmt->rowCount();
            
            if ($updated > 0) {
                echo "  ✓ Updated $updated user_roles entry(ies) from 'Customer' to 'Client'\n";
                $fixedCount += $updated;
            }
        }
        
        // Fix users.role column: Update Customer to Client
        if (count($usersWithCustomerColumn) > 0) {
            echo "Fixing users.role column...\n";
            
            $stmt = $pdo->prepare("UPDATE users SET role = 'Client' WHERE role = 'Customer'");
            $stmt->execute();
            $updated = $stmt->rowCount();
            
            if ($updated > 0) {
                echo "  ✓ Updated $updated user(s) role column from 'Customer' to 'Client'\n";
                $fixedCount += $updated;
            }
        }
        
        // Clean up: Remove Customer role from roles table if no longer used
        if ($customerRole) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM user_roles WHERE role_id = ?");
            $stmt->execute([$customerRole['id']]);
            $stillInUse = $stmt->fetchColumn() > 0;
            
            if (!$stillInUse) {
                echo "Removing unused 'Customer' role from roles table...\n";
                $stmt = $pdo->prepare("DELETE FROM roles WHERE id = ?");
                $stmt->execute([$customerRole['id']]);
                echo "  ✓ Removed 'Customer' role from roles table\n";
            } else {
                echo "  ⚠️  'Customer' role still has assignments. Keeping it for now.\n";
            }
        }
        
        $pdo->commit();
        
        echo "\n========================================\n";
        echo "✓ Successfully fixed $fixedCount issue(s)!\n";
        echo "========================================\n\n";
        
        // Step 6: Verify the fixes
        echo "Verifying fixes...\n";
        echo "========================================\n";
        
        // Check if any Customer roles remain
        $stmt = $pdo->prepare("
            SELECT COUNT(*) 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'Customer'
        ");
        $stmt->execute();
        $remainingInUserRoles = $stmt->fetchColumn();
        
        $stmt = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'Customer'");
        $remainingInColumn = $stmt->fetchColumn();
        
        if ($remainingInUserRoles == 0 && $remainingInColumn == 0) {
            echo "✓ Verification passed! No 'Customer' roles found.\n";
            echo "✓ All users now have 'Client' role.\n";
        } else {
            echo "⚠️  Warning: Some 'Customer' roles may still exist:\n";
            if ($remainingInUserRoles > 0) {
                echo "  - $remainingInUserRoles in user_roles table\n";
            }
            if ($remainingInColumn > 0) {
                echo "  - $remainingInColumn in users.role column\n";
            }
        }
        
        // Show sample of fixed users
        echo "\nSample of fixed users:\n";
        $stmt = $pdo->query("
            SELECT u.id, u.username, u.email, u.role, GROUP_CONCAT(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id IN (" . implode(',', array_keys($allAffectedUsers)) . ")
            GROUP BY u.id
            LIMIT 5
        ");
        $fixedUsers = $stmt->fetchAll();
        
        foreach ($fixedUsers as $user) {
            echo "  - {$user['username']} ({$user['email']}): role column='{$user['role']}', roles='{$user['roles']}'\n";
        }
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
    
} catch (PDOException $e) {
    echo "\n❌ Database error: " . $e->getMessage() . "\n";
    echo "Error code: " . $e->getCode() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n========================================\n";
echo "Script completed successfully!\n";
echo "========================================\n";
?>

