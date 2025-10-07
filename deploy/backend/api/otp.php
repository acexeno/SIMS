<?php
// OTP endpoints: request and verify
// - Auto-creates DB table on first use
// - Rate limits requests per email/purpose
// - Sends codes via Gmail using PHPMailer (see backend/utils/mailer.php)

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../utils/mailer.php';

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

function handleOtpRequest(PDO $pdo) {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $email = trim($input['email'] ?? '');
    $purpose = trim($input['purpose'] ?? 'login'); // e.g., 'login', 'register', 'reset_password'

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid email address']);
        return;
    }

    ensureOtpSchema($pdo);

    // Rate limiting
    $cooldownSec = (int)env('OTP_REQUEST_COOLDOWN', '60'); // min seconds between requests
    $maxPerHour = (int)env('OTP_MAX_PER_HOUR', '5');

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

    // Generate OTP
    try {
        $code = (string)random_int(100000, 999999); // 6-digit numeric
    } catch (Throwable $t) {
        $code = (string)mt_rand(100000, 999999);
    }
    $ttlMin = (int)env('OTP_TTL_MINUTES', '5');

    $user = findUserByEmail($pdo, $email);
    $userId = $user['id'] ?? null;

    // Insert row
    $stmt = $pdo->prepare("INSERT INTO otp_codes (user_id, email, purpose, code, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))");
    $stmt->execute([$userId, $email, $purpose, $code, $ttlMin]);

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
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to send OTP email: ' . $err]);
        return;
    }

    echo json_encode(['success' => true, 'message' => 'OTP sent successfully']);
}

function handleOtpVerify(PDO $pdo) {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $email = trim($input['email'] ?? '');
    $purpose = trim($input['purpose'] ?? 'login');
    $code = trim($input['code'] ?? '');

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

    // Success; if linked to an existing user, return JWT and full user info (passwordless login)
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
                // Update last_login
                try { $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?")->execute([$user['id']]); } catch (Throwable $t) { /* ignore */ }
                // Generate JWT
                $token = generateJWT($user['id'], $user['username'], $roles);
                echo json_encode([
                    'success' => true,
                    'message' => 'OTP verified',
                    'token' => $token,
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
