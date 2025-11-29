<?php
// Simple API test endpoint for debugging
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Test database connection
try {
    require_once __DIR__ . '/../config/database.php';
    $pdo = get_db_connection();
    
    // Test if components table exists and has data
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM components");
    $componentCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    // Test if prebuilts table exists and has data
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM prebuilts");
    $prebuiltCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    echo json_encode([
        'status' => 'success',
        'message' => 'API Test Successful',
        'database_connected' => true,
        'components_count' => $componentCount,
        'prebuilts_count' => $prebuiltCount,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed',
        'error' => $e->getMessage()
    ]);
}
?>
