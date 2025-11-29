<?php
/**
 * Update all prebuilts with proper categories and ensure brand detection works
 * This script updates existing prebuilts in the database to have:
 * 1. Proper categories (gaming, workstation, budget, performance)
 * 2. Valid component_ids
 * 3. Proper descriptions for brand detection
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
    
    echo "=== UPDATING PREBUILTS CATEGORIES AND BRANDS ===\n\n";
    
    // Helper functions
    function extractBrand($name, $componentIds) {
        $lower = strtolower($name);
        if (strpos($lower, 'amd') !== false || strpos($lower, 'ryzen') !== false) return 'AMD';
        if (strpos($lower, 'intel') !== false || preg_match('/\bi[3579]-\d+/', $lower)) return 'Intel';
        
        // Check CPU component if available
        if (isset($componentIds['cpu'])) {
            // We'll check this via database query
            return null; // Will be determined from CPU component
        }
        
        return null;
    }
    
    function determineCategory($cpu, $gpu, $price) {
        $cpuName = strtolower($cpu['name'] ?? '');
        $gpuName = strtolower($gpu['name'] ?? '');
        $price = floatval($price);
        
        // Budget: Low price (< 20000) OR entry-level CPU (R3, i3, APUs)
        if ($price < 20000 || preg_match('/r3|i3|3200[Gg]|5600[Gg]/', $cpuName)) {
            return 'budget';
        }
        
        // Workstation: High-end CPUs (R7/i7/i9 5700+, 5800+, 7600+) AND high price (> 35000)
        if ($price > 35000 && preg_match('/r[79]|i[79]|5700|5800|7600/', $cpuName)) {
            return 'workstation';
        }
        
        // Performance: Mid-high CPUs (R5 5600X+, R7, i5+, i7+) OR high-end GPUs (RTX 3060+, RX 6600+)
        $hasHighEndGpu = preg_match('/rtx\s*30[6-9]0|rtx\s*40[6-9]0|rx\s*6[6-9]00|rx\s*7[6-9]00/i', $gpuName);
        $hasHighEndCpu = preg_match('/r[79]|i[579]|5700|5800|7600/', $cpuName);
        
        if ($hasHighEndGpu || ($hasHighEndCpu && $price > 25000)) {
            return 'performance';
        }
        
        // Default to gaming for mid-range builds
        return 'gaming';
    }
    
    // Get all prebuilts
    echo "1. Fetching all prebuilts...\n";
    $stmt = $pdo->query("SELECT * FROM prebuilts ORDER BY id");
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "   Found " . count($prebuilts) . " prebuilt(s)\n\n";
    
    if (empty($prebuilts)) {
        echo "⚠️  No prebuilts found to update.\n";
        exit(0);
    }
    
    // Update each prebuilt
    echo "2. Updating prebuilts...\n\n";
    
    $updated = 0;
    $errors = 0;
    
    foreach ($prebuilts as $pb) {
        try {
            $componentIds = json_decode($pb['component_ids'], true);
            
            if (!is_array($componentIds) || empty($componentIds)) {
                echo "   ⚠️  Skipping ID {$pb['id']} ({$pb['name']}): Invalid component_ids\n";
                $errors++;
                continue;
            }
            
            // Fetch CPU to determine brand and category
            $cpuId = $componentIds['cpu'] ?? null;
            if (!$cpuId) {
                echo "   ⚠️  Skipping ID {$pb['id']} ({$pb['name']}): No CPU in component_ids\n";
                $errors++;
                continue;
            }
            
            $cpuStmt = $pdo->prepare("SELECT * FROM components WHERE id = ?");
            $cpuStmt->execute([$cpuId]);
            $cpu = $cpuStmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$cpu) {
                echo "   ⚠️  Skipping ID {$pb['id']} ({$pb['name']}): CPU not found (ID: $cpuId)\n";
                $errors++;
                continue;
            }
            
            // Fetch GPU if available
            $gpu = null;
            $gpuId = $componentIds['gpu'] ?? null;
            if ($gpuId) {
                $gpuStmt = $pdo->prepare("SELECT * FROM components WHERE id = ?");
                $gpuStmt->execute([$gpuId]);
                $gpu = $gpuStmt->fetch(PDO::FETCH_ASSOC);
            }
            
            // Determine brand from CPU
            $cpuName = strtolower($cpu['name'] ?? '');
            $brand = 'AMD'; // Default
            if (strpos($cpuName, 'intel') !== false || preg_match('/\bi[3579]-\d+/', $cpuName)) {
                $brand = 'Intel';
            } elseif (strpos($cpuName, 'amd') !== false || strpos($cpuName, 'ryzen') !== false) {
                $brand = 'AMD';
            } elseif (strpos($cpuName, 'r3') !== false || strpos($cpuName, 'r5') !== false || strpos($cpuName, 'r7') !== false) {
                $brand = 'AMD'; // Ryzen CPUs
            }
            
            // Determine category
            $newCategory = determineCategory($cpu, $gpu ?: [], floatval($pb['price']));
            
            // Update name to include brand if not present (avoid duplicates)
            $newName = trim($pb['name']);
            $nameLower = strtolower($newName);
            
            // Remove existing brand prefix if present
            $newName = preg_replace('/^(AMD|Intel)\s+/i', '', $newName);
            
            // Add brand prefix if not present
            if (strpos($nameLower, 'amd') === false && strpos($nameLower, 'intel') === false) {
                $newName = "$brand $newName";
            }
            
            // Update description to ensure brand detection works
            $newDescription = $pb['description'] ?: '';
            if (empty($newDescription)) {
                $cpuShort = preg_replace('/.*?(Ryzen [3579] \d+[A-Z]?|Core i[3579]-\d+).*/i', '$1', $cpu['name']);
                $gpuText = $gpu ? " and {$gpu['name']}" : "";
                $newDescription = "Compatible prebuilt featuring $cpuShort processor{$gpuText}.";
            }
            
            // Check if update is needed
            $needsUpdate = false;
            $updateFields = [];
            $updateValues = [];
            
            if ($pb['category'] !== $newCategory) {
                $needsUpdate = true;
                $updateFields[] = "category = ?";
                $updateValues[] = $newCategory;
            }
            
            if ($pb['name'] !== $newName) {
                $needsUpdate = true;
                $updateFields[] = "name = ?";
                $updateValues[] = $newName;
            }
            
            if ($pb['description'] !== $newDescription) {
                $needsUpdate = true;
                $updateFields[] = "description = ?";
                $updateValues[] = $newDescription;
            }
            
            if ($needsUpdate) {
                $updateValues[] = $pb['id'];
                $sql = "UPDATE prebuilts SET " . implode(", ", $updateFields) . " WHERE id = ?";
                $updateStmt = $pdo->prepare($sql);
                $updateStmt->execute($updateValues);
                
                $updated++;
                echo "   ✅ Updated ID {$pb['id']}: {$newName}\n";
                echo "      Category: {$pb['category']} → {$newCategory}\n";
                echo "      Brand: $brand\n";
                if ($pb['name'] !== $newName) {
                    echo "      Name: {$pb['name']} → {$newName}\n";
                }
                echo "\n";
            } else {
                echo "   ℹ️  ID {$pb['id']}: {$pb['name']} - No changes needed\n";
                echo "      Category: {$pb['category']}, Brand: $brand\n\n";
            }
            
        } catch (Exception $e) {
            echo "   ❌ Error updating ID {$pb['id']}: " . $e->getMessage() . "\n\n";
            $errors++;
        }
    }
    
    echo "\n=== UPDATE COMPLETE ===\n";
    echo "✅ Updated: $updated prebuilt(s)\n";
    if ($errors > 0) {
        echo "⚠️  Errors: $errors prebuilt(s)\n";
    }
    
    // Verify all prebuilts are valid
    echo "\n3. Verifying all prebuilts...\n";
    $verifyStmt = $pdo->query("SELECT id, name, category, component_ids FROM prebuilts ORDER BY id");
    $allPrebuilts = $verifyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $valid = 0;
    $invalid = 0;
    
    foreach ($allPrebuilts as $pb) {
        $componentIds = json_decode($pb['component_ids'], true);
        if (is_array($componentIds) && !empty($componentIds) && isset($componentIds['cpu'])) {
            // Verify CPU exists
            $cpuStmt = $pdo->prepare("SELECT id FROM components WHERE id = ?");
            $cpuStmt->execute([$componentIds['cpu']]);
            if ($cpuStmt->fetch()) {
                $valid++;
            } else {
                $invalid++;
                echo "   ⚠️  ID {$pb['id']}: CPU component not found\n";
            }
        } else {
            $invalid++;
            echo "   ⚠️  ID {$pb['id']}: Invalid component_ids\n";
        }
    }
    
    echo "\n   Valid prebuilts: $valid\n";
    if ($invalid > 0) {
        echo "   Invalid prebuilts: $invalid\n";
    }
    
    // Summary by category and brand
    echo "\n4. Summary by category:\n";
    $catStmt = $pdo->query("SELECT category, COUNT(*) as count FROM prebuilts GROUP BY category ORDER BY category");
    $categories = $catStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($categories as $cat) {
        echo "   - {$cat['category']}: {$cat['count']}\n";
    }
    
    echo "\n5. Summary by brand (estimated from names):\n";
    $amdStmt = $pdo->query("SELECT COUNT(*) as count FROM prebuilts WHERE LOWER(name) LIKE '%amd%' OR LOWER(description) LIKE '%amd%' OR LOWER(description) LIKE '%ryzen%'");
    $amdCount = $amdStmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    $intelStmt = $pdo->query("SELECT COUNT(*) as count FROM prebuilts WHERE LOWER(name) LIKE '%intel%' OR LOWER(description) LIKE '%intel%' OR LOWER(description) LIKE '%core i%'");
    $intelCount = $intelStmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    echo "   - AMD Builds: $amdCount\n";
    echo "   - Intel Builds: $intelCount\n";
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

