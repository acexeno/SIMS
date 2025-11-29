<?php
// Apply the build comments schema
require_once 'backend/config/database.php';

try {
    $pdo = get_db_connection();
    
    // Read and execute the schema file
    $schema = file_get_contents('database/build_comments_schema.sql');
    
    if ($schema === false) {
        throw new Exception('Could not read schema file');
    }
    
    // Split the schema into individual statements
    $statements = array_filter(
        array_map('trim', explode(';', $schema)),
        function($stmt) {
            return !empty($stmt) && !preg_match('/^--/', $stmt);
        }
    );
    
    foreach ($statements as $statement) {
        if (!empty(trim($statement))) {
            $pdo->exec($statement);
            echo "Executed: " . substr($statement, 0, 50) . "...\n";
        }
    }
    
    echo "Build comments schema applied successfully!\n";
    
} catch (Exception $e) {
    echo "Error applying schema: " . $e->getMessage() . "\n";
}
?>
