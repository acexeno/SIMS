<?php
// Production index.php - Main API Router for Hostinger

// Load security configuration FIRST so CSP headers are set for all requests (including HTML pages)
require_once __DIR__ . '/backend/config/env.php';
require_once __DIR__ . '/backend/config/security_config.php';

// Check if this is a root request without endpoint - serve index.html first
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
// Clean endpoint parameter - handle malformed URLs like ?endpoint=prebuilts?all=1
$rawEndpoint = $_GET['endpoint'] ?? '';
// Remove any query parameters that might be embedded in the endpoint (fix for malformed URLs)
$endpointParts = explode('?', $rawEndpoint);
$endpoint = strtolower(trim($endpointParts[0]));

// If there are additional parameters embedded in the endpoint string, parse them
// Example: ?endpoint=prebuilts?all=1 should set $_GET['all'] = '1'
if (count($endpointParts) > 1) {
    $embeddedQuery = $endpointParts[1];
    parse_str($embeddedQuery, $embeddedParams);
    foreach ($embeddedParams as $key => $value) {
        if (!isset($_GET[$key])) {
            $_GET[$key] = $value;
        }
    }
}

// Also handle case where endpoint might have query string in REQUEST_URI
// Parse the full REQUEST_URI to catch any additional query parameters
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$parsedUri = parse_url($requestUri);
if (isset($parsedUri['query'])) {
    parse_str($parsedUri['query'], $uriParams);
    // Merge URI params into $_GET (don't override existing)
    foreach ($uriParams as $key => $value) {
        if (!isset($_GET[$key])) {
            $_GET[$key] = $value;
        }
    }
}

// If root request (/) without endpoint, serve index.html immediately
if (empty($endpoint) && ($requestUri === '/' || $requestUri === '' || parse_url($requestUri, PHP_URL_PATH) === '/')) {
    // Check if this is an API request (has Accept: application/json header or POST/PUT/DELETE)
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $acceptHeader = $headers['Accept'] ?? ($headers['accept'] ?? '');
    $isApiRequest = (
        strpos($acceptHeader, 'application/json') !== false ||
        in_array($method, ['POST', 'PUT', 'DELETE']) ||
        !empty($_GET['endpoint']) ||
        strpos($requestUri, '/api/') === 0
    );
    
    if (!$isApiRequest) {
        // Serve index.html for root requests
        // CSP headers are already set by applySecurityConfiguration() above
        if (file_exists(__DIR__ . '/index.html')) {
            header('Content-Type: text/html; charset=utf-8');
            readfile(__DIR__ . '/index.html');
            exit;
        }
    }
}

// Load configuration files for API requests
require_once __DIR__ . '/backend/config/cors.php';
require_once __DIR__ . '/backend/config/security.php';

// Ensure application timezone is set (default to Philippines)
$appTz = env('APP_TIMEZONE', 'Asia/Manila');
@date_default_timezone_set($appTz);

// Set security headers
setSecurityHeaders();

// Set JSON header AFTER all other headers to ensure API responses are always JSON
// This must come after CORS to ensure JSON content type is set
header('Content-Type: application/json; charset=utf-8');

// Basic error reporting and exception handling
// Control error visibility via APP_DEBUG env var
$appDebug = env('APP_DEBUG', '0');
if ($appDebug === '1' || strtolower($appDebug) === 'true') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
    ini_set('display_errors', '0');
}

// Set exception handler
set_exception_handler(function($exception) {
    http_response_code(500);
    error_log($exception->getMessage() . ' in ' . $exception->getFile() . ' on line ' . $exception->getLine());
    echo json_encode([
        'error' => 'An internal server error occurred.',
        'message' => $exception->getMessage()
    ]);
    exit;
});

// Include all required files
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();

require_once __DIR__ . '/backend/utils/jwt_helper.php';
require_once __DIR__ . '/backend/utils/branch_helper.php';
require_once __DIR__ . '/backend/api/auth.php';
require_once __DIR__ . '/backend/api/builds.php';
require_once __DIR__ . '/backend/api/notifications.php';
require_once __DIR__ . '/backend/api/dashboard.php';
require_once __DIR__ . '/backend/api/orders.php';
require_once __DIR__ . '/backend/api/otp.php';
require_once __DIR__ . '/backend/api/mail.php';

// Prebuilts helper functions (from backend/api/prebuilts.php)
if (!function_exists('get_authenticated_user')) {
    function get_authenticated_user($pdo) {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        if (!isset($headers['Authorization']) && isset($headers['authorization'])) {
            $headers['Authorization'] = $headers['authorization'];
        }
        if (!isset($headers['Authorization'])) return null;
        $token = str_replace('Bearer ', '', $headers['Authorization']);
        $payload = verifyJWT($token);
        if (!$payload || !isset($payload['user_id'])) return null;
        $stmt = $pdo->prepare('SELECT u.*, GROUP_CONCAT(r.name) as roles FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = ? GROUP BY u.id');
        $stmt->execute([$payload['user_id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user && $user['roles']) $user['roles'] = explode(',', $user['roles']);
        return $user;
    }
}

if (!function_exists('normalize_roles_array')) {
    function normalize_roles_array($roles) {
        if (is_string($roles)) {
            $roles = array_map('trim', explode(',', $roles));
        }
        return is_array($roles) ? $roles : [];
    }
}

if (!function_exists('is_admin_or_superadmin')) {
    function is_admin_or_superadmin($user) {
        if (!$user) return false;
        $roles = normalize_roles_array($user['roles'] ?? []);
        return in_array('Super Admin', $roles) || in_array('Admin', $roles);
    }
}

if (!function_exists('require_admin_or_superadmin')) {
    function require_admin_or_superadmin($user) {
        if (!is_admin_or_superadmin($user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Admin or Super Admin access required']);
            exit();
        }
    }
}

if (!function_exists('has_prebuilt_management_role')) {
    function has_prebuilt_management_role($user) {
        if (!$user) return false;
        $roles = normalize_roles_array($user['roles'] ?? []);
        return in_array('Super Admin', $roles) || in_array('Admin', $roles) || in_array('Employee', $roles);
    }
}

if (!function_exists('require_prebuilt_management_role')) {
    function require_prebuilt_management_role($user) {
        if (!has_prebuilt_management_role($user)) {
            http_response_code(403);
            echo json_encode(['error' => 'Employee, Admin, or Super Admin access required']);
            exit();
        }
    }
}

// Helper to normalize component data
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

// Admin/Super Admin requirement function
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

// Component CRUD functions
function handleGetComponentStock($pdo) {
    requireAdminOrSuperAdmin();
    $componentId = isset($_GET['component_id']) ? (int)$_GET['component_id'] : 0;
    if ($componentId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid component_id']);
        return;
    }
    try {
        $stmt = $pdo->prepare('SELECT id, name, stock_quantity FROM components WHERE id = ?');
        $stmt->execute([$componentId]);
        $comp = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$comp) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Component not found']);
            return;
        }
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

    $fetch = $pdo->prepare("SELECT * FROM components WHERE id = ?");
    $fetch->execute([$id]);
    $component = $fetch->fetch(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'data' => $component]);
}

function handleDeleteComponent($pdo) {
    $user = requireAdminOrSuperAdmin();
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    if (!is_array($input)) {
        $input = [];
    }
    // Accept id from JSON body, form body, or query string, with multiple key aliases
    $candidates = [
        $input['id']            ?? null,
		// Accept original_id as alias to align with backend/api/index.php behavior
		$input['original_id']   ?? null,
		$_POST['original_id']   ?? null,
		$_GET['original_id']    ?? null,
        $input['component_id']  ?? null,
        $input['componentId']   ?? null,
        $_POST['id']            ?? null,
        $_POST['component_id']  ?? null,
        $_POST['componentId']   ?? null,
        $_GET['id']             ?? null,
        $_GET['component_id']   ?? null,
        $_GET['componentId']    ?? null,
    ];
    $idParam = null;
    foreach ($candidates as $candidate) {
        if ($candidate === null) continue;
        if (is_numeric($candidate)) { $idParam = $candidate; break; }
        // Handle accidental string like "1168 " or "#1168"
        if (preg_match('/(\d{1,10})/', (string)$candidate, $m)) { $idParam = $m[1]; break; }
    }
    $id = is_numeric($idParam) ? (int)$idParam : 0;
    // Fallback: handle plain text bodies like "1168"
    if ($id <= 0 && is_string($rawInput) && preg_match('/^\s*\\#?\\s*(\\d{1,10})\\s*$/', $rawInput, $m)) {
        $id = (int)$m[1];
    }
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
        if ($checkTable->rowCount() === 0) {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS archive_components (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    original_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    category_id INT NOT NULL,
                    brand VARCHAR(100),
                    model VARCHAR(100),
                    price DECIMAL(10,2) NOT NULL,
                    stock_quantity INT DEFAULT 0,
                    min_stock_level INT DEFAULT 5,
                    image_url VARCHAR(500),
                    specs LONGTEXT,
                    socket VARCHAR(50),
                    cores INT,
                    threads INT,
                    tdp INT,
                    ram_type VARCHAR(20),
                    form_factor VARCHAR(20),
                    memory VARCHAR(50),
                    speed VARCHAR(20),
                    capacity VARCHAR(50),
                    wattage INT,
                    efficiency VARCHAR(20),
                    fans INT,
                    type VARCHAR(50),
                    warranty VARCHAR(100) NULL,
                    is_active TINYINT(1) DEFAULT 1,
                    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_by INT NULL,
                    created_at TIMESTAMP NULL,
                    updated_at TIMESTAMP NULL,
                    INDEX idx_original_id (original_id),
                    INDEX idx_deleted_at (deleted_at),
                    INDEX idx_category_id (category_id),
                    FOREIGN KEY (category_id) REFERENCES component_categories(id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
        }
        
        $fetchStmt = $pdo->prepare("SELECT * FROM components WHERE id = ?");
        $fetchStmt->execute([$id]);
        $component = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$component) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Component not found']);
            return;
        }
        
        $deletedBy = isset($user->user_id) ? (int)$user->user_id : null;
        
        $archiveStmt = $pdo->prepare("
            INSERT INTO archive_components (
                original_id, name, category_id, brand, model, price, stock_quantity, 
                min_stock_level, image_url, specs, socket, cores, threads, tdp,
                ram_type, form_factor, memory, speed, capacity, wattage, 
                efficiency, fans, type, warranty, is_active,
                deleted_by, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                ?, ?, ?, ?, ?, ?, ?, ?
            )
        ");
        
        $createdAt = null;
        if (!empty($component['created_at'])) {
            $timestamp = strtotime($component['created_at']);
            if ($timestamp !== false) {
                $createdAt = date('Y-m-d H:i:s', $timestamp);
            }
        }
        
        $updatedAt = null;
        if (!empty($component['updated_at'])) {
            $timestamp = strtotime($component['updated_at']);
            if ($timestamp !== false) {
                $updatedAt = date('Y-m-d H:i:s', $timestamp);
            }
        }
        
        $archiveStmt->execute([
            $component['id'], $component['name'], $component['category_id'],
            $component['brand'] ?? null, $component['model'] ?? null, $component['price'],
            $component['stock_quantity'] ?? 0, $component['min_stock_level'] ?? 5,
            $component['image_url'] ?? null, $component['specs'] ?? null,
            $component['socket'] ?? null, $component['cores'] ?? null,
            $component['threads'] ?? null, $component['tdp'] ?? null,
            $component['ram_type'] ?? null, $component['form_factor'] ?? null,
            $component['memory'] ?? null, $component['speed'] ?? null,
            $component['capacity'] ?? null, $component['wattage'] ?? null,
            $component['efficiency'] ?? null, $component['fans'] ?? null,
            $component['type'] ?? null, $component['warranty'] ?? null,
            $component['is_active'] ?? 1, $deletedBy, $createdAt, $updatedAt
        ]);
        
        $deleteStmt = $pdo->prepare("DELETE FROM components WHERE id = ?");
        $deleteStmt->execute([$id]);
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Component moved to archive']);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Error archiving component: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to archive component: ' . $e->getMessage()]);
    }
}

function handleGetArchivedComponents($pdo) {
    requireAdminOrSuperAdmin();
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
        if ($checkTable->rowCount() === 0) {
            echo json_encode(['success' => true, 'data' => []]);
            return;
        }
        
        $stmt = $pdo->prepare("
            SELECT 
                a.*,
                c.name as category_name
            FROM archive_components a
            LEFT JOIN component_categories c ON a.category_id = c.id
            ORDER BY a.deleted_at DESC
        ");
        $stmt->execute();
        $archived = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $archived]);
    } catch (Exception $e) {
        error_log("Error fetching archived components: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to fetch archived components: ' . $e->getMessage()]);
    }
}

function handleRestoreComponent($pdo) {
    $user = requireAdminOrSuperAdmin();
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    if (!is_array($input)) {
        $input = [];
    }
    // Accept id from JSON body, form body, or query string. Also allow original_id as fallback.
    $idParam = $input['id'] ?? ($_POST['id'] ?? ($_GET['id'] ?? null));
    $originalIdParam = $input['original_id'] ?? ($_POST['original_id'] ?? ($_GET['original_id'] ?? null));
    $id = is_numeric($idParam) ? (int)$idParam : null; // allow 0 as a valid archive id
    $originalId = is_numeric($originalIdParam) ? (int)$originalIdParam : 0;
    
    if ($id === null && $originalId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id. Provide a valid archived id or original_id']);
        return;
    }
    
    $pdo->beginTransaction();
    try {
        $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
        if ($checkTable->rowCount() === 0) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Archive table not found']);
            return;
        }
        
        // Fetch archived component either by archive row id or by original_id
        if ($id !== null) {
            $fetchStmt = $pdo->prepare("SELECT * FROM archive_components WHERE id = ?");
            $fetchStmt->execute([$id]);
        } else {
            $fetchStmt = $pdo->prepare("SELECT * FROM archive_components WHERE original_id = ? ORDER BY deleted_at DESC LIMIT 1");
            $fetchStmt->execute([$originalId]);
        }
        $archived = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$archived) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Archived component not found']);
            return;
        }
        
		// Preserve the original component id when restoring to keep client references valid
		$targetId = isset($archived['original_id']) ? (int)$archived['original_id'] : 0;
		if ($targetId <= 0) {
			$pdo->rollBack();
			http_response_code(500);
			echo json_encode(['success' => false, 'error' => 'Archived record missing original_id']);
			return;
		}
		// Ensure there is no conflicting row with the target id
		$existsById = $pdo->prepare("SELECT 1 FROM components WHERE id = ?");
		$existsById->execute([$targetId]);
		if ($existsById->fetchColumn()) {
			$pdo->rollBack();
			http_response_code(409);
			echo json_encode(['success' => false, 'error' => 'A component already exists with this original id']);
			return;
		}
		
        $checkStmt = $pdo->prepare("SELECT id FROM components WHERE name = ? AND id != ?");
		$checkStmt->execute([$archived['name'], $archived['original_id'] ?? 0]);
        if ($checkStmt->fetch()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'A component with this name already exists']);
            return;
        }
        
        $componentColumns = $pdo->query("SHOW COLUMNS FROM components")->fetchAll(PDO::FETCH_COLUMN);
        $hasWarranty = in_array('warranty', $componentColumns);
        
        if ($hasWarranty) {
			$restoreStmt = $pdo->prepare("
				INSERT INTO components (
					id,
                    name, category_id, brand, model, price, stock_quantity, 
                    min_stock_level, image_url, specs, socket, cores, threads, tdp,
                    ram_type, form_factor, memory, speed, capacity, wattage, 
                    efficiency, fans, type, warranty, is_active, created_at, updated_at
				) VALUES (
					?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
					?, ?, ?, ?, ?, ?, ?
				)
			");
            
            $createdAt = null;
            if (!empty($archived['created_at'])) {
                $timestamp = strtotime($archived['created_at']);
                if ($timestamp !== false) {
                    $createdAt = date('Y-m-d H:i:s', $timestamp);
                }
            }
            
			$restoreStmt->execute([
				$targetId,
				$archived['name'], $archived['category_id'], $archived['brand'] ?? null,
                $archived['model'] ?? null, $archived['price'], $archived['stock_quantity'] ?? 0,
                $archived['min_stock_level'] ?? 5, $archived['image_url'] ?? null,
                $archived['specs'] ?? null, $archived['socket'] ?? null,
                $archived['cores'] ?? null, $archived['threads'] ?? null,
                $archived['tdp'] ?? null, $archived['ram_type'] ?? null,
                $archived['form_factor'] ?? null, $archived['memory'] ?? null,
                $archived['speed'] ?? null, $archived['capacity'] ?? null,
                $archived['wattage'] ?? null, $archived['efficiency'] ?? null,
                $archived['fans'] ?? null, $archived['type'] ?? null,
                $archived['warranty'] ?? null, $archived['is_active'] ?? 1,
                $createdAt, date('Y-m-d H:i:s')
            ]);
        } else {
			$restoreStmt = $pdo->prepare("
				INSERT INTO components (
					id,
                    name, category_id, brand, model, price, stock_quantity, 
                    min_stock_level, image_url, specs, socket, cores, threads, tdp,
                    ram_type, form_factor, memory, speed, capacity, wattage, 
                    efficiency, fans, type, is_active, created_at, updated_at
				) VALUES (
					?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
					?, ?, ?, ?, ?, ?
				)
			");
            
            $createdAt = null;
            if (!empty($archived['created_at'])) {
                $timestamp = strtotime($archived['created_at']);
                if ($timestamp !== false) {
                    $createdAt = date('Y-m-d H:i:s', $timestamp);
                }
            }
            
			$restoreStmt->execute([
				$targetId,
				$archived['name'], $archived['category_id'], $archived['brand'] ?? null,
                $archived['model'] ?? null, $archived['price'], $archived['stock_quantity'] ?? 0,
                $archived['min_stock_level'] ?? 5, $archived['image_url'] ?? null,
                $archived['specs'] ?? null, $archived['socket'] ?? null,
                $archived['cores'] ?? null, $archived['threads'] ?? null,
                $archived['tdp'] ?? null, $archived['ram_type'] ?? null,
                $archived['form_factor'] ?? null, $archived['memory'] ?? null,
                $archived['speed'] ?? null, $archived['capacity'] ?? null,
                $archived['wattage'] ?? null, $archived['efficiency'] ?? null,
                $archived['fans'] ?? null, $archived['type'] ?? null,
                $archived['is_active'] ?? 1, $createdAt, date('Y-m-d H:i:s')
            ]);
        }
        
        // Use the archive row's id (always available in $archived) instead of $id which may be null
        $archiveRowId = isset($archived['id']) ? (int)$archived['id'] : null;
        if ($archiveRowId === null) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Archive record missing id']);
            return;
        }
        
        $deleteStmt = $pdo->prepare("DELETE FROM archive_components WHERE id = ?");
        $deleteStmt->execute([$archiveRowId]);
        
		// Ensure AUTO_INCREMENT points to the next free id to avoid future conflicts
		try {
			$nextId = (int)$pdo->query("SELECT COALESCE(MAX(id),0) + 1 AS next_id FROM components")->fetchColumn();
			if ($nextId > 0) {
				$pdo->exec("ALTER TABLE components AUTO_INCREMENT = " . $nextId);
			}
		} catch (Throwable $t) {
			// non-fatal
		}
		
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Component restored successfully']);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log("Error restoring component: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to restore component: ' . $e->getMessage()]);
    }
}

function handleBulkImportComponents($pdo) {
    requireAdminOrSuperAdmin();
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['components']) || !is_array($input['components'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid components data']);
        return;
    }

    $components = $input['components'];
    if (empty($components)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No components to import']);
        return;
    }

    $results = [
        'success' => true,
        'total' => count($components),
        'created' => 0,
        'updated' => 0,
        'failed' => 0,
        'errors' => []
    ];

    try {
        $pdo->beginTransaction();

        foreach ($components as $index => $component) {
            try {
                $name = trim($component['name'] ?? '');
                $category_id = isset($component['category_id']) ? (int)$component['category_id'] : 0;
                $brand = isset($component['brand']) ? trim($component['brand']) : null;
                $price = isset($component['price']) ? (float)$component['price'] : 0.0;
                $stock_quantity = isset($component['stock_quantity']) ? (int)$component['stock_quantity'] : 0;
                $image_url = isset($component['image_url']) ? trim($component['image_url']) : null;
                
                if ($name === '' || $category_id <= 0) {
                    $results['failed']++;
                    $results['errors'][] = [
                        'index' => $index,
                        'name' => $name || 'Unknown',
                        'error' => 'Missing or invalid name/category_id'
                    ];
                    continue;
                }

                $checkStmt = $pdo->prepare("SELECT id FROM components WHERE name = ? AND category_id = ? AND (is_active IS NULL OR is_active = 1) LIMIT 1");
                $checkStmt->execute([$name, $category_id]);
                $existing = $checkStmt->fetch();

                if ($existing) {
                    $updateStmt = $pdo->prepare("UPDATE components SET brand = ?, price = ?, stock_quantity = ?, image_url = ? WHERE id = ?");
                    $updateStmt->execute([$brand, $price, $stock_quantity, $image_url, $existing['id']]);
                    $results['updated']++;
                } else {
                    $insertStmt = $pdo->prepare("INSERT INTO components (name, category_id, brand, price, stock_quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)");
                    $insertStmt->execute([$name, $category_id, $brand, $price, $stock_quantity, $image_url]);
                    $results['created']++;
                }
            } catch (Exception $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'index' => $index,
                    'name' => $component['name'] ?? 'Unknown',
                    'error' => $e->getMessage()
                ];
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Import failed: ' . $e->getMessage()]);
        return;
    }

    echo json_encode($results);
}

function handleGetUsers($pdo) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }

    try {
        $decoded = verifyJWT($token);
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
            return;
        }

        $roles = $decoded['roles'] ?? [];
        if (is_string($roles)) $roles = explode(',', $roles);
        if (!(in_array('Admin', $roles) || in_array('Super Admin', $roles))) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
            return;
        }

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

function handleGetComponents($pdo) {
    $categoryName = $_GET['category'] ?? '';
    if (empty($categoryName)) {
        error_log("handleGetComponents: missing 'category' query parameter");
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Category not specified']);
        return;
    }

    error_log("handleGetComponents: requested category='" . $categoryName . "'");

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

    $stmt = $pdo->prepare("SELECT id FROM component_categories WHERE UPPER(name) = UPPER(?)");
    $stmt->execute([$categoryName]);
    $category = $stmt->fetch();

    if (!$category) {
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
        $stmt = $pdo->prepare("SELECT * FROM components WHERE category_id = ? AND (is_active IS NULL OR is_active = 1)");
        $stmt->execute([$category['id']]);
        $components = $stmt->fetchAll();
    }

    error_log("handleGetComponents: category_id=" . $category['id'] . ", component_count=" . count($components));

    foreach ($components as &$component) {
        if (isset($component['specs']) && is_string($component['specs'])) {
            $component['specs'] = json_decode($component['specs']);
        }
        normalizeComponent($component);
    }

    echo json_encode(['success' => true, 'data' => $components]);
}

// Routing Logic
// Note: $method and $endpoint are already set above with proper URL parsing
// Do not reassign them here to avoid overwriting the malformed URL fix

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

    case 'forgot_password':
        if ($method === 'POST') {
            // Ensure mailer utility is loaded
            if (!function_exists('sendMailGmail')) {
                require_once __DIR__ . '/backend/utils/mailer.php';
            }
            
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $email = trim($input['email'] ?? '');
            
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Valid email address is required']);
                break;
            }
            
            // Only allow Gmail accounts
            if (!preg_match('/^[^@]+@gmail\.com$/i', $email)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Only Gmail accounts are allowed for password reset']);
                break;
            }
            
            try {
                // Check if user exists and get their roles
                $stmt = $pdo->prepare('
                    SELECT u.id, u.username, u.email, GROUP_CONCAT(r.name) as roles 
                    FROM users u 
                    LEFT JOIN user_roles ur ON u.id = ur.user_id 
                    LEFT JOIN roles r ON ur.role_id = r.id 
                    WHERE u.email = ? AND u.is_active = 1 
                    GROUP BY u.id
                ');
                $stmt->execute([$email]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$user) {
                    // Don't reveal if email exists or not for security
                    echo json_encode(['success' => true, 'message' => 'If an account with that email exists, password reset instructions have been sent.']);
                    break;
                }
                
                // Check if user has Super Admin, Admin, or Employee roles
                $roles = $user['roles'] ? explode(',', $user['roles']) : [];
                $restrictedRoles = ['Super Admin', 'Admin', 'Employee'];
                $hasRestrictedRole = !empty(array_intersect(array_map('trim', $roles), $restrictedRoles));
                
                if ($hasRestrictedRole) {
                    // For security, return generic message but log the attempt
                    error_log("Password reset attempt blocked for admin/employee account: {$email}");
                    http_response_code(403);
                    echo json_encode([
                        'success' => false, 
                        'error' => 'Password reset is not available for admin/employee accounts. Please contact a Super Admin to reset your password through the User Access Control feature.'
                    ]);
                    break;
                }
                
                // Ensure password_resets table exists
                try {
                    $pdo->exec("
                        CREATE TABLE IF NOT EXISTS password_resets (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            email VARCHAR(255) NOT NULL,
                            token VARCHAR(64) NOT NULL,
                            expires_at DATETIME NOT NULL,
                            used_at DATETIME NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY unique_email (email),
                            INDEX idx_token (token),
                            INDEX idx_expires_at (expires_at)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    ");
                } catch (Exception $e) {
                    // Table might already exist, continue
                }
                
                // Generate reset token
                $resetToken = bin2hex(random_bytes(32));
                $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour')); // Token expires in 1 hour
                
                // Store reset token in database
                $stmt = $pdo->prepare('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)');
                $stmt->execute([$email, $resetToken, $expiresAt]);
                
                // Get base URL from environment or auto-detect from current request
                $baseUrl = env('APP_URL', null);
                if (!$baseUrl) {
                    // Auto-detect the base URL from the current request
                    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost';
                    $baseUrl = $protocol . '://' . $host;
                }
                $resetLink = rtrim($baseUrl, '/') . "/?token=" . $resetToken;
                $subject = "Password Reset Request - " . env('APP_NAME', 'SIMS');
                
                $htmlMessage = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <h2 style='color: #16a34a; text-align: center;'>" . htmlspecialchars(env('APP_NAME', 'SIMS')) . " Password Reset</h2>
                    <p>Hello " . htmlspecialchars($user['username']) . ",</p>
                    <p>You requested a password reset for your " . htmlspecialchars(env('APP_NAME', 'SIMS')) . " account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='" . $resetLink . "' style='background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;'>Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style='word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px;'>" . $resetLink . "</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this reset, please ignore this email.</p>
                    <hr style='margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;'>
                    <p style='color: #6b7280; font-size: 14px;'>Best regards,<br>" . htmlspecialchars(env('APP_NAME', 'SIMS')) . " Team</p>
                </div>";
                
                $textMessage = "Hello " . $user['username'] . ",\n\n";
                $textMessage .= "You requested a password reset for your " . env('APP_NAME', 'SIMS') . " account.\n\n";
                $textMessage .= "Click the link below to reset your password:\n";
                $textMessage .= $resetLink . "\n\n";
                $textMessage .= "This link will expire in 1 hour.\n\n";
                $textMessage .= "If you didn't request this reset, please ignore this email.\n\n";
                $textMessage .= "Best regards,\n" . env('APP_NAME', 'SIMS') . " Team";
                
                // Send the email
                [$emailSent, $emailError] = sendMailGmail($email, $subject, $htmlMessage, $textMessage);
                
                if (!$emailSent) {
                    error_log("Failed to send password reset email to $email: $emailError");
                    // Still return success to user for security (don't reveal email sending issues)
                }
                
                echo json_encode(['success' => true, 'message' => 'Password reset instructions have been sent to your email.']);
                
            } catch (Exception $e) {
                error_log("Forgot password error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Internal server error']);
            }
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;
        
    case 'reset_password':
        if ($method === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true) ?: [];
            $token = trim($input['token'] ?? '');
            $password = trim($input['password'] ?? '');
            
            if (empty($token) || empty($password)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Token and password are required']);
                break;
            }
            
            // Validate password strength using security configuration
            $passwordErrors = validatePasswordStrength($password);
            if (!empty($passwordErrors)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Password does not meet requirements', 'details' => $passwordErrors]);
                break;
            }
            
            try {
                // Ensure password_resets table exists
                try {
                    $pdo->exec("
                        CREATE TABLE IF NOT EXISTS password_resets (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            email VARCHAR(255) NOT NULL,
                            token VARCHAR(64) NOT NULL,
                            expires_at DATETIME NOT NULL,
                            used_at DATETIME NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE KEY unique_email (email),
                            INDEX idx_token (token),
                            INDEX idx_expires_at (expires_at)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                    ");
                } catch (Exception $e) {
                    // Table might already exist, continue
                }
                
                // Verify token and get user
                $stmt = $pdo->prepare('SELECT pr.email, pr.expires_at FROM password_resets pr WHERE pr.token = ? AND pr.expires_at > NOW() AND pr.used_at IS NULL');
                $stmt->execute([$token]);
                $reset = $stmt->fetch();
                
                if (!$reset) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Invalid or expired reset token']);
                    break;
                }
                
                // Get user by email with their roles
                $stmt = $pdo->prepare('
                    SELECT u.id, u.username, GROUP_CONCAT(r.name) as roles 
                    FROM users u 
                    LEFT JOIN user_roles ur ON u.id = ur.user_id 
                    LEFT JOIN roles r ON ur.role_id = r.id 
                    WHERE u.email = ? AND u.is_active = 1 
                    GROUP BY u.id
                ');
                $stmt->execute([$reset['email']]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$user) {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'error' => 'User not found']);
                    break;
                }
                
                // Check if user has Super Admin, Admin, or Employee roles (defense in depth)
                $roles = $user['roles'] ? explode(',', $user['roles']) : [];
                $restrictedRoles = ['Super Admin', 'Admin', 'Employee'];
                $hasRestrictedRole = !empty(array_intersect(array_map('trim', $roles), $restrictedRoles));
                
                if ($hasRestrictedRole) {
                    // Mark token as used to prevent reuse
                    $stmt = $pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE token = ?');
                    $stmt->execute([$token]);
                    
                    error_log("Password reset attempt blocked for admin/employee account via token: {$reset['email']}");
                    http_response_code(403);
                    echo json_encode([
                        'success' => false, 
                        'error' => 'Password reset is not available for admin/employee accounts. Please contact a Super Admin to reset your password through the User Access Control feature.'
                    ]);
                    break;
                }
                
                // Hash new password
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                
                // Update user password (use password_hash field to match registration)
                $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
                $stmt->execute([$hashedPassword, $user['id']]);
                
                // Mark token as used
                $stmt = $pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE token = ?');
                $stmt->execute([$token]);
                
                echo json_encode(['success' => true, 'message' => 'Password reset successfully']);
                
            } catch (Exception $e) {
                error_log("Reset password error: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Internal server error']);
            }
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
            $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = ?');
            $stmt->execute([$roleName]);
            $r = $stmt->fetch();
            if (!$r) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'Role not found']); break; }
            $exists = $pdo->prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?');
            $exists->execute([$userId, $r['id']]);
            if (!$exists->fetch()) {
                $ins = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
                $ins->execute([$userId, $r['id']]);
            }
            
            if (in_array($roleName, ['Admin', 'Employee'], true)) {
                $permStmt = $pdo->prepare('
                    UPDATE users 
                    SET can_access_inventory = 1, 
                        can_access_orders = 1, 
                        can_access_chat_support = 1 
                    WHERE id = ?
                ');
                $permStmt->execute([$userId]);
            }
            
            try {
                $stmt = $pdo->prepare('UPDATE users SET role = ? WHERE id = ?');
                $stmt->execute([$roleName, $userId]);
            } catch (Exception $roleUpdateException) {
                error_log("Warning: Could not update users.role column: " . $roleUpdateException->getMessage());
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

    case 'archived_components':
        if ($method === 'GET') {
            handleGetArchivedComponents($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'restore_component':
        if ($method === 'POST') {
            handleRestoreComponent($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'import_components':
        if ($method === 'POST') {
            handleBulkImportComponents($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'notifications':
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
        if (!function_exists('handleCreateBuild')) {
            http_response_code(500);
            echo json_encode(['error' => 'Server configuration error: builds functions not loaded']);
            break;
        }
        
        switch ($method) {
            case 'GET':
                if (isset($_GET['test'])) {
                    if ($_GET['test'] === 'auth') {
                        handleTestAuth($pdo);
                    } else if ($_GET['test'] === 'ping') {
                        handlePing();
                    } else {
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid test parameter']);
                    }
                } else if (isset($_GET['public'])) {
                    handleGetPublicBuilds($pdo);
                } else {
                    handleGetBuilds($pdo);
                }
                break;
            case 'POST':
                handleCreateBuild($pdo);
                break;
            case 'PUT':
                handleUpdateBuild($pdo);
                break;
            case 'DELETE':
                handleDeleteBuild($pdo);
                break;
            default:
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
        if (isset($_GET['action']) && $_GET['action'] === 'cancel') {
            handleCancelOrder($pdo);
        } elseif ($method === 'GET') {
            if (isset($_GET['id'])) {
                handleGetOrder($pdo);
            } else {
                handleGetOrders($pdo);
            }
        } elseif ($method === 'POST') {
            handleCreateOrder($pdo);
        } elseif ($method === 'PUT') {
            handleUpdateOrderStatus($pdo);
        } elseif ($method === 'DELETE') {
            handleDeleteOrder($pdo);
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

    case 'get_all_components':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        
        if ($method === 'GET') {
            try {
                // Select all component fields including stock_quantity and all spec fields
                $stmt = $pdo->query('
                    SELECT 
                        c.*,
                        cat.name as category_name
                    FROM components c 
                    JOIN component_categories cat ON c.category_id = cat.id
                    WHERE (c.is_active IS NULL OR c.is_active = 1)
                    ORDER BY cat.name ASC, c.name ASC
                ');
                
                $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Decode specs JSON if present and ensure proper typing
                foreach ($components as &$component) {
                    if (isset($component['specs']) && is_string($component['specs'])) {
                        $decoded = json_decode($component['specs'], true);
                        $component['specs'] = is_array($decoded) ? $decoded : (is_object($decoded) ? (array)$decoded : []);
                    } else {
                        $component['specs'] = [];
                    }
                    
                    // Ensure numeric fields are properly typed
                    if (isset($component['price'])) $component['price'] = (float)$component['price'];
                    if (isset($component['stock_quantity'])) $component['stock_quantity'] = (int)$component['stock_quantity'];
                    if (isset($component['category_id'])) $component['category_id'] = (int)$component['category_id'];
                    if (isset($component['cores'])) $component['cores'] = $component['cores'] !== null ? (int)$component['cores'] : null;
                    if (isset($component['threads'])) $component['threads'] = $component['threads'] !== null ? (int)$component['threads'] : null;
                    if (isset($component['tdp'])) $component['tdp'] = $component['tdp'] !== null ? (int)$component['tdp'] : null;
                    if (isset($component['wattage'])) $component['wattage'] = $component['wattage'] !== null ? (int)$component['wattage'] : null;
                    if (isset($component['fans'])) $component['fans'] = $component['fans'] !== null ? (int)$component['fans'] : null;
                    
                    // Also add 'category' alias for backward compatibility
                    if (isset($component['category_name'])) {
                        $component['category'] = $component['category_name'];
                    }
                }
                
                echo json_encode(['success' => true, 'data' => $components], JSON_NUMERIC_CHECK);
                exit;
            } catch (PDOException $e) {
                http_response_code(500);
                error_log("get_all_components error: " . $e->getMessage());
                echo json_encode([
                    'success' => false, 
                    'error' => 'Database query failed: ' . $e->getMessage()
                ]);
                exit;
            } catch (Exception $e) {
                http_response_code(500);
                error_log("get_all_components error: " . $e->getMessage());
                echo json_encode([
                    'success' => false, 
                    'error' => 'Server error: ' . $e->getMessage()
                ]);
                exit;
            }
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
            exit;
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

    case 'password_requirements':
        if ($method === 'GET') {
            echo json_encode([
                'success' => true,
                'requirements' => getPasswordRequirements()
            ]);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'community_submission':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        // Include the community_submission API handler
        require_once __DIR__ . '/backend/api/community_submission.php';
        exit;
        break;

    case 'community_management':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        // Include the community_management API handler
        require_once __DIR__ . '/backend/api/community_management.php';
        exit;
        break;

    case 'get_all_categories':
    case 'categories':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        
        if ($method === 'GET') {
            try {
                $stmt = $pdo->query('SELECT id, name FROM component_categories ORDER BY name ASC');
                $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => $categories], JSON_NUMERIC_CHECK);
                exit;
            } catch (PDOException $e) {
                http_response_code(500);
                error_log("get_all_categories error: " . $e->getMessage());
                echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $e->getMessage()]);
                exit;
            }
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
            exit;
        }
        break;

    case 'prebuilts':
        // Handle prebuilts endpoint directly
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        
        $user = get_authenticated_user($pdo);
        $show_all = isset($_GET['all']) && $user && (in_array('Super Admin', $user['roles'] ?? []) || in_array('Admin', $user['roles'] ?? []));
        
        switch ($method) {
            case 'GET':
                try {
                    $sql = 'SELECT * FROM prebuilts';
                    if (!$show_all) {
                        $sql .= ' WHERE is_hidden = 0';
                    }
                    $stmt = $pdo->query($sql);
                    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);

                    // Decode JSON-like columns
                    foreach ($prebuilts as &$row) {
                        foreach (['performance', 'features', 'component_ids'] as $jsonField) {
                            if (isset($row[$jsonField])) {
                                $val = $row[$jsonField];
                                if (is_string($val)) {
                                    $decoded = json_decode($val, true);
                                    if (json_last_error() === JSON_ERROR_NONE) {
                                        $row[$jsonField] = $decoded;
                                    }
                                }
                            }
                        }
                    }
                    unset($row);

                    echo json_encode($prebuilts, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                    exit;
                } catch (Throwable $t) {
                    http_response_code(500);
                    echo json_encode(['error' => 'Failed to fetch prebuilts', 'message' => $t->getMessage()]);
                    exit;
                }
                
            case 'POST':
                require_prebuilt_management_role($user);
                $data = json_decode(file_get_contents('php://input'), true);
                $componentIds = isset($data['component_ids']) && is_array($data['component_ids']) ? $data['component_ids'] : [];
                $lowerKeys = [];
                foreach ($componentIds as $k => $v) { $lowerKeys[strtolower($k)] = $v; }
                $required = ['cpu','motherboard','gpu','ram','storage','psu','case'];
                $missing = [];
                foreach ($required as $req) {
                    if (!isset($lowerKeys[$req]) || empty($lowerKeys[$req])) { $missing[] = $req; }
                }
                if (!empty($missing)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Prebuilt must include all required components', 'missing' => $missing]);
                    exit;
                }
                $stmt = $pdo->prepare('INSERT INTO prebuilts (name, category, description, image, price, performance, features, component_ids, in_stock, is_hidden) VALUES (?, ?, ?, "", ?, ?, ?, ?, ?, ?)');
                $stmt->execute([
                    $data['name'] ?? '',
                    $data['category'] ?? '',
                    $data['description'] ?? '',
                    is_numeric($data['price'] ?? 0) ? $data['price'] : 0,
                    json_encode($data['performance'] ?? []),
                    json_encode($data['features'] ?? []),
                    json_encode($data['component_ids'] ?? []),
                    !empty($data['in_stock']) ? 1 : 0,
                    !empty($data['is_hidden']) ? 1 : 0
                ]);
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
                exit;
                
            case 'PUT':
                require_prebuilt_management_role($user);
                $id = $_GET['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Missing prebuilt id']);
                    exit;
                }
                $data = json_decode(file_get_contents('php://input'), true);
                $fields = [];
                $values = [];
                foreach (['name','category','description','image','price','performance','features','component_ids','in_stock','is_hidden'] as $field) {
                    if (isset($data[$field])) {
                        $fields[] = "$field = ?";
                        $values[] = in_array($field, ['performance','features','component_ids']) ? json_encode($data[$field]) : $data[$field];
                    }
                }
                if (empty($fields)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'No fields to update']);
                    exit;
                }
                $values[] = $id;
                $sql = 'UPDATE prebuilts SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
                echo json_encode(['success' => true]);
                exit;
                
            case 'DELETE':
                require_prebuilt_management_role($user);
                $id = $_GET['id'] ?? null;
                if (!$id) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Missing prebuilt id']);
                    exit;
                }
                $stmt = $pdo->prepare('DELETE FROM prebuilts WHERE id = ?');
                $stmt->execute([$id]);
                echo json_encode(['success' => true]);
                exit;
                
            default:
                http_response_code(405);
                echo json_encode(['error' => 'Method Not Allowed']);
                exit;
        }
        break;

    case 'get_components_by_ids':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        
        if ($method === 'GET') {
            $ids_str = $_GET['ids'] ?? '';
            
            if (empty($ids_str)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No component IDs specified']);
                exit;
            }
            
            // Sanitize the input IDs to ensure they are all integers
            $ids = array_filter(explode(',', $ids_str), 'is_numeric');
            $ids = array_map('intval', $ids);
            
            if (empty($ids)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid component IDs specified']);
                exit;
            }
            
            // Create placeholders for the IN clause
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            
            try {
                // Fetch components for the given IDs and join with categories
                $stmt = $pdo->prepare("
                    SELECT c.*, cat.name as category_name 
                    FROM components c 
                    JOIN component_categories cat ON c.category_id = cat.id 
                    WHERE c.id IN ($placeholders)
                ");
                $stmt->execute($ids);
                $components = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Decode specs JSON string into an object for each component
                foreach ($components as &$component) {
                    if (isset($component['specs']) && is_string($component['specs'])) {
                        $component['specs'] = json_decode($component['specs'], true);
                    }
                    // Also add 'category' alias for backward compatibility
                    if (isset($component['category_name'])) {
                        $component['category'] = $component['category_name'];
                    }
                }

                echo json_encode(['success' => true, 'data' => $components], JSON_NUMERIC_CHECK);
                exit;
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $e->getMessage()]);
                exit;
            }
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
            exit;
        }
        break;

    case 'recommendations':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        // Include the recommendations API handler
        require_once __DIR__ . '/backend/api/recommendations.php';
        exit;
        break;

    case 'cart':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        // Include the cart API handler
        require_once __DIR__ . '/backend/api/cart.php';
        exit;
        break;

    case 'chat':
        // Ensure JSON header is set
        header('Content-Type: application/json; charset=utf-8');
        // Include the chat API handler
        require_once __DIR__ . '/backend/api/chat.php';
        exit;
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
}

