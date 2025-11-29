<?php
/**
 * Fix Prebuilt RAM Compatibility
 * 
 * This script fixes existing prebuilts by replacing incompatible RAM components
 * with RAM that matches the motherboard's RAM type (DDR4/DDR5/DDR3).
 * 
 * Usage: php fix_prebuilt_ram_compatibility.php
 */

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Prevent HTTP headers from being sent
if (!defined('CLI_MODE')) {
    define('CLI_MODE', true);
}

// Suppress HTTP output from database connection
ob_start();

echo "=== Prebuilt RAM Compatibility Fix Script ===\n\n";

try {
    // Connect to database - try to use local connection first
    require_once __DIR__ . '/backend/config/env.php';
    
    // Try to detect if we're local and use direct connection
    $isLocal = false;
    $host = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? '');
    
    if ($host && (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false)) {
        $isLocal = true;
    }
    
    $appEnv = env('APP_ENV', '');
    if ($appEnv && strtolower($appEnv) === 'local') {
        $isLocal = true;
    }
    
    // For CLI scripts, we'll try direct connection
    if ($isLocal || php_sapi_name() === 'cli') {
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
            ob_end_clean(); // Clear any output
            echo "✓ Database connection established\n\n";
        } catch (PDOException $e) {
            ob_end_clean();
            echo "✗ Database connection failed: " . $e->getMessage() . "\n";
            echo "Please check your database configuration.\n";
            exit(1);
        }
    } else {
        // Try using the configured connection but catch output
        require_once __DIR__ . '/backend/config/database.php';
        
        // Try to get connection, but catch any JSON output
        try {
            $output = ob_get_contents();
            ob_clean();
            
            $pdo = get_db_connection();
            ob_end_clean(); // Clear any output
            echo "✓ Database connection established\n\n";
        } catch (Exception $e) {
            ob_end_clean();
            echo "✗ Database connection failed: " . $e->getMessage() . "\n";
            exit(1);
        }
    }
    
    // Fetch all prebuilts
    $stmt = $pdo->query('SELECT * FROM prebuilts');
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($prebuilts)) {
        echo "No prebuilts found in database.\n";
        exit(0);
    }
    
    echo "Found " . count($prebuilts) . " prebuilt(s) to check\n\n";
    
    // Fetch all RAM components
    $stmt = $pdo->prepare("SELECT c.* FROM components c JOIN component_categories cat ON c.category_id = cat.id WHERE UPPER(cat.name) = UPPER('RAM') AND (c.is_active IS NULL OR c.is_active = 1)");
    $stmt->execute();
    $rams = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($rams)) {
        echo "⚠ Warning: No RAM components found in inventory. Cannot fix prebuilts.\n";
        exit(1);
    }
    
    echo "Found " . count($rams) . " RAM component(s) in inventory\n\n";
    
    // Helper function to extract RAM type from component
    $extractRamType = function($component) {
        $ramType = null;
        
        // Check ram_type field directly
        if (isset($component['ram_type'])) {
            $ramType = trim($component['ram_type']);
        }
        
        // Fallback: check in specs JSON
        if (empty($ramType) && isset($component['specs'])) {
            $specs = is_string($component['specs']) ? json_decode($component['specs'], true) : $component['specs'];
            if (is_array($specs) && isset($specs['ram_type'])) {
                $ramType = trim($specs['ram_type']);
            }
        }
        
        // Fallback: check in name
        if (empty($ramType) && isset($component['name'])) {
            $nameUpper = strtoupper($component['name']);
            if (strpos($nameUpper, 'DDR5') !== false) {
                $ramType = 'DDR5';
            } elseif (strpos($nameUpper, 'DDR4') !== false) {
                $ramType = 'DDR4';
            } elseif (strpos($nameUpper, 'DDR3') !== false) {
                $ramType = 'DDR3';
            }
        }
        
        // Normalize RAM type
        if ($ramType) {
            $ramTypeUpper = strtoupper($ramType);
            if (strpos($ramTypeUpper, 'DDR5') !== false) {
                $ramType = 'DDR5';
            } elseif (strpos($ramTypeUpper, 'DDR4') !== false) {
                $ramType = 'DDR4';
            } elseif (strpos($ramTypeUpper, 'DDR3') !== false) {
                $ramType = 'DDR3';
            }
        }
        
        return $ramType;
    };
    
    // Helper function to get price
    $getPrice = function($component) {
        if (!isset($component['price'])) return 0;
        $n = floatval($component['price']);
        return $n > 0 ? $n : 0;
    };
    
    // Statistics
    $fixed = 0;
    $skipped = 0;
    $errors = 0;
    
    // Process each prebuilt
    foreach ($prebuilts as $prebuilt) {
        $prebuiltId = $prebuilt['id'];
        $prebuiltName = $prebuilt['name'] ?? "ID: $prebuiltId";
        
        echo "Processing: $prebuiltName\n";
        
        try {
            // Parse component_ids
            $componentIds = $prebuilt['component_ids'] ?? null;
            if (!$componentIds) {
                echo "  ⚠ Skipping: No component IDs found\n\n";
                $skipped++;
                continue;
            }
            
            if (is_string($componentIds)) {
                $componentIds = json_decode($componentIds, true);
            }
            
            if (!is_array($componentIds) || empty($componentIds['motherboard']) || empty($componentIds['ram'])) {
                echo "  ⚠ Skipping: Missing motherboard or RAM component\n\n";
                $skipped++;
                continue;
            }
            
            $moboId = (int)$componentIds['motherboard'];
            $ramId = (int)$componentIds['ram'];
            
            // Fetch motherboard and RAM components
            $stmt = $pdo->prepare('SELECT * FROM components WHERE id IN (?, ?)');
            $stmt->execute([$moboId, $ramId]);
            $components = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $motherboard = null;
            $currentRam = null;
            
            foreach ($components as $comp) {
                if ($comp['id'] == $moboId) {
                    $motherboard = $comp;
                }
                if ($comp['id'] == $ramId) {
                    $currentRam = $comp;
                }
            }
            
            if (!$motherboard) {
                echo "  ⚠ Skipping: Motherboard component not found (ID: $moboId)\n\n";
                $skipped++;
                continue;
            }
            
            if (!$currentRam) {
                echo "  ⚠ Skipping: RAM component not found (ID: $ramId)\n\n";
                $skipped++;
                continue;
            }
            
            // Extract RAM types
            $moboRamType = $extractRamType($motherboard);
            $currentRamType = $extractRamType($currentRam);
            
            if (!$moboRamType) {
                echo "  ⚠ Skipping: Could not determine motherboard RAM type\n";
                echo "    Motherboard: " . ($motherboard['name'] ?? 'Unknown') . "\n\n";
                $skipped++;
                continue;
            }
            
            // Check if already compatible
            if ($currentRamType === $moboRamType) {
                echo "  ✓ Already compatible: RAM type ($currentRamType) matches motherboard ($moboRamType)\n\n";
                $skipped++;
                continue;
            }
            
            echo "  ✗ Incompatible: RAM type ($currentRamType) doesn't match motherboard ($moboRamType)\n";
            
            // Find compatible RAM
            $compatibleRams = array_values(array_filter($rams, function($r) use ($moboRamType, $extractRamType) {
                $ramType = $extractRamType($r);
                return $ramType === $moboRamType;
            }));
            
            if (empty($compatibleRams)) {
                echo "  ⚠ Skipping: No compatible RAM found for motherboard type ($moboRamType)\n\n";
                $skipped++;
                continue;
            }
            
            // Prefer 16GB RAM if available, else cheapest
            $prefer16GB = array_values(array_filter($compatibleRams, function($r) {
                return stripos($r['name'] ?? '', '16') !== false;
            }));
            
            $selectedRam = null;
            if (!empty($prefer16GB)) {
                usort($prefer16GB, function($a, $b) use ($getPrice) {
                    return $getPrice($a) <=> $getPrice($b);
                });
                $selectedRam = $prefer16GB[0];
            } else {
                usort($compatibleRams, function($a, $b) use ($getPrice) {
                    return $getPrice($a) <=> $getPrice($b);
                });
                $selectedRam = $compatibleRams[0];
            }
            
            if (!$selectedRam) {
                echo "  ⚠ Skipping: Failed to select compatible RAM\n\n";
                $skipped++;
                continue;
            }
            
            $oldRamId = $ramId;
            $newRamId = (int)$selectedRam['id'];
            $oldRamName = $currentRam['name'] ?? 'Unknown';
            $newRamName = $selectedRam['name'] ?? 'Unknown';
            
            echo "  → Replacing RAM: \"$oldRamName\" (ID: $oldRamId) with \"$newRamName\" (ID: $newRamId)\n";
            
            // Update component_ids
            $componentIds['ram'] = $newRamId;
            $componentIdsJson = json_encode($componentIds);
            
            // Recalculate price
            $componentIdsForPrice = array_filter(array_map('intval', array_values($componentIds)));
            if (empty($componentIdsForPrice)) {
                echo "  ⚠ Warning: No valid component IDs for price calculation\n\n";
                $errors++;
                continue;
            }
            $placeholders = implode(',', array_fill(0, count($componentIdsForPrice), '?'));
            $stmt = $pdo->prepare("SELECT price FROM components WHERE id IN ($placeholders)");
            $stmt->execute($componentIdsForPrice);
            $componentsForPrice = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $newPrice = 0;
            foreach ($componentsForPrice as $comp) {
                $price = floatval($comp['price'] ?? 0);
                if ($price > 0) {
                    $newPrice += $price;
                }
            }
            
            $oldPrice = floatval($prebuilt['price'] ?? 0);
            $priceDiff = $newPrice - $oldPrice;
            
            // Update prebuilt
            $updateStmt = $pdo->prepare('UPDATE prebuilts SET component_ids = ?, price = ? WHERE id = ?');
            $updateStmt->execute([$componentIdsJson, $newPrice, $prebuiltId]);
            
            echo "  ✓ Fixed! Price updated: ₱" . number_format($oldPrice, 2) . " → ₱" . number_format($newPrice, 2);
            if (abs($priceDiff) > 0.01) {
                echo " (" . ($priceDiff >= 0 ? '+' : '') . "₱" . number_format($priceDiff, 2) . ")";
            }
            echo "\n\n";
            
            $fixed++;
            
        } catch (Exception $e) {
            echo "  ✗ Error: " . $e->getMessage() . "\n\n";
            $errors++;
        }
    }
    
    // Summary
    echo "=== Summary ===\n";
    echo "Total prebuilts: " . count($prebuilts) . "\n";
    echo "Fixed: $fixed\n";
    echo "Already compatible/Skipped: $skipped\n";
    echo "Errors: $errors\n\n";
    
    if ($fixed > 0) {
        echo "✓ Successfully fixed $fixed prebuilt(s)!\n";
    } else {
        echo "ℹ No fixes were needed.\n";
    }
    
} catch (Exception $e) {
    echo "✗ Fatal error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\nScript completed.\n";

