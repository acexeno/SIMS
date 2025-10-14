<?php
// this file has all the authentication functions
// it's included by the main router (index.php) and doesn't handle routing itself

// note: error reporting, database connection ($pdo), and JWT helpers are handled by the main index.php router

// user registration
function handleRegister($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // check that all required fields are present
    $required = ['username', 'email', 'password', 'first_name', 'last_name'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    // Check for emojis in text fields
    $textFields = [
        'username' => 'Username',
        'first_name' => 'First name',
        'last_name' => 'Last name',
        'email' => 'Email',
        'phone' => 'Phone',
        'country' => 'Country'
    ];
    
    foreach ($textFields as $field => $label) {
        if (!empty($input[$field]) && preg_match('/[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}\x{1F900}-\x{1F9FF}]/u', $input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "$label should not contain emojis"]);
            return;
        }
    }
    
    // check if the email format is valid
    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        return;
    }
    
    // Enforce OTP for registration (server-side)
    // Requires client to pass { email, otp_code } previously requested with purpose='register'
    $otpCode = isset($input['otp_code']) ? trim((string)$input['otp_code']) : '';
    if ($otpCode === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Verification code is required']);
        return;
    }

    // Ensure OTP table exists and verify latest unconsumed, unexpired code for this email and purpose='register'
    if (function_exists('ensureOtpSchema')) {
        try { ensureOtpSchema($pdo); } catch (Throwable $t) { /* ignore */ }
    }

    try {
        $stmt = $pdo->prepare("SELECT id, code, expires_at, consumed_at FROM otp_codes
                               WHERE email = ? AND purpose = 'register' AND consumed_at IS NULL AND expires_at >= NOW()
                               ORDER BY id DESC LIMIT 1");
        $stmt->execute([$input['email']]);
        $row = $stmt->fetch();

        if (!$row || !hash_equals($row['code'], $otpCode)) {
            // best-effort: increment attempt count for telemetry on latest row for this email/purpose
            try {
                $inc = $pdo->prepare("UPDATE otp_codes SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE email = ? AND purpose = 'register' ORDER BY id DESC LIMIT 1");
                $inc->execute([$input['email']]);
            } catch (Throwable $t) { /* ignore */ }
            http_response_code(400);
            echo json_encode(['error' => 'Invalid or expired verification code']);
            return;
        }

        // Mark the OTP as consumed now to prevent reuse
        $upd = $pdo->prepare("UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?");
        $upd->execute([$row['id']]);
    } catch (Throwable $t) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to verify verification code']);
        return;
    }

    // check if username or email already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$input['username'], $input['email']]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Username or email already exists']);
        return;
    }
    
    // Validate password strength
    $passwordErrors = validatePasswordStrength($input['password']);
    if (!empty($passwordErrors)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password does not meet requirements', 'details' => $passwordErrors]);
        return;
    }
    
    // hash the password for security
    $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
    
    // add the new user to the database
    $stmt = $pdo->prepare("
        INSERT INTO users (username, email, password_hash, first_name, last_name, phone, country) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $input['username'],
        $input['email'],
        $passwordHash,
        $input['first_name'],
        $input['last_name'],
        $input['phone'] ?? null,
        $input['country'] ?? 'Philippines'
    ]);
    
    $userId = $pdo->lastInsertId();
    
    // give them the default Client role
    $stmt = $pdo->prepare("SELECT id FROM roles WHERE name = 'Client'");
    $stmt->execute();
    $role = $stmt->fetch();
    
    if ($role) {
        $stmt = $pdo->prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
        $stmt->execute([$userId, $role['id']]);
    }
    
    // create tokens for the new user
    $token = generateJWT($userId, $input['username'], ['Client']);
    $refreshToken = generateRefreshJWT($userId, $input['username'], ['Client']);
    
    echo json_encode([
        'success' => true,
        'message' => 'User registered successfully',
        'token' => $token,
        'refresh_token' => $refreshToken,
        'user' => [
            'id' => $userId,
            'username' => $input['username'],
            'email' => $input['email'],
            'first_name' => $input['first_name'],
            'last_name' => $input['last_name'],
            'roles' => ['Client']
        ]
    ]);
}

// user login
function handleLogin($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['username']) || empty($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }
    
    $username = sanitizeInput($input['username'], 'string');
    $password = $input['password'];
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Check if IP is blocked
    if (isIPBlocked($pdo, $ipAddress)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied. IP address is blocked.']);
        return;
    }
    
    // Rate limiting disabled for development
    // if (!checkLoginRateLimit($pdo, $username, (int)env('LOGIN_MAX_ATTEMPTS', 5), (int)env('LOGIN_LOCKOUT_TIME', 900))) {
    //     http_response_code(429);
    //     echo json_encode(['error' => 'Too many login attempts. Please try again later.']);
    //     return;
    // }
    
    // get user info along with their roles
    $stmt = $pdo->prepare("
        SELECT u.*, GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.username = ? OR u.email = ?
        GROUP BY u.id
    ");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();
    
    $loginSuccess = false;
    
    if ($user && password_verify($password, $user['password_hash'])) {
        if ($user['is_active']) {
            $loginSuccess = true;
        } else {
            // Record failed attempt for inactive account
            recordLoginAttempt($pdo, $username, $ipAddress, false);
            logSecurityEvent($pdo, 'login_failed_inactive', "Attempted login to inactive account: $username", $user['id'], $ipAddress);
            http_response_code(403);
            echo json_encode(['error' => 'Account is deactivated']);
            return;
        }
    }
    
    // Record login attempt
    recordLoginAttempt($pdo, $username, $ipAddress, $loginSuccess);
    
    if (!$loginSuccess) {
        logSecurityEvent($pdo, 'login_failed', "Failed login attempt for: $username", null, $ipAddress);
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password']);
        return;
    }
    
    // Log successful login
    logSecurityEvent($pdo, 'login_success', "Successful login for: $username", $user['id'], $ipAddress);
    
    // Update last login
    $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->execute([$user['id']]);
    
    // Parse roles
    $roles = $user['roles'] ? explode(',', $user['roles']) : [];
    
    // Generate tokens
    $token = generateJWT($user['id'], $user['username'], $roles);
    $refreshToken = generateRefreshJWT($user['id'], $user['username'], $roles);
    
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'token' => $token,
        'refresh_token' => $refreshToken,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'roles' => $roles,
            'profile_image' => $user['profile_image'],
            'last_login' => $user['last_login']
        ]
    ]);
}

// Get User Profile
function handleGetProfile($pdo) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = verifyJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $stmt = $pdo->prepare("
        SELECT u.*, GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = ?
        GROUP BY u.id
    ");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    // Remove sensitive data
    unset($user['password_hash']);
    
    $roles = $user['roles'] ? explode(',', $user['roles']) : [];
    
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'first_name' => $user['first_name'],
            'last_name' => $user['last_name'],
            'phone' => $user['phone'],
            'country' => $user['country'],
            'profile_image' => $user['profile_image'],
            'created_at' => $user['created_at'],
            'last_login' => $user['last_login'],
            'roles' => $roles,
            'can_access_inventory' => 1,
            'can_access_orders' => 1,
            'can_access_chat_support' => 1
        ]
    ]);
}

// Update User Profile
function handleUpdateProfile($pdo) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = verifyJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Fields that can be updated
    $allowed_fields = ['first_name', 'last_name', 'phone', 'country', 'profile_image'];
    $update_fields = [];
    $update_values = [];
    
    foreach ($allowed_fields as $field) {
        if (isset($input[$field])) {
            $update_fields[] = "$field = ?";
            $update_values[] = $input[$field];
        }
    }
    
    if (empty($update_fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No fields to update']);
        return;
    }
    
    $update_values[] = $payload['user_id'];
    
    $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $update_fields) . " WHERE id = ?");
    $stmt->execute($update_values);
    
    // Fetch updated user data to return
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch();
    unset($user['password_hash']);
    
    echo json_encode([
        'success' => true,
        'message' => 'Profile updated successfully',
        'user' => $user
    ]);
}

// Change User Password
function handleChangePassword($pdo) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = verifyJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['current_password']) || empty($input['new_password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Current and new passwords are required']);
        return;
    }
    
    if (strlen($input['new_password']) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'New password must be at least 6 characters long']);
        return;
    }
    
    // Verify current password
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($input['current_password'], $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid current password']);
        return;
    }
    
    // Update with new password
    $newPasswordHash = password_hash($input['new_password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$newPasswordHash, $payload['user_id']]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Password changed successfully'
    ]);
}

// Verify Token Endpoint
function handleVerifyToken($pdo) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = verifyJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired token']);
        return;
    }

    // Optionally, you can re-fetch user data to ensure they still exist and are active
    $stmt = $pdo->prepare("SELECT is_active FROM users WHERE id = ?");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) {
        http_response_code(401);
        echo json_encode(['error' => 'User not found or is deactivated']);
        return;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Token is valid',
        'payload' => $payload
    ]);
}

// User Logout
function handleLogout() {
    // For JWT, logout is typically handled on the client-side by deleting the token.
    // This endpoint can be used for server-side logging or token blocklisting if implemented.
    echo json_encode([
        'success' => true,
        'message' => 'Logged out successfully'
    ]);
}

// Refresh Token
function handleRefreshToken($pdo) {
    // Accept refresh token via JSON body { refresh_token }, Authorization: Bearer <token>, or X-Refresh-Token header
    $input = json_decode(file_get_contents('php://input'), true);
    $refresh = null;
    if (is_array($input) && !empty($input['refresh_token'])) {
        $refresh = trim($input['refresh_token']);
    }
    if (!$refresh) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null);
        if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $m)) {
            $refresh = $m[1];
        }
    }
    if (!$refresh) {
        $refresh = $_SERVER['HTTP_X_REFRESH_TOKEN'] ?? null;
    }

    if (!$refresh) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No refresh token provided']);
        return;
    }

    $payload = verifyRefreshJWT($refresh);
    if (!$payload || !isset($payload['user_id'])) {
        http_response_code(401);
        error_log("Refresh token verification failed: " . ($payload ? 'Invalid payload' : 'Token verification failed'));
        echo json_encode(['success' => false, 'error' => 'Invalid or expired refresh token']);
        return;
    }

    // Ensure user still exists and is active; also get current roles
    $stmt = $pdo->prepare("SELECT u.*, GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = ?
        GROUP BY u.id");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active']) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'User not found or deactivated']);
        return;
    }

    $roles = $user['roles'] ? explode(',', $user['roles']) : [];
    $newAccess = generateJWT($user['id'], $user['username'], $roles);
    // Rotate refresh token to reduce replay risk
    $newRefresh = generateRefreshJWT($user['id'], $user['username'], $roles);

    // Log successful refresh for debugging
    error_log("Token refresh successful for user: " . $user['username'] . " (ID: " . $user['id'] . ")");

    echo json_encode([
        'success' => true,
        'token' => $newAccess,
        'refresh_token' => $newRefresh
    ]);
}

// Helper function to get bearer token
function getBearerToken() {
    // CRITICAL FIX: Prioritize query parameter for retry scenarios where frontend sends fresh token
    // This ensures that when frontend retries with a new token, we use the new one, not cached headers
    
    // 1) Query parameter (highest priority for retries)
    if (isset($_GET['token']) && !empty($_GET['token'])) {
        $token = trim($_GET['token']);
        if (!empty($token)) {
            return $token;
        }
    }

    // 2) Standard Authorization header
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $m)) {
        return $m[1];
    }

    // 3) Apache often forwards as REDIRECT_HTTP_AUTHORIZATION
    $redirAuth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null;
    if ($redirAuth && preg_match('/Bearer\s+(\S+)/i', $redirAuth, $m)) {
        return $m[1];
    }

    // 4) Fallback to getallheaders() (case-insensitive)
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $key => $val) {
                if (strcasecmp($key, 'Authorization') === 0) {
                    if (preg_match('/Bearer\s+(\S+)/i', $val, $m)) {
                        return $m[1];
                    } elseif (trim($val) !== '') {
                        return trim(preg_replace('/^Bearer\s+/i', '', $val));
                    }
                }
            }
        }
    }

    // 5) Custom header X-Auth-Token
    $xAuthToken = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? null;
    if ($xAuthToken) {
        return $xAuthToken;
    }

    // 6) JSON body field { "token": "..." }
    $input = json_decode(file_get_contents('php://input'), true);
    if (is_array($input) && isset($input['token']) && !empty($input['token'])) {
        return $input['token'];
    }

    return null;
}

function handleUpdateInventoryAccess($pdo) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    if (!$authHeader) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authorization header missing']);
        return;
    }
    $token = str_replace('Bearer ', '', $authHeader);
    $decoded = verifyJWT($token);
    if (!$decoded || !isset($decoded['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid token']);
        return;
    }
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    if (!in_array('Super Admin', $roles)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        return;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;
    $canAccess = isset($input['can_access_inventory']) ? (int)$input['can_access_inventory'] : null;
    if (!$userId || !in_array($canAccess, [0, 1], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input']);
        return;
    }

    // Update and check affected rows
    $stmt = $pdo->prepare("UPDATE users SET can_access_inventory = ? WHERE id = ?");
    $stmt->execute([$canAccess, $userId]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found or value not changed']);
        return;
    }

    // Fetch and return the updated value for confirmation
    $stmt = $pdo->prepare("SELECT can_access_inventory FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $updated = $stmt->fetch();
    echo json_encode([
        'success' => true,
        'can_access_inventory' => isset($updated['can_access_inventory']) ? (int)$updated['can_access_inventory'] : null
    ]);
}

function handleUpdateOrderAccess($pdo) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    if (!$authHeader) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authorization header missing']);
        return;
    }
    $token = str_replace('Bearer ', '', $authHeader);
    $decoded = verifyJWT($token);
    if (!$decoded || !isset($decoded['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid token']);
        return;
    }
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    if (!in_array('Super Admin', $roles)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        return;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;
    $canAccess = isset($input['can_access_orders']) ? (int)$input['can_access_orders'] : null;
    if (!$userId || !in_array($canAccess, [0, 1], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input']);
        return;
    }
    $stmt = $pdo->prepare("UPDATE users SET can_access_orders = ? WHERE id = ?");
    $stmt->execute([$canAccess, $userId]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found or value not changed']);
        return;
    }
    $stmt = $pdo->prepare("SELECT can_access_orders FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $updated = $stmt->fetch();
    echo json_encode([
        'success' => true,
        'can_access_orders' => isset($updated['can_access_orders']) ? (int)$updated['can_access_orders'] : null
    ]);
}

function handleUpdateChatSupportAccess($pdo) {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    if (!$authHeader) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authorization header missing']);
        return;
    }
    $token = str_replace('Bearer ', '', $authHeader);
    $decoded = verifyJWT($token);
    if (!$decoded || !isset($decoded['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid token']);
        return;
    }
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    if (!in_array('Super Admin', $roles)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Forbidden']);
        return;
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;
    $canAccess = isset($input['can_access_chat_support']) ? (int)$input['can_access_chat_support'] : null;
    if (!$userId || !in_array($canAccess, [0, 1], true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input']);
        return;
    }

    // Update and check affected rows
    $stmt = $pdo->prepare("UPDATE users SET can_access_chat_support = ? WHERE id = ?");
    $stmt->execute([$canAccess, $userId]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found or value not changed']);
        return;
    }

    // Fetch and return the updated value for confirmation
    $stmt = $pdo->prepare("SELECT can_access_chat_support FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $updated = $stmt->fetch();
    echo json_encode([
        'success' => true,
        'can_access_chat_support' => isset($updated['can_access_chat_support']) ? (int)$updated['can_access_chat_support'] : null
    ]);
}
?> 