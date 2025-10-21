<?php
// Script to create the notifications table
require_once 'backend/config/database.php';

try {
    // Create notifications table
    $sql = "
    CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('order', 'build', 'system', 'promo', 'support') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        priority ENUM('low', 'medium', 'high') DEFAULT 'low',
        read_status TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_read (user_id, read_status),
        INDEX idx_created_at (created_at)
    )";
    
    $pdo->exec($sql);
    echo "Notifications table created successfully!\n";
    
    // Insert sample notifications for test user
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'testuser'");
    $stmt->execute();
    $user = $stmt->fetch();
    
    if ($user) {
        $userId = $user['id'];
        
        $notifications = [
            [
                'type' => 'system',
                'title' => 'Welcome to SIMS!',
                'message' => 'Thank you for joining our platform. Start building your dream PC today!',
                'priority' => 'low',
                'read_status' => 1
            ],
            [
                'type' => 'order',
                'title' => 'Order #12345 Status Updated',
                'message' => 'Your order has been shipped and is on its way to you.',
                'priority' => 'high',
                'read_status' => 0
            ],
            [
                'type' => 'build',
                'title' => 'Build Compatibility Alert',
                'message' => 'Your saved build "Gaming PC 2024" has compatibility issues with the selected GPU.',
                'priority' => 'medium',
                'read_status' => 0
            ],
            [
                'type' => 'promo',
                'title' => 'Special Discount Available',
                'message' => 'Get 10% off on all gaming components this weekend!',
                'priority' => 'medium',
                'read_status' => 1
            ],
            [
                'type' => 'support',
                'title' => 'Support Ticket #789 Resolved',
                'message' => 'Your support ticket regarding component compatibility has been resolved.',
                'priority' => 'low',
                'read_status' => 1
            ]
        ];
        
        $stmt = $pdo->prepare("
            INSERT INTO notifications (user_id, type, title, message, priority, read_status) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        foreach ($notifications as $notification) {
            $stmt->execute([
                $userId,
                $notification['type'],
                $notification['title'],
                $notification['message'],
                $notification['priority'],
                $notification['read_status']
            ]);
        }
        
        echo "Sample notifications created for test user (ID: $userId)!\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?> 