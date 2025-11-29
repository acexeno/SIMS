<?php
// recommendations.php - Component recommendations endpoint
// Can be called standalone or via router

// Only load dependencies if not already loaded by router
if (!function_exists('get_db_connection')) {
    require_once __DIR__ . '/../config/cors.php';
    require_once __DIR__ . '/../config/database.php';
}

// Only set headers if not already set
if (!headers_sent()) {
    header('Content-Type: application/json');
}

// Only get connection if not provided
if (!isset($pdo)) {
    $pdo = get_db_connection();
}

try {
    // Read and sanitize query params
    $category = isset($_GET['category']) ? trim($_GET['category']) : '';
    $limit = isset($_GET['limit']) && is_numeric($_GET['limit']) ? max(1, (int)$_GET['limit']) : 5;
    $minPrice = isset($_GET['minPrice']) && is_numeric($_GET['minPrice']) ? (float)$_GET['minPrice'] : null;
    $maxPrice = isset($_GET['maxPrice']) && is_numeric($_GET['maxPrice']) ? (float)$_GET['maxPrice'] : null;
    $socket = isset($_GET['socket']) ? trim($_GET['socket']) : '';
    $ramType = isset($_GET['ramType']) ? trim($_GET['ramType']) : '';
    $minWattage = isset($_GET['minWattage']) && is_numeric($_GET['minWattage']) ? (int)$_GET['minWattage'] : null;
    $formFactor = isset($_GET['formFactor']) ? trim($_GET['formFactor']) : '';

    if ($category === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Category not specified']);
        exit;
    }

    // Normalize/alias category names similar to index.php
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
    $key = strtolower($category);
    if (isset($aliases[$key])) {
        $category = $aliases[$key];
    }

    // Find category id
    $stmt = $pdo->prepare("SELECT id FROM component_categories WHERE UPPER(name) = UPPER(?)");
    $stmt->execute([$category]);
    $cat = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$cat) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Category not found']);
        exit;
    }
    $categoryId = (int)$cat['id'];

    // Build base SQL
    $sql = "SELECT * FROM components WHERE category_id = :cat AND (is_active IS NULL OR is_active = 1)";
    $params = [':cat' => $categoryId];

    // Apply filters when present
    if (!is_null($minPrice)) {
        $sql .= " AND price >= :minPrice";
        $params[':minPrice'] = $minPrice;
    }
    if (!is_null($maxPrice)) {
        $sql .= " AND price <= :maxPrice";
        $params[':maxPrice'] = $maxPrice;
    }
    if ($socket !== '') {
        // Case-insensitive matching on socket column
        $sql .= " AND (socket IS NOT NULL AND UPPER(socket) LIKE :socket)";
        $params[':socket'] = '%' . strtoupper($socket) . '%';
    }
    if ($ramType !== '') {
        $sql .= " AND (ram_type IS NOT NULL AND UPPER(ram_type) LIKE :ramType)";
        $params[':ramType'] = '%' . strtoupper($ramType) . '%';
    }
    if (!is_null($minWattage)) {
        $sql .= " AND (wattage IS NOT NULL AND wattage >= :minWattage)";
        $params[':minWattage'] = $minWattage;
    }
    if ($formFactor !== '') {
        $sql .= " AND (form_factor IS NOT NULL AND UPPER(form_factor) LIKE :formFactor)";
        $params[':formFactor'] = '%' . strtoupper($formFactor) . '%';
    }

    // Basic ordering heuristic: in-stock first, then lower price, then recent
    $sql .= " ORDER BY (stock_quantity IS NULL) ASC, stock_quantity DESC, price ASC, id DESC LIMIT :limit";

    $stmt = $pdo->prepare($sql);
    // LIMIT must be bound as integer value
    foreach ($params as $k => $v) {
        if ($k === ':minWattage') $stmt->bindValue($k, (int)$v, PDO::PARAM_INT);
        else if ($k === ':cat') $stmt->bindValue($k, (int)$v, PDO::PARAM_INT);
        else if ($k === ':minPrice' || $k === ':maxPrice') $stmt->bindValue($k, (float)$v);
        else $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);

    $stmt->execute();
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fallback strategy: if no results with strict filters, try dropping formFactor/ramType/socket one by one
    if (empty($components)) {
        $fallbacks = [
            function() use ($pdo, $categoryId, $minPrice, $maxPrice, $minWattage, $limit) {
                $sql = "SELECT * FROM components WHERE category_id = :cat AND (is_active IS NULL OR is_active = 1)";
                $params = [':cat' => $categoryId];
                if (!is_null($minPrice)) { $sql .= " AND price >= :minPrice"; $params[':minPrice'] = $minPrice; }
                if (!is_null($maxPrice)) { $sql .= " AND price <= :maxPrice"; $params[':maxPrice'] = $maxPrice; }
                if (!is_null($minWattage)) { $sql .= " AND (wattage IS NOT NULL AND wattage >= :minWattage)"; $params[':minWattage'] = $minWattage; }
                $sql .= " ORDER BY (stock_quantity IS NULL) ASC, stock_quantity DESC, price ASC, id DESC LIMIT :limit";
                $stmt = $pdo->prepare($sql);
                foreach ($params as $k => $v) {
                    if ($k === ':minWattage' || $k === ':cat') $stmt->bindValue($k, (int)$v, PDO::PARAM_INT);
                    else $stmt->bindValue($k, $v);
                }
                $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
                $stmt->execute();
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            },
            function() use ($pdo, $categoryId, $limit) {
                $sql = "SELECT * FROM components WHERE category_id = :cat AND (is_active IS NULL OR is_active = 1) ORDER BY id DESC LIMIT :limit";
                $stmt = $pdo->prepare($sql);
                $stmt->bindValue(':cat', (int)$categoryId, PDO::PARAM_INT);
                $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
                $stmt->execute();
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
        ];
        foreach ($fallbacks as $fb) {
            $components = $fb();
            if (!empty($components)) break;
        }
    }

    // Decode specs JSON if present
    foreach ($components as &$component) {
        if (isset($component['specs']) && is_string($component['specs'])) {
            $decoded = json_decode($component['specs']); // stdClass like other endpoints
            $component['specs'] = $decoded ?: new stdClass();
        } else if (!isset($component['specs'])) {
            $component['specs'] = new stdClass();
        }
    }

    echo json_encode(['success' => true, 'data' => $components], JSON_NUMERIC_CHECK);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
}
