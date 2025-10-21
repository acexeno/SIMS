<?php
header('Content-Type: application/json');
require_once __DIR__ . '/backend/api/chat.php';

// Test the messages endpoint with a non-existent session ID
try {
    $_GET['messages'] = true;
    $_GET['session_id'] = 999999; // Non-existent session ID
    
    ob_start();
    require __DIR__ . '/backend/api/chat.php';
    $output = ob_get_clean();
    
    $response = json_decode($output, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        echo "Test 1: Successfully received response for non-existent session:\n";
        echo "Response: " . json_encode($response, JSON_PRETTY_PRINT) . "\n\n";
        
        if (isset($response['session_deleted']) && $response['session_deleted'] === true) {
            echo "✅ Test 1 PASSED: Correctly identified deleted session\n";
        } else {
            echo "❌ Test 1 FAILED: Did not identify deleted session correctly\n";
        }
    } else {
        echo "❌ Test 1 FAILED: Invalid JSON response\n";
        echo "Raw output: " . $output . "\n";
    }
} catch (Exception $e) {
    echo "❌ Test 1 FAILED with exception: " . $e->getMessage() . "\n";
}

// Test with an existing session ID (if any exists)
try {
    // Try to get a real session ID from the database
    require_once __DIR__ . '/backend/config/database.php';
    $pdo = getDBConnection();
    
    $stmt = $pdo->query('SELECT id FROM chat_sessions LIMIT 1');
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($session) {
        $_GET['session_id'] = $session['id'];
        
        ob_start();
        require __DIR__ . '/backend/api/chat.php';
        $output = ob_get_clean();
        
        $response = json_decode($output, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            echo "\nTest 2: Successfully received response for existing session:\n";
            echo "Response: " . json_encode($response, JSON_PRETTY_PRINT) . "\n";
            
            if (isset($response['messages']) && is_array($response['messages'])) {
                echo "✅ Test 2 PASSED: Successfully retrieved messages for existing session\n";
                echo "Number of messages: " . count($response['messages']) . "\n";
            } else {
                echo "❌ Test 2 FAILED: Did not retrieve messages correctly\n";
            }
        } else {
            echo "❌ Test 2 FAILED: Invalid JSON response\n";
            echo "Raw output: " . $output . "\n";
        }
    } else {
        echo "\nℹ️ No existing chat sessions found for Test 2. Skipping...\n";
    }
} catch (Exception $e) {
    echo "❌ Test 2 FAILED with exception: " . $e->getMessage() . "\n";
}

echo "\nTesting complete. Check the results above.\n";
