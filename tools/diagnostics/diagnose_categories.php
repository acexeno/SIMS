<?php
// Diagnostic tool: List all unique category names from CSV and from DB
echo "--- Unique category names in CSV ---\n";
$csvFile = __DIR__ . '/components_database_cleaned.csv';
$csvCats = [];
if (($handle = fopen($csvFile, 'r')) !== false) {
    $header = fgetcsv($handle);
    while (($row = fgetcsv($handle)) !== false) {
        if (isset($row[1])) {
            $cat = strtolower(trim($row[1]));
            $csvCats[$cat] = true;
        }
    }
    fclose($handle);
}
foreach (array_keys($csvCats) as $cat) echo $cat."\n";

// DB categories
$dbHost = 'localhost';
$dbName = 'builditpc_db';
$dbUser = 'root';
$dbPass = '';
$pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
echo "\n--- Category names in component_categories table ---\n";
$dbCats = [];
foreach ($pdo->query("SELECT id, name FROM component_categories") as $row) {
    $cat = strtolower(trim($row['name']));
    $dbCats[$cat] = $row['id'];
    echo $cat."\n";
}
?>
