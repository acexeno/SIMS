<?php
include 'C:/xampp/htdocs/builditpc/backend/config/database.php';

try {
    $pdo = new PDO('mysql:host=localhost;dbname=builditpc', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "=== COMPONENTS TABLE STRUCTURE ===\n";
    $stmt = $pdo->query('DESCRIBE components');
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $row['Field'] . ' - ' . $row['Type'] . PHP_EOL;
    }
    
    echo "\n=== SAMPLE RAM COMPONENT ===\n";
    $stmt = $pdo->query('SELECT * FROM components WHERE category_id = 4 LIMIT 1');
    $ram = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($ram) {
        foreach ($ram as $key => $value) {
            echo "$key: $value\n";
        }
    }
    
    echo "\n=== SAMPLE MOTHERBOARD COMPONENT ===\n";
    $stmt = $pdo->query('SELECT * FROM components WHERE category_id = 2 LIMIT 1');
    $mobo = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($mobo) {
        foreach ($mobo as $key => $value) {
            echo "$key: $value\n";
        }
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
?> 