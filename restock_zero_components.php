<?php
/**
 * Restock Zero Components Script
 * 
 * This script sets stock_quantity to 20 for all components that currently have 0 stock.
 * This is useful for testing purposes when most components are out of stock.
 * 
 * Usage: Run this script directly from browser or CLI
 */

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/utils/branch_helper.php';

header('Content-Type: text/html; charset=utf-8');

$pdo = get_db_connection();

echo "<!DOCTYPE html>
<html>
<head>
    <title>Restock Zero Components</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        .success { color: #4CAF50; padding: 10px; background: #e8f5e9; border-left: 4px solid #4CAF50; margin: 10px 0; }
        .info { color: #2196F3; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196F3; margin: 10px 0; }
        .warning { color: #ff9800; padding: 10px; background: #fff3e0; border-left: 4px solid #ff9800; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; }
        tr:hover { background-color: #f5f5f5; }
        .count { font-size: 24px; font-weight: bold; color: #4CAF50; }
    </style>
</head>
<body>
<div class='container'>
<h1>🔄 Restock Zero Components</h1>";

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
        echo "<div class='info'>✅ No components found with zero stock. All components already have stock!</div>";
        $pdo->rollBack();
        echo "</div></body></html>";
        exit;
    }
    
    echo "<div class='info'>📊 Found <span class='count'>{$totalComponents}</span> components with zero stock</div>";
    
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
    }
    
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
    }
    
    $pdo->commit();
    
    echo "<div class='success'>✅ Successfully updated <span class='count'>{$updatedCount}</span> components to 20 stock</div>";
    
    // Display summary table
    echo "<h2>📋 Updated Components</h2>";
    echo "<table>";
    echo "<tr><th>ID</th><th>Component Name</th><th>Category ID</th><th>Old Stock</th><th>New Stock</th><th>Price</th></tr>";
    
    foreach ($updatedComponents as $comp) {
        echo "<tr>";
        echo "<td>{$comp['id']}</td>";
        echo "<td>{$comp['name']}</td>";
        echo "<td>{$comp['category_id']}</td>";
        echo "<td>{$comp['old_stock']}</td>";
        echo "<td><strong>{$comp['new_stock']}</strong></td>";
        echo "<td>₱" . number_format($comp['price'], 2) . "</td>";
        echo "</tr>";
    }
    
    echo "</table>";
    
    // Summary stats
    $categoryStats = [];
    foreach ($updatedComponents as $comp) {
        $catId = $comp['category_id'];
        if (!isset($categoryStats[$catId])) {
            $categoryStats[$catId] = 0;
        }
        $categoryStats[$catId]++;
    }
    
    echo "<h2>📊 Summary by Category</h2>";
    echo "<table>";
    echo "<tr><th>Category ID</th><th>Components Updated</th></tr>";
    foreach ($categoryStats as $catId => $count) {
        echo "<tr><td>{$catId}</td><td>{$count}</td></tr>";
    }
    echo "</table>";
    
    if ($branchSystemExists) {
        echo "<div class='info'>💡 Branch inventory system detected. Stock was added to BULACAN branch and total stock was recalculated.</div>";
    }
    
    echo "<div class='success'>✨ All components have been restocked! You can now test the ordering system.</div>";
    
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "<div class='warning'>❌ Error: " . htmlspecialchars($e->getMessage()) . "</div>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}

echo "</div></body></html>";
?>

