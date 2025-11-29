<?php
// Email Test endpoint
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
    
    // Test email configuration
    $mailConfig = [
        'host' => env('MAIL_HOST', ''),
        'user' => env('GMAIL_USER', ''),
        'auth' => env('MAIL_AUTH', ''),
        'from_address' => env('MAIL_FROM_ADDRESS', ''),
        'from_name' => env('MAIL_FROM_NAME', '')
    ];
    
    // Test sending email
    $subject = 'SIMS Email Test - ' . date('Y-m-d H:i:s');
    $htmlBody = "
    <h2>SIMS Email Test</h2>
    <p>This is a test email to verify email functionality.</p>
    <p>Time: " . date('Y-m-d H:i:s') . "</p>
    <p>If you receive this email, the email system is working correctly.</p>
    ";
    $altBody = "SIMS Email Test - Time: " . date('Y-m-d H:i:s');
    
    $result = sendMailGmail($testEmail, $subject, $htmlBody, $altBody);
    
    if ($result['success']) {
        echo json_encode([
            'status' => 'success',
            'message' => 'Email sent successfully',
            'email' => $testEmail,
            'mail_config' => $mailConfig,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Failed to send email',
            'error' => $result['error'] ?? 'Unknown error',
            'email' => $testEmail,
            'mail_config' => $mailConfig
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Email Test Failed',
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
?>
