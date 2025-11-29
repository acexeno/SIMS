<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/security.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/orders.php';
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
require_once __DIR__ . '/../config/database.php';
$pdo = get_db_connection();

// Initialize simple security middleware (temporarily disabled)
// initSimpleSecurityMiddleware($pdo);

require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/../utils/branch_helper.php';
require_once __DIR__ . '/auth.php'; // has all the auth functions
require_once __DIR__ . '/builds.php'; // has all the build functions
require_once __DIR__ . '/notifications.php'; // has all the notification functions
require_once __DIR__ . '/dashboard.php'; // has all the dashboard data functions
require_once __DIR__ . '/orders.php'; // sales/orders endpoints
require_once __DIR__ . '/cart.php'; // cart endpoints
require_once __DIR__ . '/otp.php'; // OTP endpoints (request/verify)
require_once __DIR__ . '/mail.php'; // Mail test endpoint (admin only)

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
    $user = requireAdminOrSuperAdmin(); // Get user info including user_id
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        return;
    }

    // Start transaction to ensure data integrity
    $pdo->beginTransaction();
    
    try {
        // Ensure archive_components table exists
        $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
        if ($checkTable->rowCount() === 0) {
            // Create archive table if it doesn't exist
            $sqlFile = __DIR__ . '/../../database/archive_components_schema.sql';
            if (file_exists($sqlFile)) {
                $sql = file_get_contents($sqlFile);
                $pdo->exec($sql);
            } else {
                // Fallback: Create table with basic structure
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
        }
        
        // Get the component data before deletion
        $fetchStmt = $pdo->prepare("SELECT * FROM components WHERE id = ?");
        $fetchStmt->execute([$id]);
        $component = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$component) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Component not found']);
            return;
        }
        
        // Get user_id from token
        $deletedBy = isset($user->user_id) ? (int)$user->user_id : null;
        
        // Insert component into archive_components table
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
        
        // Handle timestamp values - convert to proper format or use NULL
        $createdAt = null;
        if (!empty($component['created_at'])) {
            // Try to parse and format the timestamp
            $timestamp = strtotime($component['created_at']);
            if ($timestamp !== false) {
                $createdAt = date('Y-m-d H:i:s', $timestamp);
            }
        }
        
        $updatedAt = null;
        if (!empty($component['updated_at'])) {
            // Try to parse and format the timestamp
            $timestamp = strtotime($component['updated_at']);
            if ($timestamp !== false) {
                $updatedAt = date('Y-m-d H:i:s', $timestamp);
            }
        }
        
        $archiveStmt->execute([
            $component['id'], // original_id
            $component['name'],
            $component['category_id'],
            $component['brand'] ?? null,
            $component['model'] ?? null,
            $component['price'],
            $component['stock_quantity'] ?? 0,
            $component['min_stock_level'] ?? 5,
            $component['image_url'] ?? null,
            $component['specs'] ?? null,
            $component['socket'] ?? null,
            $component['cores'] ?? null,
            $component['threads'] ?? null,
            $component['tdp'] ?? null,
            $component['ram_type'] ?? null,
            $component['form_factor'] ?? null,
            $component['memory'] ?? null,
            $component['speed'] ?? null,
            $component['capacity'] ?? null,
            $component['wattage'] ?? null,
            $component['efficiency'] ?? null,
            $component['fans'] ?? null,
            $component['type'] ?? null,
            $component['warranty'] ?? null,
            $component['is_active'] ?? 1,
            $deletedBy, // deleted_by
            $createdAt, // created_at (NULL is allowed)
            $updatedAt  // updated_at (NULL is allowed)
        ]);
        
        // Delete the component from components table
        $deleteStmt = $pdo->prepare("DELETE FROM components WHERE id = ?");
        $deleteStmt->execute([$id]);
        
        // Commit transaction
        $pdo->commit();
        
        echo json_encode(['success' => true, 'message' => 'Component moved to archive']);
        
    } catch (Exception $e) {
        // Rollback on error
        $pdo->rollBack();
        error_log("Error archiving component: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to archive component: ' . $e->getMessage()]);
    }
}

function handleGetArchivedComponents($pdo) {
    requireAdminOrSuperAdmin();
    
    try {
        // Ensure archive_components table exists
        $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
        if ($checkTable->rowCount() === 0) {
            echo json_encode(['success' => true, 'data' => []]);
            return;
        }
        
        // Get all archived components with category name
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
    $input = json_decode(file_get_contents('php://input'), true);
    $id = isset($input['id']) ? (int)$input['id'] : 0;
    
    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid id']);
        return;
    }
    
    // Start transaction
    $pdo->beginTransaction();
    
    try {
        // Check if archive table exists
        $checkTable = $pdo->query("SHOW TABLES LIKE 'archive_components'");
        if ($checkTable->rowCount() === 0) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Archive table not found']);
            return;
        }
        
        // Get the archived component
        $fetchStmt = $pdo->prepare("SELECT * FROM archive_components WHERE id = ?");
        $fetchStmt->execute([$id]);
        $archived = $fetchStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$archived) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Archived component not found']);
            return;
        }
        
        // Check if a component with the same name already exists
        $checkStmt = $pdo->prepare("SELECT id FROM components WHERE name = ? AND id != ?");
        $checkStmt->execute([$archived['name'], $archived['original_id'] ?? 0]);
        if ($checkStmt->fetch()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'A component with this name already exists']);
            return;
        }
        
        // Check which columns exist in components table
        $componentColumns = $pdo->query("SHOW COLUMNS FROM components")->fetchAll(PDO::FETCH_COLUMN);
        $hasWarranty = in_array('warranty', $componentColumns);
        
        // Build INSERT statement dynamically based on available columns
        if ($hasWarranty) {
            // Insert component back into components table (with warranty)
            $restoreStmt = $pdo->prepare("
                INSERT INTO components (
                    name, category_id, brand, model, price, stock_quantity, 
                    min_stock_level, image_url, specs, socket, cores, threads, tdp,
                    ram_type, form_factor, memory, speed, capacity, wattage, 
                    efficiency, fans, type, warranty, is_active, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?, ?
                )
            ");
            
            // Handle timestamp values
            $createdAt = null;
            if (!empty($archived['created_at'])) {
                $timestamp = strtotime($archived['created_at']);
                if ($timestamp !== false) {
                    $createdAt = date('Y-m-d H:i:s', $timestamp);
                }
            }
            
            $restoreStmt->execute([
                $archived['name'],
                $archived['category_id'],
                $archived['brand'] ?? null,
                $archived['model'] ?? null,
                $archived['price'],
                $archived['stock_quantity'] ?? 0,
                $archived['min_stock_level'] ?? 5,
                $archived['image_url'] ?? null,
                $archived['specs'] ?? null,
                $archived['socket'] ?? null,
                $archived['cores'] ?? null,
                $archived['threads'] ?? null,
                $archived['tdp'] ?? null,
                $archived['ram_type'] ?? null,
                $archived['form_factor'] ?? null,
                $archived['memory'] ?? null,
                $archived['speed'] ?? null,
                $archived['capacity'] ?? null,
                $archived['wattage'] ?? null,
                $archived['efficiency'] ?? null,
                $archived['fans'] ?? null,
                $archived['type'] ?? null,
                $archived['warranty'] ?? null,
                $archived['is_active'] ?? 1,
                $createdAt,
                date('Y-m-d H:i:s') // updated_at
            ]);
        } else {
            // Insert component back into components table (without warranty)
            $restoreStmt = $pdo->prepare("
                INSERT INTO components (
                    name, category_id, brand, model, price, stock_quantity, 
                    min_stock_level, image_url, specs, socket, cores, threads, tdp,
                    ram_type, form_factor, memory, speed, capacity, wattage, 
                    efficiency, fans, type, is_active, created_at, updated_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                    ?, ?, ?, ?, ?
                )
            ");
            
            // Handle timestamp values
            $createdAt = null;
            if (!empty($archived['created_at'])) {
                $timestamp = strtotime($archived['created_at']);
                if ($timestamp !== false) {
                    $createdAt = date('Y-m-d H:i:s', $timestamp);
                }
            }
            
            $restoreStmt->execute([
                $archived['name'],
                $archived['category_id'],
                $archived['brand'] ?? null,
                $archived['model'] ?? null,
                $archived['price'],
                $archived['stock_quantity'] ?? 0,
                $archived['min_stock_level'] ?? 5,
                $archived['image_url'] ?? null,
                $archived['specs'] ?? null,
                $archived['socket'] ?? null,
                $archived['cores'] ?? null,
                $archived['threads'] ?? null,
                $archived['tdp'] ?? null,
                $archived['ram_type'] ?? null,
                $archived['form_factor'] ?? null,
                $archived['memory'] ?? null,
                $archived['speed'] ?? null,
                $archived['capacity'] ?? null,
                $archived['wattage'] ?? null,
                $archived['efficiency'] ?? null,
                $archived['fans'] ?? null,
                $archived['type'] ?? null,
                $archived['is_active'] ?? 1,
                $createdAt,
                date('Y-m-d H:i:s') // updated_at
            ]);
        }
        
        // Delete from archive
        $deleteStmt = $pdo->prepare("DELETE FROM archive_components WHERE id = ?");
        $deleteStmt->execute([$id]);
        
        // Commit transaction
        $pdo->commit();
        
        echo json_encode(['success' => true, 'message' => 'Component restored successfully']);
        
    } catch (Exception $e) {
        // Rollback on error
        $pdo->rollBack();
        error_log("Error restoring component: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to restore component: ' . $e->getMessage()]);
    }
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
            
            // Verify user exists
            $userCheck = $pdo->prepare('SELECT id, username FROM users WHERE id = ?');
            $userCheck->execute([$userId]);
            $user = $userCheck->fetch();
            if (!$user) { http_response_code(404); echo json_encode(['success'=>false,'error'=>'User not found']); break; }
            
            // Find or create role
            $stmt = $pdo->prepare('SELECT id FROM roles WHERE name = ?');
            $stmt->execute([$roleName]);
            $r = $stmt->fetch();
            if (!$r) {
                // Create role if it doesn't exist (e.g., Employee, Admin, Super Admin)
                $stmt = $pdo->prepare('INSERT INTO roles (name) VALUES (?)');
                $stmt->execute([$roleName]);
                $roleId = $pdo->lastInsertId();
                if (!$roleId) {
                    http_response_code(500);
                    echo json_encode(['success'=>false,'error'=>'Failed to create role']);
                    break;
                }
            } else {
                $roleId = $r['id'];
            }
            
            // Upsert mapping (avoid duplicates)
            $exists = $pdo->prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?');
            $exists->execute([$userId, $roleId]);
            if (!$exists->fetch()) {
                $ins = $pdo->prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
                $ins->execute([$userId, $roleId]);
            }
            
            // CRITICAL: Automatically enable access permissions for Admin and Employee roles
            // This ensures all future Admin/Employee users follow user access control
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
            
            // Also update the role column in users table for consistency with phpMyAdmin display
            try {
                $stmt = $pdo->prepare('UPDATE users SET role = ? WHERE id = ?');
                $stmt->execute([$roleName, $userId]);
            } catch (Exception $roleUpdateException) {
                // If role column doesn't exist or update fails, log but don't break role assignment
                error_log("Warning: Could not update users.role column: " . $roleUpdateException->getMessage());
            }
            
            echo json_encode(['success'=>true, 'message'=>'Role assigned successfully']);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'remove_role':
        if ($method === 'POST') {
            // Verify Super Admin access
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
            
            // Remove the role mapping
            $del = $pdo->prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?');
            $del->execute([$userId, $r['id']]);
            
            // Update users.role column based on remaining roles
            // Priority: Super Admin > Admin > Employee > Client
            try {
                $stmt = $pdo->prepare('
                    SELECT r.name 
                    FROM user_roles ur 
                    JOIN roles r ON ur.role_id = r.id 
                    WHERE ur.user_id = ? 
                    ORDER BY FIELD(r.name, "Super Admin", "Admin", "Employee", "Client")
                    LIMIT 1
                ');
                $stmt->execute([$userId]);
                $remainingRole = $stmt->fetch();
                
                $roleToSet = $remainingRole ? $remainingRole['name'] : 'Client';
                $updateStmt = $pdo->prepare('UPDATE users SET role = ? WHERE id = ?');
                $updateStmt->execute([$roleToSet, $userId]);
            } catch (Exception $roleUpdateException) {
                // If role column doesn't exist or update fails, log but don't break role removal
                error_log("Warning: Could not update users.role column: " . $roleUpdateException->getMessage());
            }
            
            echo json_encode(['success'=>true]);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'delete_user':
        if ($method === 'DELETE') {
            // Verify Super Admin access
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
            if ($userId <= 0) { http_response_code(400); echo json_encode(['success'=>false,'error'=>'Invalid user ID']); break; }
            
            // Get user info before deletion
            $stmt = $pdo->prepare('SELECT username, email FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $user = $stmt->fetch();
            if (!$user) {
                http_response_code(404);
                echo json_encode(['success'=>false,'error'=>'User not found']);
                break;
            }
            
            // Prevent deletion of Super Admin accounts
            $stmt = $pdo->prepare('SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ? AND r.name = "Super Admin"');
            $stmt->execute([$userId]);
            if ($stmt->fetch()) { http_response_code(403); echo json_encode(['success'=>false,'error'=>'Cannot delete Super Admin accounts']); break; }
            
            try {
                // Start transaction for complete data wipe (all-or-nothing)
                $pdo->beginTransaction();
                
                // PERMANENT DELETION - NO TRACES LEFT BEHIND
                // =============================================
                
                // 1. Delete password reset tokens (by email - no foreign key)
                $stmt = $pdo->prepare('DELETE FROM password_resets WHERE email = ?');
                $stmt->execute([$user['email']]);
                $deletedPasswordResets = $stmt->rowCount();
                
                // 2. Delete chat sessions (user_id can be NULL, needs manual deletion)
                $stmt = $pdo->prepare('DELETE FROM chat_sessions WHERE user_id = ?');
                $stmt->execute([$userId]);
                $deletedChatSessions = $stmt->rowCount();
                
                // 3. Delete user roles (manual deletion to ensure cleanup)
                $stmt = $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?');
                $stmt->execute([$userId]);
                $deletedRoles = $stmt->rowCount();
                
                // 4. Delete user (CASCADE will auto-delete related data)
                // The following tables will be auto-deleted via ON DELETE CASCADE:
                //    - user_builds (and their community_submissions via cascade)
                //    - orders (and order_items via cascade)
                //    - notifications
                //    - last_seen_chat
                //    - community_submissions (where user_id = deleted user)
                $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
                $stmt->execute([$userId]);
                $deletedUser = $stmt->rowCount();
                
                if ($deletedUser > 0) {
                    // Commit transaction - permanent deletion complete
                    $pdo->commit();
                    
                    // Log comprehensive deletion details
                    $logMessage = "PERMANENT USER DELETION COMPLETED:\n" .
                                  "  User ID: {$userId}\n" .
                                  "  Username: {$user['username']}\n" .
                                  "  Email: {$user['email']}\n" .
                                  "  Deleted by: Super Admin\n" .
                                  "  Data wiped:\n" .
                                  "    - User account: 1\n" .
                                  "    - User roles: {$deletedRoles}\n" .
                                  "    - Password resets: {$deletedPasswordResets}\n" .
                                  "    - Chat sessions: {$deletedChatSessions}\n" .
                                  "    - User builds: auto-cascade\n" .
                                  "    - Orders: auto-cascade\n" .
                                  "    - Notifications: auto-cascade\n" .
                                  "    - Community submissions: auto-cascade\n" .
                                  "  Status: NO TRACES REMAINING";
                    error_log($logMessage);
                    
                    echo json_encode([
                        'success' => true, 
                        'message' => 'User permanently deleted with all associated data',
                        'deleted_user' => [
                            'username' => $user['username'],
                            'email' => $user['email']
                        ],
                        'data_wiped' => [
                            'user_roles' => $deletedRoles,
                            'password_resets' => $deletedPasswordResets,
                            'chat_sessions' => $deletedChatSessions,
                            'cascaded_tables' => ['user_builds', 'orders', 'notifications', 'community_submissions', 'last_seen_chat']
                        ]
                    ]);
                } else {
                    // Rollback if user deletion failed
                    $pdo->rollBack();
                    http_response_code(500);
                    echo json_encode(['success'=>false,'error'=>'Failed to delete user']);
                }
            } catch (Exception $e) {
                // Rollback transaction on any error
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log("User deletion failed: " . $e->getMessage());
                http_response_code(500);
                echo json_encode(['success'=>false,'error'=>'Database error during deletion: ' . $e->getMessage()]);
            }
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'forgot_password':
        if ($method === 'POST') {
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
                
                // Generate reset token
                $resetToken = bin2hex(random_bytes(32));
                $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour')); // Token expires in 1 hour
                
                // Store reset token in database
                $stmt = $pdo->prepare('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at)');
                $stmt->execute([$email, $resetToken, $expiresAt]);
                
                // Send email with reset link using the mailer utility
                require_once __DIR__ . '/../utils/mailer.php';
                
                $resetLink = "http://localhost:5175/?token=" . $resetToken;
                $subject = "Password Reset Request - SIMS";
                
                $htmlMessage = "
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;'>
                    <h2 style='color: #16a34a; text-align: center;'>SIMS Password Reset</h2>
                    <p>Hello " . htmlspecialchars($user['username']) . ",</p>
                    <p>You requested a password reset for your SIMS account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='" . $resetLink . "' style='background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;'>Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style='word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px;'>" . $resetLink . "</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this reset, please ignore this email.</p>
                    <hr style='margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;'>
                    <p style='color: #6b7280; font-size: 14px;'>Best regards,<br>SIMS Team</p>
                </div>";
                
                $textMessage = "Hello " . $user['username'] . ",\n\n";
                $textMessage .= "You requested a password reset for your SIMS account.\n\n";
                $textMessage .= "Click the link below to reset your password:\n";
                $textMessage .= $resetLink . "\n\n";
                $textMessage .= "This link will expire in 1 hour.\n\n";
                $textMessage .= "If you didn't request this reset, please ignore this email.\n\n";
                $textMessage .= "Best regards,\nSIMS Team";
                
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

    case 'generate_password':
        if ($method === 'GET') {
            // Verify Super Admin access
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? null);
            if (!$authHeader) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Unauthorized']); break; }
            $token = preg_replace('/^Bearer\s+/i','',$authHeader);
            $decoded = verifyJWT($token);
            if (!$decoded) { http_response_code(401); echo json_encode(['success'=>false,'error'=>'Invalid token']); break; }
            $roles = $decoded['roles'] ?? [];
            if (is_string($roles)) $roles = explode(',', $roles);
            if (!in_array('Super Admin', $roles)) { http_response_code(403); echo json_encode(['success'=>false,'error'=>'Forbidden']); break; }
            
            // Generate a secure password that meets requirements
            $requirements = getPasswordRequirements();
            $password = generateSecurePassword($requirements);
            
            echo json_encode(['success' => true, 'password' => $password]);
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
        // Check for cancellation action first
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

    case 'cart':
        // Cart module: manage user shopping carts
        if ($method === 'GET') {
            if (isset($_GET['count'])) {
                handleGetCartCount($pdo);
            } else {
                handleGetCart($pdo);
            }
        } elseif ($method === 'POST') {
            if (isset($_GET['action']) && $_GET['action'] === 'clear') {
                handleClearCart($pdo);
            } elseif (isset($_GET['action']) && $_GET['action'] === 'cleanup') {
                // Manual cleanup endpoint - convert individual prebuilt components to prebuilt items
                $decoded = requireAuthOr403();
                $userId = (int)$decoded['user_id'];
                $result = cleanupPrebuiltComponentsInCart($pdo, $userId);
                echo json_encode([
                    'success' => true,
                    'cleaned' => $result['cleaned'],
                    'prebuilts' => $result['prebuilts'] ?? [],
                    'message' => $result['message'] ?? 'Cleanup completed'
                ]);
            } else {
                handleAddToCart($pdo);
            }
        } elseif ($method === 'PUT') {
            handleUpdateCartItem($pdo);
        } elseif ($method === 'DELETE') {
            handleRemoveFromCart($pdo);
        } else {
            http_response_code(405);
            echo json_encode(['error' => 'Method Not Allowed']);
        }
        break;

    case 'community_submission':
        // Delegate to dedicated handler (handles POST for submit and GET for user's submissions)
        require_once __DIR__ . '/community_submission.php';
        break;

    case 'community_management':
        // Delegate to dedicated handler (admin/employee moderation actions and listing)
        require_once __DIR__ . '/community_management.php';
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

    case 'recommendations':
        // Delegate to recommendations handler (handles GET for component recommendations)
        require_once __DIR__ . '/recommendations.php';
        break;

    // Add component-related routes here if needed, or point to another file
    // e.g., case 'components': include 'components.php'; break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
} 