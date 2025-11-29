<?php
/**
 * Debug why prebuilts aren't being generated for all CPUs
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
    
    echo "=== DEBUGGING PREBUILT GENERATION ===\n\n";
    
    // Get all CPUs
    $stmt = $pdo->query("SELECT c.*, cat.name as category_name 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'CPU' 
        AND (c.is_active = 1 OR c.is_active IS NULL)
        ORDER BY c.name");
    $cpus = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Checking " . count($cpus) . " CPUs:\n\n";
    
    // Get all motherboards
    $stmt = $pdo->query("SELECT c.*, cat.name as category_name 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'MOTHERBOARD' 
        AND (c.is_active = 1 OR c.is_active IS NULL)
        ORDER BY c.socket, c.name");
    $mobos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get other components
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'RAM' AND (c.is_active = 1 OR c.is_active IS NULL)");
    $ramCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'STORAGE' AND (c.is_active = 1 OR c.is_active IS NULL)");
    $storageCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'PSU' AND (c.is_active = 1 OR c.is_active IS NULL)");
    $psuCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as count FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'CASE' AND (c.is_active = 1 OR c.is_active IS NULL)");
    $caseCount = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
    
    echo "Available components:\n";
    echo "  - RAM: $ramCount\n";
    echo "  - Storage: $storageCount\n";
    echo "  - PSU: $psuCount\n";
    echo "  - Case: $caseCount\n\n";
    
    function normalizeSocket($socket) {
        if (!$socket) return null;
        $s = strtolower(trim($socket));
        $s_clean = str_replace([' ', '-', '_'], '', $s);
        
        if (strpos($s_clean, 'am4') !== false || strpos($s_clean, 'amd4') !== false) return 'AMD AM4';
        if (strpos($s_clean, 'am5') !== false || strpos($s_clean, 'amd5') !== false) return 'AMD AM5';
        if (strpos($s_clean, 'lga1700') !== false) return 'Intel LGA1700';
        if (strpos($s_clean, 'lga1200') !== false) return 'Intel LGA1200';
        if (strpos($s_clean, 'lga1151') !== false) return 'Intel LGA1151';
        
        return strtoupper($s);
    }
    
    function extractSocketFromName($name) {
        if (!$name) return null;
        $lower = strtolower($name);
        $clean = str_replace([' ', '-', '_'], '', $lower);
        
        if (preg_match('/am4/i', $clean)) return 'AMD AM4';
        if (preg_match('/am5/i', $clean)) return 'AMD AM5';
        if (preg_match('/lga1700/i', $clean)) return 'Intel LGA1700';
        if (preg_match('/lga1200/i', $clean)) return 'Intel LGA1200';
        if (preg_match('/lga1151/i', $clean)) return 'Intel LGA1151';
        
        if (preg_match('/r[3579]\s*-?\s*(\d{4})/i', $lower, $matches)) {
            $series = intval($matches[1]);
            if ($series >= 7000) return 'AMD AM5';
            if ($series >= 1000) return 'AMD AM4';
        }
        
        if (preg_match('/i[3579]-(\d{4})/i', $lower, $matches)) {
            $series = intval($matches[1]);
            if ($series >= 12000) return 'Intel LGA1700';
            if ($series >= 10000) return 'Intel LGA1200';
        }
        
        return null;
    }
    
    function extractBrand($name) {
        if (!$name) return null;
        $lower = strtolower($name);
        if (strpos($lower, 'amd') !== false || strpos($lower, 'ryzen') !== false) return 'AMD';
        if (strpos($lower, 'intel') !== false || preg_match('/\bi[3579]-\d+/', $lower)) return 'Intel';
        return null;
    }
    
    $cpuIndex = 0;
    foreach ($cpus as $cpu) {
        $cpuIndex++;
        $cpuSocket = $cpu['socket'] ?: extractSocketFromName($cpu['name']);
        $cpuBrand = extractBrand($cpu['name']) ?: ($cpu['brand'] ?? '');
        
        echo "CPU #$cpuIndex: {$cpu['name']}\n";
        echo "  ID: {$cpu['id']}\n";
        echo "  Socket (from DB): " . ($cpu['socket'] ?: 'NULL') . "\n";
        echo "  Socket (extracted): " . ($cpuSocket ?: 'NULL') . "\n";
        echo "  Brand (from DB): " . ($cpu['brand'] ?: 'NULL') . "\n";
        echo "  Brand (extracted): $cpuBrand\n";
        
        // Find compatible motherboards
        $compatibleMobos = [];
        foreach ($mobos as $mobo) {
            $moboSocket = $mobo['socket'] ?: extractSocketFromName($mobo['name']);
            
            $cpuNorm = normalizeSocket($cpuSocket);
            $moboNorm = normalizeSocket($moboSocket);
            
            $compatible = false;
            if ($cpuNorm && $moboNorm && $cpuNorm === $moboNorm) {
                $compatible = true;
            } elseif (!$cpuNorm || !$moboNorm) {
                // Brand fallback
                $moboBrand = extractBrand($mobo['name']) ?: ($mobo['brand'] ?? '');
                if ($cpuBrand && $moboBrand) {
                    if (($cpuBrand === 'AMD' && $moboBrand === 'AMD') || 
                        ($cpuBrand === 'Intel' && $moboBrand === 'Intel')) {
                        $compatible = true;
                    }
                }
            }
            
            if ($compatible) {
                $compatibleMobos[] = $mobo;
            }
        }
        
        echo "  Compatible motherboards: " . count($compatibleMobos) . "\n";
        if (empty($compatibleMobos)) {
            echo "  ❌ NO COMPATIBLE MOTHERBOARDS FOUND!\n";
        } else {
            echo "  ✅ Found compatible motherboard(s):\n";
            foreach (array_slice($compatibleMobos, 0, 3) as $mobo) {
                echo "     - {$mobo['name']} (Socket: " . ($mobo['socket'] ?: 'NULL') . ")\n";
            }
            if (count($compatibleMobos) > 3) {
                echo "     ... and " . (count($compatibleMobos) - 3) . " more\n";
            }
        }
        
        // Check other required components
        $hasAllComponents = true;
        if ($ramCount === 0) {
            echo "  ⚠️  No RAM available\n";
            $hasAllComponents = false;
        }
        if ($storageCount === 0) {
            echo "  ⚠️  No Storage available\n";
            $hasAllComponents = false;
        }
        if ($psuCount === 0) {
            echo "  ⚠️  No PSU available\n";
            $hasAllComponents = false;
        }
        if ($caseCount === 0) {
            echo "  ⚠️  No Case available\n";
            $hasAllComponents = false;
        }
        
        if ($hasAllComponents && !empty($compatibleMobos)) {
            echo "  ✅ CAN CREATE PREBUILT\n";
        } else {
            echo "  ❌ CANNOT CREATE PREBUILT\n";
        }
        
        echo "\n";
    }
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
?>

