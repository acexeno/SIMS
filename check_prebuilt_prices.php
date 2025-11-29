<?php
/**
 * Diagnostic script to check prebuilt prices and their component prices
 * Helps identify pricing issues like ₱1,104 for high-end prebuilts
 */
// Try different possible paths for database config
if (file_exists(__DIR__ . '/backend/config/database.php')) {
    require_once __DIR__ . '/backend/config/database.php';
} elseif (file_exists(__DIR__ . '/config/database.php')) {
    require_once __DIR__ . '/config/database.php';
} else {
    die("Could not find database config file\n");
}

try {
    $pdo = get_db_connection();
    
    // Get all prebuilts
    $stmt = $pdo->query('SELECT * FROM prebuilts ORDER BY price ASC');
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "=== PREBUILT PRICING DIAGNOSTIC REPORT ===\n\n";
    echo "Total Prebuilts: " . count($prebuilts) . "\n\n";
    
    // Get category names for display
    $categoryStmt = $pdo->query('SELECT id, name FROM component_categories');
    $categories = [];
    foreach ($categoryStmt->fetchAll(PDO::FETCH_ASSOC) as $cat) {
        $categories[$cat['id']] = $cat['name'];
    }
    
    $suspiciousPrebuilts = [];
    
    foreach ($prebuilts as $prebuilt) {
        $currentPrice = floatval($prebuilt['price'] ?? 0);
        $componentIds = json_decode($prebuilt['component_ids'] ?? '{}', true);
        
        if (!is_array($componentIds) || empty($componentIds)) {
            continue;
        }
        
        // Calculate actual price from components
        $ids = array_filter(array_map('intval', array_values($componentIds)));
        if (empty($ids)) {
            continue;
        }
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $compStmt = $pdo->prepare("SELECT id, name, price, category_id FROM components WHERE id IN ($placeholders)");
        $compStmt->execute($ids);
        $components = $compStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $actualTotal = 0;
        $componentDetails = [];
        $hasZeroPrice = false;
        
        foreach ($components as $comp) {
            $compPrice = floatval($comp['price'] ?? 0);
            $actualTotal += $compPrice;
            
            $categoryName = $categories[$comp['category_id']] ?? 'Unknown';
            $componentDetails[] = [
                'id' => $comp['id'],
                'name' => $comp['name'],
                'price' => $compPrice,
                'category' => $categoryName
            ];
            
            if ($compPrice == 0) {
                $hasZeroPrice = true;
            }
        }
        
        // Check if price seems suspicious (too low or too different from calculated)
        $isSuspicious = false;
        $reason = '';
        
        if ($currentPrice < 1000) {
            $isSuspicious = true;
            $reason = "Price too low (₱{$currentPrice})";
        } elseif ($hasZeroPrice) {
            $isSuspicious = true;
            $reason = "Contains components with ₱0.00 price";
        } elseif (abs($currentPrice - $actualTotal) > 100) {
            $isSuspicious = true;
            $reason = sprintf("Price mismatch: stored ₱%.2f vs calculated ₱%.2f (difference: ₱%.2f)", 
                $currentPrice, $actualTotal, abs($currentPrice - $actualTotal));
        }
        
        if ($isSuspicious || stripos($prebuilt['name'], 'AMD Budget') !== false || stripos($prebuilt['name'], 'RX 6600') !== false) {
            echo str_repeat("=", 80) . "\n";
            echo "PREBUILT: {$prebuilt['name']}\n";
            echo "ID: {$prebuilt['id']}\n";
            echo "Category: {$prebuilt['category']}\n";
            echo "Current Price: ₱" . number_format($currentPrice, 2) . "\n";
            echo "Calculated Price: ₱" . number_format($actualTotal, 2) . "\n";
            if ($isSuspicious) {
                echo "⚠️  ISSUE: {$reason}\n";
            }
            echo "\nCOMPONENTS:\n";
            
            foreach ($componentDetails as $comp) {
                $priceStr = $comp['price'] == 0 ? "₱0.00 ⚠️" : "₱" . number_format($comp['price'], 2);
                echo sprintf("  [%s] %s - %s - %s\n", 
                    $comp['category'],
                    $comp['name'],
                    $priceStr,
                    $comp['id']
                );
            }
            
            if ($currentPrice != $actualTotal && $actualTotal > 0) {
                echo "\n💡 RECOMMENDATION: Price should be recalculated to ₱" . number_format($actualTotal, 2) . "\n";
            }
            
            echo "\n";
        }
    }
    
    echo str_repeat("=", 80) . "\n";
    echo "\n=== SUMMARY ===\n";
    echo "To fix prices, use the API endpoint: GET /api/prebuilts.php?recalculate_prices=1\n";
    echo "(Requires Admin/Super Admin authentication)\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

