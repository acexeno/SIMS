<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=builditpc_db', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected to database successfully\n\n";
    
    // List all tables
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($tables)) {
        echo "No tables found in the database.\n";
    } else {
        echo "Tables in database:\n";
        foreach ($tables as $table) {
            echo "- $table\n";
            
            // List columns for each table
            $columns = $pdo->query("SHOW COLUMNS FROM $table")->fetchAll(PDO::FETCH_COLUMN);
            echo "  Columns: " . implode(', ', $columns) . "\n\n";
        }
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    
    if ($e->getCode() == 1049) {
        echo "The database 'builditpc_db' does not exist.\n";
    } elseif ($e->getCode() == 2002) {
        echo "Could not connect to MySQL server. Make sure MySQL is running.\n";
    } elseif ($e->getCode() == 1045) {
        echo "Access denied. Check your MySQL username and password.\n";
    }
}
?>
