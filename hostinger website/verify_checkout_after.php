<?php
/**
 * Post-Checkout Verification Script
 * 
 * Compares stock levels before and after checkout to verify inventory was updated correctly
 */

require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();

$stateFile = __DIR__ . '/checkout_state_before.json';

if (!file_exists($stateFile)) {
    die("ERROR: Before state file not found. Please run test_checkout_verification.php FIRST.\n");
}

$beforeState = json_decode(file_get_contents($stateFile), true);

echo "========================================\n";
echo "POST-CHECKOUT VERIFICATION\n";
echo "========================================\n\n";

echo "Before State Timestamp: {$beforeState['timestamp']}\n";
echo "Prebuilt: {$beforeState['prebuilt_name']} (ID: {$beforeState['prebuilt_id']})\n\n";

// Get current stock
$componentIds = array_keys($beforeState['components']);
$placeholders = implode(',', array_fill(0, count($componentIds), '?'));
$stmt = $pdo->prepare("
    SELECT id, name, stock_quantity, min_stock_level, price 
    FROM components 
    WHERE id IN ($placeholders) AND (is_active IS NULL OR is_active = 1)
");
$stmt->execute($componentIds);
$currentComponents = [];
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $currentComponents[$row['id']] = $row;
}

// Compare stock levels
echo "Stock Level Comparison:\n";
echo str_repeat("=", 100) . "\n";
printf("%-5s %-40s %-12s %-12s %-12s %-15s\n", 
    "ID", "Component Name", "Before", "After", "Difference", "Status");
echo str_repeat("-", 100) . "\n";

$allUpdated = true;
$totalDecremented = 0;

foreach ($beforeState['components'] as $componentId => $beforeComponent) {
    $afterComponent = $currentComponents[$componentId] ?? null;
    
    if (!$afterComponent) {
        echo "ERROR: Component ID {$componentId} not found after checkout!\n";
        $allUpdated = false;
        continue;
    }
    
    $beforeStock = (int)$beforeComponent['stock_quantity'];
    $afterStock = (int)$afterComponent['stock_quantity'];
    $difference = $afterStock - $beforeStock;
    $expectedDecrement = -1; // Each component should be decremented by 1
    
    $status = "✓ OK";
    if ($difference !== $expectedDecrement) {
        $status = "✗ UNEXPECTED";
        $allUpdated = false;
    } else {
        $totalDecremented++;
    }
    
    printf("%-5d %-40s %-12d %-12d %-12d %-15s\n",
        $componentId,
        substr($beforeComponent['name'], 0, 40),
        $beforeStock,
        $afterStock,
        $difference,
        $status
    );
}

echo str_repeat("=", 100) . "\n\n";

// Check for new order
echo "Order Verification:\n";
echo str_repeat("-", 80) . "\n";

$lastOrderIdBefore = $beforeState['recent_order_id'] ?? 0;
$stmt = $pdo->prepare("
    SELECT o.id, o.user_id, o.order_date, o.status, o.total,
           COUNT(oi.id) as item_count,
           GROUP_CONCAT(oi.component_id ORDER BY oi.component_id) as component_ids
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.id > ?
    GROUP BY o.id
    ORDER BY o.id DESC
    LIMIT 5
");
$stmt->execute([$lastOrderIdBefore]);
$newOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($newOrders) > 0) {
    echo "New orders found after checkout:\n\n";
    foreach ($newOrders as $order) {
        echo "Order #{$order['id']}\n";
        echo "  Date: {$order['order_date']}\n";
        echo "  Status: {$order['status']}\n";
        echo "  Total: ₱" . number_format($order['total'], 2) . "\n";
        echo "  Item Count: {$order['item_count']}\n";
        
        // Check if this order contains all our components
        $orderComponentIds = explode(',', $order['component_ids']);
        $orderComponentIds = array_map('intval', $orderComponentIds);
        $expectedIds = array_map('intval', $componentIds);
        $missing = array_diff($expectedIds, $orderComponentIds);
        $extra = array_diff($orderComponentIds, $expectedIds);
        
        if (empty($missing) && count($orderComponentIds) === count($expectedIds)) {
            echo "  ✓ Contains all expected components\n";
        } else {
            echo "  ✗ Component mismatch!\n";
            if (!empty($missing)) {
                echo "    Missing: " . implode(', ', $missing) . "\n";
            }
            if (!empty($extra)) {
                echo "    Extra: " . implode(', ', $extra) . "\n";
            }
        }
        
        // Get order items details
        $stmt2 = $pdo->prepare("
            SELECT oi.component_id, c.name, oi.quantity, oi.price
            FROM order_items oi
            JOIN components c ON oi.component_id = c.id
            WHERE oi.order_id = ?
            ORDER BY oi.component_id
        ");
        $stmt2->execute([$order['id']]);
        $orderItems = $stmt2->fetchAll(PDO::FETCH_ASSOC);
        
        echo "  Order Items:\n";
        foreach ($orderItems as $item) {
            echo "    - {$item['name']} (ID: {$item['component_id']}): Qty {$item['quantity']} @ ₱{$item['price']}\n";
        }
        echo "\n";
    }
} else {
    echo "No new orders found. Checkout may not have completed.\n\n";
}

// Final verification
echo "========================================\n";
echo "VERIFICATION RESULTS\n";
echo "========================================\n";
echo "Components decremented correctly: " . ($totalDecremented === count($componentIds) ? "YES ✓" : "NO ✗ ({$totalDecremented}/" . count($componentIds) . ")") . "\n";
echo "New order created: " . (count($newOrders) > 0 ? "YES ✓" : "NO ✗") . "\n";
echo "All checks passed: " . ($allUpdated && count($newOrders) > 0 ? "YES ✓" : "NO ✗") . "\n";
echo "\n";

if ($allUpdated && count($newOrders) > 0) {
    echo "✓ CHECKOUT PROCESS VERIFIED SUCCESSFULLY!\n";
    echo "  - All component stocks were decremented correctly\n";
    echo "  - Order was created with correct items\n";
} else {
    echo "✗ VERIFICATION FAILED!\n";
    if (!$allUpdated) {
        echo "  - Some components were not decremented correctly\n";
    }
    if (count($newOrders) === 0) {
        echo "  - No new order was created\n";
    }
}

echo "\n";

?>

