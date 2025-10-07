<?php
// Safe script to add 'total_price' column to 'orders' table if it does not exist
$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'builditpc_db'; // Updated to match backend config

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
    die('Connection failed: ' . $conn->connect_error);
}

// Check if column exists
$colCheck = $conn->query("SHOW COLUMNS FROM orders LIKE 'total_price'");
if ($colCheck && $colCheck->num_rows > 0) {
    echo "Column 'total_price' already exists in 'orders' table.";
} else {
    $sql = "ALTER TABLE orders ADD COLUMN total_price DECIMAL(12,2) NOT NULL DEFAULT 0";
    if ($conn->query($sql) === TRUE) {
        echo "Column 'total_price' added successfully to 'orders' table.";
    } else {
        echo "Error adding column: " . $conn->error;
    }
}
$conn->close(); 