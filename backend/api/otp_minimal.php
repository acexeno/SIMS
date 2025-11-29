<?php
// Minimal OTP handler for debugging
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Get request data
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';
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
    
    // For now, just return success without sending email
    echo json_encode([
        'success' => true,
        'message' => 'OTP code generated (email sending disabled for testing)',
        'otp_code' => $otpCode,
        'email' => $email,
        'purpose' => $purpose,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'OTP request failed: ' . $e->getMessage()
    ]);
}
?>
