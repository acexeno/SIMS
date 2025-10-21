<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database configuration
$host = 'localhost';
$dbname = 'builditpc_db';
$user = 'root';
$pass = '';

// Create connection
$conn = new mysqli($host, $user, $pass, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

echo "<h2>Chat Tables Verification</h2>";

// List of required tables and their required columns
$tables = [
    'chat_sessions' => ['id', 'user_id', 'status', 'created_at', 'updated_at'],
    'chat_messages' => ['id', 'session_id', 'sender', 'message', 'sent_at'],
    'last_seen_chat' => ['user_id', 'session_id', 'last_seen_at']
];

$allTablesExist = true;

foreach ($tables as $table => $requiredColumns) {
    // Check if table exists
    $result = $conn->query("SHOW TABLES LIKE '$table'");
    
    if ($result->num_rows > 0) {
        echo "<p>✅ Table '$table' exists</p>";
        
        // Check required columns
        $missingColumns = [];
        $result = $conn->query("SHOW COLUMNS FROM `$table`");
        $existingColumns = [];
        
        while ($row = $result->fetch_assoc()) {
            $existingColumns[] = $row['Field'];
        }
        
        foreach ($requiredColumns as $column) {
            if (!in_array($column, $existingColumns)) {
                $missingColumns[] = $column;
            }
        }
        
        if (!empty($missingColumns)) {
            echo "<p>❌ Missing columns in '$table': " . implode(', ', $missingColumns) . "</p>";
            $allTablesExist = false;
        } else {
            echo "<p>✅ All required columns exist in '$table'</p>";
        }
        
    } else {
        echo "<p>❌ Table '$table' does not exist</p>";
        $allTablesExist = false;
    }
}

if ($allTablesExist) {
    echo "<h3 style='color: green;'>✅ All chat tables are properly set up!</h3>";
    echo "<p>You can now test the chat system by accessing the chat interface in your application.</p>";
} else {
    echo "<h3 style='color: red;'>❌ Some tables or columns are missing.</h3>";
    echo "<p>Please run the setup_chat_system.php script to create the missing tables/columns.</p>";
}

$conn->close();
?>
