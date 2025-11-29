<?php
// Local development mail configuration
// This is used when running on localhost

function get_local_mail_config() {
    return [
        'MAIL_AUTH' => 'gmail_password',
        'GMAIL_USER' => 'kenniellmart@gmail.com',
        'GMAIL_APP_PASSWORD' => 'omnzxwikrmmqcfys',
        'MAIL_HOST' => 'smtp.gmail.com',
        'MAIL_PORT' => '587',
        'MAIL_ENCRYPTION' => 'tls',
        'MAIL_FROM_ADDRESS' => 'kenniellmart@gmail.com',
        'MAIL_FROM_NAME' => 'SIMS1',
        'MAIL_FAKE' => '0', // Disable fake sending to actually send emails
        'OTP_SEND_ALWAYS' => '1', // Always send OTP even if user existence check fails (dev only)
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
