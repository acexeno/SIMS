<?php
// api/sales_prediction.php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
require_once __DIR__ . '/auth.php';

// Sales prediction algorithms and endpoints

function handleSalesPrediction($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            handleGetPredictions($pdo);
            break;
        case 'POST':
            handleGeneratePredictions($pdo);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleGetPredictions($pdo) {
    try {
        // Verify authentication
        $token = getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            return;
        }
        
        $decoded = verifyJWT($token);
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }
        
        // Check if user has admin/employee role
        $roles = $decoded['roles'] ?? [];
        if (is_string($roles)) {
            $roles = explode(',', $roles);
        }
        
        if (!in_array('Super Admin', $roles) && !in_array('Admin', $roles) && !in_array('Employee', $roles)) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }
        
        // Get prediction parameters
        $period = isset($_GET['period']) ? $_GET['period'] : 'monthly'; // daily, weekly, monthly
        $forecastMonths = isset($_GET['forecast_months']) ? intval($_GET['forecast_months']) : 3;
        $componentId = isset($_GET['component_id']) ? intval($_GET['component_id']) : null;
        $categoryId = isset($_GET['category_id']) ? intval($_GET['category_id']) : null;
        
        // Generate predictions
        $predictions = generateSalesPredictions($pdo, $period, $forecastMonths, $componentId, $categoryId);
        
        echo json_encode([
            'success' => true,
            'predictions' => $predictions,
            'parameters' => [
                'period' => $period,
                'forecast_months' => $forecastMonths,
                'component_id' => $componentId,
                'category_id' => $categoryId
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate predictions', 'message' => $e->getMessage()]);
    }
}

function handleGeneratePredictions($pdo) {
    try {
        // Verify authentication
        $token = getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            return;
        }
        
        $decoded = verifyJWT($token);
        if (!$decoded || !isset($decoded['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }
        
        // Check if user has admin/employee role
        $roles = $decoded['roles'] ?? [];
        if (is_string($roles)) {
            $roles = explode(',', $roles);
        }
        
        if (!in_array('Super Admin', $roles) && !in_array('Admin', $roles) && !in_array('Employee', $roles)) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden']);
            return;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        $period = $input['period'] ?? 'monthly';
        $forecastMonths = intval($input['forecast_months'] ?? 3);
        $componentId = isset($input['component_id']) ? intval($input['component_id']) : null;
        $categoryId = isset($input['category_id']) ? intval($input['category_id']) : null;
        
        // Generate and store predictions
        $predictions = generateSalesPredictions($pdo, $period, $forecastMonths, $componentId, $categoryId);
        
        // Store predictions in database
        storePredictions($pdo, $predictions, $decoded['user_id']);
        
        echo json_encode([
            'success' => true,
            'message' => 'Predictions generated and stored successfully',
            'predictions' => $predictions
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate predictions', 'message' => $e->getMessage()]);
    }
}

function generateSalesPredictions($pdo, $period = 'monthly', $forecastMonths = 3, $componentId = null, $categoryId = null) {
    $predictions = [];
    
    // Get historical sales data
    $historicalData = getHistoricalSalesData($pdo, $period, $componentId, $categoryId);
    
    if (empty($historicalData)) {
        return [
            'error' => 'Insufficient historical data for prediction',
            'historical_data' => [],
            'predictions' => []
        ];
    }
    
    // Calculate different prediction methods
    $movingAverage = calculateMovingAverage($historicalData, $forecastMonths);
    $linearTrend = calculateLinearTrend($historicalData, $forecastMonths);
    $seasonalAnalysis = calculateSeasonalAnalysis($historicalData, $forecastMonths);
    $exponentialSmoothing = calculateExponentialSmoothing($historicalData, $forecastMonths);
    
    // Combine predictions with confidence scores
    $predictions = [
        'historical_data' => $historicalData,
        'forecast_periods' => $forecastMonths,
        'prediction_methods' => [
            'moving_average' => $movingAverage,
            'linear_trend' => $linearTrend,
            'seasonal_analysis' => $seasonalAnalysis,
            'exponential_smoothing' => $exponentialSmoothing
        ],
        'combined_prediction' => combinePredictions($movingAverage, $linearTrend, $seasonalAnalysis, $exponentialSmoothing),
        'confidence_score' => calculateConfidenceScore($historicalData),
        'recommendations' => generateRecommendations($historicalData, $predictions)
    ];
    
    return $predictions;
}

function getHistoricalSalesData($pdo, $period, $componentId = null, $categoryId = null) {
    $data = [];
    
    // Build base query
    $baseQuery = "SELECT ";
    $groupBy = "";
    $dateFormat = "";
    
    switch ($period) {
        case 'daily':
            $dateFormat = "DATE(o.order_date) as period";
            $groupBy = "DATE(o.order_date)";
            $limit = "AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)";
            break;
        case 'weekly':
            $dateFormat = "YEARWEEK(o.order_date, 1) as period";
            $groupBy = "YEARWEEK(o.order_date, 1)";
            $limit = "AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 52 WEEK)";
            break;
        case 'monthly':
        default:
            $dateFormat = "DATE_FORMAT(o.order_date, '%Y-%m') as period";
            $groupBy = "DATE_FORMAT(o.order_date, '%Y-%m')";
            $limit = "AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)";
            break;
    }
    
    $baseQuery .= "$dateFormat, SUM(oi.price * oi.quantity) as total_sales, SUM(oi.quantity) as total_quantity, COUNT(DISTINCT o.id) as order_count";
    
    $fromClause = "FROM orders o JOIN order_items oi ON o.id = oi.order_id";
    $whereClause = "WHERE o.status = 'Completed' $limit";
    
    // Add component or category filter
    if ($componentId) {
        $whereClause .= " AND oi.component_id = $componentId";
    } elseif ($categoryId) {
        $fromClause .= " JOIN components c ON oi.component_id = c.id";
        $whereClause .= " AND c.category_id = $categoryId";
    }
    
    $query = "$baseQuery $fromClause $whereClause GROUP BY $groupBy ORDER BY period ASC";
    
    try {
        $stmt = $pdo->query($query);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format data for analysis
        foreach ($results as $row) {
            $data[] = [
                'period' => $row['period'],
                'total_sales' => floatval($row['total_sales']),
                'total_quantity' => intval($row['total_quantity']),
                'order_count' => intval($row['order_count']),
                'average_order_value' => floatval($row['total_sales']) / max(1, intval($row['order_count']))
            ];
        }
        
    } catch (Exception $e) {
        error_log("Failed to get historical sales data: " . $e->getMessage());
        return [];
    }
    
    return $data;
}

function calculateMovingAverage($data, $forecastPeriods) {
    if (count($data) < 3) return [];
    
    $sales = array_column($data, 'total_sales');
    $windowSize = min(3, count($sales) - 1);
    
    $predictions = [];
    $lastAverage = array_sum(array_slice($sales, -$windowSize)) / $windowSize;
    
    for ($i = 1; $i <= $forecastPeriods; $i++) {
        $predictions[] = [
            'period' => $i,
            'predicted_sales' => $lastAverage,
            'method' => 'moving_average',
            'confidence' => max(0.3, 1 - ($i * 0.1))
        ];
    }
    
    return $predictions;
}

function calculateLinearTrend($data, $forecastPeriods) {
    if (count($data) < 2) return [];
    
    $sales = array_column($data, 'total_sales');
    $n = count($sales);
    
    // Calculate linear regression
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
    
    $predictions = [];
    for ($i = 1; $i <= $forecastPeriods; $i++) {
        $predictedValue = $intercept + $slope * ($n + $i - 1);
        $predictions[] = [
            'period' => $i,
            'predicted_sales' => max(0, $predictedValue),
            'method' => 'linear_trend',
            'confidence' => max(0.2, 1 - ($i * 0.15))
        ];
    }
    
    return $predictions;
}

function calculateSeasonalAnalysis($data, $forecastPeriods) {
    if (count($data) < 12) return [];
    
    $sales = array_column($data, 'total_sales');
    $seasonalFactors = [];
    
    // Calculate seasonal factors (assuming monthly data)
    $monthlyAverages = array_fill(0, 12, []);
    
    foreach ($data as $index => $row) {
        $month = intval(substr($row['period'], 5, 2)) - 1; // Extract month (0-11)
        $monthlyAverages[$month][] = $row['total_sales'];
    }
    
    // Calculate average for each month
    for ($i = 0; $i < 12; $i++) {
        if (!empty($monthlyAverages[$i])) {
            $seasonalFactors[$i] = array_sum($monthlyAverages[$i]) / count($monthlyAverages[$i]);
        } else {
            $seasonalFactors[$i] = 1.0;
        }
    }
    
    // Normalize seasonal factors
    $avgFactor = array_sum($seasonalFactors) / 12;
    foreach ($seasonalFactors as $i => $factor) {
        $seasonalFactors[$i] = $factor / $avgFactor;
    }
    
    // Calculate overall trend
    $overallAverage = array_sum($sales) / count($sales);
    
    $predictions = [];
    for ($i = 1; $i <= $forecastPeriods; $i++) {
        $monthIndex = ($i - 1) % 12;
        $predictedValue = $overallAverage * $seasonalFactors[$monthIndex];
        
        $predictions[] = [
            'period' => $i,
            'predicted_sales' => $predictedValue,
            'method' => 'seasonal_analysis',
            'confidence' => max(0.4, 1 - ($i * 0.08))
        ];
    }
    
    return $predictions;
}

function calculateExponentialSmoothing($data, $forecastPeriods) {
    if (count($data) < 2) return [];
    
    $sales = array_column($data, 'total_sales');
    $alpha = 0.3; // Smoothing factor
    
    $smoothed = [];
    $smoothed[0] = $sales[0];
    
    for ($i = 1; $i < count($sales); $i++) {
        $smoothed[$i] = $alpha * $sales[$i] + (1 - $alpha) * $smoothed[$i - 1];
    }
    
    $predictions = [];
    $lastSmoothed = end($smoothed);
    
    for ($i = 1; $i <= $forecastPeriods; $i++) {
        $predictions[] = [
            'period' => $i,
            'predicted_sales' => $lastSmoothed,
            'method' => 'exponential_smoothing',
            'confidence' => max(0.3, 1 - ($i * 0.12))
        ];
    }
    
    return $predictions;
}

function combinePredictions($movingAverage, $linearTrend, $seasonalAnalysis, $exponentialSmoothing) {
    $combined = [];
    $methods = [$movingAverage, $linearTrend, $seasonalAnalysis, $exponentialSmoothing];
    
    // Filter out empty methods
    $methods = array_filter($methods, function($method) {
        return !empty($method);
    });
    
    if (empty($methods)) return [];
    
    $maxPeriods = max(array_map('count', $methods));
    
    for ($i = 0; $i < $maxPeriods; $i++) {
        $predictions = [];
        $totalWeight = 0;
        
        foreach ($methods as $method) {
            if (isset($method[$i])) {
                $confidence = $method[$i]['confidence'];
                $predictions[] = $method[$i]['predicted_sales'] * $confidence;
                $totalWeight += $confidence;
            }
        }
        
        if ($totalWeight > 0) {
            $combined[] = [
                'period' => $i + 1,
                'predicted_sales' => array_sum($predictions) / $totalWeight,
                'confidence' => $totalWeight / count($methods),
                'method' => 'combined'
            ];
        }
    }
    
    return $combined;
}

function calculateConfidenceScore($historicalData) {
    if (count($historicalData) < 3) return 0.3;
    
    $sales = array_column($historicalData, 'total_sales');
    $variance = 0;
    $mean = array_sum($sales) / count($sales);
    
    foreach ($sales as $sale) {
        $variance += pow($sale - $mean, 2);
    }
    $variance /= count($sales);
    $stdDev = sqrt($variance);
    $coefficientOfVariation = $stdDev / $mean;
    
    // Higher confidence for lower variation
    $confidence = max(0.1, min(0.9, 1 - $coefficientOfVariation));
    
    return round($confidence, 2);
}

function generateRecommendations($historicalData, $predictions) {
    $recommendations = [];
    
    if (empty($historicalData)) {
        return ['Insufficient data for recommendations'];
    }
    
    $recentSales = array_slice(array_column($historicalData, 'total_sales'), -3);
    $avgRecentSales = array_sum($recentSales) / count($recentSales);
    
    if (!empty($predictions['combined_prediction'])) {
        $nextPrediction = $predictions['combined_prediction'][0]['predicted_sales'];
        $confidence = $predictions['confidence_score'];
        
        if ($nextPrediction > $avgRecentSales * 1.2) {
            $recommendations[] = "Sales are predicted to increase by " . round((($nextPrediction - $avgRecentSales) / $avgRecentSales) * 100, 1) . "%. Consider increasing inventory.";
        } elseif ($nextPrediction < $avgRecentSales * 0.8) {
            $recommendations[] = "Sales are predicted to decrease by " . round((($avgRecentSales - $nextPrediction) / $avgRecentSales) * 100, 1) . "%. Consider promotional strategies.";
        } else {
            $recommendations[] = "Sales are predicted to remain stable. Maintain current inventory levels.";
        }
        
        if ($confidence < 0.5) {
            $recommendations[] = "Low confidence in predictions. Consider gathering more historical data.";
        }
    }
    
    return $recommendations;
}

function storePredictions($pdo, $predictions, $userId) {
    try {
        // Create predictions table if it doesn't exist
        $createTable = "CREATE TABLE IF NOT EXISTS sales_predictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            prediction_type VARCHAR(50) NOT NULL,
            component_id INT NULL,
            category_id INT NULL,
            period VARCHAR(20) NOT NULL,
            forecast_data JSON NOT NULL,
            confidence_score DECIMAL(3,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )";
        
        $pdo->exec($createTable);
        
        // Store the prediction
        $stmt = $pdo->prepare("INSERT INTO sales_predictions (user_id, prediction_type, component_id, category_id, period, forecast_data, confidence_score) VALUES (?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->execute([
            $userId,
            'sales_forecast',
            $predictions['parameters']['component_id'] ?? null,
            $predictions['parameters']['category_id'] ?? null,
            $predictions['parameters']['period'] ?? 'monthly',
            json_encode($predictions),
            $predictions['confidence_score']
        ]);
        
    } catch (Exception $e) {
        error_log("Failed to store predictions: " . $e->getMessage());
    }
}

// Handle the request
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'POST') {
    handleSalesPrediction($pdo);
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>
