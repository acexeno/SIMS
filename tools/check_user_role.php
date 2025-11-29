<?php
// Quick script to check a specific user's role

// Determine if running in CLI mode
$isCli = php_sapi_name() === 'cli';

if ($isCli) {
    require_once __DIR__ . '/../backend/config/env.php';
    
    $host = env('DB_HOST', 'localhost');
    $db   = env('DB_NAME', 'builditpc_db');
    $user = env('DB_USER', 'root');
    $pass = env('DB_PASS', '');
    $port = env('DB_PORT', '3306');
    $charset = env('DB_CHARSET', 'utf8mb4');
    
    $isLocal = (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false);
    
    if ($isLocal && empty($pass)) {
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
    
    $pdo = new PDO($dsn, $user, $pass, $options);
    $pdo->exec("SET time_zone = '+08:00'");
} else {
    require_once __DIR__ . '/../backend/config/database.php';
    $pdo = get_db_connection();
}

// Check username1
$username = $argv[1] ?? 'username1';
echo "Checking user: $username\n\n";

$stmt = $pdo->prepare("
    SELECT u.id, u.username, u.email, u.role as user_role_column, GROUP_CONCAT(r.name) as roles_from_user_roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    WHERE u.username = ?
    GROUP BY u.id
");
$stmt->execute([$username]);
$user = $stmt->fetch();

if ($user) {
    echo "User found:\n";
    echo "  ID: {$user['id']}\n";
    echo "  Username: {$user['username']}\n";
    echo "  Email: {$user['email']}\n";
    echo "  Role column (users.role): " . ($user['user_role_column'] ?? 'NULL') . "\n";
    echo "  Roles from user_roles table: " . ($user['roles_from_user_roles'] ?? 'NULL') . "\n";
    
    if ($user['user_role_column'] === 'Customer' || strpos($user['roles_from_user_roles'] ?? '', 'Customer') !== false) {
        echo "\n  ⚠️  This user has 'Customer' role - needs fixing!\n";
    } else {
        echo "\n  ✓ Role is correct (Client or other valid role)\n";
    }
} else {
    echo "User '$username' not found in database.\n";
    
    // List all users with Customer role
    echo "\nChecking all users with 'Customer' role:\n";
    $stmt = $pdo->query("
        SELECT u.id, u.username, u.email, u.role
        FROM users u
        WHERE u.role = 'Customer'
    ");
    $customers = $stmt->fetchAll();
    
    if (count($customers) > 0) {
        foreach ($customers as $c) {
            echo "  - ID: {$c['id']}, Username: {$c['username']}, Email: {$c['email']}\n";
        }
    } else {
        echo "  No users found with 'Customer' role.\n";
    }
}
?>

