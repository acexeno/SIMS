<?php
// Safe script to add user permission columns if they do not exist
$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'builditpc_db';

$mysqli = new mysqli($host, $user, $pass, $db);
if ($mysqli->connect_error) {
    die('Connection failed: ' . $mysqli->connect_error);
}

function ensureColumn($mysqli, $table, $column, $definition) {
    $res = $mysqli->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
    if ($res && $res->num_rows > 0) {
        echo "Column '$column' already exists in '$table' table.\n";
        return;
    }
    $sql = "ALTER TABLE `$table` ADD COLUMN $column $definition";
    if ($mysqli->query($sql) === TRUE) {
        echo "Added column '$column' to '$table'.\n";
    } else {
        echo "Error adding column '$column' to '$table': " . $mysqli->error . "\n";
    }
}

ensureColumn($mysqli, 'users', 'can_access_orders', 'TINYINT(1) NOT NULL DEFAULT 1');
ensureColumn($mysqli, 'users', 'can_access_chat_support', 'TINYINT(1) NOT NULL DEFAULT 1');

$mysqli->close(); 