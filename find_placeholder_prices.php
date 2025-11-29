<?php
/**
 * Find components with suspiciously low placeholder prices
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Components from the problematic prebuilt
    $componentIds = [1155, 1153, 1159, 1150, 1072, 1147, 541, 1148];
    
    $placeholders = implode(',', array_fill(0, count($componentIds), '?'));
    $stmt = $pdo->prepare("SELECT c.id, c.name, c.price, cat.name as category FROM components c JOIN component_categories cat ON c.category_id = cat.id WHERE c.id IN ($placeholders) ORDER BY c.price ASC");
    $stmt->execute($componentIds);
    $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "=== COMPONENT PRICE CHECK ===\n\n";
    echo "Components used in 'AMD Budget - RX 6600' prebuilt:\n\n";
    
    $total = 0;
    foreach ($components as $comp) {
        $price = floatval($comp['price']);
        $total += $price;
        
        $status = '';
        if ($price < 1000 && stripos($comp['category'], 'CPU') !== false) {
            $status = ' ⚠️  SUSPICIOUS - CPUs should cost much more';
        } elseif ($price < 5000 && stripos($comp['category'], 'GPU') !== false) {
            $status = ' ⚠️  SUSPICIOUS - GPUs should cost much more';
        } elseif ($price < 3000 && stripos($comp['category'], 'Motherboard') !== false) {
            $status = ' ⚠️  SUSPICIOUS - Motherboards should cost more';
        } elseif ($price == 100.00 || $price == 0.01) {
            $status = ' ⚠️  PLACEHOLDER PRICE';
        }
        
        echo sprintf(
            "[%s] %s\n   Price: ₱%s%s\n\n",
            $comp['category'],
            $comp['name'],
            number_format($price, 2),
            $status
        );
    }
    
    echo "Total: ₱" . number_format($total, 2) . "\n";
    echo "\n=== RECOMMENDATION ===\n";
    echo "These component prices appear to be placeholders/test data.\n";
    echo "You need to update the component prices in the database with real prices.\n";
    echo "\nA Ryzen 7 5700X should cost around ₱8,000-₱12,000\n";
    echo "An RX 6600 GPU should cost around ₱14,000-₱18,000\n";
    echo "A B550M motherboard should cost around ₱4,000-₱8,000\n";
    echo "16GB DDR4 RAM should cost around ₱2,500-₱4,000\n";
    echo "\nThe prebuilt price of ₱1,104.01 is correct based on the stored component prices,\n";
    echo "but those component prices themselves are wrong.\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

