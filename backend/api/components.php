<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json');

try {
    $pdo = get_db_connection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

try {
    // Get category parameter
    $category = isset($_GET['category']) ? trim($_GET['category']) : null;
    $branch = isset($_GET['branch']) ? trim($_GET['branch']) : null; // reserved, not used currently
    
    // Normalize category name (case-insensitive matching)
    if ($category) {
        // Build the query with case-insensitive category matching
        // Use SELECT * first to get all fields, then we can refine later
        $stmt = $pdo->prepare('
            SELECT 
                c.*,
                cat.name as category_name
            FROM components c 
            JOIN component_categories cat ON c.category_id = cat.id 
            WHERE UPPER(cat.name) = UPPER(?) AND (c.is_active IS NULL OR c.is_active = 1)
            ORDER BY c.name ASC
        ');
        $stmt->execute([$category]);
    } else {
        // Get all components if no category specified
        $stmt = $pdo->query('
            SELECT 
                c.*,
                cat.name as category_name
            FROM components c 
            JOIN component_categories cat ON c.category_id = cat.id
            WHERE (c.is_active IS NULL OR c.is_active = 1)
            ORDER BY cat.name ASC, c.name ASC
        ');
    }
    
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Decode specs JSON if present
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
    }
    
    echo json_encode(['success' => true, 'data' => $components], JSON_NUMERIC_CHECK);
} catch (PDOException $e) {
    http_response_code(500);
    error_log("components.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'error' => 'Database query failed: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    error_log("components.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'error' => 'Server error: ' . $e->getMessage()
    ]);
}


