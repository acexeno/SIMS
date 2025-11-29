<?php
/**
 * reCAPTCHA verification helper for backend
 * Handles server-side verification of reCAPTCHA tokens
 */

/**
 * Verify reCAPTCHA token with Google's API
 * @param string $token - The reCAPTCHA token from the client
 * @param string $secretKey - The reCAPTCHA secret key (from environment)
 * @param string|null $remoteIp - The user's IP address (optional)
 * @return array - ['success' => bool, 'score' => float|null, 'error' => string|null]
 */
function verifyRecaptcha($token, $secretKey = null, $remoteIp = null) {
    if (empty($token)) {
        return ['success' => false, 'score' => null, 'error' => 'No reCAPTCHA token provided'];
    }

    // Get secret key from environment if not provided
    if ($secretKey === null) {
        $secretKey = env('RECAPTCHA_SECRET_KEY', '');
    }

    if (empty($secretKey)) {
        // If secret key is not configured, return success to allow graceful degradation
        error_log('Warning: RECAPTCHA_SECRET_KEY is not configured. Skipping reCAPTCHA verification.');
        return ['success' => true, 'score' => null, 'error' => null];
    }

    // Get user's IP if not provided
    if ($remoteIp === null) {
        $remoteIp = $_SERVER['REMOTE_ADDR'] ?? null;
        // Handle proxy/load balancer headers
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $remoteIp = trim($ips[0]);
        }
    }

    // Prepare verification request
    $url = 'https://www.google.com/recaptcha/api/siteverify';
    $data = [
        'secret' => $secretKey,
        'response' => $token,
    ];
    
    if ($remoteIp) {
        $data['remoteip'] = $remoteIp;
    }

    // Make request to Google's API
    $options = [
        'http' => [
            'header' => "Content-type: application/x-www-form-urlencoded\r\n",
            'method' => 'POST',
            'content' => http_build_query($data),
            'timeout' => 5,
        ],
    ];

    $context = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);

    if ($result === false) {
        error_log('reCAPTCHA verification failed: Unable to connect to Google API');
        // Return success on connection failure to allow graceful degradation
        return ['success' => true, 'score' => null, 'error' => 'Verification service unavailable'];
    }

    $response = json_decode($result, true);

    if (!$response) {
        error_log('reCAPTCHA verification failed: Invalid JSON response');
        return ['success' => false, 'score' => null, 'error' => 'Invalid verification response'];
    }

    // Check if verification was successful
    if (isset($response['success']) && $response['success'] === true) {
        // For reCAPTCHA v3, check the score (0.0 to 1.0)
        // Lower scores indicate a bot, higher scores indicate a human
        // For reCAPTCHA v2, score will be null (v2 doesn't provide scores)
        $score = isset($response['score']) ? (float)$response['score'] : null;
        $action = isset($response['action']) ? $response['action'] : null;
        
        // Only check score if it's provided (v3 tokens have scores, v2 tokens don't)
        if ($score !== null) {
            // Minimum score threshold (adjust as needed, 0.5 is a common default)
            $minScore = (float)env('RECAPTCHA_MIN_SCORE', '0.5');
            
            if ($score < $minScore) {
                error_log("reCAPTCHA verification failed: Score too low ($score < $minScore)");
                return ['success' => false, 'score' => $score, 'error' => 'reCAPTCHA verification failed: Suspicious activity detected'];
            }
        }
        // For v2 tokens (no score), if success is true, verification passed

        return ['success' => true, 'score' => $score, 'action' => $action, 'error' => null];
    } else {
        // Get error codes from response
        $errorCodes = isset($response['error-codes']) ? $response['error-codes'] : [];
        $errorMessage = !empty($errorCodes) ? implode(', ', $errorCodes) : 'Verification failed';
        error_log("reCAPTCHA verification failed: $errorMessage");
        return ['success' => false, 'score' => null, 'error' => $errorMessage];
    }
}

/**
 * Validate reCAPTCHA token (wrapper function for easier use)
 * Returns true if verification passes or if reCAPTCHA is not configured
 * @param array $input - The input data containing 'recaptcha_token'
 * @param string $secretKey - Optional secret key override
 * @return bool - True if valid or not configured, false if invalid
 */
function validateRecaptcha($input, $secretKey = null) {
    $token = isset($input['recaptcha_token']) ? trim($input['recaptcha_token']) : '';
    
    // If no token is provided and reCAPTCHA is not configured, allow request
    if (empty($token)) {
        $secretKey = $secretKey ?? env('RECAPTCHA_SECRET_KEY', '');
        if (empty($secretKey)) {
            // reCAPTCHA not configured, allow request
            return true;
        }
        // Token required but not provided
        return false;
    }

    $result = verifyRecaptcha($token, $secretKey);
    return $result['success'];
}

