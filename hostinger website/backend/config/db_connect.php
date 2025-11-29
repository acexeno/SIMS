<?php
// Simple mysqli connector (no .env). Update credentials per environment.

// Hostinger credentials (update password and host if panel shows different host)
$hostName = "localhost";                    // Usually 'localhost' on Hostinger
$dbUser = "u709288172_sims";                // MySQL user
$dbPassword = "";                           // Paste your MySQL user's password
$dbName = "u709288172_builditpc_db";        // Database name

// Enable error reporting for visibility during setup
error_reporting(E_ALL);
ini_set('display_errors', '1');

// Create mysqli connection
$conn = mysqli_connect($hostName, $dbUser, $dbPassword, $dbName);

// Fail fast on connection error
if (!$conn) {
    die("Something went wrong. Connection failed: " . mysqli_connect_error());
}
?>


