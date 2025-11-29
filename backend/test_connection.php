<?php
// Simple database connection test
require_once __DIR__ . '/config/database.php';

echo "<h2>Database Connection Test</h2>";

try {
    $pdo = get_db_connection();
    echo "✅ Database connection successful!<br>";
    
    // Test a simple query
    $stmt = $pdo->query("SELECT 1 as test");
    $result = $stmt->fetch();
    echo "✅ Database query successful! Result: " . $result['test'] . "<br>";
    
    // Check if users table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() > 0) {
        echo "✅ Users table exists<br>";
    } else {
        echo "❌ Users table not found<br>";
    }
    
} catch (Exception $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "<br>";
}
?>
