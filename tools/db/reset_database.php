<?php
$projectRoot = __DIR__;
require_once $projectRoot . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    // Disable foreign key checks
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    echo "Foreign key checks disabled.\n";

    // Begin transaction
    $pdo->beginTransaction();
    echo "Transaction started.\n";

    // Truncate tables
    echo "Truncating user_builds...\n";
    $pdo->exec('TRUNCATE TABLE user_builds');
    // echo "Truncating build_components...\n";
    // $pdo->exec('TRUNCATE TABLE build_components');
    echo "Truncating components...\n";
    $pdo->exec('TRUNCATE TABLE components');
    // echo "Truncating component_categories...\n"; // Do not truncate categories
    // $pdo->exec('TRUNCATE TABLE component_categories');
    echo "Truncating user_roles...\n";
    $pdo->exec('TRUNCATE TABLE user_roles');
    echo "Truncating users...\n";
    $pdo->exec('TRUNCATE TABLE users');

    // Commit transaction
    $pdo->commit();
    echo "Transaction committed.\n";
    
    // Re-enable foreign key checks
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    echo "Foreign key checks re-enabled.\n";

    echo "All user-related and component tables have been reset.\n";
} catch (Exception $e) {
    $pdo->rollBack();
    echo "Transaction rolled back.\n";
    echo "Error resetting database: " . $e->getMessage() . "\n";
}
?> 