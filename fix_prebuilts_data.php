<?php
/**
 * Fix prebuilts data issues:
 * 1. Update CPU names to include brand identifiers
 * 2. Update motherboard socket information where possible
 * 3. Help identify which components need socket information
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
    
    echo "=== FIXING PREBUILTS DATA ===\n\n";
    
    // 1. Fix CPU names
    echo "1. Fixing CPU names...\n";
    
    // Get all CPUs
    $stmt = $pdo->query("SELECT c.id, c.name, c.socket 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'CPU' 
        ORDER BY c.name");
    $cpus = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $cpuUpdates = [];
    foreach ($cpus as $cpu) {
        $oldName = $cpu['name'];
        $newName = $oldName;
        $socket = $cpu['socket'] ?? '';
        
        // Fix AMD Ryzen naming
        if (preg_match('/^R(\d+)\s+(\d+[A-Z]?)/i', $oldName, $matches)) {
            $series = $matches[1];
            $model = $matches[2];
            $newName = "AMD Ryzen $series $model";
            // Preserve the rest of the name
            $rest = str_replace($matches[0], '', $oldName);
            $rest = trim($rest);
            if (!empty($rest)) {
                $newName .= ' ' . $rest;
            }
        } elseif (preg_match('/^R(\d+)\s+(\d+[A-Z]?)([A-Z]+)/i', $oldName, $matches)) {
            $series = $matches[1];
            $model = $matches[2] . $matches[3];
            $newName = "AMD Ryzen $series $model";
            $rest = str_replace($matches[0], '', $oldName);
            $rest = trim($rest);
            if (!empty($rest)) {
                $newName .= ' ' . $rest;
            }
        }
        
        // Fix Intel naming
        if (preg_match('/^(i\d+-\d+)/i', $oldName, $matches) && stripos($oldName, 'intel') === false) {
            $model = $matches[1];
            $newName = "Intel Core $model";
            $rest = str_replace($matches[1], '', $oldName);
            $rest = trim($rest);
            if (!empty($rest)) {
                $newName .= ' ' . $rest;
            }
        }
        
        // Only update if name changed
        if ($newName !== $oldName) {
            $cpuUpdates[] = ['id' => $cpu['id'], 'old' => $oldName, 'new' => $newName];
        }
    }
    
    if (!empty($cpuUpdates)) {
        $updateStmt = $pdo->prepare("UPDATE components SET name = ? WHERE id = ?");
        foreach ($cpuUpdates as $update) {
            $updateStmt->execute([$update['new'], $update['id']]);
            echo "   Updated CPU ID {$update['id']}: \"{$update['old']}\" → \"{$update['new']}\"\n";
        }
        echo "   ✅ Updated " . count($cpuUpdates) . " CPU name(s)\n";
    } else {
        echo "   ℹ️  No CPU names needed updating\n";
    }
    echo "\n";
    
    // 2. Try to infer motherboard sockets from model names
    echo "2. Analyzing motherboard sockets...\n";
    
    $stmt = $pdo->query("SELECT c.id, c.name, c.socket, c.model, c.brand 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'MOTHERBOARD' 
        ORDER BY c.name");
    $mobos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $moboUpdates = [];
    foreach ($mobos as $mobo) {
        $socket = $mobo['socket'] ?? '';
        $name = strtolower($mobo['name'] ?? '');
        $model = strtolower($mobo['model'] ?? '');
        
        // Skip if already has socket info
        if (!empty($socket) && strtolower($socket) !== 'unknown') {
            continue;
        }
        
        $inferredSocket = null;
        
        // Try to infer from name/model
        if (preg_match('/am4/i', $name . ' ' . $model)) {
            $inferredSocket = 'AM4';
        } elseif (preg_match('/am5/i', $name . ' ' . $model)) {
            $inferredSocket = 'AM5';
        } elseif (preg_match('/lga1700/i', $name . ' ' . $model)) {
            $inferredSocket = 'LGA1700';
        } elseif (preg_match('/lga1200/i', $name . ' ' . $model)) {
            $inferredSocket = 'LGA1200';
        } elseif (preg_match('/lga1151/i', $name . ' ' . $model)) {
            $inferredSocket = 'LGA1151';
        } elseif (preg_match('/b550/i', $name . ' ' . $model) || preg_match('/x570/i', $name . ' ' . $model)) {
            $inferredSocket = 'AM4'; // B550 and X570 are AM4 chipsets
        } elseif (preg_match('/b650/i', $name . ' ' . $model) || preg_match('/x670/i', $name . ' ' . $model)) {
            $inferredSocket = 'AM5'; // B650 and X670 are AM5 chipsets
        } elseif (preg_match('/z690/i', $name . ' ' . $model) || preg_match('/b660/i', $name . ' ' . $model)) {
            $inferredSocket = 'LGA1700'; // 12th/13th gen Intel
        } elseif (preg_match('/z490/i', $name . ' ' . $model) || preg_match('/b460/i', $name . ' ' . $model)) {
            $inferredSocket = 'LGA1200'; // 10th gen Intel
        }
        
        if ($inferredSocket) {
            $moboUpdates[] = ['id' => $mobo['id'], 'name' => $mobo['name'], 'socket' => $inferredSocket];
        }
    }
    
    if (!empty($moboUpdates)) {
        echo "   Found " . count($moboUpdates) . " motherboard(s) that can have inferred sockets:\n";
        $updateStmt = $pdo->prepare("UPDATE components SET socket = ? WHERE id = ?");
        foreach ($moboUpdates as $update) {
            $updateStmt->execute([$update['socket'], $update['id']]);
            echo "   ✅ ID {$update['id']} ({$update['name']}): Set socket to {$update['socket']}\n";
        }
    } else {
        echo "   ⚠️  Could not auto-infer sockets. Manual update needed.\n";
    }
    echo "\n";
    
    // 3. Summary
    echo "3. Summary:\n";
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM prebuilts");
    $prebuiltCount = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
    echo "   Current prebuilts: $prebuiltCount\n";
    echo "   CPU name fixes: " . count($cpuUpdates) . "\n";
    echo "   Motherboard socket updates: " . count($moboUpdates) . "\n";
    echo "\n";
    
    echo "=== FIXES APPLIED ===\n";
    echo "\nNEXT STEP: Re-run prebuilts seeding to generate more prebuilts.\n";
    echo "You can do this via the API: POST /api/prebuilts.php?seed=1\n";
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

