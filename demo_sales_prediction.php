<?php
// demo_sales_prediction.php
// Demonstration of how sales prediction works in your system

require_once 'backend/config/database.php';

echo "🎯 Sales Prediction System Demonstration\n";
echo "========================================\n\n";

try {
    $pdo = get_db_connection();
    echo "✅ Database connection successful\n";
    
    // Check if we have sales data
    $orderCount = $pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'Completed'")->fetchColumn();
    echo "📊 Found $orderCount completed orders\n";
    
    if ($orderCount == 0) {
        echo "⚠️  No completed orders found. Creating sample data...\n";
        createSampleData($pdo);
        $orderCount = $pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'Completed'")->fetchColumn();
    }
    
    echo "\n📈 Analyzing Sales Data...\n";
    echo "==========================\n";
    
    // Get historical sales data (last 6 months)
    $stmt = $pdo->query("
        SELECT 
            DATE_FORMAT(order_date, '%Y-%m') as month,
            SUM(total_price) as total_sales,
            COUNT(*) as order_count,
            AVG(total_price) as avg_order_value
        FROM orders 
        WHERE status = 'Completed' 
        AND order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY DATE_FORMAT(order_date, '%Y-%m')
        ORDER BY month ASC
    ");
    
    $historicalData = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($historicalData)) {
        echo "❌ No historical data available\n";
        exit;
    }
    
    echo "Historical Sales Data:\n";
    echo "Month\t\tSales\t\tOrders\t\tAvg Order\n";
    echo "-----\t\t-----\t\t------\t\t--------\n";
    
    $totalSales = 0;
    foreach ($historicalData as $row) {
        $totalSales += $row['total_sales'];
        echo sprintf("%s\t₱%s\t%d\t\t₱%s\n", 
            $row['month'], 
            number_format($row['total_sales'], 2),
            $row['order_count'],
            number_format($row['avg_order_value'], 2)
        );
    }
    
    echo "\n📊 Sales Analysis:\n";
    echo "==================\n";
    
    // Calculate basic statistics
    $sales = array_column($historicalData, 'total_sales');
    $avgSales = array_sum($sales) / count($sales);
    $maxSales = max($sales);
    $minSales = min($sales);
    $growthRate = count($sales) > 1 ? (($sales[count($sales)-1] - $sales[0]) / $sales[0]) * 100 : 0;
    
    echo "Average Monthly Sales: ₱" . number_format($avgSales, 2) . "\n";
    echo "Highest Monthly Sales: ₱" . number_format($maxSales, 2) . "\n";
    echo "Lowest Monthly Sales: ₱" . number_format($minSales, 2) . "\n";
    echo "Growth Rate: " . number_format($growthRate, 1) . "%\n";
    
    echo "\n🔮 Sales Predictions:\n";
    echo "====================\n";
    
    // Simple moving average prediction
    $recentMonths = array_slice($sales, -3); // Last 3 months
    $movingAverage = array_sum($recentMonths) / count($recentMonths);
    
    // Linear trend prediction
    $n = count($sales);
    $sumX = 0; $sumY = 0; $sumXY = 0; $sumXX = 0;
    
    for ($i = 0; $i < $n; $i++) {
        $x = $i;
        $y = $sales[$i];
        $sumX += $x;
        $sumY += $y;
        $sumXY += $x * $y;
        $sumXX += $x * $x;
    }
    
    $slope = ($n * $sumXY - $sumX * $sumY) / ($n * $sumXX - $sumX * $sumX);
    $intercept = ($sumY - $slope * $sumX) / $n;
    $nextMonthTrend = $intercept + $slope * $n;
    
    echo "Next Month Predictions:\n";
    echo "• Moving Average Method: ₱" . number_format($movingAverage, 2) . "\n";
    echo "• Linear Trend Method: ₱" . number_format(max(0, $nextMonthTrend), 2) . "\n";
    
    // Combined prediction
    $combinedPrediction = ($movingAverage + max(0, $nextMonthTrend)) / 2;
    echo "• Combined Prediction: ₱" . number_format($combinedPrediction, 2) . "\n";
    
    // Calculate confidence
    $variance = 0;
    foreach ($sales as $sale) {
        $variance += pow($sale - $avgSales, 2);
    }
    $variance /= count($sales);
    $stdDev = sqrt($variance);
    $coefficientOfVariation = $stdDev / $avgSales;
    $confidence = max(0.1, min(0.9, 1 - $coefficientOfVariation));
    
    echo "• Confidence Score: " . number_format($confidence * 100, 1) . "%\n";
    
    echo "\n💡 Business Recommendations:\n";
    echo "============================\n";
    
    if ($combinedPrediction > $avgSales * 1.1) {
        echo "• Sales are predicted to increase. Consider increasing inventory.\n";
    } elseif ($combinedPrediction < $avgSales * 0.9) {
        echo "• Sales are predicted to decrease. Consider promotional strategies.\n";
    } else {
        echo "• Sales are predicted to remain stable. Maintain current inventory levels.\n";
    }
    
    if ($confidence < 0.5) {
        echo "• Low confidence in predictions. Consider gathering more historical data.\n";
    }
    
    if ($growthRate > 10) {
        echo "• Strong growth trend detected. Plan for business expansion.\n";
    } elseif ($growthRate < -10) {
        echo "• Declining trend detected. Review business strategy.\n";
    }
    
    echo "\n🎯 How This Helps Your Business:\n";
    echo "===============================\n";
    echo "1. Inventory Management: Predict demand to avoid stockouts or overstock\n";
    echo "2. Financial Planning: Forecast revenue for budgeting and planning\n";
    echo "3. Marketing Strategy: Time promotions during predicted low-sales periods\n";
    echo "4. Growth Planning: Identify trends for business expansion decisions\n";
    
    echo "\n📱 To Use the Full System:\n";
    echo "=========================\n";
    echo "1. Log in to your admin dashboard\n";
    echo "2. Navigate to Sales Prediction Dashboard\n";
    echo "3. Select time period and components to analyze\n";
    echo "4. Generate detailed predictions with charts and recommendations\n";
    echo "5. Use insights to make informed business decisions\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

function createSampleData($pdo) {
    echo "Creating sample sales data...\n";
    
    // Get a sample user
    $stmt = $pdo->query("SELECT id FROM users LIMIT 1");
    $user = $stmt->fetch();
    
    if (!$user) {
        echo "❌ No users found. Please create a user first.\n";
        return;
    }
    
    $userId = $user['id'];
    
    // Get some components
    $stmt = $pdo->query("SELECT id, price FROM components LIMIT 5");
    $components = $stmt->fetchAll();
    
    if (empty($components)) {
        echo "❌ No components found. Please add some components first.\n";
        return;
    }
    
    // Create sample orders for the last 6 months with realistic patterns
    $months = 6;
    $baseDate = new DateTime();
    $baseDate->modify("-$months months");
    
    // Simulate seasonal patterns (higher sales in certain months)
    $seasonalMultipliers = [0.8, 1.0, 1.2, 1.1, 1.3, 1.5]; // Gradual increase with holiday spike
    
    for ($i = 0; $i < $months; $i++) {
        $orderDate = clone $baseDate;
        $orderDate->modify("+$i months");
        
        // Create 3-8 orders per month (more in later months)
        $ordersPerMonth = rand(3, 8) + $i; // Increasing trend
        $seasonalMultiplier = $seasonalMultipliers[$i];
        
        for ($j = 0; $j < $ordersPerMonth; $j++) {
            $totalAmount = 0;
            $orderDate->setTime(rand(9, 17), rand(0, 59));
            
            // Insert order
            $stmt = $pdo->prepare("INSERT INTO orders (user_id, order_date, status, total, total_price) VALUES (?, ?, 'Completed', ?, ?)");
            $stmt->execute([$userId, $orderDate->format('Y-m-d H:i:s'), 0, 0]);
            $orderId = $pdo->lastInsertId();
            
            // Add 1-3 items per order
            $itemsPerOrder = rand(1, 3);
            $selectedComponents = array_rand($components, min($itemsPerOrder, count($components)));
            
            if (!is_array($selectedComponents)) {
                $selectedComponents = [$selectedComponents];
            }
            
            foreach ($selectedComponents as $compIndex) {
                $component = $components[$compIndex];
                $quantity = rand(1, 2);
                $basePrice = $component['price'] * (0.9 + (rand(0, 20) / 100)); // Add some price variation
                $price = $basePrice * $seasonalMultiplier; // Apply seasonal multiplier
                $totalAmount += $price * $quantity;
                
                $stmt = $pdo->prepare("INSERT INTO order_items (order_id, component_id, quantity, price) VALUES (?, ?, ?, ?)");
                $stmt->execute([$orderId, $component['id'], $quantity, $price]);
            }
            
            // Update order total
            $stmt = $pdo->prepare("UPDATE orders SET total = ?, total_price = ? WHERE id = ?");
            $stmt->execute([$totalAmount, $totalAmount, $orderId]);
        }
    }
    
    echo "✅ Created sample data for $months months with seasonal patterns\n";
}

echo "\n🎉 Demonstration completed!\n";
echo "\nFor detailed usage instructions, see SALES_PREDICTION_GUIDE.md\n";
?>
