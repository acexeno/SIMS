<?php
/**
 * Check prebuilts database table directly
 * This script queries the database to see what's in the prebuilts table
 */

// Direct connection for CLI
$host = 'localhost';
$db   = 'builditpc_db';
$user = 'root';
$pass = '';
$port = '3306';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    $pdo->exec("SET time_zone = '+08:00'");
    
    echo "=== PREBUILTS DATABASE CHECK ===\n\n";
    
    // 1. Check if prebuilts table exists
    echo "1. Checking if prebuilts table exists...\n";
    $stmt = $pdo->query("SHOW TABLES LIKE 'prebuilts'");
    $tableExists = $stmt->rowCount() > 0;
    
    if (!$tableExists) {
        echo "❌ ERROR: prebuilts table does not exist!\n";
        exit(1);
    }
    echo "✅ prebuilts table exists\n\n";
    
    // 2. Count all prebuilts
    echo "2. Total prebuilts count...\n";
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM prebuilts");
    $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    echo "   Total prebuilts: $total\n\n";
    
    // 3. Count by visibility
    echo "3. Prebuilts by visibility...\n";
    $stmt = $pdo->query("SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_hidden = 0 THEN 1 ELSE 0 END) as visible,
        SUM(CASE WHEN is_hidden = 1 THEN 1 ELSE 0 END) as hidden,
        SUM(CASE WHEN in_stock = 1 THEN 1 ELSE 0 END) as in_stock,
        SUM(CASE WHEN in_stock = 0 THEN 1 ELSE 0 END) as out_of_stock
        FROM prebuilts");
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "   Visible (is_hidden = 0): {$stats['visible']}\n";
    echo "   Hidden (is_hidden = 1): {$stats['hidden']}\n";
    echo "   In Stock: {$stats['in_stock']}\n";
    echo "   Out of Stock: {$stats['out_of_stock']}\n\n";
    
    // 4. Show all prebuilts
    echo "4. All prebuilts in database:\n";
    $stmt = $pdo->query("SELECT id, name, category, price, in_stock, is_hidden, created_at FROM prebuilts ORDER BY id");
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($prebuilts)) {
        echo "   ⚠️  No prebuilts found in database!\n\n";
    } else {
        echo "   Found " . count($prebuilts) . " prebuilt(s):\n";
        foreach ($prebuilts as $pb) {
            $status = ($pb['is_hidden'] == 1) ? 'HIDDEN' : 'VISIBLE';
            $stock = ($pb['in_stock'] == 1) ? 'IN STOCK' : 'OUT OF STOCK';
            echo "   - ID: {$pb['id']}, Name: {$pb['name']}, Category: {$pb['category']}, Price: ₱{$pb['price']}\n";
            echo "     Status: $status, Stock: $stock, Created: {$pb['created_at']}\n";
        }
        echo "\n";
    }
    
    // 5. Check component_ids JSON validity
    echo "5. Checking component_ids validity...\n";
    $stmt = $pdo->query("SELECT id, name, component_ids FROM prebuilts");
    $all = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($all)) {
        echo "   No prebuilts to check\n\n";
    } else {
        foreach ($all as $pb) {
            $compIds = $pb['component_ids'];
            if (is_string($compIds)) {
                $decoded = json_decode($compIds, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    echo "   ❌ ID {$pb['id']} ({$pb['name']}): Invalid JSON - " . json_last_error_msg() . "\n";
                } else {
                    $count = is_array($decoded) ? count($decoded) : 0;
                    echo "   ✅ ID {$pb['id']} ({$pb['name']}): Valid JSON with $count component(s)\n";
                }
            } else {
                echo "   ✅ ID {$pb['id']} ({$pb['name']}): component_ids is not a string\n";
            }
        }
        echo "\n";
    }
    
    // 6. Check if components referenced in prebuilts still exist
    echo "6. Verifying referenced components exist...\n";
    $stmt = $pdo->query("SELECT id, name, component_ids FROM prebuilts WHERE component_ids IS NOT NULL");
    $prebuiltsWithComponents = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($prebuiltsWithComponents)) {
        echo "   No prebuilts with component_ids\n\n";
    } else {
        foreach ($prebuiltsWithComponents as $pb) {
            $compIds = $pb['component_ids'];
            if (is_string($compIds)) {
                $decoded = json_decode($compIds, true);
                if (is_array($decoded)) {
                    $allIds = array_values($decoded);
                    if (!empty($allIds)) {
                        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
                        $checkStmt = $pdo->prepare("SELECT id FROM components WHERE id IN ($placeholders)");
                        $checkStmt->execute($allIds);
                        $existing = $checkStmt->fetchAll(PDO::FETCH_COLUMN);
                        $missing = array_diff($allIds, $existing);
                        
                        if (empty($missing)) {
                            echo "   ✅ ID {$pb['id']} ({$pb['name']}): All components exist\n";
                        } else {
                            echo "   ⚠️  ID {$pb['id']} ({$pb['name']}): Missing component IDs: " . implode(', ', $missing) . "\n";
                        }
                    }
                }
            }
        }
        echo "\n";
    }
    
    // 7. Check API query (what the API would return)
    echo "7. What the API would return (is_hidden = 0):\n";
    $stmt = $pdo->query("SELECT id, name, category, price, in_stock, is_hidden FROM prebuilts WHERE is_hidden = 0");
    $visible = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($visible)) {
        echo "   ⚠️  No visible prebuilts found! This explains why none show up in the UI.\n";
        echo "   Possible causes:\n";
        echo "   - All prebuilts have is_hidden = 1\n";
        echo "   - Table is empty\n\n";
    } else {
        echo "   Found " . count($visible) . " visible prebuilt(s):\n";
        foreach ($visible as $pb) {
            echo "   - {$pb['name']} (ID: {$pb['id']}, Category: {$pb['category']}, Price: ₱{$pb['price']})\n";
        }
        echo "\n";
    }
    
    echo "=== CHECK COMPLETE ===\n";
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

