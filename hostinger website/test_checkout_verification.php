<?php
/**
 * Checkout Verification Script
 * 
 * This script helps verify that the checkout process correctly updates component inventory
 * when a prebuilt PC is checked out.
 * 
 * Usage: Run this script BEFORE and AFTER checkout to compare stock levels
 */

require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();

// AMD Enthusiast Prebuilt ID: 24
// Component IDs from the prebuilt:
$prebuiltId = 24;
$prebuiltName = "AMD Enthusiast";
$componentIds = [
    'cpu' => 1037,
    'motherboard' => 973,
    'ram' => 806,
    'storage' => 1124,
    'psu' => 1072,
    'case' => 1147,
    'gpu' => 533,
    'cooler' => 1148
];

echo "========================================\n";
echo "CHECKOUT VERIFICATION SCRIPT\n";
echo "Prebuilt: {$prebuiltName} (ID: {$prebuiltId})\n";
echo "========================================\n\n";

// Get prebuilt info
$stmt = $pdo->prepare("SELECT id, name, price, component_ids, in_stock FROM prebuilts WHERE id = ?");
$stmt->execute([$prebuiltId]);
$prebuilt = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$prebuilt) {
    die("ERROR: Prebuilt not found!\n");
}

echo "Prebuilt Information:\n";
echo "  Name: {$prebuilt['name']}\n";
echo "  Price: ₱" . number_format($prebuilt['price'], 2) . "\n";
echo "  In Stock Flag: " . ($prebuilt['in_stock'] ? 'Yes' : 'No') . "\n";
echo "  Component IDs: {$prebuilt['component_ids']}\n\n";

// Get current stock for all components
echo "Component Stock Levels:\n";
echo str_repeat("-", 80) . "\n";
printf("%-5s %-40s %-10s %-10s\n", "ID", "Component Name", "Stock Qty", "Min Level");
echo str_repeat("-", 80) . "\n";

$componentData = [];
$allInStock = true;

foreach ($componentIds as $category => $componentId) {
    $stmt = $pdo->prepare("
        SELECT id, name, stock_quantity, min_stock_level, price 
        FROM components 
        WHERE id = ? AND (is_active IS NULL OR is_active = 1)
    ");
    $stmt->execute([$componentId]);
    $component = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($component) {
        $componentData[$componentId] = $component;
        $stock = (int)$component['stock_quantity'];
        $minLevel = (int)$component['min_stock_level'];
        $status = $stock > 0 ? "✓" : "✗ OUT OF STOCK";
        
        if ($stock <= 0) {
            $allInStock = false;
        }
        
        printf("%-5d %-40s %-10d %-10s %s\n", 
            $component['id'], 
            substr($component['name'], 0, 40),
            $stock,
            $minLevel,
            $status
        );
    } else {
        echo "ERROR: Component ID {$componentId} ({$category}) not found!\n";
        $allInStock = false;
    }
}

echo str_repeat("-", 80) . "\n\n";

// Check recent orders
echo "Recent Orders (Last 5):\n";
echo str_repeat("-", 80) . "\n";
$stmt = $pdo->query("
    SELECT o.id, o.user_id, o.order_date, o.status, o.total, 
           COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    GROUP BY o.id
    ORDER BY o.id DESC
    LIMIT 5
");
$recentOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($recentOrders) > 0) {
    printf("%-5s %-8s %-20s %-15s %-12s %-10s\n", 
        "ID", "User", "Date", "Status", "Total", "Items");
    echo str_repeat("-", 80) . "\n";
    foreach ($recentOrders as $order) {
        printf("%-5d %-8d %-20s %-15s ₱%-11.2f %-10d\n",
            $order['id'],
            $order['user_id'],
            $order['order_date'],
            $order['status'],
            $order['total'],
            $order['item_count']
        );
    }
} else {
    echo "No orders found.\n";
}

echo str_repeat("-", 80) . "\n\n";

// Check if there's a recent order with these components
echo "Checking for recent orders containing these components...\n";
$placeholders = implode(',', array_fill(0, count($componentIds), '?'));
$stmt = $pdo->prepare("
    SELECT oi.order_id, o.order_date, o.status, oi.component_id, 
           c.name as component_name, oi.quantity, oi.price
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN components c ON oi.component_id = c.id
    WHERE oi.component_id IN ($placeholders)
    ORDER BY o.id DESC, oi.component_id
    LIMIT 20
");
$stmt->execute(array_values($componentIds));
$recentOrderItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($recentOrderItems) > 0) {
    echo "Found " . count($recentOrderItems) . " recent order items:\n";
    $currentOrderId = null;
    foreach ($recentOrderItems as $item) {
        if ($currentOrderId !== $item['order_id']) {
            echo "\nOrder #{$item['order_id']} ({$item['order_date']}) - Status: {$item['status']}\n";
            $currentOrderId = $item['order_id'];
        }
        echo "  - {$item['component_name']} (ID: {$item['component_id']}): Qty {$item['quantity']} @ ₱{$item['price']}\n";
    }
} else {
    echo "No recent orders found with these components.\n";
}

echo "\n";

// Summary
echo "========================================\n";
echo "SUMMARY\n";
echo "========================================\n";
echo "All components in stock: " . ($allInStock ? "YES ✓" : "NO ✗") . "\n";
echo "Ready for checkout: " . ($allInStock ? "YES ✓" : "NO ✗") . "\n";
echo "\n";

echo "INSTRUCTIONS:\n";
echo "1. Note the stock quantities above\n";
echo "2. Proceed with checkout in the web interface\n";
echo "3. Run this script again to verify stock was decremented\n";
echo "4. Check that a new order was created with 8 order items\n";
echo "\n";

// Save current state to file for comparison
$stateFile = __DIR__ . '/checkout_state_before.json';
$state = [
    'timestamp' => date('Y-m-d H:i:s'),
    'prebuilt_id' => $prebuiltId,
    'prebuilt_name' => $prebuiltName,
    'components' => $componentData,
    'recent_order_id' => count($recentOrders) > 0 ? $recentOrders[0]['id'] : null
];
file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT));
echo "Current state saved to: {$stateFile}\n";
echo "Run this script again after checkout to compare!\n";

?>

