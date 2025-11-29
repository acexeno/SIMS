<?php
// OTP Test endpoint for debugging email issues
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Test database connection
    require_once __DIR__ . '/../config/database.php';
    $pdo = get_db_connection();
    
    // Test mail configuration
    require_once __DIR__ . '/../config/env.php';
    require_once __DIR__ . '/../utils/mailer.php';
    
    // Check if mail configuration is loaded
    $mailHost = env('MAIL_HOST', '');
    $mailUser = env('GMAIL_USER', '');
    $mailAuth = env('MAIL_AUTH', '');
    
    // Test OTP table
    $stmt = $pdo->query("SHOW TABLES LIKE 'otp_codes'");
    $otpTableExists = $stmt->rowCount() > 0;
    
    // Test mailer initialization
    $mailerTest = false;
    $mailerError = '';
    try {
        $mailer = buildGmailMailer();
        $mailerTest = true;
    } catch (Exception $e) {
        $mailerError = $e->getMessage();
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'OTP Debug Test',
        'database_connected' => true,
        'otp_table_exists' => $otpTableExists,
        'mail_config' => [
            'host' => $mailHost,
            'user' => $mailUser,
            'auth' => $mailAuth,
            'from_address' => env('MAIL_FROM_ADDRESS', ''),
            'from_name' => env('MAIL_FROM_NAME', '')
        ],
        'mailer_test' => $mailerTest,
        'mailer_error' => $mailerError,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'OTP Debug Test Failed',
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
