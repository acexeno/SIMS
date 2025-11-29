<?php
/**
 * Authentication handlers: registration, login, profile, token lifecycle.
 * Context: included by `backend/api/index.php` which wires routing and `$pdo`.
 * Security: server validates inputs, enforces OTP on register, and issues JWTs.
 */

// Operational note: error reporting, DB connection ($pdo), and JWT helpers are provided by the main router.

// Include reCAPTCHA helper if it exists
if (file_exists(__DIR__ . '/../utils/recaptcha_helper.php')) {
    require_once __DIR__ . '/../utils/recaptcha_helper.php';
}

/**
 * Handle user registration with OTP verification and initial role assignment.
 * Input: JSON or form body with username, email, password, first_name, last_name, optional phone/country, and otp_code.
 * Output: 200 with JWTs and user summary; 4xx/5xx on validation or DB errors.
 */
function handleRegister($pdo) {
    // Robust body parsing: accept JSON, form-encoded, or raw
    $raw = file_get_contents('php://input');
    $input = [];
    if (is_string($raw) && $raw !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $input = $json;
        } else {
            $tmp = [];
            parse_str($raw, $tmp);
            if (is_array($tmp) && !empty($tmp)) {
                $input = $tmp;
            }
        }
    }
    if (empty($input) && !empty($_POST)) {
        $input = $_POST;
    }
    
    // Verify reCAPTCHA if token is provided
    if (function_exists('validateRecaptcha')) {
        $recaptchaValid = validateRecaptcha($input);
        if (!$recaptchaValid) {
            http_response_code(403);
            echo json_encode(['error' => 'reCAPTCHA verification failed. Please try again.']);
            return;
        }
    }
    
    // Validate required fields early to provide targeted feedback
    $required = ['username', 'email', 'password', 'first_name', 'last_name'];
    foreach ($required as $field) {
        if (empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    // Reject emojis in PII fields to avoid storage/UX inconsistencies
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
    
    // Enforce email format server-side
    if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        return;
    }
    
    // Require OTP previously issued with purpose='register'; blocks scripted signups
    // Super Admin override: allow 'ADMIN_OVERRIDE' when caller is Super Admin
    $otpCode = isset($input['otp_code']) ? trim((string)$input['otp_code']) : '';
    $isAdminOverride = false;
    if ($otpCode === 'ADMIN_OVERRIDE') {
        // Verify caller is Super Admin via bearer token
        $token = getBearerToken();
        if ($token) {
            $payload = verifyJWT($token);
            if ($payload) {
                $roles = $payload['roles'] ?? [];
                if (is_string($roles)) $roles = explode(',', $roles);
                if (in_array('Super Admin', $roles)) {
                    $isAdminOverride = true;
                }
            }
        }
        if (!$isAdminOverride) {
            http_response_code(403);
            echo json_encode(['error' => 'Forbidden: admin override not allowed']);
            return;
        }
    }
    if ($otpCode === '' && !$isAdminOverride) {
        http_response_code(400);
        echo json_encode(['error' => 'Verification code is required']);
        return;
    }

    // Verify latest unconsumed, unexpired OTP for this email and purpose='register'
    if (function_exists('ensureOtpSchema')) {
        try { ensureOtpSchema($pdo); } catch (Throwable $t) { /* ignore */ }
    }

    if (!$isAdminOverride) {
        try {
            // Primary lookup: OTP specifically issued for registration
            $stmt = $pdo->prepare("SELECT id, code, expires_at, consumed_at FROM otp_codes
                                   WHERE email = ? AND purpose = 'register' AND consumed_at IS NULL AND expires_at >= NOW()
                                   ORDER BY id DESC LIMIT 1");
            $stmt->execute([$input['email']]);
            $row = $stmt->fetch();

            // Fallback: support legacy OTP rows saved with a generic/login purpose
            // This avoids \"Invalid or expired\" errors on hosts still using older otp.php logic,
            // while still requiring a recent, unconsumed code for the same email.
            if (!$row) {
                $stmt = $pdo->prepare("SELECT id, code, expires_at, consumed_at FROM otp_codes
                                       WHERE email = ? AND purpose IN ('login', 'login_verify') AND consumed_at IS NULL AND expires_at >= NOW()
                                       ORDER BY id DESC LIMIT 1");
                $stmt->execute([$input['email']]);
                $row = $stmt->fetch();
            }

            if (!$row || !hash_equals($row['code'], $otpCode)) {
                // Increment attempt count for telemetry; do not leak validity details
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
    }

    // Block duplicate username or email
    // Check username
    $stmt = $pdo->prepare("SELECT id, username FROM users WHERE username = ?");
    $stmt->execute([$input['username']]);
    $existingUser = $stmt->fetch();
    if ($existingUser) {
        http_response_code(409);
        echo json_encode([
            'error' => 'Username already exists',
            'details' => "The username '{$input['username']}' is already taken. Please choose a different username."
        ]);
        return;
    }
    
    // Check email
    $stmt = $pdo->prepare("SELECT id, email FROM users WHERE email = ?");
    $stmt->execute([$input['email']]);
    $existingEmail = $stmt->fetch();
    if ($existingEmail) {
        http_response_code(409);
        echo json_encode([
            'error' => 'Email already exists',
            'details' => "The email '{$input['email']}' is already registered. Please use a different email address."
        ]);
        return;
    }
    
    // Enforce password strength policy
    $passwordErrors = validatePasswordStrength($input['password']);
    if (!empty($passwordErrors)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password does not meet requirements', 'details' => $passwordErrors]);
        return;
    }
    
    // Store password using strong, auto-upgrading hash
    $passwordHash = password_hash($input['password'], PASSWORD_DEFAULT);
    
    // Determine if this is admin-created user
    // For Client users, explicitly disable inventory/orders/chat access
    $isAdminOverride = ($otpCode === 'ADMIN_OVERRIDE');
    
    // Get the role to assign (Admin or Employee) if provided and valid
    $requestedRole = isset($input['role']) ? trim((string)$input['role']) : '';
    $validRoles = ['Admin', 'Employee'];
    $roleToAssign = 'Client'; // Default role
    $isAdminOrEmployee = false;
    
    // If ADMIN_OVERRIDE is used and a valid role is provided, assign that role instead of Client
    if ($isAdminOverride && in_array($requestedRole, $validRoles, true)) {
        $roleToAssign = $requestedRole;
        $isAdminOrEmployee = true;
    }
    
    // Insert user record with explicit is_active=1 and proper permissions
    // Clients should NOT have inventory/orders/chat access by default
    // Admin/Employee users should have access by default
    $canAccessInventory = ($isAdminOverride && $isAdminOrEmployee) ? 1 : 0;
    $canAccessOrders = ($isAdminOverride && $isAdminOrEmployee) ? 1 : 0;
    $canAccessChat = ($isAdminOverride && $isAdminOrEmployee) ? 1 : 0;
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO users (username, email, password_hash, first_name, last_name, phone, country, is_active, can_access_inventory, can_access_orders, can_access_chat_support) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ");
        
        $stmt->execute([
            $input['username'],
            $input['email'],
            $passwordHash,
            $input['first_name'],
            $input['last_name'],
            $input['phone'] ?? null,
            $input['country'] ?? 'Philippines',
            $canAccessInventory,
            $canAccessOrders,
            $canAccessChat
        ]);
        
        $userId = $pdo->lastInsertId();
        
        if (!$userId) {
            throw new Exception('Failed to create user record');
        }
        
        // Assign the appropriate role
        // Verify role exists before assignment, create if it doesn't exist
        $stmt = $pdo->prepare("SELECT id FROM roles WHERE name = ?");
        $stmt->execute([$roleToAssign]);
        $role = $stmt->fetch();
        
        if (!$role) {
            // Create role if it doesn't exist
            $stmt = $pdo->prepare("INSERT INTO roles (name) VALUES (?)");
            $stmt->execute([$roleToAssign]);
            $roleId = $pdo->lastInsertId();
            if (!$roleId) {
                throw new Exception('Failed to create role');
            }
        } else {
            $roleId = $role['id'];
        }
        
        // Assign the role
        $stmt = $pdo->prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
        $stmt->execute([$userId, $roleId]);
        
        // Also update the role column in users table for consistency with phpMyAdmin display
        // This ensures the role column matches the assigned role in user_roles table
        try {
            $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
            $stmt->execute([$roleToAssign, $userId]);
        } catch (Exception $roleUpdateException) {
            // If role column doesn't exist or update fails, log but don't break user creation
            // The user_roles table assignment above is the primary role storage
            error_log("Warning: Could not update users.role column: " . $roleUpdateException->getMessage());
        }
        
    } catch (Exception $e) {
        error_log("User registration error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create user account', 'details' => $e->getMessage()]);
        return;
    }
    
    // Issue tokens for immediate sign-in with the correct role
    $assignedRoles = [$roleToAssign];
    $token = generateJWT($userId, $input['username'], $assignedRoles);
    $refreshToken = generateRefreshJWT($userId, $input['username'], $assignedRoles);
    
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
            'roles' => $assignedRoles
        ]
    ]);
}

/**
 * Authenticate user by username/email and password. Records attempts and enforces account status.
 * Output: JWT pair and user profile on success; 401/403/429 on failure or rate limit.
 */
function handleLogin($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (empty($input['username']) || empty($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }
    
    // Verify reCAPTCHA if token is provided
    if (function_exists('validateRecaptcha')) {
        $recaptchaValid = validateRecaptcha($input);
        if (!$recaptchaValid) {
            http_response_code(403);
            echo json_encode(['error' => 'reCAPTCHA verification failed. Please try again.']);
            return;
        }
    }
    
    $username = sanitizeInput($input['username'], 'string');
    $password = $input['password'];
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Enforce IP blocklist if configured
    if (isIPBlocked($pdo, $ipAddress)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied. IP address is blocked.']);
        return;
    }
    
    // Rate limiting placeholder: enable in production to slow brute-force attempts
    // if (!checkLoginRateLimit($pdo, $username, (int)env('LOGIN_MAX_ATTEMPTS', 5), (int)env('LOGIN_LOCKOUT_TIME', 900))) {
    //     http_response_code(429);
    //     echo json_encode(['error' => 'Too many login attempts. Please try again later.']);
    //     return;
    // }
    
    // Fetch user plus roles in one query
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
            // Prevent login to inactive accounts and record event
            recordLoginAttempt($pdo, $username, $ipAddress, false);
            logSecurityEvent($pdo, 'login_failed_inactive', "Attempted login to inactive account: $username", $user['id'], $ipAddress);
            http_response_code(403);
            echo json_encode(['error' => 'Account is deactivated']);
            return;
        }
    } else {
        // Password verification failed or user not found
        $loginSuccess = false;
    }
    
    // Persist login attempt outcome for auditing and rate limits
    recordLoginAttempt($pdo, $username, $ipAddress, $loginSuccess);
    
    if (!$loginSuccess) {
        logSecurityEvent($pdo, 'login_failed', "Failed login attempt for: $username", null, $ipAddress);
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password']);
        return;
    }
    
    // Audit successful password verification (not full login yet - OTP required)
    logSecurityEvent($pdo, 'login_password_verified', "Password verified for: $username", $user['id'], $ipAddress);
    
    // Check if OTP helper function is available (from otp.php)
    if (!function_exists('sendLoginVerificationOtp')) {
        // Fallback: if OTP system not available, issue tokens directly (backward compatibility)
        $roles = $user['roles'] ? explode(',', $user['roles']) : [];
        $token = generateJWT($user['id'], $user['username'], $roles);
        $refreshToken = generateRefreshJWT($user['id'], $user['username'], $roles);
        
        // Persist last login timestamp
        $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$user['id']]);
        
        logSecurityEvent($pdo, 'login_success', "Successful login for: $username", $user['id'], $ipAddress);
        
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
        return;
    }
    
    // Send OTP for verification
    [$otpSuccess, $otpError, $otpData] = sendLoginVerificationOtp($pdo, $user['id'], $user['email'], $ipAddress);
    
    if (!$otpSuccess) {
        // If OTP send fails, log error but don't block login (could be email issue)
        // For now, we'll return error - in production you might want to allow fallback
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $otpError ?: 'Failed to send verification code. Please try again.',
            'requires_otp' => true
        ]);
        return;
    }
    
    // Return success with OTP sent message (no tokens yet)
    echo json_encode([
        'success' => true,
        'message' => 'Verification code sent to your email. Please check your inbox.',
        'requires_otp' => true,
        'email' => $user['email'], // Return email for frontend to use in OTP verification
        'ttl_minutes' => $otpData['ttl_minutes'] ?? 5,
        'cooldown_seconds' => $otpData['cooldown_seconds'] ?? 60
    ]);
}

/**
 * Return authenticated user's profile and roles. Requires valid Bearer token.
 */
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
    
    // Do not expose password hash
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
            'can_access_inventory' => isset($user['can_access_inventory']) ? (int)$user['can_access_inventory'] : 1,
            'can_access_orders' => isset($user['can_access_orders']) ? (int)$user['can_access_orders'] : 1,
            'can_access_chat_support' => isset($user['can_access_chat_support']) ? (int)$user['can_access_chat_support'] : 1
        ]
    ]);
}

/**
 * Update allowed profile fields for the authenticated user.
 * Only whitelisted fields are accepted; rejects empty updates.
 */
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
    
    // Only allow these fields to be changed by users
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
    
    // Return fresh user snapshot
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

/**
 * Change password for the authenticated user after verifying current password.
 */
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
    
    // Validate new password strength using security configuration
    $passwordErrors = validatePasswordStrength($input['new_password']);
    if (!empty($passwordErrors)) {
        http_response_code(400);
        echo json_encode(['error' => 'New password does not meet requirements', 'details' => $passwordErrors]);
        return;
    }
    
    // Verify current password matches stored hash
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
    $stmt->execute([$payload['user_id']]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($input['current_password'], $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid current password']);
        return;
    }
    
    // Store new hash
    $newPasswordHash = password_hash($input['new_password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
    $stmt->execute([$newPasswordHash, $payload['user_id']]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Password changed successfully'
    ]);
}

/**
 * Validate access token and ensure user remains active. Useful for session checks.
 */
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

    // Ensure user still exists and remains active
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

/**
 * Stateless logout acknowledgment for JWT-based auth. Client deletes tokens.
 */
function handleLogout() {
    // For JWT, logout is typically handled on the client-side by deleting the token.
    // This endpoint can be used for server-side logging or token blocklisting if implemented.
    echo json_encode([
        'success' => true,
        'message' => 'Logged out successfully'
    ]);
}

/**
 * Exchange a valid refresh token for a new access token and rotated refresh token.
 * Accepts token via JSON body, Authorization header, or X-Refresh-Token.
 */
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
        error_log("Refresh token endpoint: No refresh token provided");
        echo json_encode(['success' => false, 'error' => 'No refresh token provided']);
        return;
    }

    error_log("Refresh token endpoint: Attempting to verify refresh token");
    $payload = verifyRefreshJWT($refresh);
    if (!$payload || !isset($payload['user_id'])) {
        http_response_code(401);
        error_log("Refresh token verification failed: " . ($payload ? 'Invalid payload' : 'Token verification failed'));
        echo json_encode(['success' => false, 'error' => 'Invalid or expired refresh token']);
        return;
    }

    error_log("Refresh token endpoint: Token verified for user ID " . $payload['user_id']);

    // Ensure user still exists and is active; hydrate current roles
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
        error_log("Refresh token endpoint: User not found or deactivated for ID " . $payload['user_id']);
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

// getBearerToken() function is now defined in jwt_helper.php

/**
 * Super Admin: toggle `can_access_inventory` for a user.
 */
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

    // Update and verify affected rows
    $stmt = $pdo->prepare("UPDATE users SET can_access_inventory = ? WHERE id = ?");
    $stmt->execute([$canAccess, $userId]);
    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'User not found or value not changed']);
        return;
    }

    // Return updated value for confirmation
    $stmt = $pdo->prepare("SELECT can_access_inventory FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $updated = $stmt->fetch();
    echo json_encode([
        'success' => true,
        'can_access_inventory' => isset($updated['can_access_inventory']) ? (int)$updated['can_access_inventory'] : null
    ]);
}

/**
 * Super Admin: toggle `can_access_orders` for a user.
 */
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

/**
 * Super Admin: toggle `can_access_chat_support` for a user.
 */
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