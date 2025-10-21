<?php
// CONFIGURE THESE:
$dbname = 'builditpc_db'; // <-- Always use this database name
$dbuser = 'root';        // <-- Set your MySQL username
$dbpass = '';            // <-- Set your MySQL password (empty for XAMPP default)
$host = 'localhost';

// Resolve project root and default schema path from there
$projectRoot = __DIR__;
$defaultSchema = $projectRoot . '/backend/database/schema.sql';

// Use the provided SQL file argument, or default
$sqlFile = $argv[1] ?? $defaultSchema;
if (!file_exists($sqlFile)) {
    die("Schema file not found: $sqlFile\n");
}
$sql = file_get_contents($sqlFile);

try {
    // Connect to MySQL without specifying a database
    $pdo = new PDO("mysql:host=$host", $dbuser, $dbpass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    // Create the database if it doesn't exist
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname`");
    echo "Database '$dbname' ensured.\n";
    // Now connect to the database
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $dbuser, $dbpass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    $pdo->exec($sql);
    echo "Schema applied successfully to database '$dbname'.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
} 