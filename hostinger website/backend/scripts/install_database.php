<?php
// Apply all schema files in backend/database to the configured DB
// Usage (CLI): php backend/scripts/install_database.php

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/database.php';

$pdo = null;
try {
    $pdo = get_db_connection();
} catch (Throwable $t) {
    fwrite(STDERR, "Failed to connect to DB: " . $t->getMessage() . PHP_EOL);
    exit(1);
}

$schemaDir = realpath(__DIR__ . '/../database');
$files = [
    'schema.sql',
    'notifications_schema.sql',
    'chat_schema.sql',
    'last_seen_chat_schema.sql',
    'supplier_schema.sql',
    'community_submissions_schema.sql',
];

function executeSqlFile(PDO $pdo, string $path) {
    $sql = file_get_contents($path);
    if ($sql === false) {
        throw new RuntimeException("Unable to read SQL file: $path");
    }
    // Split on semicolons at end of statements, keep it simple
    $statements = preg_split('/;\s*(\r?\n)/', $sql);
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement === '' || str_starts_with($statement, '--') || str_starts_with($statement, '/*')) {
            continue;
        }
        $pdo->exec($statement);
    }
}

try {
    $pdo->beginTransaction();
    foreach ($files as $file) {
        $path = $schemaDir . DIRECTORY_SEPARATOR . $file;
        if (!is_readable($path)) {
            // Skip missing optional files
            echo "Skipping missing: $file\n";
            continue;
        }
        echo "Applying: $file\n";
        executeSqlFile($pdo, $path);
    }
    $pdo->commit();
    echo "All schemas applied successfully.\n";
} catch (Throwable $t) {
    if ($pdo && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Schema install failed: " . $t->getMessage() . "\n");
    exit(1);
}
