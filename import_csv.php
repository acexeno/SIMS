<?php
// A script to import the components from the CSV file into the database.

require_once __DIR__ . '/backend/config/database.php';

$pdo = get_db_connection();

// --- Helper Functions ---

// Function to get or create a category and return its ID
function getCategoryId(PDO $pdo, string $categoryName): int {
    static $categoryCache = []; // Use static to persist the cache

    // Normalize the category name for consistency
    $normalizedCategoryName = trim(ucwords(strtolower($categoryName)));
    if (empty($normalizedCategoryName)) {
        // Fallback for empty category name
        $normalizedCategoryName = 'Uncategorized';
    }

    // Check cache first
    if (isset($categoryCache[$normalizedCategoryName])) {
        return $categoryCache[$normalizedCategoryName];
    }

    // If not in cache, check the database
    $stmt = $pdo->prepare("SELECT id FROM component_categories WHERE name = ?");
    $stmt->execute([$normalizedCategoryName]);
    $category = $stmt->fetch();

    if ($category) {
        $categoryId = $category['id'];
    } else {
        // If category doesn't exist, create it
        $stmt = $pdo->prepare("INSERT INTO component_categories (name) VALUES (?)");
        $stmt->execute([$normalizedCategoryName]);
        $categoryId = $pdo->lastInsertId();
        echo "Created new category: '$normalizedCategoryName' (ID: $categoryId)\n";
    }

    // Store in cache for future use
    $categoryCache[$normalizedCategoryName] = $categoryId;
    return $categoryId;
}

// --- Main Import Logic ---

$csvFile = __DIR__ . '/data/filtered_components_for_import.csv';

if (!file_exists($csvFile)) {
    die("Error: CSV file not found at '$csvFile'\n");
}

// Open the CSV file for reading
$handle = fopen($csvFile, 'r');
if ($handle === false) {
    die("Error: Could not open CSV file for reading.\n");
}

// Get the header row to use as keys
$header = fgetcsv($handle);
if ($header === false) {
    die("Error: Could not read header from CSV file.\n");
}
echo "DEBUG: Header columns: ".implode(' | ', $header)."\n";

// Read and print the first data row for debug
$firstRow = fgetcsv($handle);
if ($firstRow !== false) {
    echo "DEBUG: First data row: ".implode(' | ', $firstRow)."\n";
} else {
    echo "DEBUG: No data rows found after header.\n";
}

// Reset file pointer to after header for main loop
rewind($handle);
fgetcsv($handle); // skip header

// Map CSV columns to database columns
$columnMap = [
    'name' => 'name',
    'category_id' => 'category_id', // Use category_id directly from CSV
    'brand' => 'brand',
    'price' => 'price',
    'url' => 'image_url',
    // --- Spec columns ---
    'socket' => 'socket',
    'chipset' => 'chipset',
    'cores' => 'cores',
    'threads' => 'threads',
    'tdp' => 'tdp',
    'ram_type' => 'ram_type',
    'form_factor' => 'form_factor',
    'memory' => 'memory',
    'speed' => 'speed',
    'capacity' => 'capacity',
    'wattage' => 'wattage',
    'efficiency' => 'efficiency',
    'fans' => 'fans',
    'type' => 'type',
    'warranty' => 'warranty',
];

// Now include 'id' in the insert
$pdo->beginTransaction();
$rowCount = 0;
$skippedCount = 0;
$dataRowCount = 0;

try {
    $sql = "INSERT INTO components (name, category_id, brand, price, stock_quantity, is_active) 
            VALUES (:name, :category_id, :brand, :price, :stock_quantity, 1)";
    $stmt = $pdo->prepare($sql);

    while (($row = fgetcsv($handle)) !== false) {
        // Skip blank or short rows
        if (count($row) < count($header) || implode('', $row) === '') {
            continue;
        }
        $dataRowCount++;
        $rowCount++;
        $rowData = array_combine($header, $row);

        // --- Data Cleaning and Preparation ---
        // Skip if name is missing
        if (empty($rowData['name'])) {
            echo "Skipping row $rowCount: Name is missing.\n";
            $skippedCount++;
            continue;
        }
        // Skip if category_id or name contains 'warranty' (case-insensitive)
        if ((isset($rowData['category_id']) && stripos($rowData['category_id'], 'warranty') !== false) ||
            (isset($rowData['name']) && stripos($rowData['name'], 'warranty') !== false)) {
            echo "Skipping row $rowCount: Warranty row detected.\n";
            $skippedCount++;
            continue;
        }
        // Debug: Show row being inserted
        echo "Inserting row $rowCount: {$rowData['name']} ({$rowData['category_id']})\n";

        // Use category_id directly from CSV
        $categoryId = isset($rowData['category_id']) ? (int)$rowData['category_id'] : null;
        if (!$categoryId) {
            echo "Skipping row $rowCount: category_id missing or invalid.\n";
            $skippedCount++;
            continue;
        }

        // Prepare parameters for binding (no :id)
        $params = [
            ':name' => $rowData['name'],
            ':category_id' => $categoryId,
            ':brand' => $rowData['brand'] ?? 'N/A',
            ':price' => !empty($rowData['price']) ? (float)preg_replace('/[^0-9.]/', '', $rowData['price']) : 0.00,
            ':stock_quantity' => rand(5, 50), // Assign a random stock quantity
        ];

        // Execute the prepared statement
        $stmt->execute($params);
    }
    $pdo->commit();
    echo "\n----------------------------------------\n";
    echo "CSV import completed successfully!\n";
    echo "Total data rows processed: $dataRowCount\n";
    echo "Components inserted: " . ($rowCount - $skippedCount) . "\n";
    echo "Components skipped (already exist or missing name): $skippedCount\n";
    echo "----------------------------------------\n";

} catch (Exception $e) {
    $pdo->rollBack();
    die("\nError during database import: " . $e->getMessage() . "\n");
} finally {
    // Close the file handle
    fclose($handle);
}
?> 