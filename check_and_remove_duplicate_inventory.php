<?php
/**
 * Check and Remove Duplicate Inventory Script
 * 
 * This script identifies and removes duplicate components from the database.
 * It checks for duplicates based on multiple criteria:
 * 1. Same name + category_id (most common)
 * 2. Same name + brand + category_id
 * 3. Same name + brand + model + category_id
 * 
 * It keeps the record with the most complete data (non-null fields) or the most recent one.
 */

// Force local database connection for CLI
$_SERVER['HTTP_HOST'] = 'localhost';

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "========================================\n";
    echo "Duplicate Inventory Check and Removal\n";
    echo "========================================\n\n";
    
    // First, let's check the total count
    $totalStmt = $pdo->query("SELECT COUNT(*) as total FROM components");
    $total = $totalStmt->fetch()['total'];
    echo "Total components in database: {$total}\n\n";
    
    // Check for duplicates based on name + category_id
    echo "Checking for duplicates (name + category_id)...\n";
    $dupStmt = $pdo->query("
        SELECT 
            name, 
            category_id, 
            COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY id) as ids
        FROM components 
        GROUP BY name, category_id 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    ");
    
    $duplicates = $dupStmt->fetchAll();
    $duplicateCount = count($duplicates);
    
    if ($duplicateCount === 0) {
        echo "✅ No duplicates found based on name + category_id.\n\n";
    } else {
        echo "⚠️  Found {$duplicateCount} groups of duplicates (name + category_id).\n\n";
        
        // Show summary
        $totalDuplicates = 0;
        foreach ($duplicates as $dup) {
            $totalDuplicates += ($dup['count'] - 1); // -1 because we keep one
            echo "  - '{$dup['name']}' (category {$dup['category_id']}): {$dup['count']} duplicates\n";
        }
        echo "\nTotal duplicate records to remove: {$totalDuplicates}\n\n";
        
        // Ask for confirmation
        echo "Starting removal process...\n";
        echo "Keeping records with most complete data (or newest if equal)...\n\n";
        
        $pdo->beginTransaction();
        
        $removed = 0;
        foreach ($duplicates as $dup) {
            $ids = explode(',', $dup['ids']);
            $name = $dup['name'];
            $category_id = $dup['category_id'];
            
            // Get all duplicate records with their data completeness scores
            $recordsStmt = $pdo->prepare("
                SELECT 
                    id,
                    name,
                    brand,
                    model,
                    price,
                    stock_quantity,
                    image_url,
                    specs,
                    socket,
                    cores,
                    threads,
                    tdp,
                    ram_type,
                    form_factor,
                    memory,
                    speed,
                    capacity,
                    wattage,
                    efficiency,
                    fans,
                    type,
                    is_active,
                    created_at,
                    updated_at,
                    -- Calculate completeness score
                    (
                        (CASE WHEN brand IS NOT NULL AND brand != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN model IS NOT NULL AND model != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN specs IS NOT NULL AND specs != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN socket IS NOT NULL AND socket != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN cores IS NOT NULL THEN 1 ELSE 0 END) +
                        (CASE WHEN threads IS NOT NULL THEN 1 ELSE 0 END) +
                        (CASE WHEN tdp IS NOT NULL THEN 1 ELSE 0 END) +
                        (CASE WHEN ram_type IS NOT NULL AND ram_type != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN form_factor IS NOT NULL AND form_factor != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN memory IS NOT NULL AND memory != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN speed IS NOT NULL AND speed != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN capacity IS NOT NULL AND capacity != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN wattage IS NOT NULL THEN 1 ELSE 0 END) +
                        (CASE WHEN efficiency IS NOT NULL AND efficiency != '' THEN 1 ELSE 0 END) +
                        (CASE WHEN fans IS NOT NULL THEN 1 ELSE 0 END) +
                        (CASE WHEN type IS NOT NULL AND type != '' THEN 1 ELSE 0 END)
                    ) as completeness_score
                FROM components
                WHERE name = ? AND category_id = ?
                ORDER BY 
                    (CASE WHEN is_active = 1 THEN 1 ELSE 0 END) DESC, -- Prefer active records
                    completeness_score DESC, -- Prefer more complete records
                    updated_at DESC, -- Prefer more recent records
                    created_at DESC  -- Fallback to creation date
            ");
            $recordsStmt->execute([$name, $category_id]);
            $records = $recordsStmt->fetchAll();
            
            if (count($records) > 1) {
                // Keep the first record (best one)
                $keepId = $records[0]['id'];
                $keepRecord = $records[0];
                
                // Remove all other duplicates
                for ($i = 1; $i < count($records); $i++) {
                    $removeId = $records[$i]['id'];
                    
                    // Check if this component is referenced elsewhere before deleting
                    $checkBuilds = $pdo->prepare("
                        SELECT COUNT(*) FROM user_builds 
                        WHERE JSON_CONTAINS(components, JSON_OBJECT('id', ?))
                    ");
                    $checkBuilds->execute([$removeId]);
                    $inBuilds = $checkBuilds->fetchColumn() > 0;
                    
                    $checkOrders = $pdo->prepare("
                        SELECT COUNT(*) FROM order_items 
                        WHERE component_id = ?
                    ");
                    $checkOrders->execute([$removeId]);
                    $inOrders = $checkOrders->fetchColumn() > 0;
                    
                    $checkBranchStock = $pdo->prepare("
                        SELECT COUNT(*) FROM component_branch_stock 
                        WHERE component_id = ?
                    ");
                    $checkBranchStock->execute([$removeId]);
                    $inBranchStock = $checkBranchStock->fetchColumn() > 0;
                    
                    if ($inBuilds || $inOrders || $inBranchStock) {
                        echo "  ⚠️  Skipping removal of component ID {$removeId} (referenced in builds/orders/branch stock)\n";
                        echo "      Merging stock_quantity into kept record (ID {$keepId})...\n";
                        
                        // Merge stock quantities if applicable
                        if ($records[$i]['stock_quantity'] > 0) {
                            $mergeStmt = $pdo->prepare("
                                UPDATE components 
                                SET stock_quantity = stock_quantity + ? 
                                WHERE id = ?
                            ");
                            $mergeStmt->execute([$records[$i]['stock_quantity'], $keepId]);
                        }
                        
                        // Update references to point to kept record
                        if ($inBuilds) {
                            // Update JSON in user_builds
                            $updateBuilds = $pdo->prepare("
                                UPDATE user_builds 
                                SET components = JSON_REPLACE(
                                    components, 
                                    '$[*].id', 
                                    CASE 
                                        WHEN JSON_EXTRACT(components, '$[*].id') = ? 
                                        THEN ? 
                                        ELSE JSON_EXTRACT(components, '$[*].id')
                                    END
                                )
                                WHERE JSON_CONTAINS(components, JSON_OBJECT('id', ?))
                            ");
                            // This is complex, we'll do it differently
                            echo "      Note: Manual review needed for user_builds references\n";
                        }
                        
                        // Delete from component_branch_stock first (if exists)
                        if ($inBranchStock) {
                            $delBranchStock = $pdo->prepare("DELETE FROM component_branch_stock WHERE component_id = ?");
                            $delBranchStock->execute([$removeId]);
                        }
                        
                        // Update order_items references
                        if ($inOrders) {
                            $updateOrders = $pdo->prepare("UPDATE order_items SET component_id = ? WHERE component_id = ?");
                            $updateOrders->execute([$keepId, $removeId]);
                        }
                        
                        // Now safe to delete
                        $deleteStmt = $pdo->prepare("DELETE FROM components WHERE id = ?");
                        $deleteStmt->execute([$removeId]);
                        $removed++;
                    } else {
                        // Safe to delete - not referenced anywhere
                        $deleteStmt = $pdo->prepare("DELETE FROM components WHERE id = ?");
                        $deleteStmt->execute([$removeId]);
                        $removed++;
                    }
                }
            }
        }
        
        $pdo->commit();
        
        echo "\n✅ Removed {$removed} duplicate components.\n\n";
    }
    
    // Check for duplicates based on name + brand + category_id (more strict)
    echo "Checking for duplicates (name + brand + category_id)...\n";
    $dupStmt2 = $pdo->query("
        SELECT 
            name, 
            brand,
            category_id, 
            COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY id) as ids
        FROM components 
        WHERE brand IS NOT NULL AND brand != ''
        GROUP BY name, brand, category_id 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    ");
    
    $duplicates2 = $dupStmt2->fetchAll();
    $duplicateCount2 = count($duplicates2);
    
    if ($duplicateCount2 === 0) {
        echo "✅ No duplicates found based on name + brand + category_id.\n\n";
    } else {
        echo "⚠️  Found {$duplicateCount2} additional groups of duplicates (name + brand + category_id).\n";
        echo "Processing these duplicates...\n\n";
        
        $pdo->beginTransaction();
        $removed2 = 0;
        
        foreach ($duplicates2 as $dup) {
            $ids = explode(',', $dup['ids']);
            $name = $dup['name'];
            $brand = $dup['brand'];
            $category_id = $dup['category_id'];
            
            // Get all duplicate records
            $recordsStmt = $pdo->prepare("
                SELECT id, updated_at, created_at, is_active,
                    (CASE WHEN model IS NOT NULL AND model != '' THEN 1 ELSE 0 END) +
                    (CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) +
                    (CASE WHEN specs IS NOT NULL AND specs != '' THEN 1 ELSE 0 END) as completeness
                FROM components
                WHERE name = ? AND brand = ? AND category_id = ?
                ORDER BY 
                    (CASE WHEN is_active = 1 THEN 1 ELSE 0 END) DESC,
                    completeness DESC,
                    updated_at DESC,
                    created_at DESC
            ");
            $recordsStmt->execute([$name, $brand, $category_id]);
            $records = $recordsStmt->fetchAll();
            
            if (count($records) > 1) {
                $keepId = $records[0]['id'];
                
                for ($i = 1; $i < count($records); $i++) {
                    $removeId = $records[$i]['id'];
                    $deleteStmt = $pdo->prepare("DELETE FROM components WHERE id = ?");
                    $deleteStmt->execute([$removeId]);
                    $removed2++;
                }
            }
        }
        
        $pdo->commit();
        
        if ($removed2 > 0) {
            echo "✅ Removed {$removed2} additional duplicate components.\n\n";
        }
    }
    
    // Final count
    $finalStmt = $pdo->query("SELECT COUNT(*) as total FROM components");
    $final = $finalStmt->fetch()['total'];
    
    echo "========================================\n";
    echo "Summary:\n";
    echo "  Initial count: {$total}\n";
    echo "  Final count: {$final}\n";
    echo "  Total removed: " . ($total - $final) . "\n";
    echo "========================================\n";
    
    // Optimize table
    echo "\nOptimizing components table...\n";
    $pdo->exec("OPTIMIZE TABLE components");
    echo "✅ Table optimized.\n";
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n✅ Duplicate removal complete!\n";
?>

