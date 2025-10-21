<?php
// Simple MySQL connection test
$host = 'localhost';
$user = 'root';
$pass = '';

echo "Testing MySQL connection...\n";

try {
    // Test connection without database
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "✅ Connected to MySQL server successfully\n";
    
    // List databases
    $stmt = $pdo->query('SHOW DATABASES');
    $databases = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "\nAvailable databases:\n";
    foreach ($databases as $db) {
        echo "- $db\n";
    }
    
} catch (PDOException $e) {
    echo "❌ Connection failed: " . $e->getMessage() . "\n";
    
    if ($e->getCode() == 2002) {
        echo "\nMake sure MySQL server is running.\n";
        echo "On XAMPP, you can start it from the XAMPP Control Panel.\n";
    } elseif ($e->getCode() == 1045) {
        echo "\nAccess denied. Check your MySQL username and password.\n";
    }
}
?>
