<?php
/**
 * Comprehensive Duplicate Checker for builditpc_db
 * 
 * This script checks ALL tables in the database for duplicate records.
 * It reports findings without automatically deleting anything (for safety).
 */

// Force local database connection for CLI
$_SERVER['HTTP_HOST'] = 'localhost';

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    echo "========================================\n";
    echo "Comprehensive Duplicate Checker\n";
    echo "Database: builditpc_db\n";
    echo "========================================\n\n";
    
    // Get all tables in the database
    $tablesStmt = $pdo->query("SHOW TABLES");
    $tables = $tablesStmt->fetchAll(PDO::FETCH_COLUMN);
    
    echo "Found " . count($tables) . " tables to check:\n";
    echo implode(", ", $tables) . "\n\n";
    echo str_repeat("=", 50) . "\n\n";
    
    $totalDuplicatesFound = 0;
    $tablesWithDuplicates = [];
    
    // Define duplicate check patterns for each table
    $duplicateChecks = [
        'users' => [
            'username' => "SELECT username, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM users GROUP BY username HAVING COUNT(*) > 1",
            'email' => "SELECT email, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM users GROUP BY email HAVING COUNT(*) > 1",
            'phone_not_null' => "SELECT phone, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM users WHERE phone IS NOT NULL AND phone != '' GROUP BY phone HAVING COUNT(*) > 1"
        ],
        'components' => [
            'name_category' => "SELECT name, category_id, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM components GROUP BY name, category_id HAVING COUNT(*) > 1",
            'name_brand_category' => "SELECT name, brand, category_id, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM components WHERE brand IS NOT NULL AND brand != '' GROUP BY name, brand, category_id HAVING COUNT(*) > 1"
        ],
        'user_builds' => [
            'user_name' => "SELECT user_id, name, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM user_builds GROUP BY user_id, name HAVING COUNT(*) > 1"
        ],
        'orders' => [
            'user_order_date' => "SELECT user_id, DATE(order_date) as order_date, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM orders GROUP BY user_id, DATE(order_date) HAVING COUNT(*) > 1"
        ],
        'component_categories' => [
            'name' => "SELECT name, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM component_categories GROUP BY name HAVING COUNT(*) > 1"
        ],
        'roles' => [
            'name' => "SELECT name, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM roles GROUP BY name HAVING COUNT(*) > 1"
        ],
        'user_roles' => [
            'user_role' => "SELECT user_id, role_id, COUNT(*) as count, GROUP_CONCAT(CONCAT('user_id:', user_id, ',role_id:', role_id)) as pairs FROM user_roles GROUP BY user_id, role_id HAVING COUNT(*) > 1"
        ],
        'prebuilts' => [
            'name' => "SELECT name, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM prebuilts GROUP BY name HAVING COUNT(*) > 1"
        ],
        'order_items' => [
            'order_component' => "SELECT order_id, component_id, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids FROM order_items GROUP BY order_id, component_id HAVING COUNT(*) > 1"
        ]
    ];
    
    // Check each table
    foreach ($tables as $table) {
        echo "Checking table: {$table}\n";
        echo str_repeat("-", 50) . "\n";
        
        // Get table row count
        $countStmt = $pdo->query("SELECT COUNT(*) as total FROM `{$table}`");
        $totalRows = $countStmt->fetch()['total'];
        echo "Total rows: {$totalRows}\n";
        
        $tableHasDuplicates = false;
        $tableDuplicateCount = 0;
        
        // Check for duplicates if patterns are defined
        if (isset($duplicateChecks[$table])) {
            foreach ($duplicateChecks[$table] as $checkName => $sql) {
                try {
                    $dupStmt = $pdo->query($sql);
                    $duplicates = $dupStmt->fetchAll();
                    
                    if (count($duplicates) > 0) {
                        $tableHasDuplicates = true;
                        echo "\n  ⚠️  Found duplicates ({$checkName}):\n";
                        
                        foreach ($duplicates as $dup) {
                            $dupCount = $dup['count'] - 1; // -1 because one is not a duplicate
                            $tableDuplicateCount += $dupCount;
                            $totalDuplicatesFound += $dupCount;
                            
                            // Format output based on the check
                            $keys = array_keys($dup);
                            $values = [];
                            foreach ($keys as $key) {
                                if ($key !== 'count' && $key !== 'ids' && $key !== 'pairs') {
                                    $values[] = "{$key}: {$dup[$key]}";
                                }
                            }
                            
                            $details = implode(", ", $values);
                            $ids = isset($dup['ids']) ? $dup['ids'] : (isset($dup['pairs']) ? $dup['pairs'] : 'N/A');
                            
                            echo "    - {$details}\n";
                            echo "      Count: {$dup['count']} records (IDs: {$ids})\n";
                            echo "      Duplicate records: {$dupCount}\n";
                        }
                    }
                } catch (PDOException $e) {
                    echo "  ⚠️  Error checking {$checkName}: " . $e->getMessage() . "\n";
                }
            }
        } else {
            // For tables without specific patterns, check all columns for potential duplicates
            echo "  ℹ️  No specific duplicate patterns defined for this table.\n";
            echo "  Checking for exact row duplicates...\n";
            
            // Get column names
            $columnsStmt = $pdo->query("SHOW COLUMNS FROM `{$table}`");
            $columns = $columnsStmt->fetchAll(PDO::FETCH_COLUMN);
            
            // Filter out id and timestamp columns
            $nonIdColumns = array_filter($columns, function($col) {
                return !in_array(strtolower($col), ['id', 'created_at', 'updated_at', 'order_date', 'last_login']);
            });
            
            if (count($nonIdColumns) > 0) {
                // Try to find duplicates based on all non-id columns
                $colList = implode(", ", array_map(function($col) { return "`{$col}`"; }, $nonIdColumns));
                $groupBy = implode(", ", array_map(function($col) { return "`{$col}`"; }, $nonIdColumns));
                
                try {
                    $dupSql = "SELECT {$colList}, COUNT(*) as count, GROUP_CONCAT(id ORDER BY id) as ids 
                               FROM `{$table}` 
                               GROUP BY {$groupBy} 
                               HAVING COUNT(*) > 1";
                    $dupStmt = $pdo->query($dupSql);
                    $duplicates = $dupStmt->fetchAll();
                    
                    if (count($duplicates) > 0) {
                        $tableHasDuplicates = true;
                        echo "\n  ⚠️  Found exact row duplicates:\n";
                        foreach ($duplicates as $dup) {
                            $dupCount = $dup['count'] - 1;
                            $tableDuplicateCount += $dupCount;
                            $totalDuplicatesFound += $dupCount;
                            
                            $ids = $dup['ids'];
                            echo "    - Count: {$dup['count']} records (IDs: {$ids})\n";
                            echo "      Duplicate records: {$dupCount}\n";
                        }
                    } else {
                        echo "  ✅ No exact row duplicates found.\n";
                    }
                } catch (PDOException $e) {
                    echo "  ⚠️  Error checking for exact duplicates: " . $e->getMessage() . "\n";
                }
            }
        }
        
        if (!$tableHasDuplicates) {
            echo "  ✅ No duplicates found.\n";
        } else {
            $tablesWithDuplicates[] = $table;
            echo "\n  📊 Total duplicate records in {$table}: {$tableDuplicateCount}\n";
        }
        
        echo "\n";
    }
    
    // Summary
    echo str_repeat("=", 50) . "\n";
    echo "SUMMARY\n";
    echo str_repeat("=", 50) . "\n";
    echo "Total tables checked: " . count($tables) . "\n";
    echo "Tables with duplicates: " . count($tablesWithDuplicates) . "\n";
    
    if (count($tablesWithDuplicates) > 0) {
        echo "\nTables with duplicates:\n";
        foreach ($tablesWithDuplicates as $table) {
            echo "  - {$table}\n";
        }
        echo "\n⚠️  Total duplicate records found: {$totalDuplicatesFound}\n";
        echo "\nNote: This script only reports duplicates. Use specific cleanup scripts to remove them.\n";
    } else {
        echo "\n✅ No duplicates found in any table!\n";
    }
    
    echo str_repeat("=", 50) . "\n";
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n✅ Duplicate check complete!\n";
?>

