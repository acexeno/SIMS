<?php
// SIMS Automated Setup Script for Hostinger
// Run this script after uploading files to verify everything is working

echo "🚀 SIMS Automated Setup Script";
echo "\n==============================\n";

// Test environment loading
echo "1. Testing environment configuration...\n";
if (file_exists('.env')) {
    echo "✅ .env file found\n";
    // Load .env variables
    $env_vars = parse_ini_file('.env');
    foreach ($env_vars as $key => $value) {
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
} else {
    echo "❌ .env file not found!\n";
    exit(1);
}

// Test database connection
echo "2. Testing database connection...\n";
try {
    require_once 'backend/config/database.php';
    $pdo = get_db_connection();
    echo "✅ Database connection successful\n";
    
    // Test if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✅ Users table exists\n";
    } else {
        echo "❌ Users table not found! Please import schema.sql\n";
    }
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}

// Test JWT configuration
echo "3. Testing JWT configuration...\n";
if (!empty($_ENV['JWT_SECRET'])) {
    echo "✅ JWT_SECRET is configured\n";
} else {
    echo "❌ JWT_SECRET is NOT configured! Check your .env file.\n";
}

// Test API endpoints
echo "4. Testing API endpoints...\n";
$apiUrl = 'backend/api/simple_test.php';
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 5
    ]
]);
$response = @file_get_contents($apiUrl, false, $context);
if ($response !== false && strpos($response, 'API Test Successful') !== false) {
    echo "✅ API endpoints are accessible\n";
} else {
    echo "❌ API endpoints are not accessible\n";
    echo "Response: " . ($response ?: 'No response') . "\n";
}

// Test file permissions
echo "5. Testing file permissions...\n";
$logs_dir = 'backend/logs';
if (is_dir($logs_dir) && is_writable($logs_dir)) {
    echo "✅ Logs directory is writable\n";
} else {
    echo "⚠️  Logs directory is not writable (this is okay if it doesn't exist)\n";
}

echo "\n🎉 Setup verification complete!\n";
echo "If all tests passed, your SIMS installation should be working.\n";
echo "Visit your domain to test the application.\n";
?>
