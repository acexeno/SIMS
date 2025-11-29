<?php
/**
 * Chat support API: sessions, messages, permissions, and stats.
 * Requires valid JWT for staff actions; guests can initiate sessions with minimal fields.
 * Notes: focuses on clarity, auditability, and safe defaults when checks fail.
 */
// Error reporting controlled by environment
require_once __DIR__ . '/../config/env.php';
$appDebug = env('APP_DEBUG', '0');
if ($appDebug === '1' || strtolower($appDebug) === 'true') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
    ini_set('display_errors', 0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../utils/jwt_helper.php';
$geminiClientPath = __DIR__ . '/../services/gemini_client.php';
if (is_readable($geminiClientPath)) {
    require_once $geminiClientPath;
}

// Development log helper: only logs when APP_DEBUG is enabled
function logMessage($message) {
    $appDebug = env('APP_DEBUG', '0');
    if (!($appDebug === '1' || strtolower($appDebug) === 'true')) {
        return; // Do not log in production
    }
    $logFile = __DIR__ . '/chat_debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

try {
    $pdo = get_db_connection();
    logMessage("Database connection established successfully");
} catch (PDOException $e) {
    logMessage("Database connection failed: " . $e->getMessage());
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]));
}

header('Content-Type: application/json');

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

/**
 * Decode Bearer token (or ?token=) and return payload, or null if absent/invalid.
 */
function getUserFromToken() {
    $headers = getallheaders();
    $token = null;
    
    // Support different header casings
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        $token = $matches[1];
    }
    
    if (!$token && isset($_GET['token'])) {
        $token = $_GET['token'];
    }
    
    if ($token) {
        // Use the correct helper function name
        return verifyJWT($token);
    }
    
    return null;
}

/**
 * Check if user has permission to access chat features.
 * Respects Super Admin override and per-user `can_access_chat_support` flags.
 */
function hasChatPermission($user, $requiredLevel = 'read') {
    if (!$user || !isset($user['roles'])) {
        return false;
    }

    $roles = is_string($user['roles']) ? explode(',', $user['roles']) : $user['roles'];

    // Super Admin has full access to chat support
    if (in_array('Super Admin', $roles, true)) {
        return true;
    }

    // Enforce per-user chat permission flag from DB for Admin/Employee
    global $pdo;
    try {
        $userId = $user['user_id'] ?? $user['id'] ?? null;
        if ($userId) {
            $stmt = $pdo->prepare('SELECT can_access_chat_support FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            $row = $stmt->fetch();
            if ($row && (int)$row['can_access_chat_support'] !== 1) {
                return false; // Explicitly disabled by Super Admin
            }
        }
    } catch (Exception $e) {
        // If DB check fails, be safe and deny access
        error_log("hasChatPermission DB check failed: " . $e->getMessage());
        return false;
    }

    // Role-based defaults with safe fallbacks
    if (in_array('Admin', $roles, true)) {
        return true; // Admins allowed unless explicitly disabled above
    }

    // Employee can read and write chat unless explicitly disabled above
    if (in_array('Employee', $roles, true) && in_array($requiredLevel, ['read', 'write'], true)) {
        return true;
    }

    return false;
}

/**
 * Return unread count for user's open sessions since their last seen time.
 */
function getUnreadCount($userId) {
    global $pdo;
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM chat_sessions WHERE user_id = ? AND status = "open" AND updated_at > (SELECT COALESCE(MAX(last_seen_at), "1970-01-01") FROM last_seen_chat WHERE user_id = ?)');
    $stmt->execute([$userId, $userId]);
    return $stmt->fetchColumn();
}

/**
 * Collapse whitespace and limit message length before sending to Gemini.
 */
function normalizeChatText($text, $maxLength = 4000) {
    $normalized = trim(preg_replace('/\s+/u', ' ', (string) $text));
    if ($maxLength > 0) {
        if (function_exists('mb_substr')) {
            $normalized = mb_substr($normalized, 0, $maxLength);
        } else {
            $normalized = substr($normalized, 0, $maxLength);
        }
    }
    return $normalized;
}

/**
 * Attempt to generate an AI assistant reply using Gemini.
 */
function attemptGeminiAutoReply($sessionId, array $options = []) {
    global $pdo;

    if (!function_exists('gemini_is_enabled') || !gemini_is_enabled()) {
        return ['ok' => false, 'reason' => 'disabled'];
    }

    try {
        $historyStmt = $pdo->prepare('
            SELECT sender, message 
            FROM chat_messages 
            WHERE session_id = ? 
            ORDER BY sent_at DESC 
            LIMIT 12
        ');
        $historyStmt->execute([$sessionId]);
        $rawHistory = $historyStmt->fetchAll(PDO::FETCH_ASSOC);
        if (empty($rawHistory)) {
            return ['ok' => false, 'reason' => 'no_history'];
        }

        $rawHistory = array_reverse($rawHistory);
        $contents = [];
        foreach ($rawHistory as $row) {
            $text = normalizeChatText($row['message'] ?? '');
            if ($text === '') {
                continue;
            }
            $role = ($row['sender'] === 'user') ? 'user' : 'model';
            $contents[] = [
                'role' => $role,
                'parts' => [
                    ['text' => $text],
                ],
            ];
        }

        if (empty($contents)) {
            return ['ok' => false, 'reason' => 'empty_contents'];
        }

        $sessionStmt = $pdo->prepare('
            SELECT guest_name, guest_email, user_id, status, priority 
            FROM chat_sessions 
            WHERE id = ? 
            LIMIT 1
        ');
        $sessionStmt->execute([$sessionId]);
        $sessionInfo = $sessionStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $contextLines = [];
        if (!empty($sessionInfo['guest_name'])) {
            $contextLines[] = 'Customer name: ' . $sessionInfo['guest_name'];
        }
        if (!empty($sessionInfo['guest_email'])) {
            $contextLines[] = 'Customer email: ' . $sessionInfo['guest_email'];
        }
        if (!empty($sessionInfo['priority'])) {
            $contextLines[] = 'Session priority: ' . $sessionInfo['priority'];
        }
        if (!empty($options['is_new_session'])) {
            $contextLines[] = 'This is the first reply in a new chat session.';
        }
        if (!empty($options['extra_context']) && is_array($options['extra_context'])) {
            $contextLines = array_merge($contextLines, $options['extra_context']);
        }
        if (!empty($contextLines)) {
            $contents[] = [
                'role' => 'user',
                'parts' => [
                    ['text' => "Support context:\n" . implode("\n", $contextLines)],
                ],
            ];
        }

        $generationConfig = [];
        $temperature = env('GOOGLE_AI_TEMPERATURE');
        if ($temperature !== null && $temperature !== '') {
            $generationConfig['temperature'] = (float) $temperature;
        }
        $maxTokens = env('GOOGLE_AI_MAX_OUTPUT_TOKENS');
        if ($maxTokens !== null && $maxTokens !== '') {
            $generationConfig['maxOutputTokens'] = (int) $maxTokens;
        }
        $topP = env('GOOGLE_AI_TOP_P');
        if ($topP !== null && $topP !== '') {
            $generationConfig['topP'] = (float) $topP;
        }
        if (empty($generationConfig)) {
            unset($generationConfig);
        }

        $systemInstruction = env('GOOGLE_AI_SYSTEM_PROMPT', "You are the SIMS Support AI assistant. Provide concise, friendly, and accurate help about PC components, orders, and account questions. Be transparent that you are an AI assistant. If the request involves payments, account deletion, personal data updates, or anything you are unsure about, politely let the customer know that a human agent will take over shortly. Encourage patience when escalation is required.");

        logMessage("Gemini: generating reply for session {$sessionId}");

        $response = gemini_generate_reply($contents, [
            'generation_config' => $generationConfig ?? [],
            'system_instruction' => $systemInstruction,
        ]);

        if (!($response['ok'] ?? false) || empty($response['text'])) {
            $reason = $response['reason'] ?? ($response['error'] ?? 'unknown');
            logMessage('Gemini auto-reply skipped: ' . $reason . ' payload=' . json_encode($response));
            return ['ok' => false, 'reason' => 'generation_failed'];
        }

        $assistantPrefix = env('GOOGLE_AI_ASSISTANT_PREFIX', '[SIMS ChatBot Assistant] ');
        $reply = trim((string) $response['text']);
        if ($reply === '') {
            logMessage('Gemini auto-reply produced empty text');
            return ['ok' => false, 'reason' => 'empty_reply'];
        }

        $messageToStore = $assistantPrefix !== '' ? $assistantPrefix . $reply : $reply;

        $insertStmt = $pdo->prepare('
            INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
            VALUES (?, ?, ?, ?, ?)
        ');
        $insertStmt->execute([$sessionId, 'ai', $messageToStore, 'text', 'unread']);
        $pdo->prepare('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?')
            ->execute([$sessionId]);

        logMessage("Gemini auto-reply stored for session {$sessionId}");
        return ['ok' => true, 'text' => $reply];
    } catch (Throwable $e) {
        logMessage('Gemini auto-reply error: ' . $e->getMessage());
        return ['ok' => false, 'reason' => 'exception'];
    }
}

$method = $_SERVER['REQUEST_METHOD'];

// Stats dashboard: totals, open sessions, today, and average first admin response
if ($method === 'GET' && isset($_GET['stats'])) {
    try {
        $stats = [];
        
        // Total sessions
        $stmt = $pdo->query('SELECT COUNT(*) FROM chat_sessions');
        $stats['total_sessions'] = $stmt->fetchColumn();
        
        // Open sessions
        $stmt = $pdo->query('SELECT COUNT(*) FROM chat_sessions WHERE status = "open"');
        $stats['open_sessions'] = $stmt->fetchColumn();
        
        // Today's sessions
        $stmt = $pdo->query('SELECT COUNT(*) FROM chat_sessions WHERE DATE(created_at) = CURDATE()');
        $stats['today_sessions'] = $stmt->fetchColumn();
        
        // Average response time (in minutes)
        $stmt = $pdo->query('
            SELECT AVG(TIMESTAMPDIFF(MINUTE, cs.created_at, cm.sent_at)) as avg_response_time
            FROM chat_sessions cs
            JOIN chat_messages cm ON cs.id = cm.session_id
            WHERE cm.sender = "admin" AND cm.id = (
                SELECT MIN(id) FROM chat_messages 
                WHERE session_id = cs.id AND sender = "admin"
            )
        ');
        $avgTime = $stmt->fetchColumn();
        $stats['avg_response_time'] = round($avgTime ?: 0, 1);
        
        respond(['success' => true, 'stats' => $stats]);
    } catch (Exception $e) {
        respond(['error' => 'Failed to get statistics: ' . $e->getMessage()], 500);
    }
}

// List sessions (admin/employee): includes unread counts and last message time
if ($method === 'GET' && isset($_GET['sessions'])) {
    try {
        $user = getUserFromToken();
        
        // Only admins and employees can access all sessions
        if (!hasChatPermission($user, 'read')) {
            respond(['error' => 'Access denied. Admin or Employee role required.'], 403);
        }
        
        $stmt = $pdo->query('
            SELECT 
                cs.*, 
                u.username,
                u.email as user_email,
                u.first_name,
                u.last_name,
                u.is_active,
                (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id AND sender = "user" AND read_status = "unread") as unread_messages,
                (SELECT MAX(sent_at) FROM chat_messages WHERE session_id = cs.id) as last_message_time
            FROM chat_sessions cs 
            LEFT JOIN users u ON cs.user_id = u.id 
            ORDER BY 
                CASE WHEN cs.status = "open" THEN 0 ELSE 1 END,
                CASE WHEN cs.priority = "urgent" THEN 0 WHEN cs.priority = "high" THEN 1 WHEN cs.priority = "normal" THEN 2 ELSE 3 END,
                cs.updated_at DESC
        ');
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Add user roles for registered users and ensure unread_messages is an integer
        foreach ($sessions as &$session) {
            // Ensure unread_messages is an integer (not string)
            $session['unread_messages'] = intval($session['unread_messages'] ?? 0);
            
            if ($session['user_id']) {
                $roleStmt = $pdo->prepare('
                    SELECT r.name FROM roles r 
                    JOIN user_roles ur ON r.id = ur.role_id 
                    WHERE ur.user_id = ?
                ');
                $roleStmt->execute([$session['user_id']]);
                $session['user_roles'] = $roleStmt->fetchAll(PDO::FETCH_COLUMN);
            } else {
                $session['user_roles'] = [];
            }
        }
        
        respond(['success' => true, 'sessions' => $sessions]);
    } catch (Exception $e) {
        respond(['error' => 'Failed to load sessions: ' . $e->getMessage()], 500);
    }
}

// Fetch messages for a session; marks read and updates last_seen for authenticated users
if ($method === 'GET' && isset($_GET['messages']) && isset($_GET['session_id'])) {
    try {
        $session_id = intval($_GET['session_id']);
        $user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
        $guest_name = $_GET['guest_name'] ?? null;
        $guest_email = $_GET['guest_email'] ?? null;
        
        // First check if the session exists and is accessible
        $query = 'SELECT cs.* FROM chat_sessions cs WHERE cs.id = ?';
        $params = [$session_id];
        
        // For authenticated users, verify the session belongs to them
        if ($user_id) {
            $query .= ' AND cs.user_id = ?';
            $params[] = $user_id;
        }
        // For guests, verify the session belongs to them (require BOTH name AND email to match when both provided)
        else if ($guest_name || (!empty($guest_email))) {
            if ($guest_name && !empty($guest_email)) {
                // Both provided: require BOTH to match (ensures unique client identification)
                $query .= ' AND cs.guest_name = ? AND cs.guest_email = ?';
                $params[] = $guest_name;
                $params[] = $guest_email;
            } else if (!empty($guest_email)) {
                // Only email provided: match on email
                $query .= ' AND cs.guest_email = ?';
                $params[] = $guest_email;
            } else if ($guest_name) {
                // Only name provided: match on name (and ensure email is also NULL for this session)
                $query .= ' AND cs.guest_name = ? AND cs.guest_email IS NULL';
                $params[] = $guest_name;
            }
        }
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        
        if ($stmt->rowCount() === 0) {
            // Session doesn't exist or doesn't belong to this user
            respond(['success' => true, 'messages' => [], 'session_deleted' => true]);
        }
        
        // Get messages with proper ordering
        $stmt = $pdo->prepare('
            SELECT * FROM chat_messages 
            WHERE session_id = ? 
            ORDER BY sent_at ASC
        ');
        $stmt->execute([$session_id]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Mark messages as read for authenticated user viewers
        if ($user_id) {
            $stmt = $pdo->prepare('
                UPDATE chat_messages 
                SET read_status = "read" 
                WHERE session_id = ? AND sender != ? AND read_status = "unread"
            ');
            $stmt->execute([$session_id, 'user']);
            
            // Update last seen
            $stmt = $pdo->prepare('
                INSERT INTO last_seen_chat (user_id, session_id, last_seen_at) 
                VALUES (?, ?, NOW()) 
                ON DUPLICATE KEY UPDATE last_seen_at = NOW()
            ');
            $stmt->execute([$user_id, $session_id]);
        }
        
        // Keep session fresh for ordering
        $pdo->prepare('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?')
            ->execute([$session_id]);
        
        respond(['success' => true, 'messages' => $messages, 'session_deleted' => false]);
    } catch (Exception $e) {
        logMessage('Error in messages endpoint: ' . $e->getMessage());
        respond(['error' => 'Failed to load messages: ' . $e->getMessage()], 500);
    }
}

// List sessions for a specific user (client-facing view)
if ($method === 'GET' && isset($_GET['user_sessions'])) {
    try {
        $user_id = intval($_GET['user_id']);
        $stmt = $pdo->prepare('
            SELECT 
                cs.*,
                (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id AND sender IN ("admin", "ai") AND read_status = "unread") as unread_messages
            FROM chat_sessions cs 
            WHERE cs.user_id = ? 
            ORDER BY cs.updated_at DESC
        ');
        $stmt->execute([$user_id]);
        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Ensure unread_messages is an integer for each session
        foreach ($sessions as &$session) {
            $session['unread_messages'] = intval($session['unread_messages'] ?? 0);
        }
        
        respond(['success' => true, 'sessions' => $sessions]);
    } catch (Exception $e) {
        respond(['error' => 'Failed to load user sessions: ' . $e->getMessage()], 500);
    }
}

// Send a message: creates session on first message, notifies staff, validates sender/type
if ($method === 'POST' && isset($_GET['send'])) {
    try {
        // Robust body parsing (JSON or form-encoded)
        $raw = file_get_contents('php://input');
        $input = [];
        if (is_string($raw) && $raw !== '') {
            $json = json_decode($raw, true);
            if (is_array($json)) {
                $input = $json;
            } else {
                $tmp = [];
                parse_str($raw, $tmp);
                if (is_array($tmp) && !empty($tmp)) $input = $tmp;
            }
        }
        if (empty($input) && !empty($_POST)) {
            $input = $_POST;
        }
        $session_id = isset($input['session_id']) ? intval($input['session_id']) : 0;
        $sender = $input['sender'] ?? '';
        $message = trim($input['message'] ?? '');
        $message_type = $input['message_type'] ?? 'text';
        $guest_name = $input['guest_name'] ?? null;
        $guest_email = $input['guest_email'] ?? null;
        $user_id = isset($input['user_id']) && $input['user_id'] !== '' ? intval($input['user_id']) : null;

        if (!$sender || !$message) {
            respond(['error' => 'Invalid input: sender and message required'], 400);
        }

        // Validate sender type and check permissions for admin messages
        if (!in_array($sender, ['user', 'admin'], true)) {
            respond(['error' => 'Invalid sender type'], 400);
        }
        $currentUser = getUserFromToken();
        if ($sender === 'admin') {
            if (!hasChatPermission($currentUser, 'write')) {
                respond(['error' => 'Access denied. Admin or Employee role required to send admin messages.'], 403);
            }
        }

        // Validate message type
        if (!in_array($message_type, ['text', 'image', 'file', 'system'])) {
            $message_type = 'text';
        }

        // If new conversation, check for existing open session first, then create if needed
        if (!$session_id) {
            // Check if user already has an open session
            $existingSession = null;
            
            if ($user_id) {
                // For registered users, check by user_id
                $stmt = $pdo->prepare('
                    SELECT id FROM chat_sessions 
                    WHERE user_id = ? AND status = "open" 
                    ORDER BY updated_at DESC 
                    LIMIT 1
                ');
                $stmt->execute([$user_id]);
                $existingSession = $stmt->fetch(PDO::FETCH_ASSOC);
            } else if ($guest_name || (!empty($guest_email))) {
                // For guests, require BOTH name AND email to match (when both provided) to ensure unique sessions per client
                // This prevents different guests from sharing conversations
                // Note: Email field removed from UI - now using name only
                $existingSession = null;
                
                if ($guest_name && !empty($guest_email)) {
                    // Both provided: require BOTH to match (ensures unique client identification)
                    $stmt = $pdo->prepare('
                        SELECT id FROM chat_sessions 
                        WHERE guest_name = ? AND guest_email = ? AND status = "open" AND user_id IS NULL 
                        ORDER BY updated_at DESC 
                        LIMIT 1
                    ');
                    $stmt->execute([$guest_name, $guest_email]);
                    $existingSession = $stmt->fetch(PDO::FETCH_ASSOC);
                } else if (!empty($guest_email)) {
                    // Only email provided: match on email (emails should be unique)
                    $stmt = $pdo->prepare('
                        SELECT id FROM chat_sessions 
                        WHERE guest_email = ? AND status = "open" AND user_id IS NULL 
                        ORDER BY updated_at DESC 
                        LIMIT 1
                    ');
                    $stmt->execute([$guest_email]);
                    $existingSession = $stmt->fetch(PDO::FETCH_ASSOC);
                } else if ($guest_name) {
                    // Only name provided: match on name only (less secure but allows anonymous chats)
                    // Note: This could still have collisions if multiple guests use same name
                    // Consider requiring email for better uniqueness
                    $stmt = $pdo->prepare('
                        SELECT id FROM chat_sessions 
                        WHERE guest_name = ? AND guest_email IS NULL AND status = "open" AND user_id IS NULL 
                        ORDER BY updated_at DESC 
                        LIMIT 1
                    ');
                    $stmt->execute([$guest_name]);
                    $existingSession = $stmt->fetch(PDO::FETCH_ASSOC);
                }
            }
            
            // Reuse existing open session if found, otherwise create new one
            $isNewSession = false;
            if ($existingSession && isset($existingSession['id'])) {
                $session_id = $existingSession['id'];
            } else {
                // Create new session only if no open session exists
                $stmt = $pdo->prepare('
                    INSERT INTO chat_sessions (user_id, guest_name, guest_email, status, priority) 
                    VALUES (?, ?, ?, "open", "normal")
                ');
                $stmt->execute([$user_id, $guest_name, $guest_email]);
                $session_id = $pdo->lastInsertId();
                $isNewSession = true;
            }
            
            // Insert user's message (whether new or existing session)
            $stmt = $pdo->prepare('
                INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
                VALUES (?, ?, ?, ?, ?)
            ');
            $read_status = 'unread';
            $stmt->execute([$session_id, $sender, $message, $message_type, $read_status]);
            
            // Update session timestamp
            $pdo->prepare('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?')
                ->execute([$session_id]);

            $aiReplySent = false;
            if ($sender === 'user') {
                $aiResponse = attemptGeminiAutoReply($session_id, [
                    'is_new_session' => $isNewSession,
                ]);
                $aiReplySent = $aiResponse['ok'] ?? false;
            }
            
            // Only send auto-reply and notifications for new sessions
            if ($isNewSession) {
                if (!$aiReplySent) {
                    // Fallback auto-reply when Gemini is unavailable
                    $fallbackReply = env('CHAT_AUTOREPLY_FALLBACK', 'Thank you for contacting SIMS Support! 🖥️ Our team will respond within 5-10 minutes. In the meantime, feel free to browse our PC components or check out our prebuilt systems.');
                    $autoReplyStmt = $pdo->prepare('
                        INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
                        VALUES (?, ?, ?, ?, ?)
                    ');
                    $autoReplyStmt->execute([$session_id, 'ai', $fallbackReply, 'text', 'unread']);
                }
                
                // Notify active Admin and Employee users of new session
                $userStmt = $pdo->query("
                    SELECT DISTINCT u.id FROM users u 
                    JOIN user_roles ur ON u.id = ur.user_id 
                    JOIN roles r ON ur.role_id = r.id 
                    WHERE r.name IN ('Admin', 'Employee') AND u.is_active = 1
                ");
                $adminUsers = $userStmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($adminUsers as $adminUser) {
                    try {
                        $notifStmt = $pdo->prepare('
                            INSERT INTO notifications (user_id, type, title, message, priority, read_status, created_at) 
                            VALUES (?, "support", "New Chat Session", ?, "high", 0, NOW())
                        ');
                        $notifStmt->execute([
                            $adminUser['id'],
                            "New customer chat session started" . ($guest_name ? " by $guest_name" : "")
                        ]);
                    } catch (Exception $e) {
                        error_log("Failed to create notification for new chat session: " . $e->getMessage());
                    }
                }
                
                respond(['success' => true, 'session_id' => $session_id, 'message' => 'Chat session created successfully']);
            } else {
                // For existing sessions, notify staff about new message
                $userStmt = $pdo->query("
                    SELECT DISTINCT u.id FROM users u 
                    JOIN user_roles ur ON u.id = ur.user_id 
                    JOIN roles r ON ur.role_id = r.id 
                    WHERE r.name IN ('Admin', 'Employee') AND u.is_active = 1
                ");
                $adminUsers = $userStmt->fetchAll(PDO::FETCH_ASSOC);
                
                foreach ($adminUsers as $adminUser) {
                    try {
                        $notifStmt = $pdo->prepare('
                            INSERT INTO notifications (user_id, type, title, message, priority, read_status, created_at) 
                            VALUES (?, "support", "New Client Message", ?, "high", 0, NOW())
                        ');
                        $notifStmt->execute([
                            $adminUser['id'],
                            "New message in chat session #$session_id"
                        ]);
                    } catch (Exception $e) {
                        error_log("Failed to create notification for client message: " . $e->getMessage());
                    }
                }
                
                // Return success for existing session
                respond(['success' => true, 'session_id' => $session_id]);
            }
        }

        // Verify the session exists and is accessible before inserting message
        $checkSession = $pdo->prepare('SELECT id FROM chat_sessions WHERE id = ?');
        $checkSession->execute([$session_id]);
        
        if ($checkSession->rowCount() === 0) {
            respond(['error' => 'Invalid chat session'], 404);
        }
        
        // Insert the message
        $stmt = $pdo->prepare('
            INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
            VALUES (?, ?, ?, ?, ?)
        ');
        $read_status = 'unread';
        $stmt->execute([$session_id, $sender, $message, $message_type, $read_status]);
        
        // Update session freshness timestamp
        $pdo->prepare('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?')
            ->execute([$session_id]);
        
        // Update session timestamp
        $pdo->prepare('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?')->execute([$session_id]);
        
        $aiReplySent = false;
        if ($sender === 'user') {
            $aiResponse = attemptGeminiAutoReply($session_id, [
                'is_new_session' => false,
            ]);
            $aiReplySent = $aiResponse['ok'] ?? false;
        }

        // Notify recipients based on sender role
        if ($sender === 'admin') {
            // Notify user if they have an account
            // First, try to get user_id from session
            $stmt = $pdo->prepare('SELECT user_id, guest_email, guest_name FROM chat_sessions WHERE id = ?');
            $stmt->execute([$session_id]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $targetUserId = null;
            
            if ($session) {
                // First, try to use the session's user_id
                if ($session['user_id']) {
                    $targetUserId = intval($session['user_id']);
                } 
                // If no user_id but guest_email exists, try to find user by email
                elseif ($session['guest_email'] && !empty($session['guest_email'])) {
                    $userStmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND is_active = 1 LIMIT 1');
                    $userStmt->execute([$session['guest_email']]);
                    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
                    if ($user && $user['id']) {
                        $targetUserId = intval($user['id']);
                        
                        // Update the session with the found user_id for future messages
                        $updateStmt = $pdo->prepare('UPDATE chat_sessions SET user_id = ? WHERE id = ?');
                        $updateStmt->execute([$targetUserId, $session_id]);
                    }
                } 
                // Last resort: If session has guest_name, try to match with username
                elseif ($session['guest_name'] && !empty($session['guest_name'])) {
                    $userStmt = $pdo->prepare('SELECT id FROM users WHERE username = ? AND is_active = 1 LIMIT 1');
                    $userStmt->execute([$session['guest_name']]);
                    $user = $userStmt->fetch(PDO::FETCH_ASSOC);
                    if ($user && $user['id']) {
                        $targetUserId = intval($user['id']);
                        
                        // Update the session with the found user_id
                        $updateStmt = $pdo->prepare('UPDATE chat_sessions SET user_id = ? WHERE id = ?');
                        $updateStmt->execute([$targetUserId, $session_id]);
                    }
                }
            }
            
            // Create notification if we found a valid user_id
            if ($targetUserId && $targetUserId > 0) {
                try {
                    $notifStmt = $pdo->prepare('
                        INSERT INTO notifications (user_id, type, title, message, priority, read_status, created_at) 
                        VALUES (?, "support", "Support Reply", "You have a new reply from our support team.", "medium", 0, NOW())
                    ');
                    $notifStmt->execute([$targetUserId]);
                } catch (Exception $e) {
                    // Log error but don't fail the message send
                    error_log("Failed to create notification for chat reply: " . $e->getMessage());
                }
            }
        } else {
            // Notify all Admin and Employee users about new client message
            $userStmt = $pdo->query("
                SELECT DISTINCT u.id FROM users u 
                JOIN user_roles ur ON u.id = ur.user_id 
                JOIN roles r ON ur.role_id = r.id 
                WHERE r.name IN ('Admin', 'Employee') AND u.is_active = 1
            ");
            $adminUsers = $userStmt->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($adminUsers as $adminUser) {
                try {
                    $notifStmt = $pdo->prepare('
                        INSERT INTO notifications (user_id, type, title, message, priority, read_status, created_at) 
                        VALUES (?, "support", "New Client Message", ?, "high", 0, NOW())
                    ');
                    $notifStmt->execute([
                        $adminUser['id'],
                        "New message in chat session #$session_id"
                    ]);
                } catch (Exception $e) {
                    error_log("Failed to create notification for client message: " . $e->getMessage());
                }
            }
        }
        
        respond(['success' => true, 'session_id' => $session_id]);
        
    } catch (Exception $e) {
        respond(['error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

// Resolve a chat session and add a system message
if ($method === 'POST' && isset($_GET['resolve'])) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $session_id = intval($input['session_id'] ?? 0);
        $resolution_notes = $input['resolution_notes'] ?? null;
        
        if (!$session_id) {
            respond(['error' => 'Invalid session_id'], 400);
        }
        
        $stmt = $pdo->prepare('
            UPDATE chat_sessions 
            SET status = "resolved", resolution_notes = ?, updated_at = NOW() 
            WHERE id = ?
        ');
        $stmt->execute([$resolution_notes, $session_id]);
        
        // Add system message
        $stmt = $pdo->prepare('
            INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
            VALUES (?, "admin", "This chat session has been marked as resolved. Thank you for contacting SIMS Support!", "system", "unread")
        ');
        $stmt->execute([$session_id]);
        
        respond(['success' => true, 'message' => 'Chat session resolved successfully']);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to resolve chat: ' . $e->getMessage()], 500);
    }
}

// Reopen a chat session and add a system message
if ($method === 'POST' && isset($_GET['reopen'])) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $session_id = intval($input['session_id'] ?? 0);
        
        if (!$session_id) {
            respond(['error' => 'Invalid session_id'], 400);
        }
        
        $stmt = $pdo->prepare('
            UPDATE chat_sessions 
            SET status = "open", updated_at = NOW() 
            WHERE id = ?
        ');
        $stmt->execute([$session_id]);
        
        // Add system message
        $stmt = $pdo->prepare('
            INSERT INTO chat_messages (session_id, sender, message, message_type, read_status) 
            VALUES (?, "admin", "This chat session has been reopened.", "system", "unread")
        ');
        $stmt->execute([$session_id]);
        
        respond(['success' => true, 'message' => 'Chat session reopened successfully']);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to reopen chat: ' . $e->getMessage()], 500);
    }
}

// Delete a message (admin only)
if ($method === 'POST' && isset($_GET['delete_message'])) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $message_id = intval($input['message_id'] ?? 0);
        
        if (!$message_id) {
            respond(['error' => 'Invalid message_id'], 400);
        }
        
        $stmt = $pdo->prepare('DELETE FROM chat_messages WHERE id = ?');
        $stmt->execute([$message_id]);
        
        respond(['success' => true, 'message' => 'Message deleted successfully']);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to delete message: ' . $e->getMessage()], 500);
    }
}

// Delete a chat session (admin only)
if ($method === 'POST' && isset($_GET['delete_session'])) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $session_id = intval($input['session_id'] ?? 0);
        
        if (!$session_id) {
            respond(['error' => 'Invalid session_id'], 400);
        }
        
        $stmt = $pdo->prepare('DELETE FROM chat_sessions WHERE id = ?');
        $stmt->execute([$session_id]);
        
        respond(['success' => true, 'message' => 'Chat session deleted successfully']);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to delete session: ' . $e->getMessage()], 500);
    }
}

// Update chat priority with validation
if ($method === 'POST' && isset($_GET['update_priority'])) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $session_id = intval($input['session_id'] ?? 0);
        $priority = $input['priority'] ?? 'normal';
        
        if (!$session_id) {
            respond(['error' => 'Invalid session_id'], 400);
        }
        
        if (!in_array($priority, ['low', 'normal', 'high', 'urgent'])) {
            respond(['error' => 'Invalid priority level'], 400);
        }
        
        $stmt = $pdo->prepare('UPDATE chat_sessions SET priority = ? WHERE id = ?');
        $stmt->execute([$priority, $session_id]);
        
        respond(['success' => true, 'message' => 'Priority updated successfully']);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to update priority: ' . $e->getMessage()], 500);
    }
}

// Get unread count for user (client-facing)
if ($method === 'GET' && isset($_GET['unread_count'])) {
    try {
        $user_id = intval($_GET['user_id'] ?? 0);
        
        if (!$user_id) {
            respond(['error' => 'Invalid user_id'], 400);
        }
        
        $count = getUnreadCount($user_id);
        respond(['success' => true, 'unread_count' => $count]);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to get unread count: ' . $e->getMessage()], 500);
    }
}

// Check user chat permissions and echo capability flags
if ($method === 'GET' && isset($_GET['check_permissions'])) {
    try {
        $user = getUserFromToken();
        
        if (!$user) {
            respond(['success' => true, 'hasPermission' => false, 'canRead' => false, 'canWrite' => false]);
        }
        
        $hasRead = hasChatPermission($user, 'read');
        $hasWrite = hasChatPermission($user, 'write');
        
        respond([
            'success' => true, 
            'hasPermission' => $hasRead || $hasWrite,
            'canRead' => $hasRead,
            'canWrite' => $hasWrite,
            'user' => $user
        ]);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to check permissions: ' . $e->getMessage()], 500);
    }
}

// Update last seen timestamp for user and session
if ($method === 'POST' && isset($_GET['update_last_seen'])) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $user_id = intval($input['user_id'] ?? 0);
        $session_id = intval($input['session_id'] ?? 0);
        
        if (!$user_id || !$session_id) {
            respond(['error' => 'Invalid user_id or session_id'], 400);
        }
        
        // Update or insert last seen timestamp with session_id
        $stmt = $pdo->prepare('INSERT INTO last_seen_chat (user_id, session_id, last_seen_at) VALUES (?, ?, NOW()) 
                              ON DUPLICATE KEY UPDATE last_seen_at = NOW()');
        $stmt->execute([$user_id, $session_id]);
        
        respond(['success' => true]);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to update last seen: ' . $e->getMessage()], 500);
    }
}

// Get online support agent count (recent last_login)
if ($method === 'GET' && isset($_GET['support_agents'])) {
    try {
        // Count active admins and employees who can access chat
        $stmt = $pdo->query("
            SELECT COUNT(DISTINCT u.id) as agent_count
            FROM users u 
            JOIN user_roles ur ON u.id = ur.user_id 
            JOIN roles r ON ur.role_id = r.id 
            WHERE r.name IN ('Admin', 'Employee') 
            AND u.is_active = 1
            AND u.last_login > DATE_SUB(NOW(), INTERVAL 30 MINUTE)
        ");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        respond(['success' => true, 'online_agents' => $result['agent_count'] ?? 0]);
        
    } catch (Exception $e) {
        respond(['error' => 'Failed to get agent count: ' . $e->getMessage()], 500);
    }
}

// Fallback: 404 for unknown endpoint
respond(['error' => 'Invalid endpoint'], 404); 