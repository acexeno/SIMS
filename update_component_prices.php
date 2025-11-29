<?php
/**
 * Script to update placeholder component prices with realistic values
 * Based on typical Philippine market prices
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "=== UPDATING COMPONENT PRICES ===\n\n";
    
    // Price mappings based on component name patterns
    // Format: [pattern => price, pattern => price, ...]
    $priceUpdates = [
        // GPUs
        ['pattern' => 'RX 6600', 'price' => 15000.00, 'category' => 'GPU'],
        ['pattern' => 'RX 6800', 'price' => 25000.00, 'category' => 'GPU'],
        ['pattern' => 'RTX 3060', 'price' => 18000.00, 'category' => 'GPU'],
        ['pattern' => 'RTX 3070', 'price' => 28000.00, 'category' => 'GPU'],
        ['pattern' => 'RTX 3080', 'price' => 35000.00, 'category' => 'GPU'],
        
        // CPUs
        ['pattern' => 'Ryzen 7 5700X', 'price' => 10000.00, 'category' => 'CPU'],
        ['pattern' => 'Ryzen 7 5800X', 'price' => 12000.00, 'category' => 'CPU'],
        ['pattern' => 'Ryzen 5 5600X', 'price' => 8000.00, 'category' => 'CPU'],
        ['pattern' => 'Ryzen 5 5600', 'price' => 7000.00, 'category' => 'CPU'],
        ['pattern' => 'Core i5', 'price' => 9000.00, 'category' => 'CPU'],
        ['pattern' => 'Core i7', 'price' => 14000.00, 'category' => 'CPU'],
        
        // Motherboards
        ['pattern' => 'B550M', 'price' => 5500.00, 'category' => 'Motherboard'],
        ['pattern' => 'B550', 'price' => 6500.00, 'category' => 'Motherboard'],
        ['pattern' => 'X570', 'price' => 10000.00, 'category' => 'Motherboard'],
        ['pattern' => 'B660', 'price' => 6000.00, 'category' => 'Motherboard'],
        
        // RAM
        ['pattern' => '16GB', 'price' => 3500.00, 'category' => 'RAM'],
        ['pattern' => '8GB', 'price' => 1800.00, 'category' => 'RAM'],
        ['pattern' => '32GB', 'price' => 6500.00, 'category' => 'RAM'],
        
        // Storage
        ['pattern' => '2000GB', 'price' => 3500.00, 'category' => 'Storage'],
        ['pattern' => '1TB', 'price' => 3000.00, 'category' => 'Storage'],
        ['pattern' => '500GB', 'price' => 2000.00, 'category' => 'Storage'],
        ['pattern' => '256GB', 'price' => 1500.00, 'category' => 'Storage'],
        
        // PSU
        ['pattern' => '800watts', 'price' => 3500.00, 'category' => 'PSU'],
        ['pattern' => '750W', 'price' => 4000.00, 'category' => 'PSU'],
        ['pattern' => '650W', 'price' => 3500.00, 'category' => 'PSU'],
        ['pattern' => '600W', 'price' => 3000.00, 'category' => 'PSU'],
        
        // Cases
        ['pattern' => 'CH260', 'price' => 2500.00, 'category' => 'Case'],
        
        // Coolers
        ['pattern' => 'AK400', 'price' => 1500.00, 'category' => 'Cooler'],
    ];
    
    // Get category map
    $catStmt = $pdo->query("SELECT id, name FROM component_categories");
    $categories = [];
    foreach ($catStmt->fetchAll(PDO::FETCH_ASSOC) as $cat) {
        $categories[strtolower($cat['name'])] = $cat['id'];
    }
    
    // Find components with placeholder prices (₱100.00 or ₱0.01)
    $stmt = $pdo->query("SELECT c.*, cat.name as category_name FROM components c JOIN component_categories cat ON c.category_id = cat.id WHERE c.price IN (0.01, 100.00) OR c.price < 500");
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($components) . " components with placeholder prices\n\n";
    
    $updated = 0;
    $skipped = 0;
    
    foreach ($components as $comp) {
        $compName = $comp['name'];
        $currentPrice = floatval($comp['price']);
        $categoryName = strtolower($comp['category_name']);
        
        // Try to find matching price update
        $newPrice = null;
        foreach ($priceUpdates as $update) {
            $pattern = strtolower($update['pattern']);
            $updateCategory = strtolower($update['category']);
            
            if (stripos($compName, $update['pattern']) !== false && 
                ($updateCategory === $categoryName || $categoryName === strtolower($update['category']))) {
                $newPrice = $update['price'];
                break;
            }
        }
        
        // Category-based fallback pricing
        if ($newPrice === null) {
            switch ($categoryName) {
                case 'cpu':
                    $newPrice = 8000.00; // Default CPU price
                    break;
                case 'gpu':
                    $newPrice = 15000.00; // Default GPU price
                    break;
                case 'motherboard':
                    $newPrice = 5000.00; // Default motherboard price
                    break;
                case 'ram':
                    $newPrice = 3000.00; // Default RAM price
                    break;
                case 'storage':
                    $newPrice = 2500.00; // Default storage price
                    break;
                case 'psu':
                    $newPrice = 3500.00; // Default PSU price
                    break;
                case 'case':
                    $newPrice = 2000.00; // Default case price
                    break;
                case 'cooler':
                    $newPrice = 1500.00; // Default cooler price
                    break;
                default:
                    $newPrice = null;
            }
        }
        
        if ($newPrice !== null && $newPrice > $currentPrice) {
            try {
                $updateStmt = $pdo->prepare('UPDATE components SET price = ? WHERE id = ?');
                $updateStmt->execute([$newPrice, $comp['id']]);
                
                echo sprintf(
                    "✓ Updated [%s] %s\n   ₱%s → ₱%s\n\n",
                    $comp['category_name'],
                    $compName,
                    number_format($currentPrice, 2),
                    number_format($newPrice, 2)
                );
                $updated++;
            } catch (Exception $e) {
                echo "✗ Error updating {$compName}: " . $e->getMessage() . "\n\n";
            }
        } else {
            $skipped++;
        }
    }
    
    echo str_repeat("=", 80) . "\n";
    echo "SUMMARY:\n";
    echo "  Updated: {$updated}\n";
    echo "  Skipped: {$skipped}\n";
    echo "\n";
    echo "⚠️  IMPORTANT: After updating component prices, you need to recalculate prebuilt prices.\n";
    echo "Run: php fix_prebuilt_prices.php\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

