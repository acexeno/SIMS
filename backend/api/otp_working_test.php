<?php
// Working OTP Test endpoint
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    require_once __DIR__ . '/../config/database.php';
    
    $pdo = get_db_connection();
    
    // Get email from request
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? 'kenniellmart@gmail.com';
    $purpose = $input['purpose'] ?? 'login';
    
    // Basic validation
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Valid email is required']);
        return;
    }
    
    // Check if Gmail
    if (!preg_match('/@gmail\.com$/i', $email)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Only Gmail addresses are allowed for OTP.']);
        return;
    }
    
    // Generate OTP code
    $otpCode = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    
    // Create OTP table if not exists
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
    
    // Insert OTP code
    $stmt = $pdo->prepare("INSERT INTO otp_codes (email, purpose, code, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))");
    $stmt->execute([$email, $purpose, $otpCode]);
    
    echo json_encode([
        'success' => true,
        'message' => 'OTP code generated successfully',
        'otp_code' => $otpCode,
        'email' => $email,
        'purpose' => $purpose,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'OTP test failed: ' . $e->getMessage()
    ]);
}
?>
