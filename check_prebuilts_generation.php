<?php
/**
 * Check why prebuilts generation might be limited
 * This script checks component availability and compatibility
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
    
    echo "=== PREBUILTS GENERATION ANALYSIS ===\n\n";
    
    // 1. Count components by category
    echo "1. Components by category:\n";
    $stmt = $pdo->query("SELECT 
        cat.name as category,
        COUNT(c.id) as count,
        SUM(CASE WHEN c.is_active = 1 OR c.is_active IS NULL THEN 1 ELSE 0 END) as active
        FROM component_categories cat
        LEFT JOIN components c ON c.category_id = cat.id
        GROUP BY cat.id, cat.name
        ORDER BY cat.name");
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($categories as $cat) {
        echo "   - {$cat['category']}: {$cat['count']} total, {$cat['active']} active\n";
    }
    echo "\n";
    
    // 2. Check CPUs (AMD vs Intel)
    echo "2. CPU Analysis:\n";
    $stmt = $pdo->query("SELECT c.*, cat.name as category_name 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'CPU' 
        AND (c.is_active = 1 OR c.is_active IS NULL)
        ORDER BY c.name");
    $cpus = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $amdCount = 0;
    $intelCount = 0;
    $amdCpus = [];
    $intelCpus = [];
    
    foreach ($cpus as $cpu) {
        $name = strtolower($cpu['name'] ?? '');
        $isAMD = (strpos($name, 'ryzen') !== false || strpos($name, 'amd') !== false);
        $isIntel = (strpos($name, 'intel') !== false || strpos($name, 'core i') !== false || strpos($name, 'celeron') !== false || strpos($name, 'pentium') !== false);
        
        if ($isAMD) {
            $amdCount++;
            $amdCpus[] = $cpu;
            echo "   AMD: {$cpu['name']} (ID: {$cpu['id']}, Socket: {$cpu['socket']})\n";
        } elseif ($isIntel) {
            $intelCount++;
            $intelCpus[] = $cpu;
            echo "   Intel: {$cpu['name']} (ID: {$cpu['id']}, Socket: {$cpu['socket']})\n";
        } else {
            echo "   Unknown: {$cpu['name']} (ID: {$cpu['id']})\n";
        }
    }
    
    echo "   Summary: {$amdCount} AMD CPU(s), {$intelCount} Intel CPU(s)\n\n";
    
    // 3. Check Motherboards by socket compatibility
    echo "3. Motherboard Analysis:\n";
    $stmt = $pdo->query("SELECT c.*, cat.name as category_name 
        FROM components c 
        JOIN component_categories cat ON c.category_id = cat.id 
        WHERE UPPER(cat.name) = 'MOTHERBOARD' 
        AND (c.is_active = 1 OR c.is_active IS NULL)
        ORDER BY c.socket, c.name");
    $mobos = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $sockets = [];
    foreach ($mobos as $mobo) {
        $socket = $mobo['socket'] ?? 'Unknown';
        if (!isset($sockets[$socket])) {
            $sockets[$socket] = 0;
        }
        $sockets[$socket]++;
    }
    
    foreach ($sockets as $socket => $count) {
        echo "   Socket $socket: $count motherboard(s)\n";
    }
    echo "   Total motherboards: " . count($mobos) . "\n\n";
    
    // 4. Match CPUs with Motherboards
    echo "4. CPU-Motherboard Compatibility:\n";
    
    foreach ($amdCpus as $cpu) {
        $cpuSocket = strtolower($cpu['socket'] ?? '');
        $cpuSocketNorm = str_replace([' ', '-', '_'], '', $cpuSocket);
        
        $matches = [];
        foreach ($mobos as $mobo) {
            $moboSocket = strtolower($mobo['socket'] ?? '');
            $moboSocketNorm = str_replace([' ', '-', '_'], '', $moboSocket);
            
            // Normalize socket matching
            $match = false;
            if (strpos($cpuSocketNorm, 'am4') !== false && strpos($moboSocketNorm, 'am4') !== false) $match = true;
            elseif (strpos($cpuSocketNorm, 'am5') !== false && strpos($moboSocketNorm, 'am5') !== false) $match = true;
            elseif ($cpuSocketNorm === $moboSocketNorm && !empty($cpuSocketNorm)) $match = true;
            
            if ($match) {
                $matches[] = $mobo;
            }
        }
        
        echo "   {$cpu['name']} (Socket: {$cpu['socket']}): " . count($matches) . " compatible motherboard(s)\n";
        if (empty($matches)) {
            echo "      ⚠️  NO COMPATIBLE MOTHERBOARDS FOUND!\n";
        }
    }
    
    foreach ($intelCpus as $cpu) {
        $cpuSocket = strtolower($cpu['socket'] ?? '');
        $cpuSocketNorm = str_replace([' ', '-', '_'], '', $cpuSocket);
        
        $matches = [];
        foreach ($mobos as $mobo) {
            $moboSocket = strtolower($mobo['socket'] ?? '');
            $moboSocketNorm = str_replace([' ', '-', '_'], '', $moboSocket);
            
            // Normalize socket matching
            $match = false;
            if (strpos($cpuSocketNorm, 'lga1700') !== false && strpos($moboSocketNorm, 'lga1700') !== false) $match = true;
            elseif (strpos($cpuSocketNorm, 'lga1200') !== false && strpos($moboSocketNorm, 'lga1200') !== false) $match = true;
            elseif (strpos($cpuSocketNorm, 'lga1151') !== false && strpos($moboSocketNorm, 'lga1151') !== false) $match = true;
            elseif ($cpuSocketNorm === $moboSocketNorm && !empty($cpuSocketNorm)) $match = true;
            
            if ($match) {
                $matches[] = $mobo;
            }
        }
        
        echo "   {$cpu['name']} (Socket: {$cpu['socket']}): " . count($matches) . " compatible motherboard(s)\n";
        if (empty($matches)) {
            echo "      ⚠️  NO COMPATIBLE MOTHERBOARDS FOUND!\n";
        }
    }
    echo "\n";
    
    // 5. Check other required components
    echo "5. Other Required Components:\n";
    $required = ['GPU', 'RAM', 'Storage', 'PSU', 'Case', 'Cooler'];
    foreach ($required as $req) {
        $stmt = $pdo->query("SELECT COUNT(*) as count 
            FROM components c 
            JOIN component_categories cat ON c.category_id = cat.id 
            WHERE UPPER(cat.name) = '$req' 
            AND (c.is_active = 1 OR c.is_active IS NULL)");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "   $req: {$result['count']} component(s)\n";
    }
    echo "\n";
    
    // 6. Current prebuilts
    echo "6. Current Prebuilts:\n";
    $stmt = $pdo->query("SELECT id, name, category, component_ids FROM prebuilts");
    $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($prebuilts as $pb) {
        $compIds = json_decode($pb['component_ids'], true);
        $cpuId = $compIds['cpu'] ?? null;
        
        if ($cpuId) {
            $cpuStmt = $pdo->prepare("SELECT name FROM components WHERE id = ?");
            $cpuStmt->execute([$cpuId]);
            $cpu = $cpuStmt->fetch(PDO::FETCH_ASSOC);
            echo "   - {$pb['name']} (ID: {$pb['id']}): Uses CPU ID $cpuId ({$cpu['name']})\n";
        }
    }
    echo "\n";
    
    echo "=== ANALYSIS COMPLETE ===\n";
    echo "\nRECOMMENDATION:\n";
    if ($intelCount === 0) {
        echo "⚠️  No Intel CPUs found in database. Add Intel CPUs to generate Intel prebuilts.\n";
    } elseif (empty($intelCpus)) {
        echo "⚠️  Intel CPUs exist but weren't detected. Check CPU naming.\n";
    } else {
        echo "ℹ️  Run the prebuilts seeding to generate more prebuilts.\n";
    }
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

