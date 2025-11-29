<?php
// migrations/create_sales_predictions_table.php

require_once __DIR__ . '/../config/database.php';

try {
    $pdo = get_db_connection();
    
    // Create sales_predictions table
    $createTable = "CREATE TABLE IF NOT EXISTS sales_predictions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prediction_type VARCHAR(50) NOT NULL DEFAULT 'sales_forecast',
        component_id INT NULL,
        category_id INT NULL,
        period VARCHAR(20) NOT NULL DEFAULT 'monthly',
        forecast_data JSON NOT NULL,
        confidence_score DECIMAL(3,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_prediction_type (prediction_type),
        INDEX idx_component_id (component_id),
        INDEX idx_category_id (category_id),
        INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    
    $pdo->exec($createTable);
    echo "✅ Sales predictions table created successfully!\n";
    
    // Create sales_analytics table for storing historical analysis
    $createAnalyticsTable = "CREATE TABLE IF NOT EXISTS sales_analytics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        component_id INT NULL,
        category_id INT NULL,
        period VARCHAR(20) NOT NULL,
        period_date DATE NOT NULL,
        total_sales DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_quantity INT NOT NULL DEFAULT 0,
        order_count INT NOT NULL DEFAULT 0,
        average_order_value DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES component_categories(id) ON DELETE CASCADE,
        UNIQUE KEY unique_analytics (component_id, category_id, period, period_date),
        INDEX idx_period_date (period_date),
        INDEX idx_component_id (component_id),
        INDEX idx_category_id (category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    
    $pdo->exec($createAnalyticsTable);
    echo "✅ Sales analytics table created successfully!\n";
    
    // Create a view for easy access to prediction data
    $createView = "CREATE OR REPLACE VIEW sales_prediction_summary AS
        SELECT 
            sp.id,
            sp.user_id,
            u.username,
            sp.prediction_type,
            sp.component_id,
            c.name as component_name,
            sp.category_id,
            cat.name as category_name,
            sp.period,
            sp.confidence_score,
            JSON_EXTRACT(sp.forecast_data, '$.combined_prediction[0].predicted_sales') as next_period_prediction,
            JSON_EXTRACT(sp.forecast_data, '$.confidence_score') as overall_confidence,
            sp.created_at
        FROM sales_predictions sp
        LEFT JOIN users u ON sp.user_id = u.id
        LEFT JOIN components c ON sp.component_id = c.id
        LEFT JOIN component_categories cat ON sp.category_id = cat.id
        ORDER BY sp.created_at DESC";
    
    $pdo->exec($createView);
    echo "✅ Sales prediction summary view created successfully!\n";
    
    echo "\n🎉 All sales prediction tables and views created successfully!\n";
    echo "You can now use the sales prediction API endpoints.\n";
    
} catch (Exception $e) {
    echo "❌ Error creating sales prediction tables: " . $e->getMessage() . "\n";
    exit(1);
}
?>
