<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/../utils/prebuilts_seed_util.php';

header('Content-Type: application/json');

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';

function get_authenticated_user_admin($pdo) {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (!isset($headers['Authorization'])) return null;
    $token = str_replace('Bearer ', '', $headers['Authorization']);
    $payload = verifyJWT($token);
    if (!$payload || !isset($payload['user_id'])) return null;
    $stmt = $pdo->prepare('SELECT u.*, GROUP_CONCAT(r.name) as roles FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = ? GROUP BY u.id');
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($user && $user['roles']) $user['roles'] = explode(',', $user['roles']);
    return $user ?: null;
}

switch ($method) {
    case 'GET':
        if ($action === 'seed_status') {
            $enabled = env('PREBUILTS_SEED_ENABLED', '0');
            $isEnabled = ($enabled === '1' || strtolower($enabled) === 'true');
            echo json_encode(['success' => true, 'enabled' => $isEnabled]);
            break;
        }
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
        break;
    case 'POST':
        if ($action === 'seed_prebuilts') {
            $enabled = env('PREBUILTS_SEED_ENABLED', '0');
            $isEnabled = ($enabled === '1' || strtolower($enabled) === 'true');
            if (!$isEnabled) {
                http_response_code(403);
                echo json_encode(['error' => 'Seeding is disabled by server configuration']);
                exit();
            }
            $user = get_authenticated_user_admin($pdo);
            // This call enforces Admin/Super Admin inside as well
            seed_prebuilts($pdo, $user);
            break; // seed_prebuilts echoes and exits
        }
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action']);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
