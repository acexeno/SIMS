<?php
// Shared utility for seeding prebuilts from current inventory
// Defines seed_prebuilts($pdo, $user) if not already defined

if (!function_exists('seed_prebuilts')) {
    function seed_prebuilts($pdo, $user) {
        // Helper to check admin
        $roles = $user['roles'] ?? [];
        if (is_string($roles)) { $roles = explode(',', $roles); }
        if (!$user || !(in_array('Super Admin', $roles) || in_array('Admin', $roles))) {
            http_response_code(403);
            echo json_encode(['error' => 'Admin or Super Admin access required']);
            exit();
        }

        // Optionally reset table if requested
        if (isset($_GET['reset']) && $_GET['reset']) {
            $pdo->exec('DELETE FROM prebuilts');
        }

        // Helpers to fetch components by category name
        $fetchByCat = function($catName) use ($pdo) {
            $stmt = $pdo->prepare("SELECT c.* FROM components c JOIN component_categories cat ON c.category_id = cat.id WHERE UPPER(cat.name) = UPPER(?) AND (c.is_active IS NULL OR c.is_active = 1)");
            $stmt->execute([$catName]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return $rows ?: [];
        };

        $cpus = $fetchByCat('CPU');
        $mobos = $fetchByCat('Motherboard');
        $gpus = $fetchByCat('GPU');
        $rams = $fetchByCat('RAM');
        $stores = $fetchByCat('Storage');
        $psus = $fetchByCat('PSU');
        $cases = $fetchByCat('Case');
        $coolers = $fetchByCat('Cooler');

        $getPrice = function($row) {
            if (!isset($row['price'])) return 0;
            $n = floatval($row['price']);
            return $n > 0 ? $n : 0;
        };

        $normSocket = function($s) {
            if (!$s) return '';
            $s = strtolower($s);
            $s_clean = str_replace([' ', '-', '_'], '', $s);
            if (strpos($s_clean, 'am4') !== false || strpos($s_clean, 'amd4') !== false) return 'AM4';
            if (strpos($s_clean, 'am5') !== false || strpos($s_clean, 'amd5') !== false) return 'AM5';
            if (strpos($s, 'lga1700') !== false) return 'LGA1700';
            if (strpos($s, 'lga1200') !== false) return 'LGA1200';
            if (strpos($s, 'lga1151') !== false) return 'LGA1151';
            return strtoupper($s);
        };

        foreach ($cpus as &$cpu) {
            $cpu['socket_norm'] = $normSocket($cpu['socket'] ?? ($cpu['model'] ?? $cpu['type'] ?? $cpu['name'] ?? ''));
            $name = strtolower($cpu['name'] ?? '');
            $cpu['brand_norm'] = (strpos($name, 'ryzen') !== false || strpos($name, 'amd') !== false) ? 'AMD' : ((strpos($name, 'intel') !== false || strpos($name, 'core i') !== false) ? 'Intel' : '');
        }
        unset($cpu);
        foreach ($mobos as &$mb) {
            $mb['socket_norm'] = $normSocket($mb['socket'] ?? ($mb['model'] ?? $mb['type'] ?? $mb['name'] ?? ''));
        }
        unset($mb);

        $pickCheapest = function($arr) use ($getPrice) {
            usort($arr, function($a, $b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $arr[0] ?? null;
        };

        $pickGpu = function($tier) use ($gpus, $getPrice, $pickCheapest) {
            if (empty($gpus)) return null;
            usort($gpus, function($a, $b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            $idx = 0;
            if ($tier === 'mid') $idx = min( (int)floor(count($gpus) * 0.4), max(0, count($gpus)-1));
            if ($tier === 'high') $idx = min( (int)floor(count($gpus) * 0.75), max(0, count($gpus)-1));
            return $gpus[$idx] ?? $pickCheapest($gpus);
        };

        $findMoboForSocket = function($socket) use ($mobos, $getPrice) {
            $list = array_values(array_filter($mobos, function($m) use ($socket) { return ($m['socket_norm'] ?? '') === $socket; }));
            if (empty($list)) return null;
            usort($list, function($a, $b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $list[0];
        };

        $pickRam = function($motherboard = null) use ($rams, $getPrice) {
            if (empty($rams)) return null;
            
            // Extract motherboard RAM type if available
            $moboRamType = null;
            if ($motherboard) {
                // Check ram_type field directly
                $moboRamType = isset($motherboard['ram_type']) ? trim($motherboard['ram_type']) : null;
                
                // Fallback: check in specs JSON if ram_type not directly available
                if (empty($moboRamType) && isset($motherboard['specs'])) {
                    $specs = is_string($motherboard['specs']) ? json_decode($motherboard['specs'], true) : $motherboard['specs'];
                    if (is_array($specs) && isset($specs['ram_type'])) {
                        $moboRamType = trim($specs['ram_type']);
                    }
                }
                
                // Normalize RAM type (DDR4, DDR5, etc.)
                if ($moboRamType) {
                    $moboRamTypeUpper = strtoupper($moboRamType);
                    if (strpos($moboRamTypeUpper, 'DDR5') !== false) {
                        $moboRamType = 'DDR5';
                    } elseif (strpos($moboRamTypeUpper, 'DDR4') !== false) {
                        $moboRamType = 'DDR4';
                    } elseif (strpos($moboRamTypeUpper, 'DDR3') !== false) {
                        $moboRamType = 'DDR3';
                    }
                }
            }
            
            // Filter RAM by compatibility with motherboard
            $compatibleRams = $rams;
            if ($moboRamType) {
                $compatibleRams = array_values(array_filter($rams, function($r) use ($moboRamType) {
                    $ramType = null;
                    
                    // Check ram_type field directly
                    if (isset($r['ram_type'])) {
                        $ramType = trim($r['ram_type']);
                    }
                    
                    // Fallback: check in specs JSON
                    if (empty($ramType) && isset($r['specs'])) {
                        $specs = is_string($r['specs']) ? json_decode($r['specs'], true) : $r['specs'];
                        if (is_array($specs) && isset($specs['ram_type'])) {
                            $ramType = trim($specs['ram_type']);
                        }
                    }
                    
                    // Fallback: check in name
                    if (empty($ramType) && isset($r['name'])) {
                        $nameUpper = strtoupper($r['name']);
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
                    
                    // Return true if RAM type matches motherboard, or if we couldn't determine RAM type (fallback)
                    return !$ramType || $ramType === $moboRamType;
                }));
            }
            
            // If no compatible RAM found, fall back to all RAM (for backward compatibility)
            if (empty($compatibleRams)) {
                $compatibleRams = $rams;
            }
            
            // Prefer 16GB if mentioned, else cheapest
            $prefer = array_values(array_filter($compatibleRams, function($r){ return stripos($r['name'] ?? '', '16') !== false; }));
            if (!empty($prefer)) {
                usort($prefer, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
                return $prefer[0];
            }
            usort($compatibleRams, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $compatibleRams[0];
        };

        $pickStorage = function() use ($stores, $getPrice) {
            if (empty($stores)) return null;
            $prefer = array_values(array_filter($stores, function($s){ return stripos($s['name'] ?? '', '500') !== false || stripos($s['name'] ?? '', '1tb') !== false || stripos($s['name'] ?? '', '1 tb') !== false || stripos($s['name'] ?? '', '1tb') !== false; }));
            if (!empty($prefer)) {
                usort($prefer, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
                return $prefer[0];
            }
            usort($stores, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $stores[0];
        };

        $pickPsu = function() use ($psus, $getPrice) {
            if (empty($psus)) return null;
            $prefer = array_values(array_filter($psus, function($p){ $w = isset($p['wattage']) ? (int)$p['wattage'] : 0; return $w >= 500 && $w <= 700; }));
            if (!empty($prefer)) {
                usort($prefer, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
                return $prefer[0];
            }
            usort($psus, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $psus[0];
        };

        $pickCase = function() use ($cases, $getPrice) {
            if (empty($cases)) return null;
            usort($cases, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $cases[0];
        };

        $pickCooler = function() use ($coolers, $getPrice) {
            if (empty($coolers)) return null;
            usort($coolers, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $coolers[0];
        };

        $amdCpus = array_values(array_filter($cpus, function($c){ return ($c['brand_norm'] ?? '') === 'AMD' || stripos($c['name'] ?? '', 'ryzen') !== false; }));
        $intelCpus = array_values(array_filter($cpus, function($c){ return ($c['brand_norm'] ?? '') === 'Intel' || stripos($c['name'] ?? '', 'intel') !== false || stripos($c['name'] ?? '', 'core i') !== false; }));

        usort($amdCpus, function($a,$b) use ($getPrice){ return $getPrice($a) <=> $getPrice($b); });
        usort($intelCpus, function($a,$b) use ($getPrice){ return $getPrice($a) <=> $getPrice($b); });

        $makeBuild = function($label, $category, $cpuRow, $gpuTier = 'budget') use ($findMoboForSocket, $pickGpu, $pickRam, $pickStorage, $pickPsu, $pickCase, $pickCooler, $getPrice) {
            if (!$cpuRow) return null;
            $mobo = $findMoboForSocket($cpuRow['socket_norm'] ?? '');
            if (!$mobo) return null;
            $name = strtolower($cpuRow['name'] ?? '');
            $isApu = (strpos($name, '5600g') !== false) || (strpos($name, '3200g') !== false) || (strpos($name, '5700g') !== false) || (strpos($name, 'g ') !== false && strpos($name, 'ryzen') !== false);
            $gpu = !$isApu || $gpuTier !== 'budget' ? $pickGpu($gpuTier) : null;
            $ram = $pickRam($mobo);
            $storage = $pickStorage();
            $psu = $pickPsu();
            $case = $pickCase();
            $cooler = $pickCooler();
            $ids = [];
            $ids['cpu'] = (int)$cpuRow['id'];
            $ids['motherboard'] = (int)$mobo['id'];
            if ($gpu) $ids['gpu'] = (int)$gpu['id'];
            if ($ram) $ids['ram'] = (int)$ram['id'];
            if ($storage) $ids['storage'] = (int)$storage['id'];
            if ($psu) $ids['psu'] = (int)$psu['id'];
            if ($case) $ids['case'] = (int)$case['id'];
            if ($cooler) $ids['cooler'] = (int)$cooler['id'];

            $price = $getPrice($cpuRow) + $getPrice($mobo) + ($gpu ? $getPrice($gpu) : 0) + $getPrice($ram) + $getPrice($storage) + $getPrice($psu) + $getPrice($case) + $getPrice($cooler);
            return [
                'name' => $label,
                'category' => $category,
                'description' => ucfirst($category) . ' prebuilt generated from current inventory.',
                'price' => $price,
                'performance' => ['gaming' => 0, 'streaming' => 0],
                'features' => [],
                'component_ids' => $ids,
                'in_stock' => 1,
                'is_hidden' => 0,
            ];
        };

        $amdBudget = $amdCpus[0] ?? null;
        $amdMid = $amdCpus[min(1, max(0, count($amdCpus)-1))] ?? ($amdCpus[0] ?? null);
        $amdHigh = $amdCpus[min(2, max(0, count($amdCpus)-1))] ?? ($amdCpus[0] ?? null);

        $intelBudget = $intelCpus[0] ?? null;
        $intelMid = $intelCpus[min(1, max(0, count($intelCpus)-1))] ?? ($intelCpus[0] ?? null);
        $intelHigh = $intelCpus[min(2, max(0, count($intelCpus)-1))] ?? ($intelCpus[0] ?? null);

        $candidates = [];
        $cand = $makeBuild('AMD Starter', 'gaming', $amdBudget, 'budget'); if ($cand) $candidates[] = $cand;
        $cand = $makeBuild('AMD Performance', 'gaming', $amdMid, 'mid'); if ($cand) $candidates[] = $cand;
        $cand = $makeBuild('AMD Enthusiast', 'workstation', $amdHigh, 'high'); if ($cand) $candidates[] = $cand;
        $cand = $makeBuild('Intel Starter', 'gaming', $intelBudget, 'budget'); if ($cand) $candidates[] = $cand;
        $cand = $makeBuild('Intel Performance', 'gaming', $intelMid, 'mid'); if ($cand) $candidates[] = $cand;
        $cand = $makeBuild('Intel Enthusiast', 'workstation', $intelHigh, 'high'); if ($cand) $candidates[] = $cand;

        if (empty($candidates)) {
            echo json_encode(['success' => false, 'error' => 'No compatible component combinations found to seed prebuilts']);
            exit();
        }

        $stmt = $pdo->prepare('INSERT INTO prebuilts (name, category, description, image, price, performance, features, component_ids, in_stock, is_hidden) VALUES (?, ?, ?, "", ?, ?, ?, ?, ?, ?)');
        $createdIds = [];
        foreach ($candidates as $p) {
            $stmt->execute([
                $p['name'],
                $p['category'],
                $p['description'],
                $p['price'],
                json_encode($p['performance']),
                json_encode($p['features']),
                json_encode($p['component_ids']),
                $p['in_stock'],
                $p['is_hidden']
            ]);
            $createdIds[] = (int)$pdo->lastInsertId();
        }

        echo json_encode(['success' => true, 'created' => $createdIds]);
        exit();
    }
}
