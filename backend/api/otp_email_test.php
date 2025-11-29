<?php
// OTP Email Test endpoint
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
    require_once __DIR__ . '/../config/env.php';
    require_once __DIR__ . '/../utils/mailer.php';
    
    $pdo = get_db_connection();
    
    // Get email from request
    $input = json_decode(file_get_contents('php://input'), true);
    $testEmail = $input['email'] ?? 'test@example.com';
    
    // Test sending OTP email
    $otpCode = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
    
    $subject = 'SIMS OTP Test - ' . $otpCode;
    $htmlBody = "
    <h2>SIMS OTP Test</h2>
    <p>Your OTP code is: <strong>{$otpCode}</strong></p>
    <p>This is a test email to verify OTP functionality.</p>
    <p>Time: " . date('Y-m-d H:i:s') . "</p>
    ";
    $altBody = "SIMS OTP Test - Code: {$otpCode}";
    
    // Try to send email
    $result = sendMailGmail($testEmail, $subject, $htmlBody, $altBody);
    
    if ($result['success']) {
        echo json_encode([
            'status' => 'success',
            'message' => 'OTP email sent successfully',
            'email' => $testEmail,
            'otp_code' => $otpCode,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Failed to send OTP email',
            'error' => $result['error'] ?? 'Unknown error',
            'email' => $testEmail
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'OTP Email Test Failed',
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
