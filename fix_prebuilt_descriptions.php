<?php
/**
 * Script to fix prebuilt descriptions that have the generic text
 * "Gaming prebuilt generated from current inventory" or similar
 * Updates them with proper component details like other prebuilts
 */
if (php_sapi_name() === 'cli') {
    $_SERVER['HTTP_HOST'] = 'localhost';
    $_SERVER['SERVER_NAME'] = 'localhost';
}

if (file_exists(__DIR__ . '/backend/config/database.php')) {
    require_once __DIR__ . '/backend/config/database.php';
} elseif (file_exists(__DIR__ . '/config/database.php')) {
    require_once __DIR__ . '/config/database.php';
} else {
    die("Could not find database config file\n");
}

try {
    $pdo = get_db_connection();
    
    echo "========================================\n";
    echo "FIXING PREBUILT DESCRIPTIONS\n";
    echo "========================================\n\n";
    
    // Get all prebuilts
    $stmt = $pdo->query('SELECT * FROM prebuilts');
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($prebuilts) . " prebuilts\n\n";
    
    $updated = 0;
    $skipped = 0;
    
    foreach ($prebuilts as $prebuilt) {
        $description = $prebuilt['description'] ?? '';
        $componentIds = $prebuilt['component_ids'] ?? null;
        
        // Check if description is generic
        $isGeneric = false;
        $genericPatterns = [
            'prebuilt generated from current inventory',
            'generated from current inventory',
            'gaming prebuilt generated',
        ];
        
        foreach ($genericPatterns as $pattern) {
            if (stripos($description, $pattern) !== false) {
                $isGeneric = true;
                break;
            }
        }
        
        if (!$isGeneric) {
            $skipped++;
            continue;
        }
        
        // Decode component_ids
        if (is_string($componentIds)) {
            $componentIds = json_decode($componentIds, true);
        }
        
        if (!is_array($componentIds) || empty($componentIds)) {
            echo "⚠️  Skipping prebuilt ID {$prebuilt['id']} ({$prebuilt['name']}) - no component IDs\n";
            $skipped++;
            continue;
        }
        
        // Get component details
        $ids = array_filter(array_map('intval', array_values($componentIds)));
        if (empty($ids)) {
            $skipped++;
            continue;
        }
        
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        
        // Get CPU
        $cpuId = isset($componentIds['cpu']) ? (int)$componentIds['cpu'] : null;
        $gpuId = isset($componentIds['gpu']) ? (int)$componentIds['gpu'] : null;
        
        $cpuName = null;
        $gpuName = null;
        
        if ($cpuId) {
            $cpuStmt = $pdo->prepare("SELECT name FROM components WHERE id = ?");
            $cpuStmt->execute([$cpuId]);
            $cpu = $cpuStmt->fetch(PDO::FETCH_ASSOC);
            if ($cpu) {
                $cpuName = $cpu['name'];
            }
        }
        
        if ($gpuId) {
            $gpuStmt = $pdo->prepare("SELECT name FROM components WHERE id = ?");
            $gpuStmt->execute([$gpuId]);
            $gpu = $gpuStmt->fetch(PDO::FETCH_ASSOC);
            if ($gpu) {
                $gpuName = $gpu['name'];
            }
        }
        
        // Generate new description
        $newDescription = '';
        if ($cpuName && $gpuName) {
            $newDescription = "Compatible prebuilt featuring {$cpuName} processor and {$gpuName}.";
        } elseif ($cpuName) {
            $newDescription = "Compatible prebuilt featuring {$cpuName} processor.";
        } else {
            // Fallback if we can't find CPU
            $newDescription = "Compatible prebuilt with high-quality components.";
        }
        
        // Update the description
        if ($newDescription && $newDescription !== $description) {
            try {
                $updateStmt = $pdo->prepare('UPDATE prebuilts SET description = ? WHERE id = ?');
                $updateStmt->execute([$newDescription, $prebuilt['id']]);
                
                echo "✓ Updated prebuilt ID {$prebuilt['id']}: {$prebuilt['name']}\n";
                echo "  Old: {$description}\n";
                echo "  New: {$newDescription}\n\n";
                $updated++;
            } catch (Exception $e) {
                echo "✗ Error updating prebuilt ID {$prebuilt['id']}: " . $e->getMessage() . "\n\n";
            }
        } else {
            $skipped++;
        }
    }
    
    echo "========================================\n";
    echo "SUMMARY\n";
    echo "========================================\n\n";
    echo "Total Prebuilts: " . count($prebuilts) . "\n";
    echo "Updated: {$updated}\n";
    echo "Skipped: {$skipped}\n\n";
    
    if ($updated > 0) {
        echo "✅ Successfully updated {$updated} prebuilt description(s)!\n";
        echo "The prebuilts now show proper component details instead of generic text.\n";
    } else {
        echo "ℹ️  No prebuilts needed updating (all descriptions already have component details).\n";
    }
    
    echo "\n";
    echo "Report Generated: " . date('Y-m-d H:i:s') . "\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}

