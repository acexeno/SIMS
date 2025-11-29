<?php
/**
 * Detailed price verification report with market price comparison
 * Focuses on components flagged as suspiciously low
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

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
    echo "DETAILED COMPONENT PRICE VERIFICATION\n";
    echo "========================================\n\n";
    
    // Get components that might have incorrect prices
    $stmt = $pdo->query("
        SELECT 
            c.id,
            c.name,
            c.price,
            c.brand,
            c.model,
            cat.name as category_name,
            c.stock_quantity,
            c.is_active
        FROM components c
        JOIN component_categories cat ON c.category_id = cat.id
        WHERE 
            c.price = 0.00 
            OR c.price = 0.01 
            OR c.price = 100.00
            OR (cat.name = 'Case' AND c.price < 1000)
            OR (cat.name = 'PSU' AND c.price < 1500)
            OR (cat.name = 'RAM' AND c.price < 1000)
            OR (cat.name = 'GPU' AND c.price < 5000)
        ORDER BY cat.name, c.price ASC
    ");
    
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($components) == 0) {
        echo "✅ No components found with incorrect prices!\n";
        echo "All prices appear to be valid.\n";
        exit;
    }
    
    echo "Found " . count($components) . " components that may need price verification:\n\n";
    
    $categoryGroups = [];
    foreach ($components as $comp) {
        $category = $comp['category_name'];
        if (!isset($categoryGroups[$category])) {
            $categoryGroups[$category] = [];
        }
        $categoryGroups[$category][] = $comp;
    }
    
    // Market price expectations (Philippine market)
    $marketExpectations = [
        'Case' => [
            'budget' => ['min' => 800, 'max' => 1500],
            'mid' => ['min' => 1500, 'max' => 4000],
            'premium' => ['min' => 4000, 'max' => 10000]
        ],
        'PSU' => [
            'budget' => ['min' => 1000, 'max' => 2500],
            'mid' => ['min' => 2500, 'max' => 5000],
            'premium' => ['min' => 5000, 'max' => 15000]
        ],
        'RAM' => [
            'budget' => ['min' => 800, 'max' => 2000],
            'mid' => ['min' => 2000, 'max' => 5000],
            'premium' => ['min' => 5000, 'max' => 15000]
        ],
        'GPU' => [
            'budget' => ['min' => 3000, 'max' => 8000],
            'mid' => ['min' => 8000, 'max' => 25000],
            'premium' => ['min' => 25000, 'max' => 100000]
        ]
    ];
    
    foreach ($categoryGroups as $category => $comps) {
        echo str_repeat("=", 80) . "\n";
        echo strtoupper($category) . " COMPONENTS\n";
        echo str_repeat("=", 80) . "\n\n";
        
        foreach ($comps as $comp) {
            $price = floatval($comp['price']);
            $issue = '';
            $recommendation = '';
            
            // Determine issue
            if ($price == 0.00) {
                $issue = '❌ ZERO PRICE';
                $recommendation = 'MUST FIX - Set a valid price';
            } elseif ($price == 0.01 || $price == 100.00) {
                $issue = '⚠️  PLACEHOLDER PRICE';
                $recommendation = 'MUST FIX - Replace with actual market price';
            } elseif (isset($marketExpectations[$category])) {
                $expectations = $marketExpectations[$category];
                $isBudget = false;
                
                // Check if it's in budget range
                if ($price >= $expectations['budget']['min'] && $price <= $expectations['budget']['max']) {
                    $issue = '✓ BUDGET PRICE (Likely correct)';
                    $isBudget = true;
                } elseif ($price < $expectations['budget']['min']) {
                    $issue = '⚠️  VERY LOW - Verify against market';
                    $recommendation = "Expected minimum: ₱" . number_format($expectations['budget']['min'], 2);
                } else {
                    $issue = '✓ VALID PRICE';
                }
                
                if (!$isBudget && $price < $expectations['budget']['min']) {
                    $recommendation = "Market range: ₱" . number_format($expectations['budget']['min'], 2) . 
                                     " - ₱" . number_format($expectations['budget']['max'], 2) . " (budget)";
                }
            }
            
            echo sprintf("ID: %d\n", $comp['id']);
            echo sprintf("  Name: %s\n", $comp['name']);
            echo sprintf("  Brand: %s\n", $comp['brand'] ?? 'N/A');
            echo sprintf("  Model: %s\n", $comp['model'] ?? 'N/A');
            echo sprintf("  Current Price: ₱%s\n", number_format($price, 2));
            echo sprintf("  Status: %s\n", $issue);
            if ($recommendation) {
                echo sprintf("  Recommendation: %s\n", $recommendation);
            }
            echo sprintf("  Stock: %d | Active: %s\n", $comp['stock_quantity'], $comp['is_active'] ? 'Yes' : 'No');
            echo "\n";
        }
    }
    
    echo str_repeat("=", 80) . "\n";
    echo "SUMMARY & RECOMMENDATIONS\n";
    echo str_repeat("=", 80) . "\n\n";
    
    $zeroCount = 0;
    $placeholderCount = 0;
    $veryLowCount = 0;
    $budgetCount = 0;
    
    foreach ($components as $comp) {
        $price = floatval($comp['price']);
        if ($price == 0.00) {
            $zeroCount++;
        } elseif ($price == 0.01 || $price == 100.00) {
            $placeholderCount++;
        } elseif (isset($marketExpectations[$comp['category_name']])) {
            $expectations = $marketExpectations[$comp['category_name']];
            if ($price >= $expectations['budget']['min'] && $price <= $expectations['budget']['max']) {
                $budgetCount++;
            } elseif ($price < $expectations['budget']['min']) {
                $veryLowCount++;
            }
        }
    }
    
    echo "Components by Status:\n";
    if ($zeroCount > 0) {
        echo "  ❌ Zero Prices: {$zeroCount} (MUST FIX)\n";
    }
    if ($placeholderCount > 0) {
        echo "  ⚠️  Placeholder Prices: {$placeholderCount} (MUST FIX)\n";
    }
    if ($veryLowCount > 0) {
        echo "  ⚠️  Very Low Prices: {$veryLowCount} (VERIFY)\n";
    }
    if ($budgetCount > 0) {
        echo "  ✓ Budget Prices: {$budgetCount} (Likely correct)\n";
    }
    
    echo "\n";
    echo "ACTION ITEMS:\n";
    echo "1. Review components with zero or placeholder prices\n";
    echo "2. Verify 'very low' prices against actual market prices\n";
    echo "3. Budget components (₱500-₱2,000) may be correct for entry-level products\n";
    echo "4. Update any incorrect prices in the database\n";
    echo "\n";
    echo "Report Generated: " . date('Y-m-d H:i:s') . "\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

