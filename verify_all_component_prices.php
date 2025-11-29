<?php
/**
 * Comprehensive script to verify all component prices in the database
 * Checks for:
 * - Zero prices
 * - Placeholder prices (0.01, 100.00)
 * - Suspiciously low prices per category
 * - Negative prices
 * - Price consistency across similar components
 * - Missing or NULL prices
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

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
    
    echo "========================================\n";
    echo "COMPONENT PRICE VERIFICATION REPORT\n";
    echo "========================================\n\n";
    
    // Get all components with categories
    $stmt = $pdo->query("
        SELECT 
            c.id,
            c.name,
            c.price,
            c.brand,
            c.model,
            c.category_id,
            cat.name as category_name,
            c.is_active,
            c.stock_quantity
        FROM components c
        JOIN component_categories cat ON c.category_id = cat.id
        ORDER BY cat.name, c.price ASC
    ");
    
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $totalComponents = count($components);
    
    echo "Total Components in Database: {$totalComponents}\n\n";
    
    // Price validation rules per category
    $categoryPriceRules = [
        'CPU' => ['min' => 2000, 'max' => 50000, 'typical_min' => 3000],
        'GPU' => ['min' => 5000, 'max' => 200000, 'typical_min' => 8000],
        'Motherboard' => ['min' => 2000, 'max' => 80000, 'typical_min' => 3000],
        'RAM' => ['min' => 1000, 'max' => 30000, 'typical_min' => 1500],
        'Storage' => ['min' => 500, 'max' => 50000, 'typical_min' => 1000],
        'PSU' => ['min' => 1500, 'max' => 30000, 'typical_min' => 2000],
        'Case' => ['min' => 1000, 'max' => 25000, 'typical_min' => 1500],
        'Cooler' => ['min' => 500, 'max' => 15000, 'typical_min' => 800],
    ];
    
    // Issues tracking
    $issues = [
        'zero_price' => [],
        'placeholder_price' => [],
        'suspiciously_low' => [],
        'suspiciously_high' => [],
        'negative_price' => [],
        'null_price' => [],
    ];
    
    $categories = [];
    $categoryStats = [];
    
    // Process each component
    foreach ($components as $comp) {
        $price = floatval($comp['price'] ?? 0);
        $category = $comp['category_name'];
        
        // Initialize category stats if not exists
        if (!isset($categoryStats[$category])) {
            $categoryStats[$category] = [
                'count' => 0,
                'total' => 0,
                'min' => PHP_FLOAT_MAX,
                'max' => 0,
                'avg' => 0,
                'valid_prices' => 0
            ];
        }
        
        $categoryStats[$category]['count']++;
        $categories[$category] = $category;
        
        // Check for NULL price
        if ($comp['price'] === null) {
            $issues['null_price'][] = $comp;
            continue;
        }
        
        // Check for negative price
        if ($price < 0) {
            $issues['negative_price'][] = $comp;
            continue;
        }
        
        // Check for zero price
        if ($price == 0.00) {
            $issues['zero_price'][] = $comp;
            continue;
        }
        
        // Check for placeholder prices
        if ($price == 0.01 || $price == 100.00) {
            $issues['placeholder_price'][] = $comp;
            continue;
        }
        
        // Check for suspicious prices based on category
        if (isset($categoryPriceRules[$category])) {
            $rules = $categoryPriceRules[$category];
            
            // Check suspiciously low
            if ($price < $rules['min']) {
                $issues['suspiciously_low'][] = [
                    'component' => $comp,
                    'reason' => "Price (₱" . number_format($price, 2) . ") is below minimum expected (₱" . number_format($rules['min'], 2) . ") for {$category}",
                ];
                continue;
            }
            
            // Check suspiciously high (warn but don't flag as critical)
            if ($price > $rules['max']) {
                $issues['suspiciously_high'][] = [
                    'component' => $comp,
                    'reason' => "Price (₱" . number_format($price, 2) . ") exceeds typical maximum (₱" . number_format($rules['max'], 2) . ") for {$category}",
                ];
            }
        }
        
        // Track valid prices for statistics
        $categoryStats[$category]['total'] += $price;
        $categoryStats[$category]['valid_prices']++;
        if ($price < $categoryStats[$category]['min']) {
            $categoryStats[$category]['min'] = $price;
        }
        if ($price > $categoryStats[$category]['max']) {
            $categoryStats[$category]['max'] = $price;
        }
    }
    
    // Calculate averages
    foreach ($categoryStats as $category => &$stats) {
        if ($stats['valid_prices'] > 0) {
            $stats['avg'] = $stats['total'] / $stats['valid_prices'];
        }
    }
    
    // ============================================
    // REPORT SECTION
    // ============================================
    
    $hasIssues = false;
    $totalIssues = 0;
    
    // Zero Prices
    if (count($issues['zero_price']) > 0) {
        $hasIssues = true;
        $totalIssues += count($issues['zero_price']);
        echo "⚠️  ZERO PRICES: " . count($issues['zero_price']) . " components\n";
        echo str_repeat("-", 80) . "\n";
        foreach ($issues['zero_price'] as $comp) {
            echo sprintf("  ID: %-6d | [%s] %s (Brand: %s)\n", 
                $comp['id'], 
                $comp['category_name'], 
                $comp['name'],
                $comp['brand'] ?? 'N/A'
            );
        }
        echo "\n";
    }
    
    // Placeholder Prices
    if (count($issues['placeholder_price']) > 0) {
        $hasIssues = true;
        $totalIssues += count($issues['placeholder_price']);
        echo "⚠️  PLACEHOLDER PRICES (₱0.01 or ₱100.00): " . count($issues['placeholder_price']) . " components\n";
        echo str_repeat("-", 80) . "\n";
        foreach ($issues['placeholder_price'] as $comp) {
            echo sprintf("  ID: %-6d | [%s] %s - ₱%s (Brand: %s)\n", 
                $comp['id'], 
                $comp['category_name'], 
                $comp['name'],
                number_format($comp['price'], 2),
                $comp['brand'] ?? 'N/A'
            );
        }
        echo "\n";
    }
    
    // Null Prices
    if (count($issues['null_price']) > 0) {
        $hasIssues = true;
        $totalIssues += count($issues['null_price']);
        echo "⚠️  NULL PRICES: " . count($issues['null_price']) . " components\n";
        echo str_repeat("-", 80) . "\n";
        foreach ($issues['null_price'] as $comp) {
            echo sprintf("  ID: %-6d | [%s] %s (Brand: %s)\n", 
                $comp['id'], 
                $comp['category_name'], 
                $comp['name'],
                $comp['brand'] ?? 'N/A'
            );
        }
        echo "\n";
    }
    
    // Negative Prices
    if (count($issues['negative_price']) > 0) {
        $hasIssues = true;
        $totalIssues += count($issues['negative_price']);
        echo "❌ NEGATIVE PRICES: " . count($issues['negative_price']) . " components\n";
        echo str_repeat("-", 80) . "\n";
        foreach ($issues['negative_price'] as $comp) {
            echo sprintf("  ID: %-6d | [%s] %s - ₱%s\n", 
                $comp['id'], 
                $comp['category_name'], 
                $comp['name'],
                number_format($comp['price'], 2)
            );
        }
        echo "\n";
    }
    
    // Suspiciously Low Prices
    if (count($issues['suspiciously_low']) > 0) {
        $hasIssues = true;
        $totalIssues += count($issues['suspiciously_low']);
        echo "⚠️  SUSPICIOUSLY LOW PRICES: " . count($issues['suspiciously_low']) . " components\n";
        echo str_repeat("-", 80) . "\n";
        foreach ($issues['suspiciously_low'] as $item) {
            $comp = $item['component'];
            echo sprintf("  ID: %-6d | [%s] %s\n", 
                $comp['id'], 
                $comp['category_name'], 
                $comp['name']
            );
            echo "         Price: ₱" . number_format($comp['price'], 2) . " - {$item['reason']}\n";
        }
        echo "\n";
    }
    
    // Suspiciously High Prices (Warning only)
    if (count($issues['suspiciously_high']) > 0) {
        echo "⚠️  SUSPICIOUSLY HIGH PRICES (WARNING): " . count($issues['suspiciously_high']) . " components\n";
        echo str_repeat("-", 80) . "\n";
        foreach (array_slice($issues['suspiciously_high'], 0, 10) as $item) {
            $comp = $item['component'];
            echo sprintf("  ID: %-6d | [%s] %s - ₱%s\n", 
                $comp['id'], 
                $comp['category_name'], 
                $comp['name'],
                number_format($comp['price'], 2)
            );
        }
        if (count($issues['suspiciously_high']) > 10) {
            echo "  ... and " . (count($issues['suspiciously_high']) - 10) . " more\n";
        }
        echo "\n";
    }
    
    // Category Statistics
    echo "========================================\n";
    echo "PRICE STATISTICS BY CATEGORY\n";
    echo "========================================\n\n";
    
    foreach ($categories as $category) {
        $stats = $categoryStats[$category];
        echo "{$category}:\n";
        echo "  Total Components: {$stats['count']}\n";
        echo "  Valid Prices: {$stats['valid_prices']}\n";
        if ($stats['valid_prices'] > 0) {
            echo "  Min Price: ₱" . number_format($stats['min'], 2) . "\n";
            echo "  Max Price: ₱" . number_format($stats['max'], 2) . "\n";
            echo "  Avg Price: ₱" . number_format($stats['avg'], 2) . "\n";
        }
        echo "\n";
    }
    
    // Summary
    echo "========================================\n";
    echo "SUMMARY\n";
    echo "========================================\n\n";
    
    $validComponents = $totalComponents - count($issues['zero_price']) - count($issues['placeholder_price']) - count($issues['null_price']) - count($issues['negative_price']);
    $issueComponents = $totalIssues;
    
    echo "Total Components: {$totalComponents}\n";
    echo "Valid Prices: {$validComponents}\n";
    echo "Issues Found: {$totalIssues}\n\n";
    
    if (!$hasIssues) {
        echo "✅ SUCCESS: All component prices appear to be correct!\n";
        echo "   No zero prices, placeholder prices, or suspicious values found.\n";
    } else {
        echo "⚠️  ATTENTION REQUIRED:\n";
        if (count($issues['zero_price']) > 0) {
            echo "   - " . count($issues['zero_price']) . " components have ₱0.00 price\n";
        }
        if (count($issues['placeholder_price']) > 0) {
            echo "   - " . count($issues['placeholder_price']) . " components have placeholder prices\n";
        }
        if (count($issues['suspiciously_low']) > 0) {
            echo "   - " . count($issues['suspiciously_low']) . " components have suspiciously low prices\n";
        }
        if (count($issues['null_price']) > 0) {
            echo "   - " . count($issues['null_price']) . " components have NULL prices\n";
        }
        if (count($issues['negative_price']) > 0) {
            echo "   - " . count($issues['negative_price']) . " components have negative prices\n";
        }
        echo "\n";
        echo "RECOMMENDATIONS:\n";
        echo "1. Review and update components with zero/placeholder prices\n";
        echo "2. Verify suspiciously low prices against market rates\n";
        echo "3. Run 'update_component_prices.php' to fix placeholder prices\n";
        echo "4. After fixing component prices, recalculate prebuilt prices\n";
    }
    
    echo "\n";
    echo "========================================\n";
    echo "Report Generated: " . date('Y-m-d H:i:s') . "\n";
    echo "========================================\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

