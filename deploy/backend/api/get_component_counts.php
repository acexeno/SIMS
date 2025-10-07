<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

$pdo = get_db_connection();

try {
    $stmt = $pdo->query('
        SELECT 
            cc.id as category_id, 
            cc.name as category_name, 
            COUNT(c.id) as component_count
        FROM component_categories cc
        LEFT JOIN components c ON cc.id = c.category_id
        GROUP BY cc.id, cc.name
        ORDER BY cc.name ASC
    ');
    $componentCounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Remap frontend keys to canonical database category names
    $categoryMapping = [
        'cpu' => 'CPU',
        'motherboard' => 'Motherboard',
        'gpu' => 'GPU',
        'ram' => 'RAM',
        'storage' => 'Storage',
        'psu' => 'PSU',
        'case' => 'Case',
        'cooler' => 'Cooler'
    ];
    
    $frontendCategoryCounts = [];
    foreach ($categoryMapping as $frontendName => $dbName) {
        $frontendCategoryCounts[$frontendName] = 0; // Initialize with 0
        foreach ($componentCounts as $count) {
            if (strcasecmp($count['category_name'], $dbName) == 0) {
                $frontendCategoryCounts[$frontendName] = (int)$count['component_count'];
                break;
            }
        }
    }
    
    echo json_encode(['success' => true, 'data' => $frontendCategoryCounts], JSON_NUMERIC_CHECK);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database query failed: ' . $e->getMessage()]);
}
