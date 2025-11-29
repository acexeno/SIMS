<?php
/**
 * Comprehensive Prebuilt Generator
 * Gathers all components from database and creates prebuilts based on compatibility rules
 * Uses the same compatibility logic as the frontend compatibilityService.js
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
    
    echo "=== COMPREHENSIVE PREBUILT GENERATOR ===\n\n";
    
    // ==================== COMPATIBILITY FUNCTIONS ====================
    
    /**
     * Normalize socket names (matches JS compatibility service)
     */
    function normalizeSocket($socket) {
        if (!$socket) return null;
        $s = strtolower(trim($socket));
        $s_clean = str_replace([' ', '-', '_'], '', $s);
        
        // AMD
        if (strpos($s_clean, 'am4') !== false || strpos($s_clean, 'amd4') !== false) return 'AMD AM4';
        if (strpos($s_clean, 'am5') !== false || strpos($s_clean, 'amd5') !== false) return 'AMD AM5';
        
        // Intel
        if (strpos($s_clean, 'lga1700') !== false) return 'Intel LGA1700';
        if (strpos($s_clean, 'lga1200') !== false) return 'Intel LGA1200';
        if (strpos($s_clean, 'lga1151') !== false) return 'Intel LGA1151';
        if (strpos($s_clean, 'lga1851') !== false) return 'Intel LGA1851';
        
        return strtoupper($s);
    }
    
    /**
     * Extract socket from component name if socket field is missing
     */
    function extractSocketFromName($name) {
        if (!$name) return null;
        $lower = strtolower($name);
        $clean = str_replace([' ', '-', '_'], '', $lower);
        
        // Check for explicit socket mentions first
        if (preg_match('/am4/i', $clean)) return 'AMD AM4';
        if (preg_match('/am5/i', $clean)) return 'AMD AM5';
        if (preg_match('/lga1700/i', $clean)) return 'Intel LGA1700';
        if (preg_match('/lga1200/i', $clean)) return 'Intel LGA1200';
        if (preg_match('/lga1151/i', $clean)) return 'Intel LGA1151';
        
        // AMD Ryzen series detection - improved regex
        if (preg_match('/r[3579]\s*-?\s*(\d{4})([a-z0-9]*)/i', $lower, $matches)) {
            $series = intval($matches[1]);
            if ($series >= 7000) return 'AMD AM5';
            if ($series >= 1000 && $series < 7000) return 'AMD AM4'; // 1000-6999 are AM4
        }
        
        // Also try simpler pattern for Ryzen
        if (preg_match('/ryzen\s*[3579]\s*(\d{4})/i', $lower, $matches)) {
            $series = intval($matches[1]);
            if ($series >= 7000) return 'AMD AM5';
            if ($series >= 1000) return 'AMD AM4';
        }
        
        // Intel CPU detection - improved
        if (preg_match('/i[3579]-(\d{4})/i', $lower, $matches)) {
            $series = intval($matches[1]);
            if ($series >= 12000 && $series < 14000) return 'Intel LGA1700'; // 12th/13th gen
            if ($series >= 14000) return 'Intel LGA1700'; // 14th gen also LGA1700
            if ($series >= 10000 && $series < 12000) return 'Intel LGA1200'; // 10th/11th gen
        }
        
        return null;
    }
    
    /**
     * Extract brand from name
     */
    function extractBrand($name) {
        if (!$name) return null;
        $lower = strtolower($name);
        
        if (strpos($lower, 'amd') !== false || strpos($lower, 'ryzen') !== false) return 'AMD';
        if (strpos($lower, 'intel') !== false || preg_match('/\bi[3579]-\d+/', $lower)) return 'Intel';
        
        return null;
    }
    
    /**
     * Check CPU-Motherboard compatibility
     */
    function checkCPUMotherboardCompatibility($cpu, $mobo) {
        $cpuSocket = $cpu['socket'] ?: extractSocketFromName($cpu['name']);
        $moboSocket = $mobo['socket'] ?: extractSocketFromName($mobo['name']);
        
        if ($cpuSocket && $moboSocket) {
            $cpuNorm = normalizeSocket($cpuSocket);
            $moboNorm = normalizeSocket($moboSocket);
            
            if ($cpuNorm && $moboNorm && $cpuNorm === $moboNorm) {
                return ['compatible' => true, 'reason' => "Socket match: $cpuNorm"];
            }
        }
        
        // Brand fallback
        $cpuBrand = extractBrand($cpu['name']) ?: ($cpu['brand'] ?? null);
        $moboBrand = $mobo['brand'] ?? null;
        
        if ($cpuBrand && $moboBrand) {
            if (($cpuBrand === 'AMD' && $moboBrand === 'AMD') || 
                ($cpuBrand === 'Intel' && $moboBrand === 'Intel')) {
                return ['compatible' => true, 'reason' => "Brand match: $cpuBrand"];
            }
        }
        
        return ['compatible' => false, 'reason' => "Socket mismatch: $cpuSocket vs $moboSocket"];
    }
    
    /**
     * Check RAM-Motherboard compatibility
     */
    function checkRAMMotherboardCompatibility($ram, $mobo) {
        $ramType = $ram['ram_type'] ?: $ram['type'] ?: 'DDR4';
        $moboRamType = $mobo['ram_type'] ?: 'DDR4';
        
        // Normalize
        $ramType = strtoupper($ramType);
        $moboRamType = strtoupper($moboRamType);
        
        if ($ramType === $moboRamType) {
            return ['compatible' => true, 'reason' => "RAM type match: $ramType"];
        }
        
        // If mobo doesn't specify, assume compatible
        if (!$mobo['ram_type']) {
            return ['compatible' => true, 'reason' => 'RAM type unknown, assuming compatible'];
        }
        
        return ['compatible' => false, 'reason' => "RAM type mismatch: $ramType vs $moboRamType"];
    }
    
    /**
     * Check PSU Power compatibility
     */
    function checkPSUPowerCompatibility($psu, $components) {
        $psuWattage = intval($psu['wattage'] ?? 0);
        
        if ($psuWattage === 0) {
            return ['compatible' => true, 'reason' => 'PSU wattage unknown, assuming compatible'];
        }
        
        // Calculate power requirements
        $totalPower = 100; // Base system
        
        // CPU
        if (isset($components['cpu'])) {
            $tdp = intval($components['cpu']['tdp'] ?? 95);
            $totalPower += $tdp * 1.2; // 20% buffer
        }
        
        // GPU
        if (isset($components['gpu'])) {
            $tdp = intval($components['gpu']['tdp'] ?? 150);
            $totalPower += $tdp * 1.3; // 30% buffer
        }
        
        // Add 15% buffer for aging
        $totalPower = intval($totalPower * 1.15);
        
        if ($psuWattage >= $totalPower) {
            return ['compatible' => true, 'reason' => "PSU sufficient: {$psuWattage}W >= {$totalPower}W"];
        }
        
        return ['compatible' => false, 'reason' => "PSU insufficient: {$psuWattage}W < {$totalPower}W"];
    }
    
    /**
     * Check Case-Motherboard form factor compatibility
     */
    function checkCaseMotherboardCompatibility($case, $mobo) {
        $caseFF = strtoupper($case['form_factor'] ?? 'ATX');
        $moboFF = strtoupper($mobo['form_factor'] ?? 'ATX');
        
        // Form factor compatibility matrix
        $compatibility = [
            'ATX' => ['ATX', 'MICRO-ATX', 'MINI-ITX'],
            'MICRO-ATX' => ['MICRO-ATX', 'MINI-ITX'],
            'MINI-ITX' => ['MINI-ITX'],
            'E-ATX' => ['E-ATX', 'ATX', 'MICRO-ATX', 'MINI-ITX']
        ];
        
        if (isset($compatibility[$caseFF])) {
            if (in_array($moboFF, $compatibility[$caseFF])) {
                return ['compatible' => true, 'reason' => "Form factor compatible: $caseFF case with $moboFF mobo"];
            }
        }
        
        // Default to compatible if unknown
        return ['compatible' => true, 'reason' => 'Form factor unknown, assuming compatible'];
    }
    
    // ==================== GATHER COMPONENTS ====================
    
    echo "1. Gathering components from database...\n";
    
    // Get all components by category
    $categories = ['CPU', 'Motherboard', 'GPU', 'RAM', 'Storage', 'PSU', 'Case', 'Cooler'];
    $components = [];
    
    foreach ($categories as $catName) {
        $stmt = $pdo->prepare("SELECT c.*, cat.name as category_name 
            FROM components c 
            JOIN component_categories cat ON c.category_id = cat.id 
            WHERE UPPER(cat.name) = UPPER(?) 
            AND (c.is_active = 1 OR c.is_active IS NULL)
            ORDER BY c.price ASC");
        $stmt->execute([$catName]);
        $components[$catName] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo "   - $catName: " . count($components[$catName]) . " component(s)\n";
    }
    
    echo "\n";
    
    // ==================== GENERATE PREBUILTS ====================
    
    echo "2. Generating compatible prebuilts...\n";
    
    $generated = [];
    $buildNumber = 1;
    
    // Group CPUs by brand/socket
    $amdCpus = [];
    $intelCpus = [];
    
    foreach ($components['CPU'] as $cpu) {
        $brand = extractBrand($cpu['name']) ?: ($cpu['brand'] ?? '');
        $socket = $cpu['socket'] ?: extractSocketFromName($cpu['name']);
        
        if ($brand === 'AMD' || strtolower($brand) === 'amd') {
            $amdCpus[] = $cpu;
        } elseif ($brand === 'Intel' || strtolower($brand) === 'intel') {
            $intelCpus[] = $cpu;
        } else {
            // Try to detect from name
            if (preg_match('/ryzen|amd/i', $cpu['name'])) {
                $amdCpus[] = $cpu;
            } elseif (preg_match('/intel|i[3579]-\d+/i', $cpu['name'])) {
                $intelCpus[] = $cpu;
            }
        }
    }
    
    echo "   Found " . count($amdCpus) . " AMD CPU(s) and " . count($intelCpus) . " Intel CPU(s)\n\n";
    
    // Function to build prebuilts from a CPU list
    function buildPrebuiltsFromCpus($cpus, $components) {
        global $pdo;
        $prebuilts = [];
        
        foreach ($cpus as $cpuIdx => $cpu) {
            if ($cpuIdx >= 15) break; // Limit to 15 prebuilts per brand
            
            // Find compatible motherboard - use different motherboards for variety
            $compatibleMobo = null;
            $usedMoboIds = [];
            foreach ($prebuilts as $existing) {
                if (isset($existing['mobo'])) {
                    $usedMoboIds[] = $existing['mobo']['id'];
                }
            }
            
            // Try to find a motherboard we haven't used yet
            foreach ($components['Motherboard'] as $mobo) {
                if (in_array($mobo['id'], $usedMoboIds)) {
                    continue; // Skip already used motherboards
                }
                $check = checkCPUMotherboardCompatibility($cpu, $mobo);
                if ($check['compatible']) {
                    $compatibleMobo = $mobo;
                    break;
                }
            }
            
            // If no unused motherboard found, use any compatible one
            if (!$compatibleMobo) {
                foreach ($components['Motherboard'] as $mobo) {
                    $check = checkCPUMotherboardCompatibility($cpu, $mobo);
                    if ($check['compatible']) {
                        $compatibleMobo = $mobo;
                        break;
                    }
                }
            }
            
            if (!$compatibleMobo) {
                continue; // Skip if no compatible motherboard
            }
            
            // Find compatible RAM - use different RAM for variety
            $usedRamIds = [];
            foreach ($prebuilts as $existing) {
                if (isset($existing['ram'])) {
                    $usedRamIds[] = $existing['ram']['id'];
                }
            }
            
            $compatibleRam = null;
            // Try unused RAM first
            foreach ($components['RAM'] as $ram) {
                if (in_array($ram['id'], $usedRamIds)) {
                    continue;
                }
                $check = checkRAMMotherboardCompatibility($ram, $compatibleMobo);
                if ($check['compatible']) {
                    $compatibleRam = $ram;
                    break;
                }
            }
            
            // If no unused compatible RAM, use any compatible RAM
            if (!$compatibleRam) {
                foreach ($components['RAM'] as $ram) {
                    $check = checkRAMMotherboardCompatibility($ram, $compatibleMobo);
                    if ($check['compatible']) {
                        $compatibleRam = $ram;
                        break;
                    }
                }
            }
            
            // Last resort: use first available RAM
            if (!$compatibleRam) {
                $compatibleRam = $components['RAM'][0] ?? null;
            }
            
            if (!$compatibleRam) {
                continue; // Skip if no RAM available
            }
            
            // Get GPU (optional for APUs) - use different GPUs for variety
            $gpu = null;
            $isAPU = preg_match('/[56]00[Gg]/', $cpu['name']); // Ryzen G-series APUs
            if (!$isAPU) {
                $usedGpuIds = [];
                foreach ($prebuilts as $existing) {
                    if (isset($existing['gpu']) && $existing['gpu']) {
                        $usedGpuIds[] = $existing['gpu']['id'];
                    }
                }
                
                // Try to use a different GPU
                foreach ($components['GPU'] as $testGpu) {
                    if (!in_array($testGpu['id'], $usedGpuIds)) {
                        $gpu = $testGpu;
                        break;
                    }
                }
                
                // If all GPUs used, cycle through them
                if (!$gpu) {
                    $gpu = $components['GPU'][$cpuIdx % count($components['GPU'])] ?? $components['GPU'][0] ?? null;
                }
            }
            
            // Get Storage - use different storage for variety
            $usedStorageIds = [];
            foreach ($prebuilts as $existing) {
                if (isset($existing['storage'])) {
                    $usedStorageIds[] = $existing['storage']['id'];
                }
            }
            
            $storage = null;
            foreach ($components['Storage'] as $testStorage) {
                if (!in_array($testStorage['id'], $usedStorageIds)) {
                    $storage = $testStorage;
                    break;
                }
            }
            
            if (!$storage) {
                $storage = $components['Storage'][$cpuIdx % count($components['Storage'])] ?? $components['Storage'][0] ?? null;
            }
            if (!$storage) {
                continue; // Skip if no storage
            }
            
            // Get Case (compatible with motherboard)
            $compatibleCase = null;
            foreach ($components['Case'] as $case) {
                $check = checkCaseMotherboardCompatibility($case, $compatibleMobo);
                if ($check['compatible']) {
                    $compatibleCase = $case;
                    break;
                }
            }
            
            if (!$compatibleCase) {
                $compatibleCase = $components['Case'][0] ?? null;
            }
            
            if (!$compatibleCase) {
                continue; // Skip if no case
            }
            
            // Get PSU (check power requirements)
            $compatiblePsu = null;
            $tempComponents = [
                'cpu' => $cpu,
                'gpu' => $gpu
            ];
            
            foreach ($components['PSU'] as $psu) {
                $check = checkPSUPowerCompatibility($psu, $tempComponents);
                if ($check['compatible']) {
                    $compatiblePsu = $psu;
                    break;
                }
            }
            
            if (!$compatiblePsu) {
                $compatiblePsu = $components['PSU'][0] ?? null;
            }
            
            if (!$compatiblePsu) {
                continue; // Skip if no PSU
            }
            
            // Get Cooler
            $cooler = $components['Cooler'][0] ?? null;
            
            // Calculate total price
            $totalPrice = floatval($cpu['price'] ?? 0) +
                         floatval($compatibleMobo['price'] ?? 0) +
                         floatval($compatibleRam['price'] ?? 0) +
                         floatval($gpu['price'] ?? 0) +
                         floatval($storage['price'] ?? 0) +
                         floatval($compatiblePsu['price'] ?? 0) +
                         floatval($compatibleCase['price'] ?? 0) +
                         floatval($cooler['price'] ?? 0);
            
            // Determine category
            $category = 'gaming';
            $cpuName = strtolower($cpu['name']);
            if (preg_match('/i[79]|r[79]/', $cpuName)) {
                $category = 'workstation';
            }
            
            // Build component IDs array
            $componentIds = [
                'cpu' => intval($cpu['id']),
                'motherboard' => intval($compatibleMobo['id']),
                'ram' => intval($compatibleRam['id']),
                'storage' => intval($storage['id']),
                'psu' => intval($compatiblePsu['id']),
                'case' => intval($compatibleCase['id'])
            ];
            
            if ($gpu) {
                $componentIds['gpu'] = intval($gpu['id']);
            }
            
            if ($cooler) {
                $componentIds['cooler'] = intval($cooler['id']);
            }
            
            // Build name
            $cpuShort = preg_replace('/.*?(Ryzen [3579] \d+[A-Z]?|Core i[3579]-\d+).*/i', '$1', $cpu['name']);
            $brand = extractBrand($cpu['name']);
            $tier = 'Starter';
            if ($cpuIdx === 0) $tier = 'Budget';
            elseif ($cpuIdx === 1) $tier = 'Performance';
            elseif ($cpuIdx === 2) $tier = 'Enthusiast';
            
            $name = "$brand $tier";
            if (!$isAPU && $gpu) {
                $gpuShort = preg_replace('/.*?([RT]X \d+|RX \d+).*/i', '$1', $gpu['name']);
                if ($gpuShort !== $gpu['name']) {
                    $name .= " - $gpuShort";
                }
            }
            
            $prebuilts[] = [
                'name' => $name,
                'category' => $category,
                'description' => "Compatible prebuilt featuring {$cpuShort} processor" . ($gpu ? " and {$gpu['name']}" : "") . ".",
                'price' => round($totalPrice, 2),
                'component_ids' => $componentIds,
                'cpu' => $cpu,
                'mobo' => $compatibleMobo,
                'ram' => $compatibleRam,
                'gpu' => $gpu,
                'storage' => $storage,
                'psu' => $compatiblePsu,
                'case' => $compatibleCase,
                'cooler' => $cooler
            ];
        }
        
        return $prebuilts;
    }
    
    // Generate AMD prebuilts
    $amdPrebuilts = buildPrebuiltsFromCpus($amdCpus, $components);
    $generated = array_merge($generated, $amdPrebuilts);
    
    // Generate Intel prebuilts
    $intelPrebuilts = buildPrebuiltsFromCpus($intelCpus, $components);
    $generated = array_merge($generated, $intelPrebuilts);
    
    echo "   Generated " . count($generated) . " compatible prebuilt(s)\n\n";
    
    // ==================== INSERT INTO DATABASE ====================
    
    if (empty($generated)) {
        echo "⚠️  No compatible prebuilts could be generated.\n";
        echo "   Check that you have:\n";
        echo "   - CPUs with compatible motherboards\n";
        echo "   - RAM compatible with motherboards\n";
        echo "   - All required components (Storage, PSU, Case)\n";
        exit(0);
    }
    
    echo "3. Inserting prebuilts into database...\n";
    
    // Clear existing prebuilts (optional - comment out if you want to keep existing)
    // $pdo->exec("DELETE FROM prebuilts");
    
    $stmt = $pdo->prepare("INSERT INTO prebuilts 
        (name, category, description, image, price, performance, features, component_ids, in_stock, is_hidden) 
        VALUES (?, ?, ?, '', ?, ?, ?, ?, 1, 0)");
    
    $inserted = 0;
    foreach ($generated as $pb) {
        try {
            $performance = json_encode(['gaming' => 0, 'streaming' => 0]);
            $features = json_encode([]);
            $componentIdsJson = json_encode($pb['component_ids']);
            
            $stmt->execute([
                $pb['name'],
                $pb['category'],
                $pb['description'],
                $pb['price'],
                $performance,
                $features,
                $componentIdsJson
            ]);
            
            $inserted++;
            echo "   ✅ Created: {$pb['name']} - ₱" . number_format($pb['price'], 2) . "\n";
            echo "      CPU: {$pb['cpu']['name']}\n";
            echo "      Mobo: {$pb['mobo']['name']}\n";
            echo "      RAM: {$pb['ram']['name']}\n";
            if ($pb['gpu']) {
                echo "      GPU: {$pb['gpu']['name']}\n";
            }
            echo "\n";
        } catch (Exception $e) {
            echo "   ❌ Failed to insert {$pb['name']}: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n=== GENERATION COMPLETE ===\n";
    echo "✅ Successfully created $inserted prebuilt(s)\n";
    
} catch (Exception $e) {
    echo "❌ ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

