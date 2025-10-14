<?php
require_once __DIR__ . '/config/database.php';

try {
    $pdo = get_db_connection();

    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS community_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    build_id INT NOT NULL,
    user_id INT NOT NULL,
    build_name VARCHAR(255) NOT NULL,
    build_description TEXT,
    total_price DECIMAL(10,2) NOT NULL,
    compatibility INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (build_id) REFERENCES user_builds(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_submitted_at (submitted_at),
    INDEX idx_user_id (user_id)
);
SQL;

    $pdo->exec($sql);
    echo "community_submissions table is ready.\n";
} catch (Exception $e) {
    http_response_code(500);
    echo "Error creating community_submissions table: " . $e->getMessage();
}
?>


