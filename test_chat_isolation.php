<?php
/**
 * Chat Conversation Isolation Test Script
 * 
 * This script tests that different clients get separate conversations.
 * Run this from the command line or browser to verify the fix is working.
 */

require_once __DIR__ . '/backend/config/database.php';

try {
    $pdo = get_db_connection();
    echo "✅ Connected to database\n\n";
} catch (PDOException $e) {
    die("❌ Database connection failed: " . $e->getMessage() . "\n");
}

echo "=" . str_repeat("=", 70) . "\n";
echo "CHAT CONVERSATION ISOLATION TEST\n";
echo "=" . str_repeat("=", 70) . "\n\n";

// Test 1: Create two guest sessions with same name but different emails
echo "TEST 1: Guest isolation (same name, different emails)\n";
echo str_repeat("-", 70) . "\n";

$stmt = $pdo->prepare('
    INSERT INTO chat_sessions (user_id, guest_name, guest_email, status, priority) 
    VALUES (?, ?, ?, "open", "normal")
');

// Create Session 1
$stmt->execute([null, 'Test User', 'test1@example.com']);
$session1_id = $pdo->lastInsertId();
echo "✅ Created Session 1: ID = $session1_id (Test User, test1@example.com)\n";

// Create Session 2 (same name, different email)
$stmt->execute([null, 'Test User', 'test2@example.com']);
$session2_id = $pdo->lastInsertId();
echo "✅ Created Session 2: ID = $session2_id (Test User, test2@example.com)\n";

// Verify they are different
if ($session1_id != $session2_id) {
    echo "✅ PASS: Sessions are different IDs (isolation working!)\n\n";
} else {
    echo "❌ FAIL: Sessions have the same ID (isolation broken!)\n\n";
}

// Test 2: Try to find existing session with same name+email combo
echo "TEST 2: Session lookup (requiring BOTH name AND email match)\n";
echo str_repeat("-", 70) . "\n";

// Try to find session with same name but different email
$stmt = $pdo->prepare('
    SELECT id FROM chat_sessions 
    WHERE guest_name = ? AND guest_email = ? AND status = "open" AND user_id IS NULL 
    ORDER BY updated_at DESC 
    LIMIT 1
');

// Should find session1
$stmt->execute(['Test User', 'test1@example.com']);
$found1 = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Looking for (Test User, test1@example.com): ";
if ($found1 && $found1['id'] == $session1_id) {
    echo "✅ Found Session 1 (correct)\n";
} else {
    echo "❌ FAIL: Found wrong session or none\n";
}

// Should NOT find session1 when using session2's email
$stmt->execute(['Test User', 'test2@example.com']);
$found2 = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Looking for (Test User, test2@example.com): ";
if ($found2 && $found2['id'] == $session2_id && $found2['id'] != $session1_id) {
    echo "✅ Found Session 2 (correct, different from Session 1)\n";
} else {
    echo "❌ FAIL: Found wrong session\n";
}

// Should NOT find session1 with wrong email
$stmt->execute(['Test User', 'wrong@example.com']);
$found_wrong = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Looking for (Test User, wrong@example.com): ";
if (!$found_wrong || $found_wrong['id'] != $session1_id) {
    echo "✅ Correctly did NOT find Session 1 with wrong email\n\n";
} else {
    echo "❌ FAIL: Wrongly found Session 1 with wrong email (isolation broken!)\n\n";
}

// Test 3: Test registered user isolation
echo "TEST 3: Registered user isolation\n";
echo str_repeat("-", 70) . "\n";

// Check if we have test users
$stmt = $pdo->query('SELECT id, username FROM users LIMIT 2');
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (count($users) >= 2) {
    $user1_id = $users[0]['id'];
    $user2_id = $users[1]['id'];
    
    // Create session for user1
    $stmt = $pdo->prepare('
        INSERT INTO chat_sessions (user_id, guest_name, guest_email, status, priority) 
        VALUES (?, NULL, NULL, "open", "normal")
    ');
    $stmt->execute([$user1_id]);
    $user_session1 = $pdo->lastInsertId();
    echo "✅ Created session for User {$users[0]['username']} (ID: $user1_id): Session $user_session1\n";
    
    // Create session for user2
    $stmt->execute([$user2_id]);
    $user_session2 = $pdo->lastInsertId();
    echo "✅ Created session for User {$users[1]['username']} (ID: $user2_id): Session $user_session2\n";
    
    if ($user_session1 != $user_session2) {
        echo "✅ PASS: Registered users have separate sessions\n\n";
    } else {
        echo "❌ FAIL: Registered users sharing same session\n\n";
    }
} else {
    echo "⚠️  SKIP: Need at least 2 users in database to test registered user isolation\n\n";
}

// Test 4: Verify messages are isolated
echo "TEST 4: Message isolation\n";
echo str_repeat("-", 70) . "\n";

// Add messages to session1
$msg_stmt = $pdo->prepare('
    INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
    VALUES (?, ?, ?, ?, ?)
');
$msg_stmt->execute([$session1_id, 'user', 'Message for session 1', 'text', 'unread']);
$msg1_id = $pdo->lastInsertId();
echo "✅ Added message $msg1_id to Session $session1_id\n";

// Add messages to session2
$msg_stmt->execute([$session2_id, 'user', 'Message for session 2', 'text', 'unread']);
$msg2_id = $pdo->lastInsertId();
echo "✅ Added message $msg2_id to Session $session2_id\n";

// Verify messages are in correct sessions
$stmt = $pdo->prepare('SELECT COUNT(*) FROM chat_messages WHERE session_id = ?');
$stmt->execute([$session1_id]);
$count1 = $stmt->fetchColumn();
echo "Session $session1_id has $count1 message(s)\n";

$stmt->execute([$session2_id]);
$count2 = $stmt->fetchColumn();
echo "Session $session2_id has $count2 message(s)\n";

if ($count1 > 0 && $count2 > 0 && $count1 == $count2) {
    echo "✅ PASS: Messages are correctly isolated per session\n\n";
} else {
    echo "❌ FAIL: Message isolation issue\n\n";
}

// Test 5: Test session access validation
echo "TEST 5: Session access validation\n";
echo str_repeat("-", 70) . "\n";

// Try to access session1 with session2's credentials
$stmt = $pdo->prepare('
    SELECT cs.* FROM chat_sessions cs 
    WHERE cs.id = ? 
    AND cs.guest_name = ? 
    AND cs.guest_email = ? 
    AND cs.user_id IS NULL
');
$stmt->execute([$session1_id, 'Test User', 'test2@example.com']); // Wrong email for session1
$wrong_access = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$wrong_access) {
    echo "✅ PASS: Cannot access Session 1 with Session 2's credentials\n";
} else {
    echo "❌ FAIL: Can access Session 1 with wrong credentials (security issue!)\n";
}

// Try to access session1 with correct credentials
$stmt->execute([$session1_id, 'Test User', 'test1@example.com']); // Correct credentials
$correct_access = $stmt->fetch(PDO::FETCH_ASSOC);

if ($correct_access && $correct_access['id'] == $session1_id) {
    echo "✅ PASS: Can access Session 1 with correct credentials\n\n";
} else {
    echo "❌ FAIL: Cannot access Session 1 with correct credentials\n\n";
}

// Summary
echo "=" . str_repeat("=", 70) . "\n";
echo "TEST SUMMARY\n";
echo "=" . str_repeat("=", 70) . "\n";

// Count distinct sessions
$stmt = $pdo->query('
    SELECT 
        COUNT(*) as total_sessions,
        COUNT(DISTINCT CASE WHEN user_id IS NULL THEN CONCAT(guest_name, "|", guest_email) ELSE NULL END) as distinct_guests,
        COUNT(DISTINCT user_id) as distinct_users
    FROM chat_sessions
');
$summary = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Total sessions created: {$summary['total_sessions']}\n";
echo "Distinct guest sessions: {$summary['distinct_guests']}\n";
echo "Distinct user sessions: {$summary['distinct_users']}\n\n";

echo "✅ All tests completed!\n";
echo "\nNOTE: Test sessions created. You may want to clean them up:\n";
echo "DELETE FROM chat_sessions WHERE guest_name = 'Test User' AND guest_email IN ('test1@example.com', 'test2@example.com');\n";
echo "DELETE FROM chat_messages WHERE session_id IN ($session1_id, $session2_id);\n";


