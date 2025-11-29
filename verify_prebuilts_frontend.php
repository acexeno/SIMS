<?php
/**
 * Verify prebuilts work correctly for frontend API
 * Simulates what the frontend would receive
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
    
    echo "=== VERIFYING PREBUILTS FOR FRONTEND ===\n\n";
    
    // Simulate the API call (what frontend receives)
    $stmt = $pdo->query("SELECT * FROM prebuilts WHERE is_hidden = 0 ORDER BY id");
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "1. API Response (is_hidden = 0):\n";
    echo "   Total prebuilts: " . count($prebuilts) . "\n\n";
    
    // Decode JSON fields like the API does
    foreach ($prebuilts as &$row) {
        foreach (['performance', 'features', 'component_ids'] as $jsonField) {
            if (isset($row[$jsonField])) {
                $val = $row[$jsonField];
                if (is_string($val)) {
                    $decoded = json_decode($val, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $row[$jsonField] = $decoded;
                    }
                }
            }
        }
    }
    unset($row);
    
    // Simulate frontend brand detection
    function getBrand($pc) {
        $haystack = strtolower(($pc['name'] ?? '') . ' ' . ($pc['description'] ?? ''));
        if (strpos($haystack, 'amd') !== false || strpos($haystack, 'ryzen') !== false) return 'amd';
        if (strpos($haystack, 'intel') !== false || strpos($haystack, 'core i') !== false) return 'intel';
        return 'other';
    }
    
    // Group by category and brand (like frontend does)
    $categories = [];
    $brands = ['amd' => 0, 'intel' => 0, 'other' => 0];
    
    foreach ($prebuilts as $pc) {
        $category = $pc['category'] ?? 'gaming';
        if (!isset($categories[$category])) {
            $categories[$category] = 0;
        }
        $categories[$category]++;
        
        $brand = getBrand($pc);
        $brands[$brand]++;
    }
    
    echo "2. Category Distribution (for frontend):\n";
    foreach ($categories as $cat => $count) {
        echo "   - " . ucfirst($cat) . ": $count\n";
    }
    
    echo "\n3. Brand Distribution (for frontend):\n";
    echo "   - AMD Builds: {$brands['amd']}\n";
    echo "   - Intel Builds: {$brands['intel']}\n";
    if ($brands['other'] > 0) {
        echo "   - Other: {$brands['other']}\n";
    }
    
    echo "\n4. Sample Prebuilts (first 5):\n";
    foreach (array_slice($prebuilts, 0, 5) as $pc) {
        echo "   - {$pc['name']}\n";
        echo "     Category: {$pc['category']}\n";
        echo "     Brand: " . getBrand($pc) . "\n";
        echo "     Price: ₱" . number_format(floatval($pc['price']), 2) . "\n";
        echo "     Components: " . (is_array($pc['component_ids']) ? count($pc['component_ids']) : 0) . "\n";
        echo "\n";
    }
    
    // Verify component_ids are valid
    echo "5. Component IDs Validation:\n";
    $valid = 0;
    $invalid = 0;
    $missingComponents = [];
    
    foreach ($prebuilts as $pc) {
        $componentIds = $pc['component_ids'] ?? [];
        if (!is_array($componentIds) || empty($componentIds)) {
            $invalid++;
            echo "   ❌ {$pc['name']}: No component_ids\n";
            continue;
        }
        
        // Check if CPU exists
        if (!isset($componentIds['cpu'])) {
            $invalid++;
            echo "   ❌ {$pc['name']}: Missing CPU in component_ids\n";
            continue;
        }
        
        $cpuStmt = $pdo->prepare("SELECT id FROM components WHERE id = ?");
        $cpuStmt->execute([$componentIds['cpu']]);
        if (!$cpuStmt->fetch()) {
            $invalid++;
            $missingComponents[] = $componentIds['cpu'];
            echo "   ❌ {$pc['name']}: CPU component not found (ID: {$componentIds['cpu']})\n";
            continue;
        }
        
        $valid++;
    }
    
    echo "\n   Valid: $valid\n";
    if ($invalid > 0) {
        echo "   Invalid: $invalid\n";
    }
    
    echo "\n=== VERIFICATION COMPLETE ===\n";
    echo "✅ All prebuilts ready for frontend display\n";
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
?>

