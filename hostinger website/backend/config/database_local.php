<?php
// Local development database configuration
// This is used when running on localhost

function get_local_db_connection() {
    $host = 'localhost';
    $db   = 'builditpc_db';  // Your local database name
    $user = 'root';          // Your local database user
    $pass = '';              // Your local database password (usually empty for XAMPP)
    $port = '3306';
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
    
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, $user, $pass, $options);
        
        // Set timezone
        $pdo->exec("SET time_zone = '+08:00'");
        
        return $pdo;
    } catch (PDOException $e) {
        error_log('[DB] Local connection failed: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Local database connection failed: ' . $e->getMessage()]);
        exit();
    }
}
?>
