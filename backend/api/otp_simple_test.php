<?php
// Simple OTP Test endpoint
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
    $testEmail = $input['email'] ?? 'kenniellmart@gmail.com';
    
    // Check if email is Gmail
    $isGmail = preg_match('/@gmail\.com$/i', $testEmail);
    
    // Test OTP table
    $stmt = $pdo->query("SHOW TABLES LIKE 'otp_codes'");
    $otpTableExists = $stmt->rowCount() > 0;
    
    // Test mail configuration
    $mailConfig = [
        'host' => env('MAIL_HOST', ''),
        'user' => env('GMAIL_USER', ''),
        'auth' => env('MAIL_AUTH', ''),
        'from_address' => env('MAIL_FROM_ADDRESS', ''),
        'from_name' => env('MAIL_FROM_NAME', '')
    ];
    
    // Test mailer
    $mailerTest = false;
    $mailerError = '';
    try {
        $mailer = buildGmailMailer();
        $mailerTest = true;
    } catch (Exception $e) {
        $mailerError = $e->getMessage();
    }
    
    // Test sending email
    $emailSent = false;
    $emailError = '';
    if ($isGmail && $mailerTest) {
        try {
            $otpCode = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
            $subject = 'SIMS OTP Test - ' . $otpCode;
            $htmlBody = "<h2>SIMS OTP Test</h2><p>Your OTP code is: <strong>{$otpCode}</strong></p>";
            $altBody = "SIMS OTP Test - Code: {$otpCode}";
            
            $result = sendMailGmail($testEmail, $subject, $htmlBody, $altBody);
            $emailSent = $result['success'];
            $emailError = $result['error'] ?? '';
        } catch (Exception $e) {
            $emailError = $e->getMessage();
        }
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'OTP Test Results',
        'test_email' => $testEmail,
        'is_gmail' => $isGmail,
        'otp_table_exists' => $otpTableExists,
        'mail_config' => $mailConfig,
        'mailer_test' => $mailerTest,
        'mailer_error' => $mailerError,
        'email_sent' => $emailSent,
        'email_error' => $emailError,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'OTP Test Failed',
        'error' => $e->getMessage()
    ]);
}
?>
