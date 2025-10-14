<?php
// Comprehensive Hostinger Deployment Diagnostic
// This script will help identify what's causing the persistent 401 error

echo "🔍 SIMS Hostinger Deployment Diagnostic\n";
echo "=====================================\n\n";

// Check if .env file exists and is readable
echo "1. Checking .env file...\n";
$envPath = __DIR__ . '/.env';
if (!file_exists($envPath)) {
    echo "❌ .env file not found at: $envPath\n";
    echo "   Please create the .env file in the root directory\n";
    exit(1);
} else {
    echo "✅ .env file exists\n";
    
    // Check file permissions
    $perms = fileperms($envPath);
    echo "   File permissions: " . substr(sprintf('%o', $perms), -4) . "\n";
    
    if (!is_readable($envPath)) {
        echo "❌ .env file is not readable!\n";
        echo "   Fix: chmod 644 .env\n";
    } else {
        echo "✅ .env file is readable\n";
    }
}

// Load environment configuration
echo "\n2. Loading environment configuration...\n";
try {
    require_once __DIR__ . '/backend/config/env.php';
    echo "✅ Environment loader loaded successfully\n";
} catch (Exception $e) {
    echo "❌ Failed to load environment: " . $e->getMessage() . "\n";
    exit(1);
}

// Test environment variables
echo "\n3. Testing critical environment variables...\n";

$criticalVars = [
    'JWT_SECRET' => 'builditpc_super_secure_jwt_secret_key_2024_production_ready_12345',
    'REFRESH_JWT_SECRET' => 'builditpc_refresh_token_secret_key_2024_production_ready_67890',
    'DB_HOST' => 'localhost',
    'DB_NAME' => 'u709288172_builditpc_db',
    'DB_USER' => 'u709288172_sims',
    'DB_PASS' => 'Egiesims1@'
];

foreach ($criticalVars as $var => $expected) {
    $value = env($var);
    if (empty($value)) {
        echo "❌ $var is empty or not set\n";
    } elseif ($value === $expected) {
        echo "✅ $var is correctly set\n";
    } else {
        echo "⚠️  $var is set but different from expected\n";
        echo "   Current: " . substr($value, 0, 20) . "...\n";
        echo "   Expected: " . substr($expected, 0, 20) . "...\n";
    }
}

// Test JWT functionality
echo "\n4. Testing JWT functionality...\n";
try {
    require_once __DIR__ . '/backend/utils/jwt_helper.php';
    
    // Test JWT generation
    $testToken = generateJWT(1, 'test_user', ['Admin']);
    if ($testToken) {
        echo "✅ JWT generation works\n";
        
        // Test JWT verification
        $payload = verifyJWT($testToken);
        if ($payload) {
            echo "✅ JWT verification works\n";
        } else {
            echo "❌ JWT verification failed\n";
        }
    } else {
        echo "❌ JWT generation failed\n";
    }
} catch (Exception $e) {
    echo "❌ JWT test failed: " . $e->getMessage() . "\n";
}

// Test database connection
echo "\n5. Testing database connection...\n";
try {
    require_once __DIR__ . '/backend/config/database.php';
    $pdo = get_db_connection();
    echo "✅ Database connection successful\n";
    
    // Test if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✅ Users table exists\n";
        
        // Check if admin user exists
        $stmt = $pdo->prepare("SELECT id, username, email, password_hash FROM users WHERE username = 'admin' OR email = 'admin@example.com'");
        $stmt->execute();
        $user = $stmt->fetch();
        
        if ($user) {
            echo "✅ Admin user found:\n";
            echo "   ID: " . $user['id'] . "\n";
            echo "   Username: " . $user['username'] . "\n";
            echo "   Email: " . $user['email'] . "\n";
            echo "   Password hash: " . (empty($user['password_hash']) ? 'EMPTY' : 'SET') . "\n";
            
            // Test password verification
            if (!empty($user['password_hash'])) {
                $testPassword = 'Admin2024!@#';
                if (password_verify($testPassword, $user['password_hash'])) {
                    echo "✅ Password verification works\n";
                } else {
                    echo "❌ Password verification failed\n";
                    echo "   The password 'Admin2024!@#' doesn't match the stored hash\n";
                }
            }
        } else {
            echo "❌ Admin user not found!\n";
            echo "   No user with username 'admin' or email 'admin@example.com'\n";
        }
    } else {
        echo "❌ Users table not found!\n";
    }
} catch (Exception $e) {
    echo "❌ Database test failed: " . $e->getMessage() . "\n";
}

// Test API endpoint
echo "\n6. Testing API endpoint structure...\n";
$apiPath = __DIR__ . '/backend/api/index.php';
if (file_exists($apiPath)) {
    echo "✅ API endpoint file exists\n";
} else {
    echo "❌ API endpoint file not found: $apiPath\n";
}

// Test CORS configuration
echo "\n7. Testing CORS configuration...\n";
$corsOrigins = env('CORS_ALLOWED_ORIGINS');
if (empty($corsOrigins)) {
    echo "⚠️  CORS_ALLOWED_ORIGINS not configured\n";
} else {
    echo "✅ CORS_ALLOWED_ORIGINS: " . $corsOrigins . "\n";
    
    // Check if current domain is in allowed origins
    $allowedOrigins = array_map('trim', explode(',', $corsOrigins));
    $currentDomain = 'https://egiesims.shop';
    if (in_array($currentDomain, $allowedOrigins)) {
        echo "✅ Current domain is in allowed origins\n";
    } else {
        echo "❌ Current domain not in allowed origins\n";
        echo "   Add '$currentDomain' to CORS_ALLOWED_ORIGINS\n";
    }
}

// Test file structure
echo "\n8. Checking critical file structure...\n";
$criticalFiles = [
    'backend/api/index.php',
    'backend/api/auth.php',
    'backend/config/env.php',
    'backend/config/database.php',
    'backend/utils/jwt_helper.php'
];

foreach ($criticalFiles as $file) {
    $fullPath = __DIR__ . '/' . $file;
    if (file_exists($fullPath)) {
        echo "✅ $file exists\n";
    } else {
        echo "❌ $file missing\n";
    }
}

echo "\n📋 DIAGNOSTIC SUMMARY:\n";
echo "=====================\n";
echo "If you're still getting 401 errors, check:\n";
echo "1. .env file is in the root directory and readable\n";
echo "2. JWT_SECRET and REFRESH_JWT_SECRET are properly set\n";
echo "3. Admin user exists in the database\n";
echo "4. Admin user password matches 'Admin2024!@#'\n";
echo "5. CORS_ALLOWED_ORIGINS includes your domain\n";
echo "6. All backend files are uploaded correctly\n\n";

echo "🔧 NEXT STEPS:\n";
echo "1. Run this diagnostic script on your Hostinger server\n";
echo "2. Fix any issues identified above\n";
echo "3. Test login again\n\n";

echo "✅ Diagnostic completed!\n";
?>
