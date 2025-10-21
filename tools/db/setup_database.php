<?php
// Database setup script for SIMS

require_once __DIR__ . '/backend/config/database.php';

try {
    // Read and execute the schema file
    $schema = file_get_contents(__DIR__ . '/backend/database/schema.sql');
    
    // Split by semicolon to execute each statement separately
    $statements = array_filter(array_map('trim', explode(';', $schema)));
    
    foreach ($statements as $statement) {
        if (!empty($statement)) {
            $pdo->exec($statement);
            echo "Executed: " . substr($statement, 0, 50) . "...\n";
        }
    }
    
    echo "\nDatabase setup completed successfully!\n";
    echo "Tables created/updated:\n";
    echo "- users\n";
    echo "- roles\n";
    echo "- user_roles\n";
    echo "- component_categories\n";
    echo "- components\n";
    echo "- user_builds\n";
    
} catch (Exception $e) {
    echo "Error setting up database: " . $e->getMessage() . "\n";
}
?> 