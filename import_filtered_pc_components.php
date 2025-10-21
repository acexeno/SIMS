<?php
// Robust PC Components Importer: Only imports PC components from filtered_components_for_import.csv
// Usage: Run this script after updating filtered_components_for_import.csv with valid PC components only.
// This will clear and repopulate the 'components' table.

require_once __DIR__ . '/backend/config/database.php';
$pdo = get_db_connection();

$csvFile = __DIR__ . '/data/filtered_components_for_import.csv';
if (!file_exists($csvFile)) {
    die("CSV file not found: $csvFile\n");
}

$table = 'components';
// Create a safety backup before clearing
$backupTable = $table . '_backup_' . date('Ymd_His');
try {
    $pdo->exec("CREATE TABLE `$backupTable` AS SELECT * FROM `$table`");
    echo "Created backup table: $backupTable\n";
} catch (PDOException $e) {
    echo "Warning: Could not create backup table ($backupTable): " . $e->getMessage() . "\n";
}

$pdo->exec("DELETE FROM `$table`");

$handle = fopen($csvFile, 'r');
$header = fgetcsv($handle);
if (!$header) {
    die("Could not read header row from CSV.\n");
}

// Normalize header names (trim whitespace)
$header = array_map(function($h) {
    return is_string($h) ? trim($h) : $h;
}, $header);
$headerCount = count($header);

// components table columns (excluding id, created_at, updated_at)
$columns = [
    'name', 'category_id', 'brand', 'model', 'price', 'stock_quantity', 'min_stock_level', 'image_url',
    'specs', 'socket', 'cores', 'threads', 'tdp', 'ram_type', 'form_factor', 'memory', 'speed',
    'capacity', 'wattage', 'efficiency', 'fans', 'type', 'is_active'
];
$sql = "INSERT INTO $table (" . implode(", ", $columns) . ") VALUES (" . rtrim(str_repeat('?,', count($columns)), ',') . ")";
$stmt = $pdo->prepare($sql);

// Helper: normalize form factor to canonical values
function normalize_form_factor($ff) {
    if (!is_string($ff) || $ff === '') return $ff;
    $v = strtolower(trim($ff));
    $v = str_replace(['_', ' '], '-', $v);
    if (in_array($v, ['micro-atx','matx','m-atx','u-atx','uatx','microatx'])) return 'Micro-ATX';
    if (in_array($v, ['mini-itx','mitx','miniitx'])) return 'Mini-ITX';
    if (in_array($v, ['e-atx','eatx'])) return 'E-ATX';
    if (strpos($v, 'micro') !== false && strpos($v, 'atx') !== false) return 'Micro-ATX';
    if (strpos($v, 'mini') !== false && strpos($v, 'itx') !== false) return 'Mini-ITX';
    if (strpos($v, 'atx') !== false) return 'ATX';
    return $ff; // fallback to original
}

// Helper: extract wattage like "400W", "400 Watts" from text
function extract_wattage_from_text($text) {
    if (!is_string($text) || $text === '') return null;
    if (preg_match('/(\d{2,4})\s*(w|watts?)\b/i', $text, $m)) {
        return (int)$m[1];
    }
    return null;
}

// Helper: normalize sockets like "AMD AM4" -> "AM4"
function normalize_socket_import($socket, $name = '') {
    $src = $socket;
    if (!is_string($src) || $src === '') $src = $name;
    if (!is_string($src) || $src === '') return $socket;
    $s = strtoupper($src);
    if (strpos($s, 'AM4') !== false) return 'AM4';
    if (strpos($s, 'AM5') !== false) return 'AM5';
    if (strpos($s, 'LGA1200') !== false) return 'LGA1200';
    if (strpos($s, 'LGA1700') !== false) return 'LGA1700';
    if (strpos($s, 'LGA1151') !== false) return 'LGA1151';
    if (strpos($s, 'LGA2066') !== false) return 'LGA2066';
    return $socket;
}

$count = 0;
$skipped = 0;
// Track per-category insert counts and skip reasons
$categoryInserted = [1=>0,2=>0,3=>0,4=>0,5=>0,6=>0,7=>0,8=>0];
$skipReasons = ['bad_row'=>0,'inactive'=>0,'bad_category'=>0];
while (($row = fgetcsv($handle)) !== false) {
    // Skip empty lines
    if ($row === null || (count($row) === 1 && trim((string)$row[0]) === '')) {
        continue;
    }

    // Ensure row has the same number of columns as header
    if (count($row) < $headerCount) {
        $row = array_pad($row, $headerCount, null);
    } elseif (count($row) > $headerCount) {
        $row = array_slice($row, 0, $headerCount);
    }

    $assoc = @array_combine($header, $row);
    if (!$assoc) {
        $skipped++;
        $skipReasons['bad_row']++;
        continue;
    }

    // Normalize/Default fields
    $assoc['is_active'] = isset($assoc['is_active']) ? trim((string)$assoc['is_active']) : '';
    // Heuristic: some rows may have '1YR' shifted into is_active due to missing 'type' column
    if ($assoc['is_active'] !== '' && stripos($assoc['is_active'], 'yr') !== false) {
        $assoc['is_active'] = '1';
    }
    // If warranty column looks like '1YR' and is_active is empty, infer active
    if (($assoc['is_active'] === '' || $assoc['is_active'] === null) && isset($assoc['warranty'])) {
        $w = trim((string)$assoc['warranty']);
        if ($w !== '' && (stripos($w, 'yr') !== false || $w === '1')) {
            $assoc['is_active'] = '1';
        }
    }
    if (!in_array($assoc['is_active'], ['1','true','TRUE','yes','YES'], true)) {
        $skipped++;
        $skipReasons['inactive']++;
        continue;
    }
    $assoc['is_active'] = 1;

    // Default specs to '{}' if empty
    if (!isset($assoc['specs']) || $assoc['specs'] === '' || $assoc['specs'] === null) {
        $assoc['specs'] = '{}';
    }

    // Coerce numeric fields where applicable
    foreach (['price','stock_quantity','min_stock_level','cores','threads','tdp','wattage','fans'] as $numField) {
        if (isset($assoc[$numField]) && $assoc[$numField] !== '') {
            $assoc[$numField] = is_numeric($assoc[$numField]) ? $assoc[$numField] : 0;
        }
    }

    // Data enrichment and normalization
    // 1) Normalize form factor (e.g., mATX -> Micro-ATX)
    if (isset($assoc['form_factor'])) {
        $assoc['form_factor'] = normalize_form_factor($assoc['form_factor']);
    }

    // 2) Normalize socket using explicit value or fallback to name text
    if (isset($assoc['socket']) || isset($assoc['name'])) {
        $assoc['socket'] = normalize_socket_import($assoc['socket'] ?? '', $assoc['name'] ?? '');
    }

    // 3) If PSU wattage is missing/zero, try to extract from name/model/type
    $wattage = (int)($assoc['wattage'] ?? 0);
    if ($wattage <= 0) {
        $candidates = [];
        foreach (['name','model','type'] as $f) {
            if (!empty($assoc[$f])) $candidates[] = $assoc[$f];
        }
        foreach ($candidates as $txt) {
            $val = extract_wattage_from_text($txt);
            if (!is_null($val)) { $wattage = $val; break; }
        }
        if ($wattage > 0) $assoc['wattage'] = $wattage;
    }

    $categoryId = intval($assoc['category_id'] ?? 0);
    if ($categoryId < 1 || $categoryId > 8) { // Only PC component categories
        $skipped++;
        $skipReasons['bad_category']++;
        continue;
    }
    $values = [];
    foreach ($columns as $col) {
        $values[] = $assoc[$col] ?? null;
    }
    $stmt->execute($values);
    $count++;
    if (isset($categoryInserted[$categoryId])) $categoryInserted[$categoryId]++;
}
fclose($handle);
echo "Imported $count PC components. Skipped $skipped rows.\n";
echo "Inserted per category: ";
foreach ($categoryInserted as $cid=>$c) { echo "$cid=$c "; }
echo "\n";
echo "Skip reasons: bad_row={$skipReasons['bad_row']} inactive={$skipReasons['inactive']} bad_category={$skipReasons['bad_category']}\n";
