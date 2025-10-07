<?php
// Admin-only mail testing endpoint
// POST /backend/api/index.php?endpoint=mail_test
// Body: { "to": "you@example.com", "subject": "Optional", "message": "Optional" }

require_once __DIR__ . '/../utils/mailer.php';
require_once __DIR__ . '/../utils/jwt_helper.php';

function handleMailTest(PDO $pdo) {
    // Verify Admin or Super Admin
    $token = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($token, 'Bearer ') === 0) { $token = substr($token, 7); }
    $decoded = $token ? verifyJWT($token) : null;
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        return;
    }
    $roles = $decoded['roles'] ?? [];
    if (is_string($roles)) $roles = explode(',', $roles);
    if (!(in_array('Admin', $roles) || in_array('Super Admin', $roles))) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $to = trim($input['to'] ?? '');
    if (!$to) {
        // fallback to current user's email
        try {
            $stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
            $stmt->execute([$decoded['user_id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $to = $row['email'] ?? '';
        } catch (Throwable $t) { /* ignore */ }
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No valid recipient email provided']);
        return;
    }

    $subject = $input['subject'] ?? ('[' . env('APP_NAME', 'SIMS') . '] Mail test');
    $msg = $input['message'] ?? 'This is a test email to verify Gmail OAuth2 sending. If you received this, SMTP is working.';

    [$ok, $err] = sendMailGmail($to, $subject, nl2br(htmlspecialchars($msg)), $msg);
    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $err]);
        return;
    }

    echo json_encode(['success' => true, 'message' => 'Test email sent to ' . $to]);
}
