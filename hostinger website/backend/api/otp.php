<?php
// OTP endpoints: request and verify
// - Auto-creates DB table on first use
// - Rate limits requests per email/purpose
// - Sends codes via Gmail using PHPMailer (see backend/utils/mailer.php)

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../utils/mailer.php';

// Include reCAPTCHA helper if it exists
if (file_exists(__DIR__ . '/../utils/recaptcha_helper.php')) {
    require_once __DIR__ . '/../utils/recaptcha_helper.php';
}

function ensureOtpSchema(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS otp_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        email VARCHAR(255) NOT NULL,
        purpose VARCHAR(64) NOT NULL DEFAULT 'generic',
        code VARCHAR(16) NOT NULL,
        attempt_count INT NOT NULL DEFAULT 0,
        last_attempt_at DATETIME NULL,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email_purpose_consumed (email, purpose, consumed_at),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    // Non-breaking schema hardening: track requester IP for rate limiting (MySQL 8+ supports IF NOT EXISTS)
    try { $pdo->exec("ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS requester_ip VARCHAR(64) NULL, ADD INDEX IF NOT EXISTS idx_ip_created (requester_ip, created_at)"); } catch (Throwable $t) { /* ignore if not supported */ }
}

function findUserByEmail(PDO $pdo, string $email): ?array {
    try {
        $stmt = $pdo->prepare("SELECT id, username, email FROM users WHERE UPPER(email) = UPPER(?) LIMIT 1");
        $stmt->execute([$email]);
        $u = $stmt->fetch(PDO::FETCH_ASSOC);
        return $u ?: null;
    } catch (Throwable $t) {
        return null;
    }
}

/**
 * Helper function to send OTP for post-login verification.
 * Can be called from auth.php after password verification.
 * Returns [bool success, string|null error, array|null data]
 */
function sendLoginVerificationOtp(PDO $pdo, int $userId, string $email, string $ipAddress = 'unknown'): array {
    $purpose = 'login_verify';
    
    // Ensure OTP schema exists
    ensureOtpSchema($pdo);
    
    // Check if email is Gmail (required for OTP)
    if (!preg_match('/@gmail\.com$/i', $email)) {
        return [false, 'Only Gmail addresses are allowed for OTP verification.', null];
    }
    
    // Rate limiting - check cooldown
    $cooldownSec = (int)env('OTP_REQUEST_COOLDOWN', '60');
    $stmt = $pdo->prepare("SELECT created_at FROM otp_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1");
    $stmt->execute([$email, $purpose]);
    $last = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($last) {
        $lastTs = strtotime($last['created_at']);
        if ($lastTs !== false && (time() - $lastTs) < $cooldownSec) {
            $wait = $cooldownSec - (time() - $lastTs);
            return [false, "Please wait $wait seconds before requesting another code.", null];
        }
    }
    
    // Generate OTP
    try {
        $code = (string)random_int(100000, 999999);
    } catch (Throwable $t) {
        $code = (string)mt_rand(100000, 999999);
    }
    $ttlMin = (int)env('OTP_TTL_MINUTES', '5');
    
    // Insert OTP record
    try {
        $stmt = $pdo->prepare("INSERT INTO otp_codes (user_id, email, purpose, code, expires_at, requester_ip) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)");
        $stmt->execute([$userId, $email, $purpose, $code, $ttlMin, $ipAddress]);
    } catch (Throwable $t) {
        // Fallback when column not present
        $stmt = $pdo->prepare("INSERT INTO otp_codes (user_id, email, purpose, code, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))");
        $stmt->execute([$userId, $email, $purpose, $code, $ttlMin]);
    }
    
    // Send email
    $appName = env('APP_NAME', 'SIMS');
    $subject = "$appName - Sign-in Verification Code";
    $html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
        . '<p>Your sign-in verification code for ' . htmlspecialchars($appName) . ' is:</p>'
        . '<p style="font-size:24px;font-weight:bold;letter-spacing:3px">' . htmlspecialchars($code) . '</p>'
        . '<p>This code will expire in ' . (int)$ttlMin . ' minutes. Please enter this code to complete your sign-in.</p>'
        . '<hr style="border:none;border-top:1px solid #eee" />'
        . '<p style="color:#666">If you did not attempt to sign in, please ignore this email or contact support.</p>'
        . '</div>';
    
    [$ok, $err] = sendMailGmail($email, $subject, $html, 'Your verification code is: ' . $code);
    if (!$ok) {
        error_log('[OTP] Email send failed to ' . $email . ' - ' . $err);
        return [false, 'Failed to send OTP email: ' . $err, null];
    }
    
    return [true, null, ['ttl_minutes' => $ttlMin, 'cooldown_seconds' => $cooldownSec]];
}

function handleOtpRequest(PDO $pdo) {
    // Robust request parsing: JSON, form-encoded, or raw
    $raw = file_get_contents('php://input');
    $input = [];
    if (is_string($raw) && $raw !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $input = $json;
        } else {
            // Try to parse urlencoded key=value pairs from raw body
            $tmp = [];
            parse_str($raw, $tmp);
            if (is_array($tmp) && !empty($tmp)) {
                $input = $tmp;
            }
        }
    }
    // Fallback to $_POST if still empty
    if (empty($input) && !empty($_POST)) {
        $input = $_POST;
    }

    $email = trim((string)($input['email'] ?? ''));
    $purpose = trim((string)($input['purpose'] ?? 'login')); // e.g., 'login', 'register', 'reset_password'
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid email address']);
        return;
    }

    // Restrict OTP to Gmail addresses only
    if (!preg_match('/@gmail\.com$/i', $email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Only Gmail addresses are allowed for OTP.']);
        return;
    }

    ensureOtpSchema($pdo);

    // Whitelist supported purposes to avoid abuse via arbitrary custom values
    $allowedPurposes = ['login', 'login_verify', 'register', 'reset_password'];
    if (!in_array($purpose, $allowedPurposes, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Unsupported OTP purpose']);
        return;
    }

    // Rate limiting
    $cooldownSec = (int)env('OTP_REQUEST_COOLDOWN', '60'); // min seconds between requests
    $maxPerHour = (int)env('OTP_MAX_PER_HOUR', '5');
    $maxPerHourIp = (int)env('OTP_MAX_IP_PER_HOUR', '20');

    // Check last request time for this email/purpose
    $stmt = $pdo->prepare("SELECT created_at FROM otp_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1");
    $stmt->execute([$email, $purpose]);
    $last = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($last) {
        $lastTs = strtotime($last['created_at']);
        if ($lastTs !== false && (time() - $lastTs) < $cooldownSec) {
            $wait = $cooldownSec - (time() - $lastTs);
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => "Please wait $wait seconds before requesting another code."]);
            return;
        }
    }

    // Check number of requests in the past hour
    $stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM otp_codes WHERE email = ? AND purpose = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)");
    $stmt->execute([$email, $purpose]);
    $cnt = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);
    if ($cnt >= $maxPerHour) {
        http_response_code(429);
        echo json_encode(['success' => false, 'error' => 'Too many OTP requests. Try again later.']);
        return;
    }

    // Per-IP rate limit across all emails/purposes
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM otp_codes WHERE requester_ip = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)");
        $stmt->execute([$ip]);
        $ipCnt = (int)($stmt->fetch(PDO::FETCH_ASSOC)['cnt'] ?? 0);
        if ($ipCnt >= $maxPerHourIp) {
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Too many OTP requests from your IP. Try again later.']);
            return;
        }
    } catch (Throwable $t) { /* skip if column not available */ }

    // Purpose-aware anti-abuse: do not send OTPs that cannot be used
    $user = findUserByEmail($pdo, $email);
    $alwaysSend = strtolower((string)env('OTP_SEND_ALWAYS', '0')) === '1' || strtolower((string)env('OTP_SEND_ALWAYS', '0')) === 'true';
    if (!$alwaysSend) {
        if ($purpose === 'login') {
            // Only send login OTP to existing users; otherwise return generic success (no send) to avoid user enumeration and spam
            if (!$user) {
                echo json_encode(['success' => true, 'message' => 'If the account exists, a code has been sent.', 'ttl_minutes' => (int)env('OTP_TTL_MINUTES', '5'), 'cooldown_seconds' => (int)$cooldownSec]);
                return;
            }
        } elseif ($purpose === 'register') {
            // Only send register OTP to non-existing users; otherwise return generic success
            if ($user) {
                echo json_encode(['success' => true, 'message' => 'If the account does not already exist, a code has been sent.', 'ttl_minutes' => (int)env('OTP_TTL_MINUTES', '5'), 'cooldown_seconds' => (int)$cooldownSec]);
                return;
            }
        }
    }

    // Generate OTP
    try {
        $code = (string)random_int(100000, 999999); // 6-digit numeric
    } catch (Throwable $t) {
        $code = (string)mt_rand(100000, 999999);
    }
    $ttlMin = (int)env('OTP_TTL_MINUTES', '5');

    // Link OTP to user when known (login/reset), else null for register
    $userId = $user['id'] ?? null;

    // Insert row
    // Persist OTP with requester IP for audit/rate limiting
    try {
        $stmt = $pdo->prepare("INSERT INTO otp_codes (user_id, email, purpose, code, expires_at, requester_ip) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)");
        $stmt->execute([$userId, $email, $purpose, $code, $ttlMin, $ip]);
    } catch (Throwable $t) {
        // Fallback when column not present
        $stmt = $pdo->prepare("INSERT INTO otp_codes (user_id, email, purpose, code, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))");
        $stmt->execute([$userId, $email, $purpose, $code, $ttlMin]);
    }

    $appName = env('APP_NAME', 'SIMS');
    $subject = "$appName verification code";
    $html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">'
        . '<p>Your verification code for ' . htmlspecialchars($appName) . ' is:</p>'
        . '<p style="font-size:24px;font-weight:bold;letter-spacing:3px">' . htmlspecialchars($code) . '</p>'
        . '<p>This code will expire in ' . (int)$ttlMin . ' minutes. If you did not request this, you can ignore this email.</p>'
        . '<hr style="border:none;border-top:1px solid #eee" />'
        . '<p style="color:#666">Requested for purpose: ' . htmlspecialchars($purpose) . '</p>'
        . '</div>';

    [$ok, $err] = sendMailGmail($email, $subject, $html, 'Your verification code is: ' . $code);
    if (!$ok) {
        error_log('[OTP] Email send failed to ' . $email . ' - ' . $err);
    }

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to send OTP email: ' . $err]);
        return;
    }

    echo json_encode([
        'success' => true,
        'message' => 'OTP sent successfully',
        'ttl_minutes' => (int)$ttlMin,
        'cooldown_seconds' => (int)$cooldownSec
    ]);
}

function handleOtpVerify(PDO $pdo) {
    // Robust request parsing: JSON, form-encoded, or raw
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

    $email = trim((string)($input['email'] ?? ''));
    $purpose = trim((string)($input['purpose'] ?? 'login'));
    
    // Verify reCAPTCHA if token is provided (optional for login_verify since user already passed it during password login)
    if ($purpose !== 'login_verify' && function_exists('validateRecaptcha')) {
        $recaptchaValid = validateRecaptcha($input);
        if (!$recaptchaValid) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'reCAPTCHA verification failed. Please try again.']);
            return;
        }
    }
    $code = trim((string)($input['code'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $code === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Email and code are required']);
        return;
    }

    ensureOtpSchema($pdo);

    // Fetch latest matching unconsumed, unexpired code
    $stmt = $pdo->prepare("SELECT id, user_id, email, purpose, code, expires_at, consumed_at FROM otp_codes
                           WHERE email = ? AND purpose = ? AND consumed_at IS NULL AND expires_at >= NOW()
                           ORDER BY id DESC LIMIT 1");
    $stmt->execute([$email, $purpose]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        // Increment attempts on most recent OTP for telemetry
        $upd = $pdo->prepare("UPDATE otp_codes SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1");
        try { $upd->execute([$email, $purpose]); } catch (Throwable $t) { /* ignore */ }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired code']);
        return;
    }

    if (!hash_equals($row['code'], $code)) {
        $upd = $pdo->prepare("UPDATE otp_codes SET attempt_count = attempt_count + 1, last_attempt_at = NOW() WHERE id = ?");
        try { $upd->execute([$row['id']]); } catch (Throwable $t) { /* ignore */ }
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Incorrect code']);
        return;
    }

    // Mark consumed
    $upd = $pdo->prepare("UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?");
    $upd->execute([$row['id']]);

    // Success; if linked to an existing user, return JWT and full user info (passwordless login or post-login verification)
    if (!empty($row['user_id'])) {
        try {
            $s = $pdo->prepare("SELECT u.*, GROUP_CONCAT(r.name) as roles
                                 FROM users u
                                 LEFT JOIN user_roles ur ON u.id = ur.user_id
                                 LEFT JOIN roles r ON ur.role_id = r.id
                                 WHERE u.id = ?
                                 GROUP BY u.id");
            $s->execute([$row['user_id']]);
            $user = $s->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($user) {
                $roles = $user['roles'] ? explode(',', $user['roles']) : [];
                
                // For login_verify purpose, update last_login and log security event
                if ($purpose === 'login_verify') {
                    try { 
                        $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]); 
                    } catch (Throwable $t) { /* ignore */ }
                    
                    // Log successful login completion
                    if (function_exists('logSecurityEvent')) {
                        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
                        logSecurityEvent($pdo, 'login_success', "Successful login with OTP verification for: " . $user['username'], $user['id'], $ipAddress);
                    }
                } else {
                    // For other purposes (like standalone OTP login), also update last_login
                    try { 
                        $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]); 
                    } catch (Throwable $t) { /* ignore */ }
                }
                
                // Generate tokens
                $token = generateJWT($user['id'], $user['username'], $roles);
                $refreshToken = generateRefreshJWT($user['id'], $user['username'], $roles);
                echo json_encode([
                    'success' => true,
                    'message' => $purpose === 'login_verify' ? 'Sign-in verified successfully' : 'OTP verified',
                    'token' => $token,
                    'refresh_token' => $refreshToken,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'email' => $user['email'],
                        'first_name' => $user['first_name'] ?? null,
                        'last_name' => $user['last_name'] ?? null,
                        'roles' => $roles,
                        'profile_image' => $user['profile_image'] ?? null,
                        'last_login' => $user['last_login'] ?? null
                    ]
                ]);
                return;
            }
        } catch (Throwable $t) { /* ignore and fall through */ }
    }

    // If no user linked, just return success (e.g., for email verification flows)
    echo json_encode(['success' => true, 'message' => 'OTP verified']);
}
