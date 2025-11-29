<?php
/**
 * Check specific prebuilt prices and their components
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Find prebuilt with "AMD Budget" or "RX 6600"
    $stmt = $pdo->prepare("SELECT * FROM prebuilts WHERE name LIKE ? OR name LIKE ?");
    $stmt->execute(['%AMD Budget%', '%RX 6600%']);
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($prebuilts)) {
        // Get all prebuilts and show ones with low prices
        $stmt = $pdo->query("SELECT * FROM prebuilts WHERE price < 5000 ORDER BY price ASC");
        $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    echo "=== PREBUILT PRICE ANALYSIS ===\n\n";
    
    foreach ($prebuilts as $prebuilt) {
        echo str_repeat("=", 80) . "\n";
        echo "Prebuilt ID: {$prebuilt['id']}\n";
        echo "Name: {$prebuilt['name']}\n";
        echo "Current Price: ₱" . number_format($prebuilt['price'], 2) . "\n";
        echo "Category: {$prebuilt['category']}\n";
        echo "\n";
        
        $componentIds = json_decode($prebuilt['component_ids'] ?? '{}', true);
        
        if (!is_array($componentIds) || empty($componentIds)) {
            echo "⚠️  No component IDs found!\n\n";
            continue;
        }
        
        echo "Component IDs: " . json_encode($componentIds) . "\n\n";
        
        $ids = array_filter(array_map('intval', array_values($componentIds)));
        if (empty($ids)) {
            echo "⚠️  No valid component IDs!\n\n";
            continue;
        }
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $compStmt = $pdo->prepare("SELECT id, name, price, category_id FROM components WHERE id IN ($placeholders)");
        $compStmt->execute($ids);
        $components = $compStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get category names
        $catIds = array_unique(array_column($components, 'category_id'));
        $catStmt = $pdo->prepare("SELECT id, name FROM component_categories WHERE id IN (" . implode(',', array_fill(0, count($catIds), '?')) . ")");
        $catStmt->execute($catIds);
        $categories = [];
        foreach ($catStmt->fetchAll(PDO::FETCH_ASSOC) as $cat) {
            $categories[$cat['id']] = $cat['name'];
        }
        
        echo "COMPONENTS:\n";
        $total = 0;
        $zeroPriceCount = 0;
        
        foreach ($components as $comp) {
            $compPrice = floatval($comp['price'] ?? 0);
            $total += $compPrice;
            $catName = $categories[$comp['category_id']] ?? 'Unknown';
            $priceStr = $compPrice == 0 ? "₱0.00 ⚠️" : "₱" . number_format($compPrice, 2);
            
            echo sprintf("  [%s] %s - %s (ID: %d)\n", 
                $catName,
                $comp['name'],
                $priceStr,
                $comp['id']
            );
            
            if ($compPrice == 0) {
                $zeroPriceCount++;
            }
        }
        
        echo "\n";
        echo "Component Total: ₱" . number_format($total, 2) . "\n";
        echo "Stored Price: ₱" . number_format($prebuilt['price'], 2) . "\n";
        echo "Difference: ₱" . number_format($total - $prebuilt['price'], 2) . "\n";
        
        if ($zeroPriceCount > 0) {
            echo "⚠️  {$zeroPriceCount} component(s) have ₱0.00 price!\n";
        }
        
        echo "\n";
    }
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

