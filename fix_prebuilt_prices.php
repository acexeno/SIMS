<?php
/**
 * Script to recalculate and update all prebuilt prices in the database
 * This fixes incorrect prices like ₱1,104 for high-end prebuilts
 */

// Set CLI environment for database detection
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "=== FIXING PREBUILT PRICES ===\n\n";
    
    // Get all prebuilts
    $stmt = $pdo->query('SELECT * FROM prebuilts');
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($prebuilts) . " prebuilts\n\n";
    
    $updated = 0;
    $errors = [];
    $priceChanges = [];
    
    foreach ($prebuilts as $prebuilt) {
        $prebuiltId = $prebuilt['id'];
        $oldPrice = floatval($prebuilt['price'] ?? 0);
        $componentIds = json_decode($prebuilt['component_ids'] ?? '{}', true);
        
        if (!is_array($componentIds) || empty($componentIds)) {
            $errors[] = "Prebuilt #{$prebuiltId} ({$prebuilt['name']}): No component IDs";
            continue;
        }
        
        // Get all component IDs
        $ids = array_filter(array_map('intval', array_values($componentIds)));
        if (empty($ids)) {
            $errors[] = "Prebuilt #{$prebuiltId} ({$prebuilt['name']}): Empty component IDs";
            continue;
        }
        
        // Calculate new price from components
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $compStmt = $pdo->prepare("SELECT id, name, price FROM components WHERE id IN ($placeholders)");
        $compStmt->execute($ids);
        $components = $compStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $newPrice = 0;
        $missingComponents = [];
        
        foreach ($components as $comp) {
            $compPrice = floatval($comp['price'] ?? 0);
            $newPrice += $compPrice;
            
            if ($compPrice == 0) {
                $missingComponents[] = $comp['name'] . " (ID: {$comp['id']})";
            }
        }
        
        // Only update if price changed significantly (> 1 peso difference)
        if (abs($newPrice - $oldPrice) > 1) {
            try {
                $updateStmt = $pdo->prepare('UPDATE prebuilts SET price = ? WHERE id = ?');
                $updateStmt->execute([$newPrice, $prebuiltId]);
                
                $updated++;
                $priceChanges[] = [
                    'id' => $prebuiltId,
                    'name' => $prebuilt['name'],
                    'old' => $oldPrice,
                    'new' => $newPrice,
                    'difference' => $newPrice - $oldPrice,
                    'missing_prices' => $missingComponents
                ];
                
                echo sprintf(
                    "✓ Prebuilt #%d: %s\n   Old: ₱%s → New: ₱%s (Difference: ₱%s)\n",
                    $prebuiltId,
                    $prebuilt['name'],
                    number_format($oldPrice, 2),
                    number_format($newPrice, 2),
                    number_format($newPrice - $oldPrice, 2)
                );
                
                if (!empty($missingComponents)) {
                    echo "   ⚠️  Components with ₱0.00: " . implode(', ', $missingComponents) . "\n";
                }
                echo "\n";
            } catch (Exception $e) {
                $errors[] = "Prebuilt #{$prebuiltId}: Update failed - " . $e->getMessage();
            }
        } else {
            if (!empty($missingComponents)) {
                echo "⚠️  Prebuilt #{$prebuiltId}: {$prebuilt['name']} has components with ₱0.00: " . implode(', ', $missingComponents) . "\n";
            }
        }
    }
    
    echo "\n" . str_repeat("=", 80) . "\n";
    echo "SUMMARY:\n";
    echo "  Total prebuilts: " . count($prebuilts) . "\n";
    echo "  Updated: {$updated}\n";
    echo "  Errors: " . count($errors) . "\n";
    
    if (!empty($errors)) {
        echo "\nERRORS:\n";
        foreach ($errors as $error) {
            echo "  - {$error}\n";
        }
    }
    
    echo "\n✓ Price update complete!\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

