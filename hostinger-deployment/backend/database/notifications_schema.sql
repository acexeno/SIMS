-- Notifications table for SIMS
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    component_id INT DEFAULT NULL, -- Added for stock notifications
    type ENUM('order', 'build', 'system', 'promo', 'support', 'stock') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high') DEFAULT 'low',
    read_status TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE SET NULL,
    INDEX idx_user_read (user_id, read_status),
    INDEX idx_created_at (created_at),
    INDEX idx_component (component_id)
);

-- Insert some sample notifications for testing
INSERT INTO notifications (user_id, type, title, message, priority, read_status) VALUES
(1, 'system', 'Welcome to SIMS!', 'Thank you for joining our platform. Start building your dream PC today!', 'low', 1),
(1, 'order', 'Order #12345 Status Updated', 'Your order has been shipped and is on its way to you.', 'high', 0),
(1, 'build', 'Build Compatibility Alert', 'Your saved build "Gaming PC 2024" has compatibility issues with the selected GPU.', 'medium', 0),
(1, 'promo', 'Special Discount Available', 'Get 10% off on all gaming components this weekend!', 'medium', 1),
(1, 'support', 'Support Ticket #789 Resolved', 'Your support ticket regarding component compatibility has been resolved.', 'low', 1); 