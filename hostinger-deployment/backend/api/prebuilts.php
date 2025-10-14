<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
header('Content-Type: application/json');

// Error visibility controlled by APP_DEBUG
$__app_debug = env('APP_DEBUG', '0');
if ($__app_debug === '1' || strtolower($__app_debug) === 'true') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_STRICT);
    ini_set('display_errors', '0');
}
set_exception_handler(function($ex){
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'message' => $ex->getMessage()]);
    exit;
});
set_error_handler(function($errno, $errstr, $errfile, $errline){
    // Convert warnings/notices into exceptions so we can return JSON
    throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
});
register_shutdown_function(function(){
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header('Content-Type: application/json');
            http_response_code(500);
        }
        echo json_encode(['error' => 'Fatal server error', 'message' => $e['message']]);
    }
});

// Fallback for environments where getallheaders() is unavailable (e.g., PHP-FPM)
if (!function_exists('build_request_headers')) {
    function build_request_headers() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) === 'HTTP_') {
                $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$key] = $value;
            }
        }
        // Common locations for Authorization
        if (!isset($headers['Authorization']) && isset($_SERVER['Authorization'])) {
            $headers['Authorization'] = $_SERVER['Authorization'];
        }
        if (!isset($headers['Authorization']) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers['Authorization'] = $_SERVER['HTTP_AUTHORIZATION'];
        }
        return $headers;
    }
}

$pdo = get_db_connection();
$method = $_SERVER['REQUEST_METHOD'];
// Admin-only seed toggle (ENV-controlled)
$seedEnabled = env('PREBUILTS_SEED_ENABLED', '0');
$seedToken   = env('PREBUILTS_SEED_TOKEN', '');

// Lightweight diagnostics (safe while APP_DEBUG is enabled)
if (($__app_debug === '1' || strtolower($__app_debug) === 'true') && isset($_GET['test'])) {
    $t = $_GET['test'];
    if ($t === 'ping') {
        echo json_encode(['ok' => true]);
        exit;
    }
    if ($t === 'tables') {
        try {
            $rows = $pdo->query("SHOW TABLES LIKE 'prebuilts'")->fetchAll(PDO::FETCH_NUM);
            echo json_encode(['ok' => true, 'match_count' => count($rows), 'rows' => $rows]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['error' => 'tables_check_failed', 'message' => $e->getMessage()]);
        }
        exit;
    }
    if ($t === 'count') {
        try {
            $stmt = $pdo->query('SELECT COUNT(*) AS c FROM prebuilts');
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['ok' => true, 'count' => (int)($row['c'] ?? 0)]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['error' => 'count_failed', 'message' => $e->getMessage()]);
        }
        exit;
    }
}

function get_authenticated_user($pdo) {
    $headers = function_exists('getallheaders') ? getallheaders() : (function_exists('build_request_headers') ? build_request_headers() : []);
    // Normalize lowercase key variant if present
    if (!isset($headers['Authorization']) && isset($headers['authorization'])) {
        $headers['Authorization'] = $headers['authorization'];
    }
    if (!isset($headers['Authorization'])) return null;
    $token = str_replace('Bearer ', '', $headers['Authorization']);
    $payload = verifyJWT($token);
    if (!$payload || !isset($payload['user_id'])) return null;
    $stmt = $pdo->prepare('SELECT u.*, GROUP_CONCAT(r.name) as roles FROM users u JOIN user_roles ur ON u.id = ur.user_id JOIN roles r ON ur.role_id = r.id WHERE u.id = ? GROUP BY u.id');
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($user && $user['roles']) $user['roles'] = explode(',', $user['roles']);
    return $user;
}

function is_admin_or_superadmin($user) {
    $roles = $user['roles'] ?? [];
    if (is_string($roles)) {
        $roles = explode(',', $roles);
    }
    return $user && (in_array('Super Admin', $roles) || in_array('Admin', $roles));
}

function seed_prebuilts($pdo, $user) {
    // Admin/Super Admin only
    if (!is_admin_or_superadmin($user)) {
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

    // Utility: safely parse numeric price
    $getPrice = function($row) {
        if (!isset($row['price'])) return 0;
        $n = floatval($row['price']);
        return $n > 0 ? $n : 0;
    };

    // Normalize socket/brand
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

    // Pickers with simple heuristics
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

    $pickRam = function() use ($rams, $getPrice) {
        if (empty($rams)) return null;
        // Prefer 16GB if mentioned, else cheapest
        $prefer = array_values(array_filter($rams, function($r){ return stripos($r['name'] ?? '', '16') !== false; }));
        if (!empty($prefer)) {
            usort($prefer, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
            return $prefer[0];
        }
        usort($rams, function($a,$b) use ($getPrice) { return $getPrice($a) <=> $getPrice($b); });
        return $rams[0];
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
        // Prefer 550-650W if wattage available
        $prefer = array_values(array_filter($psus, function($p){
            $w = isset($p['wattage']) ? (int)$p['wattage'] : 0;
            return $w >= 500 && $w <= 700;
        }));
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

    // Define target CPU buckets
    $amdCpus = array_values(array_filter($cpus, function($c){ return ($c['brand_norm'] ?? '') === 'AMD' || stripos($c['name'] ?? '', 'ryzen') !== false; }));
    $intelCpus = array_values(array_filter($cpus, function($c){ return ($c['brand_norm'] ?? '') === 'Intel' || stripos($c['name'] ?? '', 'intel') !== false || stripos($c['name'] ?? '', 'core i') !== false; }));

    usort($amdCpus, function($a,$b) use ($getPrice){ return $getPrice($a) <=> $getPrice($b); });
    usort($intelCpus, function($a,$b) use ($getPrice){ return $getPrice($a) <=> $getPrice($b); });

    $buildSpecs = [];
    $makeBuild = function($label, $category, $cpuRow, $gpuTier = 'budget') use ($findMoboForSocket, $pickGpu, $pickRam, $pickStorage, $pickPsu, $pickCase, $pickCooler, $getPrice) {
        if (!$cpuRow) return null;
        $mobo = $findMoboForSocket($cpuRow['socket_norm'] ?? '');
        if (!$mobo) return null; // require CPU+Motherboard
        // If CPU looks like APU (e.g., G-series), GPU optional for budget
        $name = strtolower($cpuRow['name'] ?? '');
        $isApu = (strpos($name, '5600g') !== false) || (strpos($name, '3200g') !== false) || (strpos($name, '5700g') !== false) || (strpos($name, 'g ') !== false && strpos($name, 'ryzen') !== false);
        $gpu = !$isApu || $gpuTier !== 'budget' ? $pickGpu($gpuTier) : null;
        $ram = $pickRam();
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

    // Construct tiers
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

    // Insert prebuilts
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

function require_admin_or_superadmin($user) {
    $roles = $user['roles'] ?? [];
    if (is_string($roles)) {
        $roles = explode(',', $roles);
    }
    if (!$user || !(in_array('Super Admin', $roles) || in_array('Admin', $roles))) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin or Super Admin access required']);
        exit();
    }
}

switch ($method) {
    case 'GET':
        try {
            $user = get_authenticated_user($pdo);
            $show_all = isset($_GET['all']) && $user && (in_array('Super Admin', $user['roles'] ?? []) || in_array('Admin', $user['roles'] ?? []));
            $sql = 'SELECT * FROM prebuilts';
            if (!$show_all) {
                $sql .= ' WHERE is_hidden = 0';
            }
            $stmt = $pdo->query($sql);
            $prebuilts = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Best-effort decode/sanitize JSON-like columns and ensure UTF-8 output
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

            $out = json_encode($prebuilts, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            if ($out === false) {
                http_response_code(500);
                $msg = 'JSON encoding failed';
                if ($__app_debug === '1' || strtolower($__app_debug) === 'true') {
                    $msg .= ': ' . json_last_error_msg();
                }
                echo json_encode(['error' => 'Failed to fetch prebuilts', 'message' => $msg]);
            } else {
                echo $out;
            }
        } catch (Throwable $t) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch prebuilts', 'message' => $t->getMessage()]);
        }
        break;
    case 'POST':
        $user = get_authenticated_user($pdo);
        // Seeding endpoint: POST ?seed=1
        if (isset($_GET['seed'])) {
            // If ENV toggle and token match, allow seeding without JWT (admin-only toggle)
            $enabled = ($seedEnabled === '1' || strtolower($seedEnabled) === 'true');
            $providedToken = $_GET['token'] ?? ($_SERVER['HTTP_X_SEED_TOKEN'] ?? null);
            if ($enabled && $seedToken && $providedToken && hash_equals($seedToken, $providedToken)) {
                // Bypass JWT but still treat as Super Admin for this action
                seed_prebuilts($pdo, ['roles' => ['Super Admin']]);
                break;
            }
            // Fallback to normal auth requirement
            seed_prebuilts($pdo, $user);
            break; // seed_prebuilts exits after echo
        }
        require_admin_or_superadmin($user);
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare('INSERT INTO prebuilts (name, category, description, image, price, performance, features, component_ids, in_stock, is_hidden) VALUES (?, ?, ?, "", ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $data['name'],
            $data['category'],
            $data['description'] ?? '',
            is_numeric($data['price']) ? $data['price'] : 0,
            json_encode($data['performance'] ?? []),
            json_encode($data['features'] ?? []),
            json_encode($data['component_ids'] ?? []),
            !empty($data['in_stock']) ? 1 : 0,
            !empty($data['is_hidden']) ? 1 : 0
        ]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
        break;
    case 'PUT':
        $user = get_authenticated_user($pdo);
        require_admin_or_superadmin($user);
        parse_str($_SERVER['QUERY_STRING'], $params);
        $id = $params['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing prebuilt id']);
            exit();
        }
        $data = json_decode(file_get_contents('php://input'), true);
        $fields = [];
        $values = [];
        foreach (['name','category','description','image','price','performance','features','component_ids','in_stock','is_hidden'] as $field) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $values[] = in_array($field, ['performance','features','component_ids']) ? json_encode($data[$field]) : $data[$field];
            }
        }
        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No fields to update']);
            exit();
        }
        $values[] = $id;
        $sql = 'UPDATE prebuilts SET ' . implode(', ', $fields) . ' WHERE id = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);
        echo json_encode(['success' => true]);
        break;
    case 'PATCH':
        $user = get_authenticated_user($pdo);
        require_admin_or_superadmin($user);
        parse_str($_SERVER['QUERY_STRING'], $params);
        $id = $params['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing prebuilt id']);
            exit();
        }
        $data = json_decode(file_get_contents('php://input'), true);
        if (!isset($data['is_hidden'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing is_hidden field']);
            exit();
        }
        $stmt = $pdo->prepare('UPDATE prebuilts SET is_hidden = ? WHERE id = ?');
        $stmt->execute([(int)$data['is_hidden'], $id]);
        echo json_encode(['success' => true]);
        break;
    case 'DELETE':
        $user = get_authenticated_user($pdo);
        require_admin_or_superadmin($user);
        parse_str($_SERVER['QUERY_STRING'], $params);
        $id = $params['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing prebuilt id']);
            exit();
        }
        $stmt = $pdo->prepare('DELETE FROM prebuilts WHERE id = ?');
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}