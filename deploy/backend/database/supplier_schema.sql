-- Supplier Module Database Schema
-- This schema adds supplier management capabilities to the existing system

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    communication_method ENUM('email', 'phone', 'messenger', 'sms', 'other') DEFAULT 'email',
    communication_handle VARCHAR(255), -- email address, phone number, or social media handle
    payment_terms VARCHAR(100),
    lead_time_days INT DEFAULT 7,
    minimum_order_amount DECIMAL(10,2) DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Supplier orders table
CREATE TABLE IF NOT EXISTS supplier_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_delivery_date DATE,
    status ENUM('draft', 'sent', 'confirmed', 'in_transit', 'delivered', 'cancelled') DEFAULT 'draft',
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    communication_log TEXT, -- JSON field for tracking messages/emails
    created_by INT NOT NULL,
    updated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Supplier order items table
CREATE TABLE IF NOT EXISTS supplier_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_order_id INT NOT NULL,
    component_id INT NOT NULL,
    quantity_ordered INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_order_id) REFERENCES supplier_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE RESTRICT
);

-- Inventory alerts table for low stock notifications
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    component_id INT NOT NULL,
    alert_type ENUM('low_stock', 'out_of_stock', 'reorder_point') NOT NULL,
    current_stock INT NOT NULL,
    threshold_level INT NOT NULL,
    is_resolved TINYINT(1) DEFAULT 0,
    resolved_by INT,
    resolved_at DATETIME,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Supplier communication history table
CREATE TABLE IF NOT EXISTS supplier_communications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    communication_type ENUM('email', 'phone', 'messenger', 'sms', 'meeting') NOT NULL,
    subject VARCHAR(255),
    message TEXT,
    direction ENUM('outgoing', 'incoming') NOT NULL,
    status ENUM('sent', 'delivered', 'read', 'replied') DEFAULT 'sent',
    scheduled_for DATETIME,
    sent_at DATETIME,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Add indexes for better performance
CREATE INDEX idx_supplier_orders_supplier_id ON supplier_orders(supplier_id);
CREATE INDEX idx_supplier_orders_status ON supplier_orders(status);
CREATE INDEX idx_supplier_orders_created_by ON supplier_orders(created_by);
CREATE INDEX idx_supplier_order_items_order_id ON supplier_order_items(supplier_order_id);
CREATE INDEX idx_supplier_order_items_component_id ON supplier_order_items(component_id);
CREATE INDEX idx_inventory_alerts_component_id ON inventory_alerts(component_id);
CREATE INDEX idx_inventory_alerts_resolved ON inventory_alerts(is_resolved);
CREATE INDEX idx_supplier_communications_supplier_id ON supplier_communications(supplier_id);
CREATE INDEX idx_supplier_communications_type ON supplier_communications(communication_type);

