<?php
require_once __DIR__ . '/../backend/config/cors.php';
require_once __DIR__ . '/../backend/config/env.php';
require_once __DIR__ . '/../backend/config/security.php';
// require_once __DIR__ . '/../middleware/simple_security_middleware.php';

// Ensure application timezone is set (default to Philippines)
$appTz = env('APP_TIMEZONE', 'Asia/Manila');
@date_default_timezone_set($appTz);

// Set security headers
setSecurityHeaders();

// main API router for SIMS

// all other requests will continue from here

// basic error reporting and exception handling
// Control error visibility via APP_DEBUG env var
$appDebug = env('APP_DEBUG', '0');
if ($appDebug === '1' || strtolower($appDebug) === 'true') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
    ini_set('display_errors', '0');
}

// --- Component stock per-branch (Admin/Super Admin only) ---
function handleGetComponentStock($pdo) {
    requireAdminOrSuperAdmin();
    $componentId = isset($_GET['component_id']) ? (int)$_GET['component_id'] : 0;
    if ($componentId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid component_id']);
        return;
    }
    try {
        // Fetch total from components
        $stmt = $pdo->prepare('SELECT id, name, stock_quantity FROM components WHERE id = ?');
        $stmt->execute([$componentId]);
        $comp = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$comp) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Component not found']);
            return;
        }
        // Fetch branches and per-branch stock if tables exist
        $rows = [];
        try {
            $sql = "SELECT b.id as branch_id, b.code, b.name, COALESCE(s.stock_quantity, 0) as stock_quantity
                    FROM branches b
                    LEFT JOIN component_branch_stock s ON s.branch_id = b.id AND s.component_id = :cid
                    WHERE b.is_active = 1
                    ORDER BY b.id ASC";
            $q = $pdo->prepare($sql);
            $q->execute([':cid' => $componentId]);
            $rows = $q->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $t) {
            // If branches table does not exist, return empty list
            $rows = [];
        }
        echo json_encode(['success' => true, 'data' => [
            'component' => $comp,
            'branches' => $rows
        ]]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
set_exception_handler(function($exception) {
    http_response_code(500);
    // The cors.php file already set the Content-Type to json
    error_log($exception->getMessage() . ' in ' . $exception->getFile() . ' on line ' . $exception->getLine());
    echo json_encode([
        'error' => 'An internal server error occurred.',
        'message' => $exception->getMessage()
    ]);
    exit;
});

// include all the files we need
require_once __DIR__ . '/../backend/config/database.php';
$pdo = get_db_connection();

// Initialize simple security middleware (temporarily disabled)
// initSimpleSecurityMiddleware($pdo);

require_once __DIR__ . '/../backend/utils/jwt_helper.php';
require_once __DIR__ . '/../backend/utils/branch_helper.php';
require_once __DIR__ . '/../backend/api/auth.php'; // has all the auth functions
require_once __DIR__ . '/../backend/api/builds.php'; // has all the build functions
require_once __DIR__ . '/../backend/api/notifications.php'; // has all the notification functions
require_once __DIR__ . '/../backend/api/dashboard.php'; // has all the dashboard data functions
require_once __DIR__ . '/../backend/api/orders.php'; // sales/orders endpoints
require_once __DIR__ . '/../backend/api/otp.php'; // OTP endpoints (request/verify)
require_once __DIR__ . '/../backend/api/mail.php'; // Mail test endpoint (admin only)

// debug: check if builds functions are loaded
// error_log("API Router: Checking if builds functions are loaded...");
// error_log("handleCreateBuild exists: " . (function_exists('handleCreateBuild') ? 'YES' : 'NO'));
// error_log("handleGetBuilds exists: " . (function_exists('handleGetBuilds') ? 'YES' : 'NO'));
// error_log("handlePing exists: " . (function_exists('handlePing') ? 'YES' : 'NO'));

// helper to normalize and figure out brand and socket for CPUs and motherboards
function normalizeComponent(&$component) {
    // Normalize brand
    $brand = '';
    if (!empty($component['brand'])) $brand = strtolower($component['brand']);
    else if (!empty($component['name'])) $brand = strtolower($component['name']);
    else if (!empty($component['model'])) $brand = strtolower($component['model']);
    else if (!empty($component['type'])) $brand = strtolower($component['type']);
    if (strpos($brand, 'amd') !== false) $component['brand'] = 'AMD';
    else if (strpos($brand, 'intel') !== false) $component['brand'] = 'Intel';
    // Normalize socket
    $socket = '';
    if (!empty($component['socket'])) $socket = strtolower($component['socket']);
    else if (!empty($component['type'])) $socket = strtolower($component['type']);
    else if (!empty($component['model'])) $socket = strtolower($component['model']);
    else if (!empty($component['name'])) $socket = strtolower($component['name']);
    // Be tolerant of common typos and formatting: amd4 => AM4, amd5 => AM5, am-4 => AM4, etc.
    $socket_norm = str_replace([' ', '-', '_'], '', $socket);
    if (strpos($socket_norm, 'am4') !== false || strpos($socket_norm, 'amd4') !== false) $component['socket'] = 'AM4';
    else if (strpos($socket_norm, 'am5') !== false || strpos($socket_norm, 'amd5') !== false) $component['socket'] = 'AM5';
    else if (strpos($socket, 'lga1200') !== false) $component['socket'] = 'LGA1200';
    else if (strpos($socket, 'lga1700') !== false) $component['socket'] = 'LGA1700';
    // Also check specs if present
    if (isset($component['specs']) && is_object($component['specs'])) {
        if (empty($component['brand']) && !empty($component['specs']->brand)) {
            $component['brand'] = $component['specs']->brand;
        }
        if (empty($component['socket']) && !empty($component['specs']->socket)) {
            $component['socket'] = $component['specs']->socket;
        }
    }
    // Re-normalize socket if it was filled from specs
    if (!empty($component['socket'])) {
        $s = strtolower($component['socket']);
        // strip spaces, hyphens, underscores before matching
        $s_clean = str_replace([' ', '-', '_'], '', $s);
        if (strpos($s_clean, 'am4') !== false || strpos($s_clean, 'amd4') !== false) $component['socket'] = 'AM4';
        else if (strpos($s_clean, 'am5') !== false || strpos($s_clean, 'amd5') !== false) $component['socket'] = 'AM5';
        else if (strpos($s, 'lga1200') !== false) $component['socket'] = 'LGA1200';
        else if (strpos($s, 'lga1700') !== false) $component['socket'] = 'LGA1700';
        else if (strpos($s, 'lga1151') !== false) $component['socket'] = 'LGA1151';
        else if (strpos($s, 'lga2066') !== false) $component['socket'] = 'LGA2066';
    }

    // Normalize form factor
    $ff = '';
    if (!empty($component['form_factor'])) $ff = strtolower(trim($component['form_factor']));
    else if (isset($component['specs']) && is_object($component['specs']) && !empty($component['specs']->form_factor)) {
        $ff = strtolower(trim($component['specs']->form_factor));
    }
    if (!empty($ff)) {
        $ff = str_replace(['_', ' '], '-', $ff);
        if (in_array($ff, ['micro-atx','matx','m-atx','u-atx','uatx','microatx'])) $component['form_factor'] = 'Micro-ATX';
        else if (in_array($ff, ['mini-itx','mitx','miniitx'])) $component['form_factor'] = 'Mini-ITX';
        else if (in_array($ff, ['e-atx','eatx'])) $component['form_factor'] = 'E-ATX';
        else if (strpos($ff, 'micro') !== false && strpos($ff, 'atx') !== false) $component['form_factor'] = 'Micro-ATX';
        else if (strpos($ff, 'mini') !== false && strpos($ff, 'itx') !== false) $component['form_factor'] = 'Mini-ITX';
        else if (strpos($ff, 'atx') !== false) $component['form_factor'] = 'ATX';
    }
}

// --- Component CRUD (Admin/Super Admin) ---
function requireAdminOrSuperAdmin() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
    $decoded = verifyJWT($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
        exit;
    }
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    if (!(in_array('Admin', $roles) || in_array('Super Admin', $roles))) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
        exit;
    }
    return (object)$decoded;
}

function handleCreateComponent($pdo) {
    requireAdminOrSuperAdmin();
    $input = json_decode(file_get_contents('php://input'), true);
    $name = trim($input['name'] ?? '');
    $category_id = isset($input['category_id']) ? (int)$input['category_id'] : 0;
    $brand = isset($input['brand']) ? trim($input['brand']) : null;
    $price = isset($input['price']) ? (float)$input['price'] : 0.0;
    $stock_quantity = isset($input['stock_quantity']) ? (int)$input['stock_quantity'] : 0;
    $image_url = isset($input['image_url']) ? trim($input['image_url']) : null;

    if ($name === '' || $category_id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing or invalid name/category_id']);
        return;
    }

    $stmt = $pdo->prepare("INSERT INTO components (name, category_id, brand, price, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$name, $category_id, $brand, $price, $stock_quantity, $image_url]);

    $id = (int)$pdo->lastInsertId();
    // Return created component data
    $fetch = $pdo->prepare("SELECT * FROM components WHERE id = ?");
    $fetch->execute([$id]);
    $component = $fetch->fetch(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $component]);
}

function handleUpdateComponent($pdo) {
    requireAdminOrSuperAdmin();
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        return;
    }

    $fields = [];
    $values = [];
    $allowed = ['name', 'category_id', 'brand', 'price', 'stock_quantity', 'image_url'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $input)) {
            $fields[] = "$f = ?";
            $values[] = $input[$f];
        }
    }
    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No fields to update']);
        return;
    }
    $values[] = $id;
    $sql = 'UPDATE components SET ' . implode(', ', $fields) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($values);

    // Return updated component
    $fetch = $pdo->prepare("SELECT * FROM components WHERE id = ?");
    $fetch->execute([$id]);
    $component = $fetch->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $component]);
}

function handleDeleteComponent($pdo) {
    requireAdminOrSuperAdmin();
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        return;
    }

    // Soft delete: mark as inactive
    $stmt = $pdo->prepare("UPDATE components SET is_active = 0 WHERE id = ?");
    $stmt->execute([$id]);

    echo json_encode(['success' => true]);
}

// --- User Management Functions ---
function handleGetUsers($pdo) {
    // Verify admin or super admin access
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    try {
        // Verify token and get requester data
        $decoded = verifyJWT($token);
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
            return;
        }

        // Ensure requester has Admin or Super Admin role
        $roles = $decoded['roles'] ?? [];
        if (is_string($roles)) $roles = explode(',', $roles);
        if (!(in_array('Admin', $roles) || in_array('Super Admin', $roles))) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
            return;
        }

        // Fetch all users except the current user and clients, including aggregated roles
        $stmt = $pdo->prepare("SELECT 
                u.id, u.username, u.email, u.is_active, u.last_login,
                u.can_access_inventory, u.can_access_orders, u.can_access_chat_support,
                GROUP_CONCAT(r.name) AS roles
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id != ? AND NOT EXISTS (
                SELECT 1 FROM user_roles ur2 
                JOIN roles r2 ON ur2.role_id = r2.id 
                WHERE ur2.user_id = u.id AND r2.name = 'Client'
            )
            GROUP BY u.id");
        $stmt->execute([$decoded['user_id']]);
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format the response
        $formattedUsers = array_map(function($user) {
            return [
                'id' => (int)$user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'roles' => $user['roles'] ? explode(',', $user['roles']) : [],
                'is_active' => (bool)$user['is_active'],
                'last_login' => $user['last_login'],
                'can_access_inventory' => (int)$user['can_access_inventory'] === 1,
                'can_access_orders' => (int)$user['can_access_orders'] === 1,
                'can_access_chat_support' => (int)$user['can_access_chat_support'] === 1
            ];
        }, $users);

        echo json_encode(['success' => true, 'data' => $formattedUsers]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch users: ' . $e->getMessage()]);
    }
}

// --- component functions ---
function handleGetComponents($pdo) {
    $categoryName = $_GET['category'] ?? '';
    if (empty($categoryName)) {
        // Debug: missing category param
        error_log("handleGetComponents: missing 'category' query parameter");
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Category not specified']);
        return;
    }

    // Debug: log requested category
    error_log("handleGetComponents: requested category='" . $categoryName . "'");

    // Normalize legacy/alias category labels to canonical names used in DB
    $aliases = [
        'procie only'   => 'CPU',
        'processor'     => 'CPU',
        'cpu'           => 'CPU',
        'mobo'          => 'Motherboard',
        'motherboard'   => 'Motherboard',
        'gpu'           => 'GPU',
        'graphics card' => 'GPU',
        'ram 3200mhz'   => 'RAM',
        'memory'        => 'RAM',
        'ssd nvme'      => 'Storage',
        'storage'       => 'Storage',
        'psu - tr'      => 'PSU',
        'power supply'  => 'PSU',
        'psu'           => 'PSU',
        'case gaming'   => 'Case',
        'case'          => 'Case',
        'aio'           => 'Cooler',
        'cooling'       => 'Cooler',
        'cooler'        => 'Cooler',
    ];
    $key = strtolower(trim($categoryName));
    if (isset($aliases[$key])) {
        $categoryName = $aliases[$key];
        error_log("handleGetComponents: normalized category to '" . $categoryName . "'");
    }

    // find the category ID from the name, case-insensitively
    $stmt = $pdo->prepare("SELECT id FROM component_categories WHERE UPPER(name) = UPPER(?)");
    $stmt->execute([$categoryName]);
    $category = $stmt->fetch();

    if (!$category) {
        // Debug: log available categories for quick inspection
        try {
            $available = $pdo->query("SELECT name FROM component_categories ORDER BY name ASC")
                              ->fetchAll(PDO::FETCH_COLUMN);
            error_log("handleGetComponents: category not found: '" . $categoryName . "'. Available: " . implode(', ', $available));
        } catch (Throwable $t) {
            error_log("handleGetComponents: failed to list available categories: " . $t->getMessage());
            $available = [];
        }
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Category not found',
            'debug' => [
                'requested_category' => $categoryName,
                'available_categories' => $available
            ]
        ]);
        return;
    }

    // Branch-aware fetch: when branch or branch_id provided, override stock by branch rows
    $branchCode = $_GET['branch'] ?? null;
    $branchIdParam = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : null;
    $branchId = null;
    if ($branchIdParam && $branchIdParam > 0) {
        $branchId = $branchIdParam;
    } elseif (!empty($branchCode)) {
        $branchId = get_branch_id_by_code($pdo, $branchCode);
    }

    if ($branchId) {
        $sql = "SELECT c.id, c.name, c.category_id, c.brand, c.price, c.image_url, c.specs, c.is_active,
                       COALESCE(s.stock_quantity, 0) AS stock_quantity
                FROM components c
                LEFT JOIN component_branch_stock s
                  ON s.component_id = c.id AND s.branch_id = :branch
                WHERE c.category_id = :cat AND (c.is_active IS NULL OR c.is_active = 1)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':branch' => $branchId, ':cat' => $category['id']]);
        $components = $stmt->fetchAll();
    } else {
        // grab all active components for that category
        $stmt = $pdo->prepare("SELECT * FROM components WHERE category_id = ? AND (is_active IS NULL OR is_active = 1)");
        $stmt->execute([$category['id']]);
        $components = $stmt->fetchAll();
    }

    // Debug: log count
    error_log("handleGetComponents: category_id=" . $category['id'] . ", component_count=" . count($components));

    // decode specs JSON string into an object for each component and normalize
    foreach ($components as &$component) {
        if (isset($component['specs']) && is_string($component['specs'])) {
            $component['specs'] = json_decode($component['specs']);
        }
        normalizeComponent($component);
    }

    echo json_encode(['success' => true, 'data' => $components]);
}

// --- Routing Logic ---
$method = $_SERVER['REQUEST_METHOD'];

// Route based on the 'endpoint' query parameter
$endpoint = strtolower($_GET['endpoint'] ?? '');

// Security check for all requests (temporarily disabled for testing)
// checkSimpleSecurity($endpoint);

// Debug logging
// error_log("API Router Debug - Method: $method, Endpoint: '$endpoint', GET params: " . json_encode($_GET));

if (empty($endpoint)) {
    http_response_code(400);
    echo json_encode(['error' => 'Endpoint not specified']);
    exit;
}

// Route based on the endpoint
switch ($endpoint) {
    case 'register':
        if ($method === 'POST') {
            handleRegister($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'login':
        if ($method === 'POST') {
            handleLogin($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'profile':
        if ($method === 'GET') {
            handleGetProfile($pdo);
        } elseif ($method === 'PUT') {
            handleUpdateProfile($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'password':
        if ($method === 'PUT') {
            handleChangePassword($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;
        
    case 'verify':
        if ($method === 'GET') {
            handleVerifyToken($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'logout':
        if ($method === 'POST') {
            handleLogout();
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'refresh':
        if ($method === 'POST') {
            handleRefreshToken($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'otp_request':
        if ($method === 'POST') {
            handleOtpRequest($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'otp_verify':
        if ($method === 'POST') {
            handleOtpVerify($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'get_users':
        if ($method === 'GET') {
            handleGetUsers($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'assign_role':
        if ($method === 'POST') {
            // Minimal secure handler inline to avoid another include
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? null);
            if (!$authHeader) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Unauthorized']); break; }
            $token = preg_replace('/^Bearer\s+/i','',$authHeader);
            $decoded = verifyJWT($token);
            if (!$decoded) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Invalid token']); break; }
            $roles = $decoded['roles'] ?? [];
            if (is_string($roles)) $roles = explode(',', $roles);
            if (!in_array('Super Admin', $roles)) { http_response_code(403); echo json_encode(['success'=>false,'error'=>'Forbidden']); break; }
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $userId = isset($input['user_id']) ? (int)$input['user_id'] : 0;
            $roleName = trim((string)($input['role'] ?? ''));
            if ($userId <= 0 || $roleName === '') { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid input']); break; }
            // Find role id
            $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = ?');
            $stmt->execute([$roleName]);
            $r = $stmt->fetch();
            if (!$r) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'Role not found']); break; }
            // Upsert mapping (avoid duplicates)
            $exists = $pdo->prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?');
            $exists->execute([$userId, $r['id']]);
            if (!$exists->fetch()) {
                $ins = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
                $ins->execute([$userId, $r['id']]);
            }
            echo json_encode(['success'=>true]);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'components':
        if ($method === 'GET') {
            handleGetComponents($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'component_stock':
        if ($method === 'GET') {
            handleGetComponentStock($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'create_component':
        if ($method === 'POST') {
            handleCreateComponent($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'update_component':
        if ($method === 'POST') {
            handleUpdateComponent($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'delete_component':
        if ($method === 'POST') {
            handleDeleteComponent($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'notifications':
        // Route notifications requests to the notifications.php handlers
        switch ($method) {
            case 'GET':
                if (isset($_GET['count'])) {
                    handleGetUnreadCount($pdo);
                } else {
                    handleGetNotifications($pdo);
                }
                break;
            case 'POST':
                handleCreateNotification($pdo);
                break;
            case 'PUT':
                if (isset($_GET['action']) && $_GET['action'] === 'mark-all-read') {
                    handleMarkAllAsRead($pdo);
                } else {
                    handleMarkAsRead($pdo);
                }
                break;
            case 'DELETE':
                handleDeleteNotification($pdo);
                break;
            default:
                http_response_code(405);
                echo json_encode(['error' => 'Method Not Allowed']);
                break;
        }
        break;

    case 'builds':
        // Debug logging for builds endpoint
        // error_log("BUILDS ENDPOINT: Method=$method, GET params=" . json_encode($_GET));
        
        // Check if required functions are defined
        if (!function_exists('handleCreateBuild')) {
            // error_log("BUILDS ERROR: handleCreateBuild function not found!");
            http_response_code(500);
            echo json_encode(['error' => 'Server configuration error: builds functions not loaded']);
            break;
        }
        
        // Route builds requests to the builds.php handlers
        switch ($method) {
            case 'GET':
                // error_log("BUILDS: Handling GET request");
                if (isset($_GET['test'])) {
                    if ($_GET['test'] === 'auth') {
                        // error_log("BUILDS: Calling handleTestAuth");
                        handleTestAuth($pdo);
                    } else if ($_GET['test'] === 'ping') {
                        // error_log("BUILDS: Calling handlePing");
                        handlePing();
                    } else {
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid test parameter']);
                    }
                } else if (isset($_GET['public'])) {
                    // error_log("BUILDS: Calling handleGetPublicBuilds");
                    handleGetPublicBuilds($pdo);
                } else {
                    // error_log("BUILDS: Calling handleGetBuilds");
                    handleGetBuilds($pdo);
                }
                break;
            case 'POST':
                // error_log("BUILDS: Calling handleCreateBuild");
                handleCreateBuild($pdo);
                break;
            case 'PUT':
                // error_log("BUILDS: Calling handleUpdateBuild");
                handleUpdateBuild($pdo);
                break;
            case 'DELETE':
                // error_log("BUILDS: Calling handleDeleteBuild");
                handleDeleteBuild($pdo);
                break;
            default:
                // error_log("BUILDS: Method not allowed: $method");
                http_response_code(405);
                echo json_encode(['error' => 'Method Not Allowed']);
                break;
        }
        break;

    case 'dashboard':
        if ($method === 'GET') {
            handleGetDashboardData($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'orders':
        // Sales module: record transactions and fetch orders
        if ($method === 'GET') {
            if (isset($_GET['id'])) {
                handleGetOrder($pdo);
            } else {
                handleGetOrders($pdo);
            }
        } elseif ($method === 'POST') {
            handleCreateOrder($pdo);
        } elseif ($method === 'PUT') {
            handleUpdateOrderStatus($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'categories':
        if ($method === 'GET') {
            $stmt = $pdo->query('SELECT id, name FROM component_categories ORDER BY name ASC');
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $categories]);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'update_inventory_access':
        if ($method === 'PUT') {
            handleUpdateInventoryAccess($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'update_order_access':
        if ($method === 'PUT') {
            handleUpdateOrderAccess($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'update_chat_support_access':
        if ($method === 'PUT') {
            handleUpdateChatSupportAccess($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'mail_test':
        if ($method === 'POST') {
            handleMailTest($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    // Add component-related routes here if needed, or point to another file
    // e.g., case 'components': include 'components.php'; break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
} 