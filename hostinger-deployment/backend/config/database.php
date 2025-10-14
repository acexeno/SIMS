<?php
// Load environment helper
require_once __DIR__ . '/env.php';

function get_db_connection() {
    $host = env('DB_HOST', 'localhost');
    $db   = env('DB_NAME', 'builditpc_db');
    $user = env('DB_USER', 'root');
    $pass = env('DB_PASS', '');
    $port = env('DB_PORT', '3306');
    $charset = env('DB_CHARSET', 'utf8mb4');

    $makeDsn = function($h, $d, $p, $c) {
        $portPart = $p ? ";port=$p" : '';
        return "mysql:host=$h$portPart;dbname=$d;charset=$c";
    };

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $tryConnect = function($dsn) use ($user, $pass, $options) {
        return new PDO($dsn, $user, $pass, $options);
    };

    $debug = env('APP_DEBUG', '0');
    $dsn = $makeDsn($host, $db, $port, $charset);
    try {
        $pdo = $tryConnect($dsn);
    } catch (PDOException $e) {
        // Attempt Hostinger-style database name with prefix derived from DB_USER
        $altDb = null;
        $userPrefix = $user;
        if (strpos($userPrefix, '_') !== false) {
            $userPrefix = substr($userPrefix, 0, strpos($userPrefix, '_'));
        }
        // If DB_NAME doesn't already start with the prefix, try prefix + '_' + DB_NAME
        if ($userPrefix && strpos($db, $userPrefix . '_') !== 0) {
            $altDb = $userPrefix . '_' . $db;
        }
        // Also allow explicit DB_NAME_PREFIX env override
        $explicitPrefix = env('DB_NAME_PREFIX', '');
        if (!$altDb && $explicitPrefix) {
            $altDb = rtrim($explicitPrefix, '_') . '_' . $db;
        }

        if ($altDb) {
            try {
                $dsnAlt = $makeDsn($host, $altDb, $port, $charset);
                $pdo = $tryConnect($dsnAlt);
            } catch (PDOException $e2) {
                // Log detailed errors, return safe message unless debug
                error_log('[DB] Primary DSN failed: ' . $e->getMessage());
                error_log('[DB] Fallback DSN failed: ' . $e2->getMessage());
                http_response_code(500);
                $message = ($debug === '1' || strtolower($debug) === 'true')
                    ? ('Database connection failed: ' . $e2->getMessage())
                    : 'Database connection failed.';
                echo json_encode(['error' => $message]);
                exit();
            }
        } else {
            error_log('[DB] Primary DSN failed: ' . $e->getMessage());
            http_response_code(500);
            $message = ($debug === '1' || strtolower($debug) === 'true')
                ? ('Database connection failed: ' . $e->getMessage())
                : 'Database connection failed.';
            echo json_encode(['error' => $message]);
            exit();
        }
    }

    // Align MySQL session time zone (default to Philippines UTC+08:00)
    $dbTz = env('DB_TIMEZONE', '+08:00');
    try { $pdo->exec("SET time_zone = '" . $dbTz . "'"); } catch (Throwable $t) { /* ignore if not supported */ }
    return $pdo;
}
?>