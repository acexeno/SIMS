<?php
// Simple OTP function test
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    // Test if OTP functions exist
    $functions = [
        'handleOtpRequest' => function_exists('handleOtpRequest'),
        'handleOtpVerify' => function_exists('handleOtpVerify'),
        'ensureOtpSchema' => function_exists('ensureOtpSchema'),
        'findUserByEmail' => function_exists('findUserByEmail')
    ];
    
    // Test if OTP file can be included
    $otpFileExists = file_exists(__DIR__ . '/otp.php');
    $otpFileReadable = is_readable(__DIR__ . '/otp.php');
    
    // Test database connection
    $dbConnected = false;
    $dbError = '';
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = get_db_connection();
        $dbConnected = true;
    } catch (Exception $e) {
        $dbError = $e->getMessage();
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'OTP Function Test',
        'functions' => $functions,
        'otp_file_exists' => $otpFileExists,
        'otp_file_readable' => $otpFileReadable,
        'database_connected' => $dbConnected,
        'database_error' => $dbError,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'OTP Function Test Failed',
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
