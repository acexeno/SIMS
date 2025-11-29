<?php
// Test environment detection and configuration
require_once __DIR__ . '/config/database.php';

echo "<h2>Environment Test</h2>";

// Test environment detection
$host = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? '');
$appEnv = env('APP_ENV', '');

echo "<h3>Environment Detection:</h3>";
echo "HTTP_HOST: " . $host . "<br>";
echo "APP_ENV: " . $appEnv . "<br>";

$isLocal = false;
if ($host && (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false)) {
    $isLocal = true;
}
if ($appEnv && strtolower($appEnv) === 'local') {
    $isLocal = true;
}

echo "Is Local: " . ($isLocal ? 'YES' : 'NO') . "<br>";

// Test database connection
echo "<h3>Database Connection:</h3>";
try {
    $pdo = get_db_connection();
    echo "✅ Database connection successful!<br>";
    
    // Test a simple query
    $stmt = $pdo->query("SELECT 1 as test");
    $result = $stmt->fetch();
    echo "✅ Database query successful! Result: " . $result['test'] . "<br>";
    
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "<br>";
}

// Test mail configuration
echo "<h3>Mail Configuration:</h3>";
require_once __DIR__ . '/utils/mailer.php';

[$mail, $error] = buildGmailMailer();
if ($mail) {
    echo "✅ Mail configuration successful!<br>";
} else {
    echo "❌ Mail configuration failed: " . $error . "<br>";
}
?>
