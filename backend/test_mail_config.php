<?php
// Test mail configuration
require_once __DIR__ . '/config/env.php';

echo "<h2>Mail Configuration Test</h2>";

echo "<h3>Environment Variables:</h3>";
echo "MAIL_AUTH: " . env('MAIL_AUTH', 'NOT_SET') . "<br>";
echo "GMAIL_USER: " . env('GMAIL_USER', 'NOT_SET') . "<br>";
echo "GMAIL_APP_PASSWORD: " . (env('GMAIL_APP_PASSWORD', '') ? 'SET' : 'NOT_SET') . "<br>";
echo "MAIL_HOST: " . env('MAIL_HOST', 'NOT_SET') . "<br>";
echo "MAIL_PORT: " . env('MAIL_PORT', 'NOT_SET') . "<br>";
echo "MAIL_ENCRYPTION: " . env('MAIL_ENCRYPTION', 'NOT_SET') . "<br>";

echo "<h3>Testing Mailer:</h3>";
require_once __DIR__ . '/utils/mailer.php';

[$mail, $error] = buildGmailMailer();
if ($mail) {
    echo "✅ Gmail mailer configured successfully!<br>";
} else {
    echo "❌ Gmail mailer failed: " . $error . "<br>";
}
?>
