-- Order Financial Details table
CREATE TABLE IF NOT EXISTS order_financial_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    invoice_number VARCHAR(255) NULL,
    component_price DECIMAL(10,2) NULL DEFAULT 0.00,
    purchase_date DATE NOT NULL,
    customer_name VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    acquisition_date DATE NULL,
    acquisition_price DECIMAL(10,2) NULL DEFAULT 0.00,
    purchase_order VARCHAR(255) NULL,
    acquisition_type ENUM('purchase', 'lease', 'rental', 'donation', 'trade') NULL,
    end_of_life DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE KEY unique_order_financial (order_id)
);
