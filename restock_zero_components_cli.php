<?php
/**
 * Restock Zero Components Script (CLI Version)
 * 
 * This script sets stock_quantity to 20 for all components that currently have 0 stock.
 * This is useful for testing purposes when most components are out of stock.
 * 
 * Usage: php restock_zero_components_cli.php
 */

// Force local mode for CLI
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['SERVER_NAME'] = 'localhost';

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/utils/branch_helper.php';

$pdo = get_db_connection();

echo "🔄 Restocking Zero Stock Components...\n";
echo str_repeat("=", 60) . "\n\n";

try {
    $pdo->beginTransaction();
    
    // Find all components with stock_quantity = 0 or NULL
    $stmt = $pdo->query("
        SELECT id, name, category_id, stock_quantity, price 
        FROM components 
        WHERE (stock_quantity IS NULL OR stock_quantity = 0) 
        AND (is_active IS NULL OR is_active = 1)
        ORDER BY category_id, name
    ");
    $zeroStockComponents = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalComponents = count($zeroStockComponents);
    
    if ($totalComponents === 0) {
        echo "✅ No components found with zero stock. All components already have stock!\n";
        $pdo->rollBack();
        exit(0);
    }
    
    echo "📊 Found {$totalComponents} components with zero stock\n\n";
    
    // Check if branch inventory system exists
    $branchSystemExists = false;
    try {
        $testStmt = $pdo->query("SELECT 1 FROM component_branch_stock LIMIT 1");
        $branchSystemExists = true;
    } catch (Exception $e) {
        $branchSystemExists = false;
    }
    
    $updatedCount = 0;
    $updatedComponents = [];
    
    // Get default branch (BULACAN) if branch system exists
    $branchId = null;
    if ($branchSystemExists) {
        $branchId = get_branch_id_by_code($pdo, 'BULACAN');
        if ($branchId) {
            echo "💡 Branch inventory system detected. Using BULACAN branch.\n\n";
        }
    }
    
    echo "Updating components...\n";
    echo str_repeat("-", 60) . "\n";
    
    foreach ($zeroStockComponents as $component) {
        $componentId = (int)$component['id'];
        $newStock = 20;
        
        if ($branchSystemExists && $branchId) {
            // Update branch-specific stock
            upsert_branch_stock($pdo, $componentId, $branchId, $newStock);
            // Recalculate total stock
            $totalStock = recalc_total_stock($pdo, $componentId);
        } else {
            // Direct update (no branch system)
            $updStmt = $pdo->prepare("UPDATE components SET stock_quantity = ? WHERE id = ?");
            $updStmt->execute([$newStock, $componentId]);
            $totalStock = $newStock;
        }
        
        $updatedComponents[] = [
            'id' => $componentId,
            'name' => $component['name'],
            'category_id' => $component['category_id'],
            'old_stock' => $component['stock_quantity'] ?? 0,
            'new_stock' => $totalStock,
            'price' => $component['price']
        ];
        $updatedCount++;
        
        echo sprintf("✓ [%d] %s - Stock: %d → %d\n", 
            $componentId, 
            $component['name'], 
            $component['stock_quantity'] ?? 0, 
            $totalStock
        );
    }
    
    $pdo->commit();
    
    echo str_repeat("-", 60) . "\n";
    echo "✅ Successfully updated {$updatedCount} components to 20 stock\n\n";
    
    // Summary stats
    $categoryStats = [];
    foreach ($updatedComponents as $comp) {
        $catId = $comp['category_id'];
        if (!isset($categoryStats[$catId])) {
            $categoryStats[$catId] = 0;
        }
        $categoryStats[$catId]++;
    }
    
    echo "📊 Summary by Category:\n";
    echo str_repeat("-", 60) . "\n";
    foreach ($categoryStats as $catId => $count) {
        echo sprintf("  Category ID %d: %d components\n", $catId, $count);
    }
    
    echo "\n✨ All components have been restocked! You can now test the ordering system.\n";
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}

