<?php
// FINALIZED: Import using exact mapping from CSV category names to DB category IDs, with error handling and validation
$csvFile = __DIR__ . '/data/components_database_cleaned.csv';
$dbHost = 'localhost';
$dbName = 'builditpc_db';
$dbUser = 'root';
$dbPass = '';

$pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$categoryMap = [
    'AIO' => 8,
    'COOLER FAN' => 8,
    'STOCK FAN' => 8,
    'HEATSINK FAN' => 8,
    'PRO & MOBO - AMD' => 2,
    'PRO & MOBO - INTEL' => 2,
    'PRO & MOBO - NO COOLER' => 2,
    'MOBO' => 2,
    'GPU' => 3,
    'HDD' => 5,
    'HDD (USED)' => 5,
    'HDD PORTABLE' => 5,
    'SSD 2.5-INCH' => 5,
    'SSD M.2' => 5,
    'SSD NVME' => 5,
    'SSD PORTABLE' => 5,
    'RAM 2666MHZ' => 4,
    'RAM 3200MHZ' => 4,
    'RAM 3600MHZ' => 4,
    'RAM 5200MHZ' => 4,
    'RAM 5600MHZ' => 4,
    'RAM 6000MHZ' => 4,
    'RAM 6400MHZ' => 4,
    'RAM DDR3' => 4,
    'RAM SODIMM' => 4,
    'PSU' => 6,
    'PSU - TR' => 6,
    'PSU GENERIC' => 6,
    'CASE GAMING' => 7,
    'CASE GENERIC' => 7,
    'CPU' => 1,
    'PROCIE ONLY' => 1,      // Uppercased key to match strtoupper($row[1])
    'PROCESSOR' => 1,        // Additional alias seen in some sources
    'MOTHERBOARD' => 2,
    'STORAGE' => 5,
    'RAM' => 4,
    'CASE' => 7,
    'COOLER' => 8,
];

$rowNum = 0;
$imported = 0;
$skipped = 0;
$fixedNames = 0;
$fixedPrices = 0;
$duplicateSkipped = 0;
$unmapped = [];
if (($handle = fopen($csvFile, 'r')) !== false) {
    $header = fgetcsv($handle);
    while (($row = fgetcsv($handle)) !== false) {
        $rowNum++;
        $cat = strtoupper(trim($row[1]));
        if (!isset($categoryMap[$cat])) {
            $unmapped[$cat] = true;
            $skipped++;
            continue;
        }
        $category_id = $categoryMap[$cat];
        $brand = trim($row[2]);
        $name = trim($row[3]);
        $priceStr = trim($row[7]);
        $stockStr = trim($row[8]);
        $price = floatval(str_replace(['₱',','], '', $priceStr));
        $stock_quantity = intval(preg_replace('/[^0-9-]/', '', $stockStr));

        // Auto-fix missing name and zero/invalid price
        if ($name === '') {
            if ($brand !== '') {
                $name = $brand . ' ' . ucfirst(strtolower($cat)) . ' (Unnamed)';
            } else {
                $name = 'Unnamed ' . ucfirst(strtolower($cat));
            }
            $fixedNames++;
        }
        if ($price <= 0) {
            // Fallback minimal price to avoid skipping valid items with zero price in source
            $price = 100.00;
            $fixedPrices++;
        }

        // Normalize stock
        if ($stock_quantity < 0) $stock_quantity = 0;

        // Duplicate guard: skip if same name + category already exists
        $dupStmt = $pdo->prepare("SELECT id FROM components WHERE name = ? AND category_id = ? LIMIT 1");
        $dupStmt->execute([$name, $category_id]);
        if ($dupStmt->fetch(PDO::FETCH_ASSOC)) {
            echo "Skipping row $rowNum: duplicate component '{$name}' in category {$category_id}.\n";
            $duplicateSkipped++;
            $skipped++;
            continue;
        }
        try {
            $stmt = $pdo->prepare("INSERT INTO components (name, category_id, brand, price, stock_quantity) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$name, $category_id, $brand, $price, $stock_quantity]);
            $imported++;
        } catch (PDOException $e) {
            echo "Error on row $rowNum: ".$e->getMessage()."\n";
            echo "Data: ".json_encode([$name, $category_id, $brand, $price, $stock_quantity])."\n";
            $skipped++;
        }
    }
    fclose($handle);
}
echo "Imported $imported PC components. Skipped $skipped items (including $duplicateSkipped duplicates). Fixed names: $fixedNames. Fixed prices: $fixedPrices.\n";
if (!empty($unmapped)) {
    echo "Unmapped categories (please review or add to mapping):\n";
    foreach (array_keys($unmapped) as $cat) echo "- $cat\n";
}
?>
