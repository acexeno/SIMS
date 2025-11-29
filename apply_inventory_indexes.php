<?php
/**
 * Apply Inventory Indexes to Database
 * 
 * This script adds database indexes to optimize dropdown filtering,
 * sorting, and search operations in the inventory system.
 * 
 * Based on panelist feedback about adding indexes for:
 * - "All Components" dropdown (category_id)
 * - "All Brands" dropdown (brand)
 * - "Sort by Name" dropdown (name)
 * - Search functionality (name + brand)
 */

// Ensure we're in CLI mode
if (php_sapi_name() !== 'cli') {
    die("This script must be run from the command line.\n");
}

// Load environment
require_once __DIR__ . '/backend/config/env.php';

// Direct database connection for CLI (bypasses HTTP error handling)
function get_db_connection_cli() {
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
        return $pdo;
    } catch (PDOException $e) {
        throw new Exception("Database connection failed: " . $e->getMessage());
    }
}

// Database connection
try {
    $pdo = get_db_connection_cli();
    echo "✓ Connected to database successfully\n\n";
} catch (Exception $e) {
    die("✗ Database connection failed: " . $e->getMessage() . "\n");
}

// List of indexes to create
$indexes = [
    // Single-column indexes
    'idx_components_category_id' => [
        'table' => 'components',
        'columns' => ['category_id'],
        'type' => 'regular',
        'description' => 'All Components dropdown filtering'
    ],
    'idx_components_brand' => [
        'table' => 'components',
        'columns' => ['brand'],
        'type' => 'regular',
        'description' => 'All Brands dropdown filtering'
    ],
    'idx_components_name' => [
        'table' => 'components',
        'columns' => ['name'],
        'type' => 'regular',
        'description' => 'Sort by Name dropdown sorting'
    ],
    'idx_components_price' => [
        'table' => 'components',
        'columns' => ['price'],
        'type' => 'regular',
        'description' => 'Price sorting optimization'
    ],
    'idx_components_stock' => [
        'table' => 'components',
        'columns' => ['stock_quantity'],
        'type' => 'regular',
        'description' => 'Stock quantity filtering'
    ],
    'idx_components_is_active' => [
        'table' => 'components',
        'columns' => ['is_active'],
        'type' => 'regular',
        'description' => 'Active/inactive filtering'
    ],
    
    // Composite indexes
    'idx_components_category_name' => [
        'table' => 'components',
        'columns' => ['category_id', 'name'],
        'type' => 'regular',
        'description' => 'Category filtering + name sorting'
    ],
    'idx_components_brand_name' => [
        'table' => 'components',
        'columns' => ['brand', 'name'],
        'type' => 'regular',
        'description' => 'Brand filtering + name sorting'
    ],
    'idx_components_active_stock' => [
        'table' => 'components',
        'columns' => ['is_active', 'stock_quantity'],
        'type' => 'regular',
        'description' => 'Active + stock filtering'
    ],
    'idx_components_category_active_stock' => [
        'table' => 'components',
        'columns' => ['category_id', 'is_active', 'stock_quantity'],
        'type' => 'regular',
        'description' => 'Complex multi-column filtering'
    ],
    
    // Category table indexes
    'idx_categories_name' => [
        'table' => 'component_categories',
        'columns' => ['name'],
        'type' => 'regular',
        'description' => 'Category name lookups'
    ],
];

/**
 * Check if an index already exists
 */
function indexExists($pdo, $table, $indexName) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = ? 
        AND index_name = ?
    ");
    $stmt->execute([$table, $indexName]);
    return $stmt->fetchColumn() > 0;
}

/**
 * Create a regular index
 */
function createIndex($pdo, $table, $indexName, $columns) {
    $sql = "CREATE INDEX `{$indexName}` ON `{$table}` (" . 
           implode(', ', array_map(function($col) { return "`{$col}`"; }, $columns)) . ")";
    
    try {
        $pdo->exec($sql);
        return ['success' => true, 'message' => ''];
    } catch (PDOException $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * Create a fulltext index
 */
function createFulltextIndex($pdo, $table, $indexName, $columns) {
    $sql = "ALTER TABLE `{$table}` ADD FULLTEXT INDEX `{$indexName}` (" . 
           implode(', ', array_map(function($col) { return "`{$col}`"; }, $columns)) . ")";
    
    try {
        $pdo->exec($sql);
        return ['success' => true, 'message' => ''];
    } catch (PDOException $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * Main execution
 */
echo "Applying inventory performance indexes...\n";
echo str_repeat('=', 70) . "\n\n";

$successCount = 0;
$skipCount = 0;
$errorCount = 0;

foreach ($indexes as $indexName => $config) {
    $table = $config['table'];
    $columns = $config['columns'];
    $description = $config['description'];
    
    echo "Checking: {$indexName} ({$description})...\n";
    
    // Check if index exists
    if (indexExists($pdo, $table, $indexName)) {
        echo "  → Already exists, skipping\n\n";
        $skipCount++;
        continue;
    }
    
    // Create the index
    if ($config['type'] === 'fulltext') {
        $result = createFulltextIndex($pdo, $table, $indexName, $columns);
    } else {
        $result = createIndex($pdo, $table, $indexName, $columns);
    }
    
    if ($result['success']) {
        echo "  ✓ Created successfully\n\n";
        $successCount++;
    } else {
        echo "  ✗ Error: {$result['message']}\n\n";
        $errorCount++;
    }
}

// Try to create fulltext index separately (it may fail due to InnoDB configuration)
echo str_repeat('=', 70) . "\n";
echo "Attempting to create fulltext search index...\n\n";

$fulltextIndexName = 'idx_components_search';
if (!indexExists($pdo, 'components', $fulltextIndexName)) {
    echo "Creating: {$fulltextIndexName} (Full-text search optimization)...\n";
    $result = createFulltextIndex($pdo, 'components', $fulltextIndexName, ['name', 'brand']);
    
    if ($result['success']) {
        echo "  ✓ Fulltext index created successfully\n\n";
        $successCount++;
    } else {
        echo "  ⚠ Fulltext index creation failed (this is usually OK)\n";
        echo "    Reason: {$result['message']}\n";
        echo "    Note: Your InnoDB may need configuration for fulltext search.\n";
        echo "    Regular text searching will still work, just without the fulltext optimization.\n\n";
    }
} else {
    echo "  → Fulltext index already exists, skipping\n\n";
    $skipCount++;
}

// Summary
echo str_repeat('=', 70) . "\n";
echo "SUMMARY:\n";
echo str_repeat('-', 70) . "\n";
echo "✓ Successfully created: {$successCount} indexes\n";
echo "⊘ Already existed:      {$skipCount} indexes\n";
echo "✗ Errors:              {$errorCount} indexes\n";
echo str_repeat('=', 70) . "\n\n";

if ($errorCount === 0 && $successCount > 0) {
    echo "🎉 All indexes applied successfully!\n\n";
    echo "Your inventory dropdowns should now be significantly faster.\n";
    echo "Test the improvement by:\n";
    echo "  1. Filtering by 'All Components'\n";
    echo "  2. Filtering by 'All Brands'\n";
    echo "  3. Sorting by 'Name'\n";
    echo "  4. Using the search functionality\n\n";
    
    echo "To verify indexes were created:\n";
    echo "  SHOW INDEX FROM components;\n\n";
} elseif ($errorCount > 0) {
    echo "⚠ Some indexes could not be created. Check the error messages above.\n\n";
} else {
    echo "✓ All indexes were already in place. Nothing to do!\n\n";
}

echo "For more information, see: INVENTORY_INDEXES_EXPLAINED.md\n";

