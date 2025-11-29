<?php
// Migration: Add component_id to notifications table
require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();

try {
    $pdo->exec("ALTER TABLE notifications ADD COLUMN component_id INT DEFAULT NULL AFTER user_id");
    $pdo->exec("ALTER TABLE notifications ADD CONSTRAINT fk_notifications_component_id FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE SET NULL");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_component ON notifications(component_id)");
    echo "Migration successful: component_id column added to notifications table.\n";
} catch (PDOException $e) {
    echo "Migration error: " . $e->getMessage() . "\n";
} 