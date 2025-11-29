<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json');

$pdo = get_db_connection();

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
} catch (PDOException $e) {
    http_response_code(500);
    error_log("get_all_components.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'error' => 'Database query failed: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    error_log("get_all_components.php error: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'error' => 'Server error: ' . $e->getMessage()
    ]);
} 