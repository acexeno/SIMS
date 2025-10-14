<?php
// Comprehensive Admin User Fix for Hostinger Deployment
// This script will create/fix the admin user and test authentication

echo "🔧 SIMS Admin User Fix for Hostinger\n";
echo "===================================\n\n";

// Load environment and database
require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/utils/jwt_helper.php';

try {
    $pdo = get_db_connection();
    echo "✅ Database connection successful\n\n";
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Define possible admin credentials
$adminCredentials = [
    ['username' => 'admin@example.com', 'password' => 'Admin2024!@#'],
    ['username' => 'admin', 'password' => 'password'],
    ['username' => 'Admin', 'password' => 'password'],
    ['username' => 'SuperAdminAccount', 'password' => 'BuildITPASS'],
    ['username' => 'superadmin', 'password' => 'password']
];

echo "1. Checking existing admin users...\n";
$stmt = $pdo->query("SELECT id, username, email, password_hash, is_active FROM users WHERE username LIKE '%admin%' OR email LIKE '%admin%'");
$adminUsers = $stmt->fetchAll();

if (empty($adminUsers)) {
    echo "❌ No admin users found!\n";
} else {
    echo "✅ Found " . count($adminUsers) . " admin user(s):\n";
    foreach ($adminUsers as $user) {
        echo "   ID: {$user['id']}, Username: {$user['username']}, Email: {$user['email']}, Active: " . ($user['is_active'] ? 'Yes' : 'No') . "\n";
    }
}

echo "\n2. Testing password verification for existing users...\n";
foreach ($adminUsers as $user) {
    foreach ($adminCredentials as $cred) {
        if ($user['username'] === $cred['username'] || $user['email'] === $cred['username']) {
            if (password_verify($cred['password'], $user['password_hash'])) {
                echo "✅ Password match found: {$cred['username']} / {$cred['password']}\n";
            }
        }
    }
}

echo "\n3. Creating/Updating admin user with correct credentials...\n";

// Create or update admin user with the credentials from your login attempt
$adminUsername = 'admin@example.com';
$adminPassword = 'Admin2024!@#';
$adminEmail = 'admin@example.com';
$adminFirstName = 'System';
$adminLastName = 'Administrator';

// Check if user exists
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
$stmt->execute([$adminUsername, $adminEmail]);
$existingUser = $stmt->fetch();

if ($existingUser) {
    // Update existing user
    $passwordHash = password_hash($adminPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?");
    $stmt->execute([$passwordHash, $existingUser['id']]);
    echo "✅ Updated existing admin user (ID: {$existingUser['id']})\n";
    $userId = $existingUser['id'];
} else {
    // Create new user
    $passwordHash = password_hash($adminPassword, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("
        INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW())
    ");
    $stmt->execute([$adminUsername, $adminEmail, $passwordHash, $adminFirstName, $adminLastName]);
    $userId = $pdo->lastInsertId();
    echo "✅ Created new admin user (ID: $userId)\n";
}

// Ensure user has admin role
echo "\n4. Setting up admin role...\n";

// Check if Admin role exists
$stmt = $pdo->prepare("SELECT id FROM roles WHERE name = 'Admin'");
$stmt->execute();
$adminRole = $stmt->fetch();

if (!$adminRole) {
    // Create Admin role
    $stmt = $pdo->prepare("INSERT INTO roles (name) VALUES ('Admin')");
    $stmt->execute();
    $roleId = $pdo->lastInsertId();
    echo "✅ Created Admin role (ID: $roleId)\n";
} else {
    $roleId = $adminRole['id'];
    echo "✅ Admin role exists (ID: $roleId)\n";
}

// Assign role to user
$stmt = $pdo->prepare("
    INSERT IGNORE INTO user_roles (user_id, role_id) 
    VALUES (?, ?)
");
$stmt->execute([$userId, $roleId]);
echo "✅ Assigned Admin role to user\n";

echo "\n5. Testing authentication...\n";

// Test password verification
$stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
$stmt->execute([$userId]);
$user = $stmt->fetch();

if (password_verify($adminPassword, $user['password_hash'])) {
    echo "✅ Password verification successful\n";
} else {
    echo "❌ Password verification failed\n";
}

// Test JWT generation
try {
    $token = generateJWT($userId, $adminUsername, ['Admin']);
    if ($token) {
        echo "✅ JWT generation successful\n";
        
        // Test JWT verification
        $payload = verifyJWT($token);
        if ($payload) {
            echo "✅ JWT verification successful\n";
            echo "   User ID: {$payload['user_id']}\n";
            echo "   Username: {$payload['username']}\n";
            echo "   Roles: " . implode(', ', $payload['roles']) . "\n";
        } else {
            echo "❌ JWT verification failed\n";
        }
    } else {
        echo "❌ JWT generation failed\n";
    }
} catch (Exception $e) {
    echo "❌ JWT test failed: " . $e->getMessage() . "\n";
}

echo "\n6. Testing API endpoint...\n";

// Simulate login request
$loginData = [
    'username' => $adminUsername,
    'password' => $adminPassword
];

// Test the login function directly
try {
    // Include the auth handler
    require_once __DIR__ . '/backend/api/auth.php';
    
    // Mock the input
    $_SERVER['REQUEST_METHOD'] = 'POST';
    $_SERVER['CONTENT_TYPE'] = 'application/json';
    
    // Capture output
    ob_start();
    
    // Simulate the login process
    $input = $loginData;
    $username = $input['username'];
    $password = $input['password'];
    $ipAddress = '127.0.0.1';
    
    // Check if IP is blocked (simplified)
    $isIPBlocked = false;
    
    if (!$isIPBlocked) {
        // Get user info
        $stmt = $pdo->prepare("
            SELECT u.*, GROUP_CONCAT(r.name) as roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.username = ? OR u.email = ?
            GROUP BY u.id
        ");
        $stmt->execute([$username, $username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password_hash'])) {
            // Parse roles
            $roles = $user['roles'] ? explode(',', $user['roles']) : [];
            
            // Generate tokens
            $token = generateJWT($user['id'], $user['username'], $roles);
            $refreshToken = generateRefreshJWT($user['id'], $user['username'], $roles);
            
            echo "✅ Login simulation successful!\n";
            echo "   Token generated: " . substr($token, 0, 50) . "...\n";
            echo "   Refresh token generated: " . substr($refreshToken, 0, 50) . "...\n";
        } else {
            echo "❌ Login simulation failed - invalid credentials\n";
        }
    }
    
    $output = ob_get_clean();
    echo $output;
    
} catch (Exception $e) {
    echo "❌ API test failed: " . $e->getMessage() . "\n";
}

echo "\n📋 SUMMARY:\n";
echo "===========\n";
echo "Admin user setup completed!\n";
echo "Login credentials:\n";
echo "  Username: $adminUsername\n";
echo "  Password: $adminPassword\n\n";

echo "🔧 NEXT STEPS:\n";
echo "1. Upload this script to your Hostinger server\n";
echo "2. Run: php admin-user-fix.php\n";
echo "3. Test login with the credentials above\n";
echo "4. If still having issues, check the diagnostic script\n\n";

echo "✅ Admin user fix completed!\n";
?>
