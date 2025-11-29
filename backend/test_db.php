<?php
// Simple database connection test
require_once __DIR__ . '/config/env.php';

echo "Testing database connection...\n";

$host = env('DB_HOST', 'localhost');
$db   = env('DB_NAME', 'builditpc_db');
$user = env('DB_USER', 'root');
$pass = env('DB_PASS', '');
$port = env('DB_PORT', '3306');

echo "DB_HOST: $host\n";
echo "DB_NAME: $db\n";
echo "DB_USER: $user\n";
echo "DB_PASS: " . (empty($pass) ? '(empty)' : '(set)') . "\n";
echo "DB_PORT: $port\n";

try {
    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "✅ Database connection successful!\n";
} catch (PDOException $e) {
    echo "❌ Database connection failed: " . $e->getMessage() . "\n";
}
?>
