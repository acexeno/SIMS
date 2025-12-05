<?php
// Local development mail configuration
// This is used when running on localhost

function get_local_mail_config() {
    // SECURITY: All credentials should come from .env file
    // This function now reads from environment variables only
    return [
        'MAIL_AUTH' => env('MAIL_AUTH', 'gmail_password'),
        'GMAIL_USER' => env('GMAIL_USER', ''),
        'GMAIL_APP_PASSWORD' => env('GMAIL_APP_PASSWORD', ''),
        'MAIL_HOST' => env('MAIL_HOST', 'smtp.gmail.com'),
        'MAIL_PORT' => env('MAIL_PORT', '587'),
        'MAIL_ENCRYPTION' => env('MAIL_ENCRYPTION', 'tls'),
        'MAIL_FROM_ADDRESS' => env('MAIL_FROM_ADDRESS', ''),
        'MAIL_FROM_NAME' => env('MAIL_FROM_NAME', 'SIMS'),
        'MAIL_FAKE' => env('MAIL_FAKE', '0'),
        'OTP_SEND_ALWAYS' => env('OTP_SEND_ALWAYS', '1'),
    ];
}

// Override environment variables for local development
if (!function_exists('env')) {
    function env($key, $default = null) {
        $config = get_local_mail_config();
        return $config[$key] ?? $default;
    }
} else {
    // Override specific mail variables for local development
    $config = get_local_mail_config();
    foreach ($config as $key => $value) {
        if (env($key, '') === '') {
            $_ENV[$key] = $value;
            putenv($key . '=' . $value);
        }
    }
}
?>
