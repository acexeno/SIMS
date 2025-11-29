<?php
/**
 * Comprehensive Duplicate Cleanup Script for builditpc_db
 * 
 * This script safely removes duplicate records from all tables:
 * - chat_sessions: Keeps most recent session (by updated_at)
 * - notifications: Keeps most recent notification (by created_at)
 * - login_attempts: Keeps most recent attempt (by timestamp/created_at)
 * - security_logs: Keeps most recent log (by created_at/timestamp)
 * 
 * Uses transactions for safety and handles foreign key relationships.
 */

// Force local database connection for CLI
$_SERVER['HTTP_HOST'] = 'localhost';

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "========================================\n";
    echo "Comprehensive Duplicate Cleanup\n";
    echo "Database: builditpc_db\n";
    echo "========================================\n\n";
    
    $totalRemoved = 0;
    
    // ============================================
    // 1. Clean up chat_sessions duplicates
    // ============================================
    echo "1. Cleaning chat_sessions duplicates...\n";
    echo str_repeat("-", 50) . "\n";
    
    $pdo->beginTransaction();
    
    // Find duplicate chat_sessions (exact matches)
    $dupStmt = $pdo->query("
        SELECT 
            user_id, 
            guest_name, 
            guest_email, 
            status, 
            priority,
            COUNT(*) as count,
            GROUP_CONCAT(id ORDER BY updated_at DESC, id DESC) as ids
        FROM chat_sessions 
        GROUP BY user_id, guest_name, guest_email, status, priority
        HAVING COUNT(*) > 1
    ");
    
    $duplicates = $dupStmt->fetchAll();
    $removedChatSessions = 0;
    
    if (count($duplicates) > 0) {
        echo "Found " . count($duplicates) . " groups of duplicates.\n";
        
        foreach ($duplicates as $dup) {
            $ids = explode(',', $dup['ids']);
            $keepId = array_shift($ids); // Keep the most recent (first in DESC order)
            $removeIds = $ids; // Rest to remove
            
            // Check if any sessions have messages before deleting
            foreach ($removeIds as $removeId) {
                $checkMessages = $pdo->prepare("SELECT COUNT(*) FROM chat_messages WHERE session_id = ?");
                $checkMessages->execute([$removeId]);
                $hasMessages = $checkMessages->fetchColumn() > 0;
                
                if ($hasMessages) {
                    // Transfer messages to kept session before deleting
                    $transferStmt = $pdo->prepare("UPDATE chat_messages SET session_id = ? WHERE session_id = ?");
                    $transferStmt->execute([$keepId, $removeId]);
                    echo "  Transferred messages from session {$removeId} to session {$keepId}\n";
                }
                
                // Delete from last_seen_chat first
                $pdo->prepare("DELETE FROM last_seen_chat WHERE session_id = ?")->execute([$removeId]);
                
                // Delete duplicate session
                $pdo->prepare("DELETE FROM chat_sessions WHERE id = ?")->execute([$removeId]);
                $removedChatSessions++;
            }
        }
        
        echo "✅ Removed {$removedChatSessions} duplicate chat_sessions.\n";
    } else {
        echo "✅ No duplicates found in chat_sessions.\n";
    }
    
    $pdo->commit();
    $totalRemoved += $removedChatSessions;
    echo "\n";
    
    // ============================================
    // 2. Clean up notifications duplicates
    // ============================================
    echo "2. Cleaning notifications duplicates...\n";
    echo str_repeat("-", 50) . "\n";
    
    $pdo->beginTransaction();
    
    // Check which columns exist
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM notifications");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Build column list excluding id and timestamps
    $groupColumns = [];
    $selectColumns = [];
    foreach (['user_id', 'component_id', 'type', 'title', 'message', 'priority', 'read_status'] as $col) {
        if (in_array($col, $columns)) {
            $groupColumns[] = "`{$col}`";
            $selectColumns[] = $col;
        }
    }
    
    if (empty($groupColumns)) {
        echo "⚠️  No matching columns found for duplicate checking.\n";
        $pdo->commit();
    } else {
        $colList = implode(", ", $selectColumns);
        $groupBy = implode(", ", $groupColumns);
        
        // Find duplicate notifications (exact matches)
        $dupStmt = $pdo->query("
            SELECT 
                {$colList},
                COUNT(*) as count,
                GROUP_CONCAT(id ORDER BY created_at DESC, id DESC) as ids
            FROM notifications 
            GROUP BY {$groupBy}
            HAVING COUNT(*) > 1
        ");
    
        $duplicates = $dupStmt->fetchAll();
        $removedNotifications = 0;
        
        if (count($duplicates) > 0) {
            echo "Found " . count($duplicates) . " groups of duplicates.\n";
            
            foreach ($duplicates as $dup) {
                $ids = explode(',', $dup['ids']);
                $keepId = array_shift($ids); // Keep the most recent
                $removeIds = $ids;
                
                foreach ($removeIds as $removeId) {
                    $pdo->prepare("DELETE FROM notifications WHERE id = ?")->execute([$removeId]);
                    $removedNotifications++;
                }
            }
            
            echo "✅ Removed {$removedNotifications} duplicate notifications.\n";
        } else {
            echo "✅ No duplicates found in notifications.\n";
        }
        
        $pdo->commit();
        $totalRemoved += $removedNotifications;
    }
    echo "\n";
    
    // ============================================
    // 3. Clean up login_attempts duplicates
    // ============================================
    echo "3. Cleaning login_attempts duplicates...\n";
    echo str_repeat("-", 50) . "\n";
    
    // First check what columns exist
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM login_attempts");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasTimestamp = in_array('timestamp', $columns);
    $hasCreatedAt = in_array('created_at', $columns);
    
    // Build column list for grouping (check which columns exist)
    $groupColumns = [];
    $selectColumns = [];
    
    // Check for identifier (newer) or user_id (older)
    if (in_array('identifier', $columns)) {
        $groupColumns[] = 'identifier';
        $selectColumns[] = 'identifier';
    } elseif (in_array('user_id', $columns)) {
        $groupColumns[] = 'user_id';
        $selectColumns[] = 'user_id';
    }
    
    if (in_array('ip_address', $columns)) {
        $groupColumns[] = 'ip_address';
        $selectColumns[] = 'ip_address';
    }
    
    if (in_array('success', $columns)) {
        $groupColumns[] = 'success';
        $selectColumns[] = 'success';
    }
    
    $pdo->beginTransaction();
    
    if (empty($groupColumns)) {
        echo "⚠️  No matching columns found for duplicate checking.\n";
        $pdo->commit();
    } else {
        // Find duplicate login_attempts
        $orderBy = $hasCreatedAt ? 'created_at DESC' : ($hasTimestamp ? 'timestamp DESC' : 'id DESC');
        $colList = implode(", ", $selectColumns);
        $groupBy = implode(", ", $groupColumns);
        $timeColumn = $hasCreatedAt ? 'created_at' : ($hasTimestamp ? 'timestamp' : 'id');
        
        $dupStmt = $pdo->query("
            SELECT 
                {$colList},
                COUNT(*) as count,
                GROUP_CONCAT(id ORDER BY " . $orderBy . ", id DESC) as ids
            FROM login_attempts 
            GROUP BY {$groupBy}
            HAVING COUNT(*) > 1
            LIMIT 1000
        ");
    
        $duplicates = $dupStmt->fetchAll();
        $removedLoginAttempts = 0;
        
        if (count($duplicates) > 0) {
            echo "Found " . count($duplicates) . " groups of duplicates.\n";
            echo "Processing (keeping most recent attempts)...\n";
            
            foreach ($duplicates as $dup) {
                $ids = explode(',', $dup['ids']);
                $keepId = array_shift($ids); // Keep the most recent
                $removeIds = $ids;
                
                if (count($removeIds) > 0) {
                    $placeholders = implode(',', array_fill(0, count($removeIds), '?'));
                    $deleteStmt = $pdo->prepare("DELETE FROM login_attempts WHERE id IN ($placeholders)");
                    $deleteStmt->execute($removeIds);
                    $removedLoginAttempts += count($removeIds);
                }
            }
            
            echo "✅ Removed {$removedLoginAttempts} duplicate login_attempts.\n";
            
            // Also clean up very old login attempts (older than 90 days)
            if ($hasCreatedAt) {
                $oldStmt = $pdo->exec("
                    DELETE FROM login_attempts 
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
                ");
                echo "✅ Cleaned up login attempts older than 90 days.\n";
            } elseif ($hasTimestamp) {
                $oldStmt = $pdo->exec("
                    DELETE FROM login_attempts 
                    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY)
                ");
                echo "✅ Cleaned up login attempts older than 90 days.\n";
            }
        } else {
            echo "✅ No duplicates found in login_attempts.\n";
        }
        
        $pdo->commit();
        $totalRemoved += $removedLoginAttempts;
    }
    echo "\n";
    
    // ============================================
    // 4. Clean up security_logs duplicates
    // ============================================
    echo "4. Cleaning security_logs duplicates...\n";
    echo str_repeat("-", 50) . "\n";
    
    // Check what columns exist
    $columnsStmt = $pdo->query("SHOW COLUMNS FROM security_logs");
    $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
    $hasTimestamp = in_array('timestamp', $columns);
    $hasCreatedAt = in_array('created_at', $columns);
    
    $pdo->beginTransaction();
    
    // Get all column names except id, timestamp, created_at
    $nonTimestampColumns = array_filter($columns, function($col) {
        return !in_array(strtolower($col), ['id', 'timestamp', 'created_at']);
    });
    
    if (count($nonTimestampColumns) > 0) {
        $colList = implode(", ", array_map(function($col) { return "`{$col}`"; }, $nonTimestampColumns));
        $groupBy = implode(", ", array_map(function($col) { return "`{$col}`"; }, $nonTimestampColumns));
        $orderBy = $hasCreatedAt ? 'created_at DESC' : ($hasTimestamp ? 'timestamp DESC' : 'id DESC');
        
        $dupStmt = $pdo->query("
            SELECT 
                {$colList},
                COUNT(*) as count,
                GROUP_CONCAT(id ORDER BY " . $orderBy . ", id DESC) as ids
            FROM security_logs 
            GROUP BY {$groupBy}
            HAVING COUNT(*) > 1
            LIMIT 1000
        ");
        
        $duplicates = $dupStmt->fetchAll();
        $removedSecurityLogs = 0;
        
        if (count($duplicates) > 0) {
            echo "Found " . count($duplicates) . " groups of duplicates.\n";
            echo "Processing (keeping most recent logs)...\n";
            
            foreach ($duplicates as $dup) {
                $ids = explode(',', $dup['ids']);
                $keepId = array_shift($ids); // Keep the most recent
                $removeIds = $ids;
                
                if (count($removeIds) > 0) {
                    $placeholders = implode(',', array_fill(0, count($removeIds), '?'));
                    $deleteStmt = $pdo->prepare("DELETE FROM security_logs WHERE id IN ($placeholders)");
                    $deleteStmt->execute($removeIds);
                    $removedSecurityLogs += count($removeIds);
                }
            }
            
            echo "✅ Removed {$removedSecurityLogs} duplicate security_logs.\n";
            
            // Also clean up very old security logs (older than 90 days)
            if ($hasCreatedAt) {
                $oldStmt = $pdo->exec("
                    DELETE FROM security_logs 
                    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
                ");
                echo "✅ Cleaned up security logs older than 90 days.\n";
            } elseif ($hasTimestamp) {
                $oldStmt = $pdo->exec("
                    DELETE FROM security_logs 
                    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY)
                ");
                echo "✅ Cleaned up security logs older than 90 days.\n";
            }
        } else {
            echo "✅ No duplicates found in security_logs.\n";
        }
        
        $pdo->commit();
        $totalRemoved += $removedSecurityLogs;
    } else {
        $pdo->commit();
        echo "✅ No columns found for duplicate checking.\n";
    }
    
    echo "\n";
    
    // ============================================
    // Summary and Optimization
    // ============================================
    echo str_repeat("=", 50) . "\n";
    echo "CLEANUP SUMMARY\n";
    echo str_repeat("=", 50) . "\n";
    echo "Total duplicate records removed: {$totalRemoved}\n";
    echo "\n";
    
    echo "Optimizing tables...\n";
    $tables = ['chat_sessions', 'notifications', 'login_attempts', 'security_logs'];
    foreach ($tables as $table) {
        try {
            // Fetch any remaining results first to clear unbuffered queries
            $pdo->query("SELECT 1")->fetchAll();
            $pdo->exec("OPTIMIZE TABLE `{$table}`");
            echo "✅ Optimized table: {$table}\n";
        } catch (PDOException $e) {
            echo "⚠️  Could not optimize {$table}: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n";
    echo str_repeat("=", 50) . "\n";
    echo "✅ Cleanup complete!\n";
    echo str_repeat("=", 50) . "\n";
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

