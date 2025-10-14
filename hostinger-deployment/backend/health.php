<?php
require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/env.php';

header('Content-Type: application/json');

$resp = [
    'app' => [
        'name' => env('APP_NAME', 'SIMS'),
        'timezone' => env('APP_TIMEZONE', 'Asia/Manila'),
        'debug' => env('APP_DEBUG', '0'),
    ],
    'db' => [
        // Do NOT expose password or full user
        'host' => env('DB_HOST', 'localhost'),
        'port' => env('DB_PORT', '3306'),
        'name' => env('DB_NAME', 'builditpc_db'),
        'user_prefix' => (function() {
            $u = env('DB_USER', '');
            if (!$u) return '';
            $pos = strpos($u, '_');
            return $pos !== false ? substr($u, 0, $pos) : $u;
        })(),
    ],
    'checks' => [],
];

try {
    $pdo = get_db_connection();
    $pdo->query('SELECT 1');
    $resp['checks']['db_connect'] = true;

    try {
        $currentDb = $pdo->query('SELECT DATABASE()')->fetchColumn();
        $resp['checks']['current_database'] = $currentDb;
        $hasTables = $pdo->query("SHOW TABLES LIKE 'components'")->rowCount() > 0;
        $resp['checks']['has_components_table'] = $hasTables;
        if ($hasTables) {
            $count = (int)$pdo->query('SELECT COUNT(*) FROM components')->fetchColumn();
            $resp['checks']['components_count'] = $count;
        }
    } catch (Throwable $t) {
        $resp['checks']['schema_error'] = $t->getMessage();
    }
} catch (Throwable $e) {
    http_response_code(500);
    $resp['checks']['db_connect'] = false;
    $resp['error'] = $e->getMessage();
    echo json_encode($resp);
    exit;
}

echo json_encode($resp);
