<?php
// Debug utility to read the latest OTP for a given email
require_once __DIR__ . '/backend/config/database.php';

header('Content-Type: application/json');

try {
    $pdo = get_db_connection();
    $email = isset($_GET['email']) ? trim($_GET['email']) : '';
    if ($email === '') {
        http_response_code(400);
        echo json_encode(['error' => 'email query param required']);
        exit;
    }
    $stmt = $pdo->prepare("SELECT id, email, purpose, code, expires_at, consumed_at, created_at FROM otp_codes WHERE email = ? ORDER BY id DESC LIMIT 1");
    $stmt->execute([$email]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'no otp found']);
        exit;
    }
    echo json_encode(['otp' => $row]);
} catch (Throwable $t) {
    http_response_code(500);
    echo json_encode(['error' => $t->getMessage()]);
}
?>


