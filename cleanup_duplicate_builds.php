<?php
/**
 * Cleanup Duplicate Builds Script
 * 
 * This script removes duplicate builds from the database.
 * It keeps the most recent build and removes older duplicates.
 * 
 * Usage: Run this script once to clean up existing duplicates.
 */

require_once 'backend/config/database.php';

try {
    $pdo = getConnection();
    
    echo "Starting cleanup of duplicate builds...\n";
    
    // Find and remove duplicates
    $sql = "
        DELETE ub1 FROM user_builds ub1
        INNER JOIN user_builds ub2 
        WHERE ub1.id < ub2.id 
          AND ub1.user_id = ub2.user_id 
          AND ub1.name = ub2.name 
          AND ub1.components = ub2.components
    ";
    
    $stmt = $pdo->prepare($sql);
    $result = $stmt->execute();
    
    $deletedCount = $stmt->rowCount();
    
    echo "Cleanup completed!\n";
    echo "Removed {$deletedCount} duplicate builds.\n";
    
    // Show remaining builds count
    $countSql = "SELECT COUNT(*) as total FROM user_builds";
    $countStmt = $pdo->query($countSql);
    $totalBuilds = $countStmt->fetch()['total'];
    
    echo "Total builds remaining: {$totalBuilds}\n";
    
} catch (Exception $e) {
    echo "Error during cleanup: " . $e->getMessage() . "\n";
    exit(1);
}
?>
