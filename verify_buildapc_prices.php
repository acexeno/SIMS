<?php
/**
 * Verify that Build A PC page will use updated component prices
 * Check if components API returns updated prices
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "=== VERIFYING BUILD A PC COMPONENT PRICES ===\n\n";
    
    // Check components that were updated - specifically the ones from "AMD Budget - RX 6600"
    $componentIds = [1155, 1153, 1159, 1150, 1072, 1147, 541, 1148];
    
    $placeholders = implode(',', array_fill(0, count($componentIds), '?'));
    
    // Query like the components API does
    $stmt = $pdo->prepare("
        SELECT 
            c.id, 
            c.name, 
            c.price, 
            c.category_id,
            cat.name as category_name,
            c.brand,
            c.model,
            c.stock_quantity,
            c.is_active
        FROM components c
        JOIN component_categories cat ON c.category_id = cat.id
        WHERE c.id IN ($placeholders)
        AND (c.is_active IS NULL OR c.is_active = 1)
        ORDER BY c.price ASC
    ");
    $stmt->execute($componentIds);
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Components that would be shown in Build A PC:\n\n";
    
    $total = 0;
    $allGood = true;
    
    foreach ($components as $comp) {
        $price = floatval($comp['price']);
        $total += $price;
        
        $status = '✓';
        $isPlaceholder = false;
        
        // Check if price looks like placeholder
        if ($price == 100.00 || $price == 0.01 || $price < 500) {
            $status = '⚠️';
            $isPlaceholder = true;
            $allGood = false;
        }
        
        echo sprintf(
            "%s [%s] %s\n   Price: ₱%s (ID: %d)\n",
            $status,
            $comp['category_name'],
            $comp['name'],
            number_format($price, 2),
            $comp['id']
        );
        
        if ($isPlaceholder) {
            echo "   ⚠️  This price appears to be a placeholder!\n";
        }
        echo "\n";
    }
    
    echo str_repeat("=", 80) . "\n";
    echo "Total if all selected: ₱" . number_format($total, 2) . "\n";
    echo "\n";
    
    if ($allGood) {
        echo "✓ All component prices look realistic!\n";
        echo "✓ Build A PC page should display correct prices when selecting components.\n";
    } else {
        echo "⚠️  Some components still have placeholder prices.\n";
        echo "   These need to be updated in the database.\n";
    }
    
    echo "\n=== API ENDPOINT VERIFICATION ===\n";
    echo "The Build A PC page uses these API endpoints:\n";
    echo "1. /api/components.php?category=CPU (for fetching components by category)\n";
    echo "2. /api/get_components_by_ids.php?ids=... (for fetching selected components)\n";
    echo "\nBoth endpoints read directly from the database, so they will show updated prices.\n";
    echo "\nHowever, if you're seeing old prices, you may need to:\n";
    echo "1. Clear your browser cache\n";
    echo "2. Hard refresh the page (Ctrl+F5 or Ctrl+Shift+R)\n";
    echo "3. Check if the component selector is caching old data\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

