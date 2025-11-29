<?php
// Hostinger production mail configuration
// This file loads mail configuration from .env for production environment
// The .env file should contain all necessary mail settings

// Note: This file is optional - if mail credentials are not in .env,
// the mailer will use default values from env() function calls
// All mail configuration is read from .env file via env() function

// For production, we rely on .env configuration:
// - MAIL_HOST (default: smtp.hostinger.com)
// - MAIL_PORT (default: 587)
// - MAIL_ENCRYPTION (default: tls)
// - MAIL_FROM_ADDRESS
// - MAIL_FROM_NAME
// - MAIL_AUTH (gmail_password or gmail_oauth)
// - GMAIL_USER (if using Gmail)
// - GMAIL_APP_PASSWORD (if using Gmail app password)
// - MAIL_USERNAME (legacy)
// - MAIL_PASSWORD (legacy)

// This file exists to satisfy the require_once in mailer.php
// All actual configuration comes from .env via the env() function
// No additional configuration needed here

// If you need to override specific values for production, you can do so here:
// But it's recommended to use .env file instead

// Example override (uncomment if needed):
// if (function_exists('env')) {
//     $_ENV['MAIL_HOST'] = 'smtp.hostinger.com';
//     putenv('MAIL_HOST=smtp.hostinger.com');
// }

?>

