<?php
// test_sales_prediction.php
// Test script to demonstrate sales prediction functionality

require_once 'backend/config/database.php';

echo "🧪 Sales Prediction System Test\n";
echo "================================\n\n";

try {
    $pdo = get_db_connection();
    echo "✅ Database connection successful\n";
    
    // Check if we have sales data
    $orderCount = $pdo->query("SELECT COUNT(*) FROM orders WHERE status = 'Completed'")->fetchColumn();
    echo "📊 Found $orderCount completed orders\n";
    
    if ($orderCount == 0) {
        echo "⚠️  No completed orders found. Creating sample data...\n";
        createSampleData($pdo);
    }
    
    // Test the prediction system
    echo "\n🔮 Testing Sales Prediction System...\n";
    echo "=====================================\n";
    
    // Simulate API call
    $_SERVER['REQUEST_METHOD'] = 'GET';
    $_GET['period'] = 'monthly';
    $_GET['forecast_months'] = 3;
    
    // Include the prediction API
    ob_start();
    include 'backend/api/sales_prediction.php';
    $output = ob_get_clean();
    
    $response = json_decode($output, true);
    
    if ($response && $response['success']) {
        echo "✅ Prediction system working correctly!\n";
        echo "📈 Confidence Score: " . ($response['predictions']['confidence_score'] * 100) . "%\n";
        echo "🔮 Next Period Prediction: ₱" . number_format($response['predictions']['combined_prediction'][0]['predicted_sales'], 2) . "\n";
        echo "📊 Historical Data Points: " . count($response['predictions']['historical_data']) . "\n";
        
        if (!empty($response['predictions']['recommendations'])) {
            echo "\n💡 Recommendations:\n";
            foreach ($response['predictions']['recommendations'] as $rec) {
                echo "   • $rec\n";
            }
        }
    } else {
        echo "❌ Prediction system test failed\n";
        echo "Response: " . $output . "\n";
    }
    
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
    
    // Create sample orders for the last 6 months
    $months = 6;
    $baseDate = new DateTime();
    $baseDate->modify("-$months months");
    
    for ($i = 0; $i < $months; $i++) {
        $orderDate = clone $baseDate;
        $orderDate->modify("+$i months");
        
        // Create 2-5 orders per month
        $ordersPerMonth = rand(2, 5);
        
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
                $price = $component['price'] * (0.9 + (rand(0, 20) / 100)); // Add some price variation
                $totalAmount += $price * $quantity;
                
                $stmt = $pdo->prepare("INSERT INTO order_items (order_id, component_id, quantity, price) VALUES (?, ?, ?, ?)");
                $stmt->execute([$orderId, $component['id'], $quantity, $price]);
            }
            
            // Update order total
            $stmt = $pdo->prepare("UPDATE orders SET total = ?, total_price = ? WHERE id = ?");
            $stmt->execute([$totalAmount, $totalAmount, $orderId]);
        }
    }
    
    echo "✅ Created sample data for $months months\n";
}

echo "\n🎉 Test completed!\n";
echo "\nTo use the Sales Prediction System:\n";
echo "1. Run: php backend/migrations/create_sales_predictions_table.php\n";
echo "2. Access the Sales Prediction Dashboard in your admin panel\n";
echo "3. Generate predictions for different time periods and components\n";
echo "\nFor more information, see SALES_PREDICTION_GUIDE.md\n";
?>
